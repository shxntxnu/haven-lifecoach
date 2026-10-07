//! Storage and cryptography error definitions.

use thiserror::Error;

#[derive(Error, Debug)]
pub enum StorageError {
    #[error("Cryptographic key derivation failed: {0}")]
    KeyDerivationFailed(String),

    #[error("Encryption failed: {0}")]
    EncryptionFailed(String),

    #[error("Decryption failed (record key corrupted or crypto-shredded): {0}")]
    DecryptionFailed(String),

    #[error("SQLite database error: {0}")]
    DatabaseError(#[from] rusqlite::Error),

    #[error("Record not found: {0}")]
    NotFound(String),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("Memory item with ID {0} has been crypto-shredded")]
    RecordShredded(String),

    #[error("Panic wipe error: {0}")]
    PanicWipeFailed(String),
}
