//! Comprehensive state machine tests for haven-core.

use haven_core::error::StateMachineError;
use haven_core::state_machine::{CoachingMode, CoachingPhase, SessionStateMachine};

#[test]
fn test_full_successful_coaching_session_flow() {
    let mut session = SessionStateMachine::new(CoachingMode::Explore);
    assert_eq!(session.current_phase, CoachingPhase::Contract);
    assert!(!session.is_closed);

    // 1. Contract
    assert!(session.advance_to_check_in().is_err()); // Cannot advance without contract text
    session.set_contract("Gain clarity on career transition to climate tech").unwrap();
    session.advance_to_check_in().unwrap();
    assert_eq!(session.current_phase, CoachingPhase::CheckIn);

    // 2. CheckIn (normal, no distress)
    session.process_check_in(false).unwrap();
    assert_eq!(session.mode, CoachingMode::Explore);
    session.advance_to_focus().unwrap();
    assert_eq!(session.current_phase, CoachingPhase::Focus);

    // 3. Focus
    assert!(session.advance_to_explore().is_err()); // Cannot advance without user topic
    session.set_focus_topic("Overcoming fear of leaving my current salary").unwrap();
    session.advance_to_explore().unwrap();
    assert_eq!(session.current_phase, CoachingPhase::Explore);

    // 4. Explore
    assert!(!session.advice_gate_unlocked);
    session.advance_to_options().unwrap();
    assert_eq!(session.current_phase, CoachingPhase::Options);

    // 5. Options
    assert!(!session.advice_gate_unlocked);
    session.unlock_advice_by_user_request().unwrap();
    assert!(session.advice_gate_unlocked);
    session.advance_to_commit().unwrap();
    assert_eq!(session.current_phase, CoachingPhase::Commit);

    // 6. Commit - Form action
    assert!(!session.advice_gate_unlocked); // Locked again in Commit
    session.propose_action("Talk to one friend in climate tech this week", 9).unwrap();
    session.advance_to_close().unwrap();
    assert_eq!(session.current_phase, CoachingPhase::Close);

    // 7. Close - Final checkout
    let summary = session.complete_session(5, Some("Client identified strong motivation".into())).unwrap();
    assert_eq!(summary.checkout_score, 5);
    assert_eq!(summary.contract, "Gain clarity on career transition to climate tech");
    assert_eq!(summary.focus_topic, "Overcoming fear of leaving my current salary");
    assert!(session.is_closed);

    // Post-close mutations must fail
    assert_eq!(
        session.set_contract("New contract"),
        Err(StateMachineError::SessionAlreadyClosed)
    );
}

#[test]
fn test_check_in_distress_clamps_mode_to_steady() {
    let mut session = SessionStateMachine::new(CoachingMode::Perform);
    session.set_contract("High stakes presentation prep").unwrap();
    session.advance_to_check_in().unwrap();

    // Signal heightened distress
    session.process_check_in(true).unwrap();
    assert_eq!(session.mode, CoachingMode::Steady);
}

#[test]
fn test_advice_gate_locked_outside_options() {
    let mut session = SessionStateMachine::new(CoachingMode::Explore);
    session.set_contract("Explore life priorities").unwrap();
    session.advance_to_check_in().unwrap();
    session.process_check_in(false).unwrap();
    session.advance_to_focus().unwrap();
    session.set_focus_topic("Work-life alignment").unwrap();
    session.advance_to_explore().unwrap();

    // Attempting to unlock advice in Explore must fail
    let err = session.unlock_advice_by_user_request().unwrap_err();
    assert_eq!(err, StateMachineError::AdviceLocked("Explore".to_string()));
    assert!(!session.advice_gate_unlocked);
}

#[test]
fn test_commit_confidence_gating_and_action_shrinkage() {
    let mut session = SessionStateMachine::new(CoachingMode::Build);
    session.set_contract("Build morning writing routine").unwrap();
    session.advance_to_check_in().unwrap();
    session.advance_to_focus().unwrap();
    session.set_focus_topic("Finding 30 minutes in the morning").unwrap();
    session.advance_to_explore().unwrap();
    session.advance_to_options().unwrap();
    session.advance_to_commit().unwrap();

    // Propose overly ambitious action with low confidence (6/10)
    session.propose_action("Write for 2 hours every day before 7 AM", 6).unwrap();

    // Advancing to Close MUST be rejected because confidence < 8
    let err = session.advance_to_close().unwrap_err();
    assert_eq!(
        err,
        StateMachineError::ConfidenceTooLowForCommitment { confidence: 6 }
    );
    assert_eq!(session.current_phase, CoachingPhase::Commit);

    // Shrink action to a manageable micro-step with high confidence (9/10)
    session.shrink_action("Write for 10 minutes at my kitchen table", 9).unwrap();

    // Now advancing to Close succeeds!
    assert!(session.advance_to_close().is_ok());
    assert_eq!(session.current_phase, CoachingPhase::Close);

    let action = session.action.as_ref().unwrap();
    assert_eq!(action.text, "Write for 10 minutes at my kitchen table");
    assert_eq!(action.confidence, 9);
    assert!(action.was_shrunk);
}

#[test]
fn test_checkout_score_bounds() {
    let mut session = SessionStateMachine::new(CoachingMode::Steady);
    session.set_contract("Rest and decompression").unwrap();
    session.advance_to_check_in().unwrap();
    session.advance_to_focus().unwrap();
    session.set_focus_topic("Breathing and rest").unwrap();
    session.advance_to_explore().unwrap();
    session.advance_to_options().unwrap();
    session.advance_to_commit().unwrap();
    session.advance_to_close().unwrap();

    // Invalid checkout score 0
    assert_eq!(
        session.complete_session(0, None),
        Err(StateMachineError::InvalidCheckoutScore(0))
    );

    // Invalid checkout score 6
    assert_eq!(
        session.complete_session(6, None),
        Err(StateMachineError::InvalidCheckoutScore(6))
    );

    // Valid score 4
    assert!(session.complete_session(4, None).is_ok());
    assert!(session.is_closed);
}
