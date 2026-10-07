//! Zero-Knowledge Cryptographic Engine with Per-Record Crypto-Shredding.
//!
//! Implements:
//! 1. Argon2id key derivation from user PIN/passkey.
//! 2. Per-record AES-256-GCM envelope encryption.
//! 3. Cryptographic deletion (crypto-shredding) via wrapped-key destruction.

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use argon2::{Algorithm, Argon2, Params, Version};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use zeroize::{Zeroize, ZeroizeOnDrop};

use crate::error::StorageError;

/// 256-bit Master Key derived via Argon2id.
/// Wrapped in ZeroizeOnDrop to guarantee zeroization from memory upon deallocation.
#[derive(Clone, Zeroize, ZeroizeOnDrop)]
pub struct MasterVaultKey {
    key_bytes: [u8; 32],
}

impl MasterVaultKey {
    pub fn from_bytes(bytes: [u8; 32]) -> Self {
        Self { key_bytes: bytes }
    }

    pub fn as_bytes(&self) -> &[u8; 32] {
        &self.key_bytes
    }
}

/// Container for an envelope-encrypted record stored in SQLCipher.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EnvelopeEncryptedRecord {
    /// AES-256-GCM ciphertext + authentication tag
    pub ciphertext: Vec<u8>,
    /// 96-bit nonce used to encrypt ciphertext
    pub nonce: [u8; 12],
    /// AES-256-GCM wrapped ephemeral record key
    pub wrapped_record_key: Vec<u8>,
    /// 96-bit nonce used to wrap the record key
    pub wrapped_key_nonce: [u8; 12],
}

/// Derives a 256-bit MasterVaultKey from a user PIN and salt using Argon2id.
pub fn derive_master_key(pin: &str, salt: &[u8]) -> Result<MasterVaultKey, StorageError> {
    if salt.len() < 8 {
        return Err(StorageError::KeyDerivationFailed(
            "Salt must be at least 8 bytes".to_string(),
        ));
    }

    let params = Params::new(65536, 3, 1, Some(32))
        .map_err(|e| StorageError::KeyDerivationFailed(e.to_string()))?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);

    let mut key_output = [0u8; 32];
    argon2
        .hash_password_into(pin.as_bytes(), salt, &mut key_output)
        .map_err(|e| StorageError::KeyDerivationFailed(e.to_string()))?;

    Ok(MasterVaultKey::from_bytes(key_output))
}

/// Encrypts plaintext data using an ephemeral record key wrapped by the master vault key.
///
/// Steps:
/// 1. Generate random 256-bit `record_key`.
/// 2. Generate random 96-bit `nonce` and encrypt plaintext with AES-256-GCM.
/// 3. Generate random 96-bit `wrapped_key_nonce` and encrypt `record_key` with `master_key`.
/// 4. Zeroize ephemeral `record_key` from RAM.
pub fn encrypt_record(
    master_key: &MasterVaultKey,
    plaintext: &[u8],
) -> Result<EnvelopeEncryptedRecord, StorageError> {
    let mut rng = rand::thread_rng();

    // 1. Generate ephemeral 256-bit record key
    let mut record_key = [0u8; 32];
    rng.fill_bytes(&mut record_key);

    // 2. Encrypt plaintext body with record_key
    let mut body_nonce = [0u8; 12];
    rng.fill_bytes(&mut body_nonce);

    let body_cipher = Aes256Gcm::new_from_slice(&record_key)
        .map_err(|e| StorageError::EncryptionFailed(e.to_string()))?;
    let body_nonce_ref = Nonce::from_slice(&body_nonce);

    let ciphertext = body_cipher
        .encrypt(body_nonce_ref, plaintext)
        .map_err(|e| StorageError::EncryptionFailed(e.to_string()))?;

    // 3. Wrap record_key using master_key
    let mut wrap_nonce = [0u8; 12];
    rng.fill_bytes(&mut wrap_nonce);

    let master_cipher = Aes256Gcm::new_from_slice(master_key.as_bytes())
        .map_err(|e| StorageError::EncryptionFailed(e.to_string()))?;
    let wrap_nonce_ref = Nonce::from_slice(&wrap_nonce);

    let wrapped_record_key = master_cipher
        .encrypt(wrap_nonce_ref, record_key.as_ref())
        .map_err(|e| StorageError::EncryptionFailed(e.to_string()))?;

    // 4. Zeroize ephemeral record_key
    record_key.zeroize();

    Ok(EnvelopeEncryptedRecord {
        ciphertext,
        nonce: body_nonce,
        wrapped_record_key,
        wrapped_key_nonce: wrap_nonce,
    })
}

/// Decrypts an envelope-encrypted record using the master vault key.
///
/// Steps:
/// 1. Unwrap ephemeral `record_key` from `wrapped_record_key` using `master_key`.
/// 2. Decrypt `ciphertext` using unwrapped `record_key`.
/// 3. Zeroize unwrapped `record_key` from RAM.
pub fn decrypt_record(
    master_key: &MasterVaultKey,
    record: &EnvelopeEncryptedRecord,
) -> Result<Vec<u8>, StorageError> {
    // Check if the wrapped key is zeroized (already shredded)
    if record.wrapped_record_key.is_empty()
        || record.wrapped_record_key.iter().all(|&b| b == 0)
    {
        return Err(StorageError::RecordShredded(
            "Wrapped key is zeroized".to_string(),
        ));
    }

    // 1. Unwrap ephemeral record_key
    let master_cipher = Aes256Gcm::new_from_slice(master_key.as_bytes())
        .map_err(|e| StorageError::DecryptionFailed(e.to_string()))?;
    let wrap_nonce_ref = Nonce::from_slice(&record.wrapped_key_nonce);

    let mut record_key_vec = master_cipher
        .decrypt(wrap_nonce_ref, record.wrapped_record_key.as_ref())
        .map_err(|_| {
            StorageError::DecryptionFailed(
                "Failed to unwrap record key: key corrupted or shredded".to_string(),
            )
        })?;

    // 2. Decrypt ciphertext using record_key
    let body_cipher = Aes256Gcm::new_from_slice(&record_key_vec)
        .map_err(|e| StorageError::DecryptionFailed(e.to_string()))?;
    let body_nonce_ref = Nonce::from_slice(&record.nonce);

    let plaintext = body_cipher
        .decrypt(body_nonce_ref, record.ciphertext.as_ref())
        .map_err(|_| {
            StorageError::DecryptionFailed(
                "Failed to decrypt body: ciphertext corrupted".to_string(),
            )
        })?;

    // 3. Zeroize ephemeral key vector
    record_key_vec.zeroize();

    Ok(plaintext)
}

/// Securely zeroes out a wrapped key buffer in-place (crypto-shredding).
pub fn shred_wrapped_key(wrapped_key: &mut [u8]) {
    wrapped_key.zeroize();
}
