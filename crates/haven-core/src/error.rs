//! Centralized error definitions for haven-core.

use thiserror::Error;

#[derive(Error, Debug, Clone, PartialEq, Eq)]
pub enum StateMachineError {
    #[error("Invalid state transition from {from:?} to {to:?}: {reason}")]
    InvalidTransition {
        from: String,
        to: String,
        reason: String,
    },

    #[error("Action confidence {confidence}/10 is below the required threshold (8/10). Action must be shrunk or simplified before committing.")]
    ConfidenceTooLowForCommitment { confidence: u8 },

    #[error("Advice gate is locked in phase {0:?}. Advice is only allowed in the Options phase upon explicit user invitation.")]
    AdviceLocked(String),

    #[error("Contract target must be specified before advancing past the Contract phase.")]
    MissingContract,

    #[error("Focus agenda topic must be set by user before advancing to Explore.")]
    MissingFocusTopic,

    #[error("Checkout score must be an integer between 1 and 5 (got {0}).")]
    InvalidCheckoutScore(u8),

    #[error("Session is already completed.")]
    SessionAlreadyClosed,
}

#[derive(Error, Debug, Clone, PartialEq, Eq)]
pub enum AuditViolation {
    #[error("Turn missing empathetic reflection before question.")]
    MissingReflection,

    #[error("Turn contains {0} questions. Exactly at most ONE open-ended question is permitted.")]
    MultipleQuestions(usize),

    #[error("Unsolicited advice detected in phase {0}. Advice can only be generated in Options phase with explicit user consent.")]
    UnsolicitedAdvice(String),

    #[error("Prohibited clinical diagnostic language detected: {0}")]
    DiagnosticLanguage(String),

    #[error("Prohibited dependency-forming or parasocial language detected: {0}")]
    DependencyLanguage(String),

    #[error("Failed to parse model JSON output: {0}")]
    MalformedJson(String),
}

#[derive(Error, Debug)]
pub enum HavenError {
    #[error("State machine error: {0}")]
    StateMachine(#[from] StateMachineError),

    #[error("Guardian audit violation: {0}")]
    Guardian(#[from] AuditViolation),

    #[error("Crisis tier red triggered: {0}")]
    CrisisInterception(String),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
}
