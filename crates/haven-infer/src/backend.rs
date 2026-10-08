//! Pluggable inference backend abstraction.
//!
//! Provides the core `InferenceBackend` trait and the high-fidelity `SimulatedCoachingBackend`
//! used for headless integration tests and automated offline CI validation.

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use crate::error::InferenceError;

/// Core inference abstraction for local LLM engines.
pub trait InferenceBackend: Send + Sync {
    fn generate(&self, prompt: &str) -> Result<String, InferenceError>;
}

/// High-fidelity deterministic coaching simulation backend.
/// Generates strict ICF-compliant responses matching the prompt context.
#[derive(Clone)]
pub struct SimulatedCoachingBackend {
    fault_injection_count: Arc<AtomicUsize>,
}

impl Default for SimulatedCoachingBackend {
    fn default() -> Self {
        Self::new()
    }
}

impl SimulatedCoachingBackend {
    pub fn new() -> Self {
        Self {
            fault_injection_count: Arc::new(AtomicUsize::new(0)),
        }
    }

    /// Configures the backend to inject an audit failure for the next N calls.
    /// Used to test the orchestrator's self-healing corrective retry loop.
    pub fn inject_faults(&self, count: usize) {
        self.fault_injection_count.store(count, Ordering::SeqCst);
    }
}

impl InferenceBackend for SimulatedCoachingBackend {
    fn generate(&self, prompt: &str) -> Result<String, InferenceError> {
        // If fault injection is active, generate a violation (unsolicited advice)
        if self.fault_injection_count.load(Ordering::SeqCst) > 0 {
            self.fault_injection_count.fetch_sub(1, Ordering::SeqCst);
            return Ok(serde_json::to_string(&serde_json::json!({
                "reflection": "I hear how overwhelmed you are.",
                "question": "What will you do?",
                "full_reply": "I hear how overwhelmed you are. You should immediately speak to your manager tomorrow.",
                "reflection_present": true,
                "advice_given": false,
                "risk_tier": "green"
            })).unwrap());
        }

        // Determine conversational phase from prompt
        if prompt.contains("CURRENT PHASE: Contract") {
            Ok(serde_json::to_string(&serde_json::json!({
                "reflection": "It takes courage to pause and invest in yourself today.",
                "question": "What would make our time today feel truly well spent?",
                "full_reply": "It takes courage to pause and invest in yourself today. What would make our time today feel truly well spent?",
                "reflection_present": true,
                "advice_given": false,
                "risk_tier": "green"
            })).unwrap())
        } else if prompt.contains("CURRENT PHASE: CheckIn") {
            Ok(serde_json::to_string(&serde_json::json!({
                "reflection": "I hear how much you've been carrying this week.",
                "question": "On a scale of 1 to 10, where is your energy right now?",
                "full_reply": "I hear how much you've been carrying this week. On a scale of 1 to 10, where is your energy right now?",
                "reflection_present": true,
                "advice_given": false,
                "risk_tier": "green"
            })).unwrap())
        } else if prompt.contains("CURRENT PHASE: Focus") {
            Ok(serde_json::to_string(&serde_json::json!({
                "reflection": "There is clearly a lot alive on your mind right now.",
                "question": "Of everything you're juggling, what matters most to focus on today?",
                "full_reply": "There is clearly a lot alive on your mind right now. Of everything you're juggling, what matters most to focus on today?",
                "reflection_present": true,
                "advice_given": false,
                "risk_tier": "green"
            })).unwrap())
        } else if prompt.contains("CURRENT PHASE: Explore") {
            Ok(serde_json::to_string(&serde_json::json!({
                "reflection": "You feel torn between wanting security and longing for autonomy.",
                "question": "What does honoring your core value of autonomy look like here?",
                "full_reply": "You feel torn between wanting security and longing for autonomy. What does honoring your core value of autonomy look like here?",
                "reflection_present": true,
                "advice_given": false,
                "risk_tier": "green"
            })).unwrap())
        } else if prompt.contains("CURRENT PHASE: Options") {
            if prompt.contains("ADVICE PERMITTED") {
                Ok(serde_json::to_string(&serde_json::json!({
                    "reflection": "You are ready to explore concrete pathways forward.",
                    "question": "Which of these 2 options resonates most: drafting a 30-day savings buffer, or conducting 2 informational interviews?",
                    "full_reply": "You are ready to explore concrete pathways forward. Here are two pathways to consider: 1) establishing a clear 30-day savings safety net, or 2) conducting two informal informational interviews this month. Which of these 2 options resonates most?",
                    "reflection_present": true,
                    "advice_given": true,
                    "risk_tier": "green"
                })).unwrap())
            } else {
                Ok(serde_json::to_string(&serde_json::json!({
                    "reflection": "You see several possible routes opening up.",
                    "question": "If you could test one gentle step without any risk, what would you try?",
                    "full_reply": "You see several possible routes opening up. If you could test one gentle step without any risk, what would you try?",
                    "reflection_present": true,
                    "advice_given": false,
                    "risk_tier": "green"
                })).unwrap())
            }
        } else if prompt.contains("CURRENT PHASE: Commit") {
            Ok(serde_json::to_string(&serde_json::json!({
                "reflection": "That feels like a very real and grounded intention.",
                "question": "On a scale of 0 to 10, how confident are you that you can complete this?",
                "full_reply": "That feels like a very real and grounded intention. On a scale of 0 to 10, how confident are you that you can complete this?",
                "reflection_present": true,
                "advice_given": false,
                "risk_tier": "green"
            })).unwrap())
        } else if prompt.contains("CURRENT PHASE: Close") {
            Ok(serde_json::to_string(&serde_json::json!({
                "reflection": "You began today looking for clarity, and you arrived at a concrete commitment you own completely.",
                "question": null,
                "full_reply": "You began today looking for clarity, and you arrived at a concrete commitment you own completely. Thank you for your vulnerability and focus today.",
                "reflection_present": true,
                "advice_given": false,
                "risk_tier": "green"
            })).unwrap())
        } else {
            // General fallback
            Ok(serde_json::to_string(&serde_json::json!({
                "reflection": "I hear the reflection in what you shared.",
                "question": "What is present for you right now?",
                "full_reply": "I hear the reflection in what you shared. What is present for you right now?",
                "reflection_present": true,
                "advice_given": false,
                "risk_tier": "green"
            })).unwrap())
        }
    }
}
