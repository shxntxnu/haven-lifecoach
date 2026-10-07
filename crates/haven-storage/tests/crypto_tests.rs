//! Comprehensive tests for Argon2id key derivation, envelope encryption, and crypto-shredding.

use haven_storage::crypto::{
    decrypt_record, derive_master_key, encrypt_record, shred_wrapped_key,
};

#[test]
fn test_argon2id_master_key_derivation() {
    let pin = "948271";
    let salt = b"haven_unique_user_salt_12345";

    let key1 = derive_master_key(pin, salt).expect("Derivation failed");
    let key2 = derive_master_key(pin, salt).expect("Derivation failed");
    assert_eq!(key1.as_bytes(), key2.as_bytes(), "Same PIN/salt must produce identical key");

    let wrong_pin = "000000";
    let key3 = derive_master_key(wrong_pin, salt).expect("Derivation failed");
    assert_ne!(key1.as_bytes(), key3.as_bytes(), "Different PIN must produce distinct key");

    // Short salt rejection
    assert!(derive_master_key(pin, b"short").is_err());
}

#[test]
fn test_envelope_encryption_roundtrip() {
    let pin = "123456";
    let salt = b"salt_for_encryption_test_123";
    let master_key = derive_master_key(pin, salt).unwrap();

    let secret_thought = "I am terrified that I will fail my upcoming board review.";
    let encrypted = encrypt_record(&master_key, secret_thought.as_bytes()).unwrap();

    // Ciphertext must not contain plaintext substring
    assert!(!encrypted.ciphertext.windows(secret_thought.len()).any(|w| w == secret_thought.as_bytes()));

    // Successful decryption
    let decrypted = decrypt_record(&master_key, &encrypted).unwrap();
    assert_eq!(String::from_utf8(decrypted).unwrap(), secret_thought);

    // Decryption with incorrect master key must fail
    let wrong_key = derive_master_key("654321", salt).unwrap();
    let decrypt_err = decrypt_record(&wrong_key, &encrypted);
    assert!(decrypt_err.is_err());
}

#[test]
fn test_crypto_shredding_renders_ciphertext_unreadable() {
    let pin = "789012";
    let salt = b"salt_for_crypto_shredding_test";
    let master_key = derive_master_key(pin, salt).unwrap();

    let sensitive_disclosure = "Confidential personal coaching notes that must be permanently expunged.";
    let mut encrypted = encrypt_record(&master_key, sensitive_disclosure.as_bytes()).unwrap();

    // Initial check: can be decrypted
    let decrypted_before = decrypt_record(&master_key, &encrypted).unwrap();
    assert_eq!(String::from_utf8(decrypted_before).unwrap(), sensitive_disclosure);

    // TRIGGER CRYPTO-SHREDDING: Zeroize wrapped record key
    shred_wrapped_key(&mut encrypted.wrapped_record_key);

    // Decryption MUST now fail definitively
    let result = decrypt_record(&master_key, &encrypted);
    assert!(
        result.is_err(),
        "Shredded record was unexpectedly decipherable!"
    );

    // Even if an attacker has the master key and the raw ciphertext blob,
    // the ephemeral record key is permanently destroyed.
}
