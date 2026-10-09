//! WebAssembly bindings for Project Haven.
//!
//! Provides WebAssembly interface wrappers enabling zero-knowledge,
//! client-side execution in air-gapped web browsers and Progressive Web Apps (PWAs).

use serde::{Deserialize, Serialize};

use crate::guardian::Guardian;
use crate::policy::ThompsonBandit;
use crate::state_machine::{CoachingMode, CoachingPhase, SessionStateMachine};

#[derive(Serialize, Deserialize)]
pub struct WasmEngineState {
    pub session_id: String,
    pub current_phase: String,
    pub mode: String,
    pub contract: Option<String>,
    pub focus_topic: Option<String>,
    pub advice_unlocked: bool,
    pub is_closed: bool,
}

pub struct WasmHavenEngine {
    state_machine: SessionStateMachine,
    guardian: Guardian,
    bandit: ThompsonBandit,
}

impl Default for WasmHavenEngine {
    fn default() -> Self {
        Self::new("explore")
    }
}

impl WasmHavenEngine {
    pub fn new(mode_str: &str) -> Self {
        let mode = match mode_str.to_lowercase().as_str() {
            "steady" => CoachingMode::Steady,
            "build" => CoachingMode::Build,
            "perform" => CoachingMode::Perform,
            _ => CoachingMode::Explore,
        };

        Self {
            state_machine: SessionStateMachine::new(mode),
            guardian: Guardian::new(),
            bandit: ThompsonBandit::new(),
        }
    }

    pub fn get_state_json(&self) -> String {
        let phase_str = match self.state_machine.current_phase {
            CoachingPhase::Contract => "Contract",
            CoachingPhase::CheckIn => "CheckIn",
            CoachingPhase::Focus => "Focus",
            CoachingPhase::Explore => "Explore",
            CoachingPhase::Options => "Options",
            CoachingPhase::Commit => "Commit",
            CoachingPhase::Close => "Close",
        };

        let mode_str = match self.state_machine.mode {
            CoachingMode::Steady => "Steady",
            CoachingMode::Explore => "Explore",
            CoachingMode::Build => "Build",
            CoachingMode::Perform => "Perform",
        };

        let state = WasmEngineState {
            session_id: self.state_machine.session_id.to_string(),
            current_phase: phase_str.to_string(),
            mode: mode_str.to_string(),
            contract: self.state_machine.contract.clone(),
            focus_topic: self.state_machine.focus_topic.clone(),
            advice_unlocked: self.state_machine.advice_gate_unlocked,
            is_closed: self.state_machine.is_closed,
        };

        serde_json::to_string(&state).unwrap_or_else(|_| "{}".to_string())
    }

    pub fn pre_scan(&self, user_input: &str, user_region: &str) -> String {
        let result = self.guardian.pre_scan(user_input, user_region);
        serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_string())
    }

    pub fn set_contract(&mut self, text: &str) -> Result<String, String> {
        self.state_machine
            .set_contract(text)
            .map_err(|e| e.to_string())?;
        self.state_machine
            .advance_to_check_in()
            .map_err(|e| e.to_string())?;
        Ok(self.get_state_json())
    }

    pub fn complete_check_in(&mut self, distress_detected: bool) -> Result<String, String> {
        self.state_machine
            .process_check_in(distress_detected)
            .map_err(|e| e.to_string())?;
        self.state_machine
            .advance_to_focus()
            .map_err(|e| e.to_string())?;
        Ok(self.get_state_json())
    }

    pub fn set_focus_topic(&mut self, topic: &str) -> Result<String, String> {
        self.state_machine
            .set_focus_topic(topic)
            .map_err(|e| e.to_string())?;
        self.state_machine
            .advance_to_explore()
            .map_err(|e| e.to_string())?;
        Ok(self.get_state_json())
    }

    pub fn advance_to_options(&mut self) -> Result<String, String> {
        self.state_machine
            .advance_to_options()
            .map_err(|e| e.to_string())?;
        Ok(self.get_state_json())
    }

    pub fn unlock_advice(&mut self) -> Result<String, String> {
        self.state_machine
            .unlock_advice_by_user_request()
            .map_err(|e| e.to_string())?;
        Ok(self.get_state_json())
    }

    pub fn advance_to_commit(&mut self) -> Result<String, String> {
        self.state_machine
            .advance_to_commit()
            .map_err(|e| e.to_string())?;
        Ok(self.get_state_json())
    }

    pub fn propose_action(&mut self, text: &str, confidence: u8) -> Result<String, String> {
        self.state_machine
            .propose_action(text, confidence)
            .map_err(|e| e.to_string())?;
        Ok(self.get_state_json())
    }

    pub fn shrink_action(&mut self, text: &str, confidence: u8) -> Result<String, String> {
        self.state_machine
            .shrink_action(text, confidence)
            .map_err(|e| e.to_string())?;
        Ok(self.get_state_json())
    }

    pub fn advance_to_close(&mut self) -> Result<String, String> {
        self.state_machine
            .advance_to_close()
            .map_err(|e| e.to_string())?;
        Ok(self.get_state_json())
    }

    pub fn complete_session(&mut self, checkout_score: u8) -> Result<String, String> {
        let summary = self
            .state_machine
            .complete_session(checkout_score, None)
            .map_err(|e| e.to_string())?;

        let tech = self.bandit.select_technique(self.state_machine.mode, None);
        self.bandit
            .record_checkout_score(self.state_machine.mode, tech, checkout_score);

        serde_json::to_string(&summary).map_err(|e| e.to_string())
    }

    pub fn select_technique(&self) -> String {
        let tech = self.bandit.select_technique(self.state_machine.mode, None);
        tech.display_name().to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_wasm_engine_lifecycle() {
        let mut engine = WasmHavenEngine::new("explore");
        assert!(engine.get_state_json().contains("\"current_phase\":\"Contract\""));

        engine.set_contract("Define morning focus").unwrap();
        assert!(engine.get_state_json().contains("\"current_phase\":\"CheckIn\""));

        engine.complete_check_in(false).unwrap();
        assert!(engine.get_state_json().contains("\"current_phase\":\"Focus\""));

        engine.set_focus_topic("Time management").unwrap();
        assert!(engine.get_state_json().contains("\"current_phase\":\"Explore\""));

        engine.advance_to_options().unwrap();
        assert!(engine.get_state_json().contains("\"current_phase\":\"Options\""));

        engine.unlock_advice().unwrap();
        assert!(engine.get_state_json().contains("\"advice_unlocked\":true"));

        engine.advance_to_commit().unwrap();
        assert!(engine.get_state_json().contains("\"current_phase\":\"Commit\""));

        // Low confidence rejected
        engine.propose_action("Run 10 miles", 4).unwrap();
        assert!(engine.advance_to_close().is_err());

        // Shrink action
        engine.shrink_action("Walk 15 minutes", 9).unwrap();
        assert!(engine.advance_to_close().is_ok());

        let summary = engine.complete_session(5).unwrap();
        assert!(summary.contains("\"checkout_score\":5"));
    }
}
