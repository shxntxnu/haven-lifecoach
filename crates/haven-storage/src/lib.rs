//! haven-storage: Zero-knowledge cryptographic persistence engine.
//!
//! Provides relational persistence, Argon2id key derivation,
//! per-record wrapped key crypto-shredding, and panic-wipe protection.

pub mod crypto;
pub mod error;
pub mod schema;
pub mod storage;

pub use crypto::{
    decrypt_record, derive_master_key, encrypt_record, shred_wrapped_key,
    EnvelopeEncryptedRecord, MasterVaultKey,
};
pub use error::StorageError;
pub use storage::{HavenStorage, MemoryItem, MemoryKind};

pub fn storage_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}
