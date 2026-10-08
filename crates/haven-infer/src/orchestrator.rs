//! End-to-end Coaching Session Orchestrator.
//!
//! Integrates Safety Guardian, State Machine, Thompson Bandit,
//! Cryptographic Storage, and Inference Backend into a unified, self-healing pipeline.

use std::sync::Arc;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use haven_core::crisis::CrisisPack;
use haven_core::error::{AuditViolation, StateMachineError};
use haven_core::guardian::{CoachingTurnPayload, Guardian, RiskTier};
use haven_core::policy::{CoachingTechnique, ThompsonBandit};
use haven_core::state_machine::{
    CoachingMode, CoachingPhase, SessionStateMachine, SessionSummary,
};
use haven_storage::storage::{HavenStorage, MemoryKind};

use crate::backend::InferenceBackend;
use crate::error::InferenceError;
use crate::prompt::{PromptAssembler, PromptContext};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OrchestratorTurnResult {
    CoachingReply {
        turn_id: Uuid,
        phase: CoachingPhase,
        technique: CoachingTechnique,
        payload: CoachingTurnPayload,
    },
    CrisisInterception {
        statement: String,
        crisis_pack: CrisisPack,
    },
}

pub struct CoachingOrchestrator {
    pub state_machine: SessionStateMachine,
    pub guardian: Guardian,
    pub bandit: ThompsonBandit,
    pub storage: Arc<HavenStorage>,
    pub backend: Arc<dyn InferenceBackend>,
    pub user_region: String,
    pub active_technique: CoachingTechnique,
    pub dialogue_history: Vec<(String, String)>,
}

impl CoachingOrchestrator {
    pub fn new(
        mode: CoachingMode,
        user_region: impl Into<String>,
        storage: Arc<HavenStorage>,
        backend: Arc<dyn InferenceBackend>,
    ) -> Result<Self, InferenceError> {
        let bandit = if let Ok(stats) = storage.load_technique_stats() {
            if !stats.is_empty() {
                ThompsonBandit::from_stats(stats)
            } else {
                ThompsonBandit::new()
            }
        } else {
            ThompsonBandit::new()
        };

        let initial_technique = bandit.select_technique(mode, None);

        Ok(Self {
            state_machine: SessionStateMachine::new(mode),
            guardian: Guardian::new(),
            bandit,
            storage,
            backend,
            user_region: user_region.into(),
            active_technique: initial_technique,
            dialogue_history: Vec::new(),
        })
    }

    /// Process a conversational turn through the full 5-tier pipeline:
    /// Pre-Scan -> Slot Assembly -> Model Generation -> Post-Audit -> Persistence.
    pub fn process_turn(&mut self, user_input: &str) -> Result<OrchestratorTurnResult, InferenceError> {
        // 1. Dual-Tier Pre-Inference Scan
        let pre_scan = self.guardian.pre_scan(user_input, &self.user_region);
        if pre_scan.tier == RiskTier::Red {
            let crisis_pack = pre_scan.crisis_pack.expect("Red tier must supply crisis pack");
            let statement = pre_scan.crisis_message.expect("Red tier must supply message");

            return Ok(OrchestratorTurnResult::CrisisInterception {
                statement,
                crisis_pack,
            });
        }

        // Amber tier automatically clamps mode to Steady
        if pre_scan.tier == RiskTier::Amber {
            self.state_machine.mode = CoachingMode::Steady;
        }

        // 2. Sample Coaching Technique via Thompson Bandit
        self.active_technique = self.bandit.select_technique(self.state_machine.mode, None);

        // 3. Assemble Prompt Context Slots
        let mut prompt_ctx = PromptContext::new(
            self.state_machine.current_phase,
            self.state_machine.mode,
            self.active_technique,
        );
        prompt_ctx.contract = self.state_machine.contract.clone();
        prompt_ctx.focus_topic = self.state_machine.focus_topic.clone();
        prompt_ctx.advice_requested = self.state_machine.advice_gate_unlocked;
        prompt_ctx.dialogue_history = self.dialogue_history.clone();

        // Retrieve semantic memories
        if let Ok(memories) = self.storage.list_memories(Some(MemoryKind::Semantic)) {
            prompt_ctx.semantic_profile = memories.into_iter().map(|m| m.body).collect();
        }

        // 4. Model Generation & Post-Audit with Self-Healing Retry Loop
        let mut attempts = 0;
        let max_attempts = 3;
        let mut last_violation: Option<AuditViolation> = None;
        let mut verified_payload: Option<CoachingTurnPayload> = None;

        while attempts < max_attempts {
            attempts += 1;
            let prompt = PromptAssembler::build_prompt(&prompt_ctx, user_input);
            let raw_json = self.backend.generate(&prompt)?;

            match self.guardian.audit_raw_json(
                self.state_machine.current_phase,
                self.state_machine.advice_gate_unlocked,
                &raw_json,
            ) {
                Ok(payload) => {
                    verified_payload = Some(payload);
                    break;
                }
                Err(violation) => {
                    prompt_ctx.corrective_instruction = Some(format!("{}", violation));
                    last_violation = Some(violation);
                }
            }
        }

        // Fallback to safe deterministic reflection if model exhausted retries
        let payload = match verified_payload {
            Some(p) => p,
            None => {
                let violation = last_violation.unwrap_or(AuditViolation::MissingReflection);
                tracing::warn!("Inference audit retries exhausted: {}. Falling back to safe template.", violation);
                CoachingTurnPayload {
                    reflection: "I hear what you shared and want to give you space to explore that.".to_string(),
                    question: Some("What feels most important about this for you right now?".to_string()),
                    full_reply: "I hear what you shared and want to give you space to explore that. What feels most important about this for you right now?".to_string(),
                    reflection_present: true,
                    advice_given: false,
                    risk_tier: RiskTier::Green,
                }
            }
        };

        // 5. Append to Dialogue History and Persist Turn
        self.dialogue_history.push(("Client".to_string(), user_input.to_string()));
        self.dialogue_history.push(("Haven".to_string(), payload.full_reply.clone()));

        let _ = self.storage.insert_memory(
            MemoryKind::Episodic,
            &format!("Turn in {:?}: {}", self.state_machine.current_phase, payload.full_reply),
            1.0,
        );

        Ok(OrchestratorTurnResult::CoachingReply {
            turn_id: Uuid::new_v4(),
            phase: self.state_machine.current_phase,
            technique: self.active_technique,
            payload,
        })
    }

    // ==========================================
    // STATE PROGRESSION HELPERS
    // ==========================================

    pub fn set_contract(&mut self, text: &str) -> Result<(), StateMachineError> {
        self.state_machine.set_contract(text)?;
        self.state_machine.advance_to_check_in()
    }

    pub fn complete_check_in(&mut self, distress_detected: bool) -> Result<(), StateMachineError> {
        self.state_machine.process_check_in(distress_detected)?;
        self.state_machine.advance_to_focus()
    }

    pub fn set_focus_topic(&mut self, topic: &str) -> Result<(), StateMachineError> {
        self.state_machine.set_focus_topic(topic)?;
        self.state_machine.advance_to_explore()
    }

    pub fn advance_to_options(&mut self) -> Result<(), StateMachineError> {
        self.state_machine.advance_to_options()
    }

    pub fn unlock_advice_by_user_request(&mut self) -> Result<(), StateMachineError> {
        self.state_machine.unlock_advice_by_user_request()
    }

    pub fn advance_to_commit(&mut self) -> Result<(), StateMachineError> {
        self.state_machine.advance_to_commit()
    }

    pub fn propose_action(&mut self, text: &str, confidence: u8) -> Result<(), StateMachineError> {
        self.state_machine.propose_action(text, confidence)
    }

    pub fn shrink_action(&mut self, text: &str, confidence: u8) -> Result<(), StateMachineError> {
        self.state_machine.shrink_action(text, confidence)
    }

    pub fn advance_to_close(&mut self) -> Result<(), StateMachineError> {
        self.state_machine.advance_to_close()
    }

    pub fn finalize_session(&mut self, checkout_score: u8, summary: Option<String>) -> Result<SessionSummary, StateMachineError> {
        let session_summary = self.state_machine.complete_session(checkout_score, summary)?;

        // Update Thompson bandit posterior distribution
        self.bandit.record_checkout_score(
            session_summary.mode,
            self.active_technique,
            checkout_score,
        );

        // Persist session and updated bandit weights to SQLCipher storage
        let _ = self.storage.save_session(&session_summary);
        let _ = self.storage.save_technique_stats(&self.bandit.to_stats());

        Ok(session_summary)
    }
}
