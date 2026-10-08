//! Headless Vertical Slice CLI Test Harness for Project Haven.
//!
//! Executes a complete, end-to-end 10-minute 7-phase offline coaching session:
//! Contract -> CheckIn -> Focus -> Explore -> Options -> Commit -> Close.
//!
//! Validates:
//! 1. haven-core: Deterministic state machine, gating, action shrinkage.
//! 2. haven-storage: Argon2id derivation, envelope encryption, crypto-shredding, SQLite persistence.
//! 3. haven-guardian: Pre-inference crisis filter, post-inference JSON audit.
//! 4. haven-infer: Offline simulated coaching backend and prompt slot assembly.
//! 5. haven-policy: Thompson sampling contextual bandit with Beta posterior updates.

use std::sync::Arc;
use haven_core::error::StateMachineError;
use haven_core::state_machine::{CoachingMode, CoachingPhase};
use haven_infer::backend::SimulatedCoachingBackend;
use haven_infer::orchestrator::{CoachingOrchestrator, OrchestratorTurnResult};
use haven_storage::crypto::derive_master_key;
use haven_storage::storage::{HavenStorage, MemoryKind};

#[test]
fn test_vertical_slice_full_offline_coaching_session() {
    println!("\n=======================================================");
    println!(" PROJECT HAVEN: HEADLESS VERTICAL SLICE PROTOTYPE");
    println!(" Offline End-to-End 7-Phase Coaching Session Simulation");
    println!("=======================================================\n");

    // --- STEP 0: INITIALIZE CRYPTOGRAPHIC VAULT ---
    let master_key = derive_master_key("889900", b"vertical_slice_salt_12345")
        .expect("Argon2id key derivation failed");
    let storage = Arc::new(HavenStorage::open_in_memory(master_key).expect("Vault failed to open"));

    // Pre-populate living semantic profile in storage
    let profile_id = storage
        .insert_memory(
            MemoryKind::Semantic,
            "Values: Deep autonomy, environmental impact, creative problem solving.",
            1.5,
        )
        .expect("Failed to seed semantic profile");
    assert!(!profile_id.is_nil());

    let backend = Arc::new(SimulatedCoachingBackend::new());
    let mut orchestrator = CoachingOrchestrator::new(
        CoachingMode::Explore,
        "UK",
        storage.clone(),
        backend.clone(),
    )
    .expect("Failed to initialize orchestrator");

    // --- STEP 1: CONTRACT PHASE ---
    println!("[PHASE 1: CONTRACT]");
    let client_input_1 = "I need clarity on transitioning from corporate finance into climate technology.";
    let result_1 = orchestrator.process_turn(client_input_1).expect("Turn 1 failed");

    match result_1 {
        OrchestratorTurnResult::CoachingReply { phase, payload, .. } => {
            assert_eq!(phase, CoachingPhase::Contract);
            assert!(payload.reflection_present);
            assert!(!payload.advice_given);
            println!("  Client: {}", client_input_1);
            println!("  Haven:  {}", payload.full_reply);
        }
        _ => panic!("Expected coaching reply"),
    }

    orchestrator
        .set_contract("Clarify transition from corporate finance into climate tech")
        .expect("Failed to agree contract");
    assert_eq!(orchestrator.state_machine.current_phase, CoachingPhase::CheckIn);

    // --- STEP 2: CHECK-IN PHASE ---
    println!("\n[PHASE 2: CHECK-IN]");
    let client_input_2 = "My energy is at a 6/10 today. A bit exhausted from spreadsheets, but ready to think.";
    let result_2 = orchestrator.process_turn(client_input_2).expect("Turn 2 failed");

    match result_2 {
        OrchestratorTurnResult::CoachingReply { phase, payload, .. } => {
            assert_eq!(phase, CoachingPhase::CheckIn);
            println!("  Client: {}", client_input_2);
            println!("  Haven:  {}", payload.full_reply);
        }
        _ => panic!("Expected coaching reply"),
    }

    orchestrator.complete_check_in(false).expect("Failed to complete check-in");
    assert_eq!(orchestrator.state_machine.current_phase, CoachingPhase::Focus);

    // --- STEP 3: FOCUS PHASE ---
    println!("\n[PHASE 3: FOCUS]");
    let client_input_3 = "The core thing alive right now is the fear of leaving a guaranteed salary.";
    let result_3 = orchestrator.process_turn(client_input_3).expect("Turn 3 failed");

    match result_3 {
        OrchestratorTurnResult::CoachingReply { phase, payload, .. } => {
            assert_eq!(phase, CoachingPhase::Focus);
            println!("  Client: {}", client_input_3);
            println!("  Haven:  {}", payload.full_reply);
        }
        _ => panic!("Expected coaching reply"),
    }

    orchestrator
        .set_focus_topic("Overcoming fear of leaving a stable salary")
        .expect("Failed to confirm focus topic");
    assert_eq!(orchestrator.state_machine.current_phase, CoachingPhase::Explore);

    // --- STEP 4: EXPLORE PHASE (REALITY & VALUES) ---
    println!("\n[PHASE 4: EXPLORE]");
    let client_input_4 = "If I stay another year, I know I will feel spiritually empty. But risk terrifies me.";
    let result_4 = orchestrator.process_turn(client_input_4).expect("Turn 4 failed");

    match result_4 {
        OrchestratorTurnResult::CoachingReply { phase, payload, .. } => {
            assert_eq!(phase, CoachingPhase::Explore);
            // Strict ICF Advice Gate check: Advice MUST NOT be present in Explore
            assert!(!payload.advice_given);
            assert!(!orchestrator.state_machine.advice_gate_unlocked);
            println!("  Client: {}", client_input_4);
            println!("  Haven:  {}", payload.full_reply);
        }
        _ => panic!("Expected coaching reply"),
    }

    orchestrator.advance_to_options().expect("Failed to advance to Options");
    assert_eq!(orchestrator.state_machine.current_phase, CoachingPhase::Options);

    // --- STEP 5: OPTIONS PHASE (BRAINSTORMING & ADVICE GATE) ---
    println!("\n[PHASE 5: OPTIONS]");
    let client_input_5 = "I could build an 8-month financial buffer, or take a climate fellowship part-time.";
    let result_5 = orchestrator.process_turn(client_input_5).expect("Turn 5 failed");

    match result_5 {
        OrchestratorTurnResult::CoachingReply { phase, payload, .. } => {
            assert_eq!(phase, CoachingPhase::Options);
            println!("  Client: {}", client_input_5);
            println!("  Haven:  {}", payload.full_reply);
        }
        _ => panic!("Expected coaching reply"),
    }

    // Client explicitly invites ideas: Advice Gate unlocks
    orchestrator
        .unlock_advice_by_user_request()
        .expect("Failed to unlock advice gate");
    assert!(orchestrator.state_machine.advice_gate_unlocked);

    let client_input_5b = "What other pathways might I consider?";
    let result_5b = orchestrator.process_turn(client_input_5b).expect("Turn 5b failed");

    match result_5b {
        OrchestratorTurnResult::CoachingReply { payload, .. } => {
            assert!(payload.advice_given);
            println!("  Client (Advice Requested): {}", client_input_5b);
            println!("  Haven (2-3 Options):       {}", payload.full_reply);
        }
        _ => panic!("Expected coaching reply"),
    }

    orchestrator.advance_to_commit().expect("Failed to advance to Commit");
    assert_eq!(orchestrator.state_machine.current_phase, CoachingPhase::Commit);

    // --- STEP 6: COMMIT PHASE (CONFIDENCE GATING & ACTION SHRINKAGE) ---
    println!("\n[PHASE 6: COMMIT]");
    let ambitious_action = "Apply to 20 climate tech startups this weekend and revamp my entire LinkedIn.";
    orchestrator
        .propose_action(ambitious_action, 5)
        .expect("Failed to propose action");

    // Verify Confidence Gating: Score < 8 hard-blocks advancement to Close
    let gate_err = orchestrator.advance_to_close().unwrap_err();
    assert_eq!(
        gate_err,
        StateMachineError::ConfidenceTooLowForCommitment { confidence: 5 }
    );
    println!("  -> Enforced Action Confidence Gate: Score 5/10 rejected.");

    // Action Shrinkage: Resize to manageable micro-step with confidence 9/10
    let shrunken_action = "Reach out to 1 alumnus working in climate tech for a 15-minute coffee chat.";
    orchestrator
        .shrink_action(shrunken_action, 9)
        .expect("Failed to shrink action");

    orchestrator.advance_to_close().expect("Advance to close failed after action shrinkage");
    assert_eq!(orchestrator.state_machine.current_phase, CoachingPhase::Close);
    println!("  -> Action Shrunk & Accepted: '{}' (Confidence: 9/10)", shrunken_action);

    // --- STEP 7: CLOSE PHASE (CONSOLIDATION & BANDIT REWARD) ---
    println!("\n[PHASE 7: CLOSE]");
    let client_input_7 = "I feel like a huge burden lifted. Having a single realistic step gave me momentum.";
    let result_7 = orchestrator.process_turn(client_input_7).expect("Turn 7 failed");

    match result_7 {
        OrchestratorTurnResult::CoachingReply { phase, payload, .. } => {
            assert_eq!(phase, CoachingPhase::Close);
            println!("  Client: {}", client_input_7);
            println!("  Haven:  {}", payload.full_reply);
        }
        _ => panic!("Expected coaching reply"),
    }

    let summary = orchestrator
        .finalize_session(5, Some("Client achieved emotional clarity and committed to 1 coffee chat.".into()))
        .expect("Failed to finalize session");

    println!("\n=======================================================");
    println!(" SESSION COMPLETED & VALIDATED");
    println!(" Checkout Score: {}/5", summary.checkout_score);
    println!(" Session ID:     {}", summary.session_id);
    println!("=======================================================\n");

    // --- POST-SESSION VALIDATION OF PERSISTENCE & BANDIT ---
    // 1. Verify session saved in SQLite
    let actions = storage
        .get_actions_for_session(summary.session_id)
        .expect("Failed to load actions from storage");
    assert_eq!(actions.len(), 1);
    assert_eq!(actions[0].text, shrunken_action);
    assert_eq!(actions[0].confidence, 9);

    // 2. Verify episodic memories were persisted with envelope encryption
    let memories = storage
        .list_memories(Some(MemoryKind::Episodic))
        .expect("Failed to list episodic memories");
    assert!(!memories.is_empty(), "Episodic turn memories must be stored");

    // 3. Verify Thompson Bandit posterior updated
    let active_tech = orchestrator.active_technique;
    let loaded_stats = storage
        .load_technique_stats()
        .expect("Failed to load bandit stats");
    let tech_stat = loaded_stats
        .iter()
        .find(|s| s.technique == active_tech && s.mode == CoachingMode::Explore)
        .expect("Technique stat must exist in storage");
    assert_eq!(
        tech_stat.alpha, 2.0,
        "Technique alpha must be updated from 1.0 to 2.0 after checkout score 5"
    );

    // 4. Verify Crypto-Shredding of episodic record
    let mem_id = memories[0].id;
    storage.crypto_shred_memory(mem_id).expect("Crypto-shredding failed");
    assert!(
        storage.get_memory(mem_id).is_err(),
        "Shredded memory must be permanently undecipherable"
    );
}

#[test]
fn test_orchestrator_self_healing_retry_loop_on_audit_violation() {
    let master_key = derive_master_key("111222", b"fault_injection_salt").unwrap();
    let storage = Arc::new(HavenStorage::open_in_memory(master_key).unwrap());
    let backend = Arc::new(SimulatedCoachingBackend::new());

    // Inject 1 transient fault (unsolicited advice violation)
    backend.inject_faults(1);

    let mut orchestrator = CoachingOrchestrator::new(
        CoachingMode::Explore,
        "US",
        storage,
        backend,
    )
    .unwrap();

    // Orchestrator should detect violation on attempt 1, re-prompt with corrective instructions,
    // and successfully return a compliant reply on attempt 2!
    let turn = orchestrator.process_turn("I am trying to decide what to do.").unwrap();
    match turn {
        OrchestratorTurnResult::CoachingReply { payload, .. } => {
            assert!(payload.reflection_present);
            assert!(!payload.advice_given);
        }
        _ => panic!("Expected valid coaching reply after self-healing retry"),
    }
}
