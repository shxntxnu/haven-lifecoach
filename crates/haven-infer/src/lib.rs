//! haven-infer: Local inference abstraction and prompt assembly.
//!
//! Provides bindings to embedded on-device runtimes (llama.cpp)
//! and deterministic simulation engines with strict ICF output JSON constraints.

pub mod error;
pub mod prompt;

pub use error::InferenceError;
pub use prompt::{PromptAssembler, PromptContext};

pub fn infer_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}
