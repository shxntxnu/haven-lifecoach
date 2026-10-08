//! haven-infer: Local inference abstraction, prompt assembly, and runtimes.
//!
//! Provides bindings to embedded on-device runtimes (llama.cpp)
//! and deterministic simulation engines with strict ICF output JSON constraints.

pub mod backend;
pub mod error;
pub mod llama_backend;
pub mod prompt;

pub use backend::{InferenceBackend, SimulatedCoachingBackend};
pub use error::InferenceError;
pub use llama_backend::LlamaCppBackend;
pub use prompt::{PromptAssembler, PromptContext};

pub fn infer_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}
