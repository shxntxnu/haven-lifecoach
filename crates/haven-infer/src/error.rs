//! Inference error definitions for haven-infer.

use thiserror::Error;
use haven_core::error::{AuditViolation, HavenError, StateMachineError};

#[derive(Error, Debug)]
pub enum InferenceError {
    #[error("Inference backend error: {0}")]
    BackendError(String),

    #[error("Model file not found at path: {0}")]
    ModelNotFound(String),

    #[error("Audit failure after {attempts} attempts: {violation}")]
    AuditExhausted {
        attempts: usize,
        violation: AuditViolation,
    },

    #[error("Failed to parse model JSON: {0}")]
    JsonParseError(String),

    #[error("Session state error: {0}")]
    StateMachine(#[from] StateMachineError),

    #[error("Guardian audit error: {0}")]
    Guardian(#[from] AuditViolation),

    #[error("Core haven error: {0}")]
    Core(#[from] HavenError),
}
