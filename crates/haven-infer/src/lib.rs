//! haven-infer: Local inference abstraction layer.
//!
//! Provides bindings to embedded on-device runtimes (llama.cpp / WebLLM)
//! with strict output JSON constraints.

pub fn infer_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}
