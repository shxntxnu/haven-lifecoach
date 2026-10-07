//! haven-core: Core domain logic, state machine, safety guardian, and contextual bandit.
//!
//! Enforces zero-knowledge, deterministic conversation flow,
//! and International Coaching Federation (ICF) boundaries.

pub mod crisis;
pub mod error;
pub mod guardian;
pub mod policy;
pub mod state_machine;

pub use crisis::{get_crisis_pack, CrisisPack, EmergencyResource};
pub use error::{AuditViolation, HavenError, StateMachineError};
pub use guardian::{CoachingTurnPayload, Guardian, PreScanResult, RiskTier};
pub use policy::{CoachingTechnique, TechniqueStats, ThompsonBandit};
pub use state_machine::{
    ActionCommitment, CoachingMode, CoachingPhase, PhaseTransitionRecord, SessionStateMachine,
    SessionSummary,
};
