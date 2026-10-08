//! haven-infer: Local inference abstraction, prompt assembly, and coaching orchestrator.
//!
//! Provides bindings to embedded on-device runtimes (llama.cpp),
//! deterministic simulation engines, and the end-to-end coaching pipeline.

pub mod backend;
pub mod error;
pub mod llama_backend;
pub mod orchestrator;
pub mod prompt;

pub use backend::{InferenceBackend, SimulatedCoachingBackend};
pub use error::InferenceError;
pub use llama_backend::LlamaCppBackend;
pub use orchestrator::{CoachingOrchestrator, OrchestratorTurnResult};
pub use prompt::{PromptAssembler, PromptContext};

pub fn infer_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}
