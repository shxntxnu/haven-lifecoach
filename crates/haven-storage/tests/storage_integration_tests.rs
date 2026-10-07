//! Comprehensive integration tests for HavenStorage database persistence,
//! tripartite memory, crypto-shredding, and bandit synchronization.

use std::fs;
use chrono::Utc;
use uuid::Uuid;

use haven_core::policy::{CoachingTechnique, ThompsonBandit};
use haven_core::state_machine::{
    ActionCommitment, CoachingMode, SessionSummary,
};
use haven_storage::crypto::derive_master_key;
use haven_storage::storage::{HavenStorage, MemoryKind};
use haven_storage::error::StorageError;

#[test]
fn test_haven_storage_memory_crud_and_crypto_shredding() {
    let master_key = derive_master_key("445566", b"integration_test_salt_1").unwrap();
    let storage = HavenStorage::open_in_memory(master_key).unwrap();

    // 1. Insert episodic memory
    let episodic_id = storage
        .insert_memory(
            MemoryKind::Episodic,
            "Session 1: Identified friction with current career path.",
            1.0,
        )
        .unwrap();

    // 2. Insert semantic memory
    let semantic_id = storage
        .insert_memory(
            MemoryKind::Semantic,
            "Values: Autonomy, creative depth, psychological safety.",
            1.5,
        )
        .unwrap();

    // 3. Retrieve and verify decryption
    let episodic_item = storage.get_memory(episodic_id).unwrap();
    assert_eq!(episodic_item.kind, MemoryKind::Episodic);
    assert_eq!(
        episodic_item.body,
        "Session 1: Identified friction with current career path."
    );

    let semantic_item = storage.get_memory(semantic_id).unwrap();
    assert_eq!(semantic_item.kind, MemoryKind::Semantic);
    assert_eq!(
        semantic_item.body,
        "Values: Autonomy, creative depth, psychological safety."
    );

    // 4. List memories
    let all_memories = storage.list_memories(None).unwrap();
    assert_eq!(all_memories.len(), 2);

    let episodic_only = storage.list_memories(Some(MemoryKind::Episodic)).unwrap();
    assert_eq!(episodic_only.len(), 1);
    assert_eq!(episodic_only[0].id, episodic_id);

    // 5. Crypto-shred episodic memory
    storage.crypto_shred_memory(episodic_id).unwrap();

    // 6. Direct retrieval must now fail with RecordShredded
    let shred_err = storage.get_memory(episodic_id).unwrap_err();
    assert!(matches!(shred_err, StorageError::RecordShredded(_)));

    // 7. Active list must now only contain the unshredded semantic memory
    let remaining = storage.list_memories(None).unwrap();
    assert_eq!(remaining.len(), 1);
    assert_eq!(remaining[0].id, semantic_id);
}

#[test]
fn test_haven_storage_session_and_actions() {
    let master_key = derive_master_key("112233", b"integration_test_salt_2").unwrap();
    let storage = HavenStorage::open_in_memory(master_key).unwrap();

    let session_id = Uuid::new_v4();
    let action_id = Uuid::new_v4();

    let summary = SessionSummary {
        session_id,
        mode: CoachingMode::Build,
        contract: "Build a dependable evening wind-down routine".to_string(),
        focus_topic: "Screen curfew at 10 PM".to_string(),
        action: Some(ActionCommitment {
            id: action_id,
            text: "Put phone in kitchen dock at 10 PM tonight".to_string(),
            confidence: 9,
            created_at: Utc::now(),
            was_shrunk: false,
        }),
        checkout_score: 5,
        started_at: Utc::now(),
        completed_at: Utc::now(),
        summary_text: Some("Client developed clear actionable boundary".to_string()),
    };

    storage.save_session(&summary).unwrap();

    let actions = storage.get_actions_for_session(session_id).unwrap();
    assert_eq!(actions.len(), 1);
    assert_eq!(actions[0].id, action_id);
    assert_eq!(actions[0].text, "Put phone in kitchen dock at 10 PM tonight");
    assert_eq!(actions[0].confidence, 9);
}

#[test]
fn test_haven_storage_technique_stats_sync_with_bandit() {
    let master_key = derive_master_key("778899", b"integration_test_salt_3").unwrap();
    let storage = HavenStorage::open_in_memory(master_key).unwrap();

    // 1. Initialize and train bandit
    let mut bandit = ThompsonBandit::new();
    bandit.record_feedback(CoachingMode::Perform, CoachingTechnique::StrengthsReframing, true);
    bandit.record_feedback(CoachingMode::Perform, CoachingTechnique::StrengthsReframing, true);
    bandit.record_feedback(CoachingMode::Perform, CoachingTechnique::ScalingInquiry, false);
    bandit.set_veto(CoachingMode::Perform, CoachingTechnique::GroundingBreath, true);

    // 2. Persist to storage
    let stats = bandit.to_stats();
    storage.save_technique_stats(&stats).unwrap();

    // 3. Reload from storage
    let loaded_stats = storage.load_technique_stats().unwrap();
    assert!(!loaded_stats.is_empty());

    // 4. Restore new bandit instance
    let restored_bandit = ThompsonBandit::from_stats(loaded_stats);
    let s_reframing = restored_bandit
        .get_stats(CoachingMode::Perform, CoachingTechnique::StrengthsReframing)
        .unwrap();
    assert_eq!(s_reframing.alpha, 3.0);
    assert_eq!(s_reframing.beta, 1.0);

    let s_grounding = restored_bandit
        .get_stats(CoachingMode::Perform, CoachingTechnique::GroundingBreath)
        .unwrap();
    assert!(s_grounding.vetoed);
}

#[test]
fn test_panic_wipe_scrambles_file_header() {
    let temp_db_path = std::env::temp_dir().join(format!("haven_panic_test_{}.db", Uuid::new_v4()));
    let master_key = derive_master_key("999999", b"panic_wipe_salt_123456").unwrap();

    let mut storage = HavenStorage::open_at_path(&temp_db_path, master_key).unwrap();
    storage
        .insert_memory(
            MemoryKind::Episodic,
            "Very sensitive data to wipe",
            1.0,
        )
        .unwrap();

    // Read original bytes
    let original_bytes = fs::read(&temp_db_path).unwrap();
    assert!(!original_bytes.is_empty());

    // Trigger panic wipe
    storage.panic_wipe().unwrap();

    // Read wiped bytes
    let wiped_bytes = fs::read(&temp_db_path).unwrap();
    assert_ne!(
        original_bytes[..100],
        wiped_bytes[..100],
        "Database header was not scrambled by panic wipe!"
    );

    let _ = fs::remove_file(&temp_db_path);
}
