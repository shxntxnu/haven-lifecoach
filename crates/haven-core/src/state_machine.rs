//! Deterministic 7-phase coaching state machine for Project Haven.
//!
//! Enforces International Coaching Federation (ICF) and Motivational Interviewing (OARS)
//! standards via compile-time and runtime state transitions:
//! Contract -> CheckIn -> Focus -> Explore -> Options -> Commit -> Close.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::StateMachineError;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum CoachingPhase {
    Contract,
    CheckIn,
    Focus,
    Explore,
    Options,
    Commit,
    Close,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum CoachingMode {
    Steady,
    Explore,
    Build,
    Perform,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ActionCommitment {
    pub id: Uuid,
    pub text: String,
    pub confidence: u8,
    pub created_at: DateTime<Utc>,
    pub was_shrunk: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PhaseTransitionRecord {
    pub from: CoachingPhase,
    pub to: CoachingPhase,
    pub timestamp: DateTime<Utc>,
    pub reason: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SessionSummary {
    pub session_id: Uuid,
    pub mode: CoachingMode,
    pub contract: String,
    pub focus_topic: String,
    pub action: Option<ActionCommitment>,
    pub checkout_score: u8,
    pub started_at: DateTime<Utc>,
    pub completed_at: DateTime<Utc>,
    pub summary_text: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionStateMachine {
    pub session_id: Uuid,
    pub current_phase: CoachingPhase,
    pub mode: CoachingMode,
    pub contract: Option<String>,
    pub focus_topic: Option<String>,
    pub action: Option<ActionCommitment>,
    pub checkout_score: Option<u8>,
    pub advice_gate_unlocked: bool,
    pub started_at: DateTime<Utc>,
    pub is_closed: bool,
    pub history: Vec<PhaseTransitionRecord>,
}

impl SessionStateMachine {
    /// Initialize a new coaching session in Contract phase.
    pub fn new(mode: CoachingMode) -> Self {
        Self {
            session_id: Uuid::new_v4(),
            current_phase: CoachingPhase::Contract,
            mode,
            contract: None,
            focus_topic: None,
            action: None,
            checkout_score: None,
            advice_gate_unlocked: false,
            started_at: Utc::now(),
            is_closed: false,
            history: Vec::new(),
        }
    }

    /// Set the session contract (target/outcome user desires from this session).
    pub fn set_contract(&mut self, contract_text: impl Into<String>) -> Result<(), StateMachineError> {
        self.ensure_not_closed()?;
        if self.current_phase != CoachingPhase::Contract {
            return Err(StateMachineError::InvalidTransition {
                from: format!("{:?}", self.current_phase),
                to: "Contract".to_string(),
                reason: "Cannot set contract outside Contract phase".to_string(),
            });
        }
        let text = contract_text.into().trim().to_string();
        if text.is_empty() {
            return Err(StateMachineError::MissingContract);
        }
        self.contract = Some(text);
        Ok(())
    }

    /// Advance from Contract to CheckIn.
    pub fn advance_to_check_in(&mut self) -> Result<(), StateMachineError> {
        self.ensure_not_closed()?;
        if self.current_phase != CoachingPhase::Contract {
            return Err(StateMachineError::InvalidTransition {
                from: format!("{:?}", self.current_phase),
                to: "CheckIn".to_string(),
                reason: "Must be in Contract phase to advance to CheckIn".to_string(),
            });
        }
        if self.contract.is_none() {
            return Err(StateMachineError::MissingContract);
        }

        self.record_transition(CoachingPhase::CheckIn, "Contract agreed");
        Ok(())
    }

    /// Process CheckIn mood/distress signal.
    /// If heightened distress is detected, automatically clamps mode to Steady.
    pub fn process_check_in(&mut self, distress_detected: bool) -> Result<(), StateMachineError> {
        self.ensure_not_closed()?;
        if self.current_phase != CoachingPhase::CheckIn {
            return Err(StateMachineError::InvalidTransition {
                from: format!("{:?}", self.current_phase),
                to: "CheckIn".to_string(),
                reason: "Not currently in CheckIn phase".to_string(),
            });
        }

        if distress_detected {
            self.mode = CoachingMode::Steady;
        }

        Ok(())
    }

    /// Advance from CheckIn to Focus.
    pub fn advance_to_focus(&mut self) -> Result<(), StateMachineError> {
        self.ensure_not_closed()?;
        if self.current_phase != CoachingPhase::CheckIn {
            return Err(StateMachineError::InvalidTransition {
                from: format!("{:?}", self.current_phase),
                to: "Focus".to_string(),
                reason: "Must be in CheckIn phase to advance to Focus".to_string(),
            });
        }

        self.record_transition(CoachingPhase::Focus, "Check-in completed");
        Ok(())
    }

    /// User sets the specific focus topic for this session.
    /// Haven NEVER dictates the topic.
    pub fn set_focus_topic(&mut self, topic: impl Into<String>) -> Result<(), StateMachineError> {
        self.ensure_not_closed()?;
        if self.current_phase != CoachingPhase::Focus {
            return Err(StateMachineError::InvalidTransition {
                from: format!("{:?}", self.current_phase),
                to: "Focus".to_string(),
                reason: "Cannot set focus topic outside Focus phase".to_string(),
            });
        }
        let text = topic.into().trim().to_string();
        if text.is_empty() {
            return Err(StateMachineError::MissingFocusTopic);
        }
        self.focus_topic = Some(text);
        Ok(())
    }

    /// Advance from Focus to Explore.
    pub fn advance_to_explore(&mut self) -> Result<(), StateMachineError> {
        self.ensure_not_closed()?;
        if self.current_phase != CoachingPhase::Focus {
            return Err(StateMachineError::InvalidTransition {
                from: format!("{:?}", self.current_phase),
                to: "Explore".to_string(),
                reason: "Must be in Focus phase to advance to Explore".to_string(),
            });
        }
        if self.focus_topic.is_none() {
            return Err(StateMachineError::MissingFocusTopic);
        }

        self.advice_gate_unlocked = false;
        self.record_transition(CoachingPhase::Explore, "Focus topic confirmed by user");
        Ok(())
    }

    /// Advance from Explore to Options.
    pub fn advance_to_options(&mut self) -> Result<(), StateMachineError> {
        self.ensure_not_closed()?;
        if self.current_phase != CoachingPhase::Explore {
            return Err(StateMachineError::InvalidTransition {
                from: format!("{:?}", self.current_phase),
                to: "Options".to_string(),
                reason: "Must be in Explore phase to advance to Options".to_string(),
            });
        }

        self.advice_gate_unlocked = false; // Remains locked until explicit user request
        self.record_transition(CoachingPhase::Options, "Exploration completed");
        Ok(())
    }

    /// Explicitly unlock advice gate in Options phase upon user request.
    pub fn unlock_advice_by_user_request(&mut self) -> Result<(), StateMachineError> {
        self.ensure_not_closed()?;
        if self.current_phase != CoachingPhase::Options {
            return Err(StateMachineError::AdviceLocked(format!("{:?}", self.current_phase)));
        }
        self.advice_gate_unlocked = true;
        Ok(())
    }

    /// Advance from Options to Commit.
    pub fn advance_to_commit(&mut self) -> Result<(), StateMachineError> {
        self.ensure_not_closed()?;
        if self.current_phase != CoachingPhase::Options {
            return Err(StateMachineError::InvalidTransition {
                from: format!("{:?}", self.current_phase),
                to: "Commit".to_string(),
                reason: "Must be in Options phase to advance to Commit".to_string(),
            });
        }

        self.advice_gate_unlocked = false;
        self.record_transition(CoachingPhase::Commit, "Options evaluated");
        Ok(())
    }

    /// Propose a client-owned action with confidence rating (0..=10).
    pub fn propose_action(&mut self, text: impl Into<String>, confidence: u8) -> Result<(), StateMachineError> {
        self.ensure_not_closed()?;
        if self.current_phase != CoachingPhase::Commit {
            return Err(StateMachineError::InvalidTransition {
                from: format!("{:?}", self.current_phase),
                to: "Commit".to_string(),
                reason: "Actions can only be formulated in Commit phase".to_string(),
            });
        }

        let action_text = text.into().trim().to_string();
        if action_text.is_empty() {
            return Err(StateMachineError::InvalidTransition {
                from: "Commit".to_string(),
                to: "Commit".to_string(),
                reason: "Action text cannot be empty".to_string(),
            });
        }

        let bounded_confidence = confidence.min(10);
        self.action = Some(ActionCommitment {
            id: Uuid::new_v4(),
            text: action_text,
            confidence: bounded_confidence,
            created_at: Utc::now(),
            was_shrunk: false,
        });

        Ok(())
    }

    /// Shrink or simplify action if confidence was < 8.
    pub fn shrink_action(&mut self, revised_text: impl Into<String>, revised_confidence: u8) -> Result<(), StateMachineError> {
        self.ensure_not_closed()?;
        if self.current_phase != CoachingPhase::Commit {
            return Err(StateMachineError::InvalidTransition {
                from: format!("{:?}", self.current_phase),
                to: "Commit".to_string(),
                reason: "Action shrinking only occurs in Commit phase".to_string(),
            });
        }

        let text = revised_text.into().trim().to_string();
        let bounded_confidence = revised_confidence.min(10);

        self.action = Some(ActionCommitment {
            id: Uuid::new_v4(),
            text,
            confidence: bounded_confidence,
            created_at: Utc::now(),
            was_shrunk: true,
        });

        Ok(())
    }

    /// Advance from Commit to Close.
    /// Strictly gates closing: If an action exists and confidence < 8, forces action shrinkage.
    pub fn advance_to_close(&mut self) -> Result<(), StateMachineError> {
        self.ensure_not_closed()?;
        if self.current_phase != CoachingPhase::Commit {
            return Err(StateMachineError::InvalidTransition {
                from: format!("{:?}", self.current_phase),
                to: "Close".to_string(),
                reason: "Must be in Commit phase to advance to Close".to_string(),
            });
        }

        if let Some(ref action) = self.action {
            if action.confidence < 8 {
                return Err(StateMachineError::ConfidenceTooLowForCommitment {
                    confidence: action.confidence,
                });
            }
        }

        self.record_transition(CoachingPhase::Close, "Action commitment verified");
        Ok(())
    }

    /// Complete the session by recording checkout score (1..=5) and extracting summary.
    pub fn complete_session(
        &mut self,
        checkout_score: u8,
        summary_text: Option<String>,
    ) -> Result<SessionSummary, StateMachineError> {
        self.ensure_not_closed()?;
        if self.current_phase != CoachingPhase::Close {
            return Err(StateMachineError::InvalidTransition {
                from: format!("{:?}", self.current_phase),
                to: "Close".to_string(),
                reason: "Must be in Close phase to finalize session".to_string(),
            });
        }

        if !(1..=5).contains(&checkout_score) {
            return Err(StateMachineError::InvalidCheckoutScore(checkout_score));
        }

        self.checkout_score = Some(checkout_score);
        self.is_closed = true;

        Ok(SessionSummary {
            session_id: self.session_id,
            mode: self.mode,
            contract: self.contract.clone().unwrap_or_default(),
            focus_topic: self.focus_topic.clone().unwrap_or_default(),
            action: self.action.clone(),
            checkout_score,
            started_at: self.started_at,
            completed_at: Utc::now(),
            summary_text,
        })
    }

    fn ensure_not_closed(&self) -> Result<(), StateMachineError> {
        if self.is_closed {
            Err(StateMachineError::SessionAlreadyClosed)
        } else {
            Ok(())
        }
    }

    fn record_transition(&mut self, next: CoachingPhase, reason: &str) {
        self.history.push(PhaseTransitionRecord {
            from: self.current_phase,
            to: next,
            timestamp: Utc::now(),
            reason: reason.to_string(),
        });
        self.current_phase = next;
    }
}
