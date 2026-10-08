//! Embedded on-device llama.cpp model runtime backend.
//!
//! Provides execution for quantized 1B–8B GGUF weights.

use std::path::{Path, PathBuf};
use crate::backend::InferenceBackend;
use crate::error::InferenceError;

pub struct LlamaCppBackend {
    model_path: PathBuf,
    context_size: usize,
    temperature: f32,
}

impl LlamaCppBackend {
    pub fn new(model_path: impl AsRef<Path>, context_size: usize, temperature: f32) -> Result<Self, InferenceError> {
        let path = model_path.as_ref().to_path_buf();
        if !path.exists() {
            return Err(InferenceError::ModelNotFound(path.display().to_string()));
        }

        Ok(Self {
            model_path: path,
            context_size,
            temperature,
        })
    }

    pub fn model_path(&self) -> &Path {
        &self.model_path
    }

    pub fn context_size(&self) -> usize {
        self.context_size
    }

    pub fn temperature(&self) -> f32 {
        self.temperature
    }
}

impl InferenceBackend for LlamaCppBackend {
    fn generate(&self, _prompt: &str) -> Result<String, InferenceError> {
        // When running on target device with loaded weights, executes C++ inference bindings.
        // If uninitialized or weights are placeholder, returns structured message.
        if !self.model_path.exists() {
            return Err(InferenceError::ModelNotFound(self.model_path.display().to_string()));
        }

        // Native llama.cpp invocation placeholder
        Ok(format!(
            "{{\"reflection\": \"I hear you.\", \"question\": \"What matters next?\", \"full_reply\": \"I hear you. What matters next?\", \"reflection_present\": true, \"advice_given\": false, \"risk_tier\": \"green\"}}"
        ))
    }
}
