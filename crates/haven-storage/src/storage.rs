//! HavenStorage: Relational persistence and crypto-shredding coordinator.

use std::fs::OpenOptions;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::str::FromStr;
use std::sync::Mutex;

use chrono::{DateTime, TimeZone, Utc};
use rand::RngCore;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use haven_core::policy::{CoachingTechnique, TechniqueStats};
use haven_core::state_machine::{
    ActionCommitment, CoachingMode, SessionSummary,
};

use crate::crypto::{
    decrypt_record, encrypt_record, EnvelopeEncryptedRecord, MasterVaultKey,
};
use crate::error::StorageError;
use crate::schema::ALL_MIGRATIONS;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MemoryKind {
    Episodic,
    Semantic,
    Procedural,
}

impl MemoryKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            MemoryKind::Episodic => "episodic",
            MemoryKind::Semantic => "semantic",
            MemoryKind::Procedural => "procedural",
        }
    }
}

impl FromStr for MemoryKind {
    type Err = StorageError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "episodic" => Ok(MemoryKind::Episodic),
            "semantic" => Ok(MemoryKind::Semantic),
            "procedural" => Ok(MemoryKind::Procedural),
            other => Err(StorageError::NotFound(format!("Unknown memory kind: {}", other))),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct MemoryItem {
    pub id: Uuid,
    pub kind: MemoryKind,
    pub body: String,
    pub importance: f32,
    pub last_used: DateTime<Utc>,
    pub user_pinned: bool,
    pub user_hidden: bool,
    pub is_shredded: bool,
}

pub struct HavenStorage {
    conn: Mutex<Connection>,
    master_key: MasterVaultKey,
    file_path: Option<PathBuf>,
}

impl HavenStorage {
    /// Opens an in-memory encrypted SQLite database for testing or ephemeral sessions.
    pub fn open_in_memory(master_key: MasterVaultKey) -> Result<Self, StorageError> {
        let conn = Connection::open_in_memory()?;
        let storage = Self {
            conn: Mutex::new(conn),
            master_key,
            file_path: None,
        };
        storage.run_migrations()?;
        Ok(storage)
    }

    /// Opens or creates an encrypted SQLite database at a specific filesystem path.
    pub fn open_at_path(path: impl AsRef<Path>, master_key: MasterVaultKey) -> Result<Self, StorageError> {
        let path_buf = path.as_ref().to_path_buf();
        let conn = Connection::open(&path_buf)?;
        let storage = Self {
            conn: Mutex::new(conn),
            master_key,
            file_path: Some(path_buf),
        };
        storage.run_migrations()?;
        Ok(storage)
    }

    fn run_migrations(&self) -> Result<(), StorageError> {
        let conn = self.conn.lock().unwrap();
        for &migration in ALL_MIGRATIONS {
            conn.execute(migration, [])?;
        }
        Ok(())
    }

    // ==========================================
    // TRIPARTITE MEMORY & CRYPTO-SHREDDING
    // ==========================================

    /// Stores a memory item with envelope encryption (unique AES-256 data key per row).
    pub fn insert_memory(
        &self,
        kind: MemoryKind,
        body: &str,
        importance: f32,
    ) -> Result<Uuid, StorageError> {
        let id = Uuid::new_v4();
        let encrypted = encrypt_record(&self.master_key, body.as_bytes())?;
        let now_timestamp = Utc::now().timestamp();

        let conn = self.conn.lock().unwrap();
        conn.execute(
            r#"
            INSERT INTO memory_items (
                id, kind, body, nonce, record_key_wrapped, wrapped_key_nonce,
                importance, last_used, user_pinned, user_hidden, is_shredded
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 0, 0, 0)
            "#,
            params![
                id.to_string(),
                kind.as_str(),
                encrypted.ciphertext,
                &encrypted.nonce[..],
                encrypted.wrapped_record_key,
                &encrypted.wrapped_key_nonce[..],
                importance,
                now_timestamp,
            ],
        )?;

        Ok(id)
    }

    /// Retrieves and decrypts a memory item using the master key.
    pub fn get_memory(&self, id: Uuid) -> Result<MemoryItem, StorageError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            r#"
            SELECT kind, body, nonce, record_key_wrapped, wrapped_key_nonce,
                   importance, last_used, user_pinned, user_hidden, is_shredded
            FROM memory_items WHERE id = ?1
            "#,
        )?;

        let mut rows = stmt.query(params![id.to_string()])?;
        if let Some(row) = rows.next()? {
            let is_shredded: i32 = row.get(9)?;
            if is_shredded != 0 {
                return Err(StorageError::RecordShredded(id.to_string()));
            }

            let kind_str: String = row.get(0)?;
            let kind = MemoryKind::from_str(&kind_str)?;
            let ciphertext: Vec<u8> = row.get(1)?;
            let nonce_bytes: Vec<u8> = row.get(2)?;
            let wrapped_record_key: Vec<u8> = row.get(3)?;
            let wrapped_key_nonce_bytes: Vec<u8> = row.get(4)?;
            let importance: f32 = row.get(5)?;
            let last_used_ts: i64 = row.get(6)?;
            let user_pinned: i32 = row.get(7)?;
            let user_hidden: i32 = row.get(8)?;

            let mut nonce = [0u8; 12];
            nonce.copy_from_slice(&nonce_bytes);
            let mut wrapped_key_nonce = [0u8; 12];
            wrapped_key_nonce.copy_from_slice(&wrapped_key_nonce_bytes);

            let enc_record = EnvelopeEncryptedRecord {
                ciphertext,
                nonce,
                wrapped_record_key,
                wrapped_key_nonce,
            };

            let decrypted_bytes = decrypt_record(&self.master_key, &enc_record)?;
            let body = String::from_utf8(decrypted_bytes).map_err(|e| {
                StorageError::DecryptionFailed(format!("Invalid UTF-8 in decrypted body: {}", e))
            })?;

            Ok(MemoryItem {
                id,
                kind,
                body,
                importance,
                last_used: Utc.timestamp_opt(last_used_ts, 0).single().unwrap_or_else(Utc::now),
                user_pinned: user_pinned != 0,
                user_hidden: user_hidden != 0,
                is_shredded: false,
            })
        } else {
            Err(StorageError::NotFound(id.to_string()))
        }
    }

    /// Crypto-shreds a memory record by overwriting its wrapped key with zeroes in storage.
    /// After this call, the encrypted body on flash is permanently undecipherable.
    pub fn crypto_shred_memory(&self, id: Uuid) -> Result<(), StorageError> {
        let conn = self.conn.lock().unwrap();
        let zeroized_wrapped_key = vec![0u8; 48]; // 32 bytes key + 16 bytes auth tag

        let affected = conn.execute(
            r#"
            UPDATE memory_items
            SET record_key_wrapped = ?1,
                body = zeroblob(16),
                is_shredded = 1
            WHERE id = ?2
            "#,
            params![zeroized_wrapped_key, id.to_string()],
        )?;

        if affected == 0 {
            Err(StorageError::NotFound(id.to_string()))
        } else {
            Ok(())
        }
    }

    /// Lists all non-shredded memories, optionally filtered by kind.
    pub fn list_memories(&self, kind_filter: Option<MemoryKind>) -> Result<Vec<MemoryItem>, StorageError> {
        let ids: Vec<Uuid> = {
            let conn = self.conn.lock().unwrap();
            if let Some(k) = kind_filter {
                let mut s = conn.prepare("SELECT id FROM memory_items WHERE kind = ?1 AND is_shredded = 0")?;
                let rows = s.query_map(params![k.as_str()], |row| {
                    let id_str: String = row.get(0)?;
                    Ok(Uuid::parse_str(&id_str).unwrap())
                })?;
                rows.filter_map(Result::ok).collect()
            } else {
                let mut s = conn.prepare("SELECT id FROM memory_items WHERE is_shredded = 0")?;
                let rows = s.query_map([], |row| {
                    let id_str: String = row.get(0)?;
                    Ok(Uuid::parse_str(&id_str).unwrap())
                })?;
                rows.filter_map(Result::ok).collect()
            }
        };

        let mut memories = Vec::new();
        for id in ids {
            if let Ok(item) = self.get_memory(id) {
                memories.push(item);
            }
        }

        Ok(memories)
    }

    // ==========================================
    // SESSIONS & ACTIONS
    // ==========================================

    pub fn save_session(&self, summary: &SessionSummary) -> Result<(), StorageError> {
        let conn = self.conn.lock().unwrap();
        let mode_str = match summary.mode {
            CoachingMode::Steady => "Steady",
            CoachingMode::Explore => "Explore",
            CoachingMode::Build => "Build",
            CoachingMode::Perform => "Perform",
        };

        conn.execute(
            r#"
            INSERT OR REPLACE INTO sessions (
                id, started_at, completed_at, mode, contract, summary, checkout_score
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
            "#,
            params![
                summary.session_id.to_string(),
                summary.started_at.timestamp(),
                summary.completed_at.timestamp(),
                mode_str,
                summary.contract,
                summary.summary_text,
                summary.checkout_score,
            ],
        )?;

        if let Some(ref action) = summary.action {
            conn.execute(
                r#"
                INSERT OR REPLACE INTO actions (
                    id, session_id, text, confidence, due_date, status
                ) VALUES (?1, ?2, ?3, ?4, NULL, 'open')
                "#,
                params![
                    action.id.to_string(),
                    summary.session_id.to_string(),
                    action.text,
                    action.confidence,
                ],
            )?;
        }

        Ok(())
    }

    pub fn get_actions_for_session(&self, session_id: Uuid) -> Result<Vec<ActionCommitment>, StorageError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, text, confidence FROM actions WHERE session_id = ?1",
        )?;

        let rows = stmt.query_map(params![session_id.to_string()], |row| {
            let id_str: String = row.get(0)?;
            let text: String = row.get(1)?;
            let confidence: u8 = row.get(2)?;

            Ok(ActionCommitment {
                id: Uuid::parse_str(&id_str).unwrap(),
                text,
                confidence,
                created_at: Utc::now(),
                was_shrunk: false,
            })
        })?;

        let mut actions = Vec::new();
        for a in rows {
            actions.push(a?);
        }
        Ok(actions)
    }

    // ==========================================
    // TECHNIQUE STATS (BANDIT POSTERIOR)
    // ==========================================

    pub fn save_technique_stats(&self, stats: &[TechniqueStats]) -> Result<(), StorageError> {
        let mut conn = self.conn.lock().unwrap();
        let tx = conn.transaction()?;

        for s in stats {
            let mode_str = match s.mode {
                CoachingMode::Steady => "Steady",
                CoachingMode::Explore => "Explore",
                CoachingMode::Build => "Build",
                CoachingMode::Perform => "Perform",
            };
            let tech_str = format!("{:?}", s.technique);
            let vetoed_int = if s.vetoed { 1 } else { 0 };

            tx.execute(
                r#"
                INSERT OR REPLACE INTO technique_stats (
                    mode, technique, alpha, beta, vetoed
                ) VALUES (?1, ?2, ?3, ?4, ?5)
                "#,
                params![mode_str, tech_str, s.alpha, s.beta, vetoed_int],
            )?;
        }

        tx.commit()?;
        Ok(())
    }

    pub fn load_technique_stats(&self) -> Result<Vec<TechniqueStats>, StorageError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT mode, technique, alpha, beta, vetoed FROM technique_stats")?;

        let rows = stmt.query_map([], |row| {
            let mode_str: String = row.get(0)?;
            let tech_str: String = row.get(1)?;
            let alpha: f64 = row.get(2)?;
            let beta: f64 = row.get(3)?;
            let vetoed: i32 = row.get(4)?;

            let mode = match mode_str.as_str() {
                "Steady" => CoachingMode::Steady,
                "Explore" => CoachingMode::Explore,
                "Build" => CoachingMode::Build,
                "Perform" => CoachingMode::Perform,
                _ => CoachingMode::Explore,
            };

            let technique = match tech_str.as_str() {
                "ValuesClarification" => CoachingTechnique::ValuesClarification,
                "ScalingInquiry" => CoachingTechnique::ScalingInquiry,
                "StrengthsReframing" => CoachingTechnique::StrengthsReframing,
                "MicroStepBreakdown" => CoachingTechnique::MicroStepBreakdown,
                "PerspectiveShift" => CoachingTechnique::PerspectiveShift,
                "ExceptionSeeking" => CoachingTechnique::ExceptionSeeking,
                "GroundingBreath" => CoachingTechnique::GroundingBreath,
                _ => CoachingTechnique::ValuesClarification,
            };

            Ok(TechniqueStats {
                mode,
                technique,
                alpha,
                beta,
                vetoed: vetoed != 0,
            })
        })?;

        let mut result = Vec::new();
        for r in rows {
            result.push(r?);
        }

        Ok(result)
    }

    // ==========================================
    // STEALTH SUITE: PANIC-WIPE
    // ==========================================

    /// Single-gesture panic-wipe: Zeroizes master key and overwrites DB file header within 1000ms.
    pub fn panic_wipe(&mut self) -> Result<(), StorageError> {
        // Zeroize master key in memory
        self.master_key = MasterVaultKey::from_bytes([0u8; 32]);

        if let Some(ref path) = self.file_path {
            if path.exists() {
                let mut random_bytes = [0u8; 4096];
                rand::thread_rng().fill_bytes(&mut random_bytes);

                let mut file = OpenOptions::new()
                    .write(true)
                    .open(path)
                    .map_err(|e| StorageError::PanicWipeFailed(e.to_string()))?;

                file.write_all(&random_bytes)
                    .map_err(|e| StorageError::PanicWipeFailed(e.to_string()))?;
                file.flush()
                    .map_err(|e| StorageError::PanicWipeFailed(e.to_string()))?;
            }
        }

        Ok(())
    }
}
