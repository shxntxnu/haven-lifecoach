//! Dual-tier Safety Guardian for Project Haven.
//!
//! Provides:
//! 1. Deterministic Pre-Inference Scan: Intercepts crisis (Red) and acute distress (Amber)
//!    before prompt assembly or local model execution. 100% bypass on Red tier.
//! 2. Deterministic Post-Inference Audit: Audits structured JSON turn output from the LLM,
//!    enforcing reflection-first OARS discipline, at most one open question, advice locking,
//!    and scrubbing clinical diagnostic / dependency-forming phrasing.

use regex::{Regex, RegexSet};
use serde::{Deserialize, Serialize};

use crate::crisis::{get_crisis_pack, CrisisPack};
use crate::error::AuditViolation;
use crate::state_machine::CoachingPhase;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RiskTier {
    Green,
    Amber,
    Red,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PreScanResult {
    pub tier: RiskTier,
    pub matched_patterns: Vec<String>,
    pub crisis_message: Option<String>,
    pub crisis_pack: Option<CrisisPack>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CoachingTurnPayload {
    pub reflection: String,
    pub question: Option<String>,
    pub full_reply: String,
    pub reflection_present: bool,
    pub advice_given: bool,
    pub risk_tier: RiskTier,
}

/// Normalises typographic apostrophes (U+2018 / U+2019) to ASCII `'`.
///
/// Phone keyboards commonly emit curly apostrophes, which would otherwise evade patterns
/// such as `can't go on` or `I'm the only one who understands`. The TypeScript guardian
/// applies the same normalisation, and shared fixtures keep both in step.
pub fn normalize_text(text: &str) -> String {
    text.replace(['\u{2018}', '\u{2019}'], "'")
}

pub struct Guardian {
    red_regex_set: RegexSet,
    red_patterns: Vec<&'static str>,
    amber_regex_set: RegexSet,
    amber_patterns: Vec<&'static str>,
    clinical_patterns: Vec<Regex>,
    dependency_patterns: Vec<Regex>,
    advice_prescriptive_patterns: Vec<Regex>,
}

impl Default for Guardian {
    fn default() -> Self {
        Self::new()
    }
}

impl Guardian {
    pub fn new() -> Self {
        // Red tier patterns: Active suicidal ideation, self-harm, physical violence, overdose
        let red_patterns = vec![
            r"(?i)\b(?:kill|end|take)\s+(?:my\s+own\s+life|myself)\b",
            r"(?i)\bcommit\s+suicide\b",
            r"(?i)\bwant\s+to\s+die\b",
            r"(?i)\bbetter\s+off\s+dead\b",
            r"(?i)\b(?:hang|shoot|slit|poison)\s+myself\b",
            r"(?i)\boverdose\s+on\b",
            r"(?i)\bcutting\s+myself\b",
            r"(?i)\bcut\s+my\s+wrists\b",
            r"(?i)\b(?:jumping|jump)\s+off\s+a\s+(?:bridge|building|roof)\b",
            r"(?i)\bno\s+reason\s+to\s+live\b",
            r"(?i)\b(?:he|she|partner|husband|wife)\s+is\s+(?:beating|hitting|choking|attacking)\s+me\b",
            r"(?i)\bthreatened\s+to\s+kill\s+me\b",
            r"(?i)\bin\s+immediate\s+danger\b",
            // Generic ideation / self-harm vocabulary. NOTE: the regex crate has no look-around,
            // so ambiguous phrases ("take my life back", "cut myself some slack") are deliberately
            // NOT matched; only unambiguous forms are.
            r"(?i)\bsuicid(?:e|al)\b",
            r"(?i)\bself[\s-]?harm(?:ing)?\b",
            r"(?i)\bend\s+my\s+(?:own\s+)?life\b",
            r"(?i)\bover-?dos(?:e|ed|ing)\b",
            r"(?i)\b(?:slit|slash)\s+my\s+wrists\b",
            r"(?i)\bcut\s+myself\s+(?:again|on\s+purpose|open|deep)\b",
        ];

        // Amber tier patterns: Severe hopelessness, panic attack, persistent exhaustion
        let amber_patterns = vec![
            r"(?i)\bcan't\s+go\s+on\s+like\s+this\b",
            r"(?i)\bcompletely\s+hopeless\b",
            r"(?i)\beverything\s+is\s+falling\s+apart\b",
            r"(?i)\bsevere\s+panic\s+attack\b",
            r"(?i)\bcan't\s+breathe\s+from\s+panic\b",
            r"(?i)\bcrying\s+uncontrollably\b",
            r"(?i)\bdeep\s+dark\s+hole\b",
            r"(?i)\bexhausted\s+of\s+everything\b",
            r"(?i)\bcannot\s+get\s+out\s+of\s+bed\b",
            r"(?i)\bnothing\s+matters\s+anymore\b",
            r"(?i)\bpanic\s+attack\b",
            r"(?i)\bcan'?t\s+breathe\b",
            r"(?i)\bhyperventilat(?:e|ing)\b",
            r"(?i)\bshaking\s+uncontrollably\b",
            r"(?i)\bextreme\s+distress\b",
            r"(?i)\bterrified\b",
        ];

        let red_regex_set = RegexSet::new(&red_patterns).expect("Invalid Red Tier regex patterns");
        let amber_regex_set = RegexSet::new(&amber_patterns).expect("Invalid Amber Tier regex patterns");

        let clinical_patterns = vec![
            Regex::new(r"(?i)\byou\s+(?:have|suffer\s+from|are\s+diagnosed\s+with)\s+(?:clinical\s+depression|depression|bipolar|schizophrenia|bpd|borderline\s+personality\s+disorder|personality\s+disorder|ptsd|ocd|adhd|anxiety\s+disorder|eating\s+disorder|psychosis)\b").unwrap(),
            Regex::new(r"(?i)\byou\s+are\s+diagnosed\s+with\b").unwrap(),
            Regex::new(r"(?i)\bmy\s+diagnosis\s+is\b").unwrap(),
            Regex::new(r"(?i)\bas\s+your\s+therapist\b").unwrap(),
            Regex::new(r"(?i)\bpsychiatric\s+assessment\b").unwrap(),
            Regex::new(r"(?i)\bclinical\s+assessment\b").unwrap(),
        ];

        let dependency_patterns = vec![
            Regex::new(r"(?i)\bi('m|\s+am)\s+the\s+only\s+(?:one\s+who\s+understands|person\s+who\s+cares)\b").unwrap(),
            Regex::new(r"(?i)\byou\s+(?:only\s+need|don't\s+need\s+anyone\s+other\s+than)\s+me\b").unwrap(),
            Regex::new(r"(?i)\bi\s+missed\s+you\b").unwrap(),
            Regex::new(r"(?i)\bi\s+will\s+always\s+be\s+here\s+for\s+you\s+forever\b").unwrap(),
        ];

        let advice_prescriptive_patterns = vec![
            Regex::new(r"(?i)\byou\s+(?:should|must|ought\s+to|need\s+to)\s+[a-z]+").unwrap(),
            Regex::new(r"(?i)\bmy\s+advice\s+is\s+to\b").unwrap(),
            Regex::new(r"(?i)\bhere\s+is\s+what\s+you\s+must\s+do\b").unwrap(),
            Regex::new(r"(?i)\bwhat\s+you\s+need\s+to\s+do\s+is\b").unwrap(),
        ];

        Self {
            red_regex_set,
            red_patterns,
            amber_regex_set,
            amber_patterns,
            clinical_patterns,
            dependency_patterns,
            advice_prescriptive_patterns,
        }
    }

    /// Dual-tier Pre-Inference Scan.
    /// Evaluates raw user input deterministically before calling local LLM.
    pub fn pre_scan(&self, user_input: &str, user_region: &str) -> PreScanResult {
        let user_input = normalize_text(user_input);
        let user_input = user_input.as_str();
        let red_matches = self.red_regex_set.matches(user_input);
        if red_matches.matched_any() {
            let matched_strings: Vec<String> = red_matches
                .into_iter()
                .map(|idx| self.red_patterns[idx].to_string())
                .collect();

            let crisis_pack = get_crisis_pack(user_region);
            let crisis_message = format!(
                "I hear how much pain you're in right now, and I want you to be safe. Because I am an automated coaching companion and not a person or crisis service, I cannot give you the care you deserve right now. Please connect with someone who can support you right away at {}: {}",
                crisis_pack.emergency_services,
                crisis_pack.emergency_description
            );

            return PreScanResult {
                tier: RiskTier::Red,
                matched_patterns: matched_strings,
                crisis_message: Some(crisis_message),
                crisis_pack: Some(crisis_pack),
            };
        }

        let amber_matches = self.amber_regex_set.matches(user_input);
        if amber_matches.matched_any() {
            let matched_strings: Vec<String> = amber_matches
                .into_iter()
                .map(|idx| self.amber_patterns[idx].to_string())
                .collect();

            return PreScanResult {
                tier: RiskTier::Amber,
                matched_patterns: matched_strings,
                crisis_message: None,
                crisis_pack: None,
            };
        }

        PreScanResult {
            tier: RiskTier::Green,
            matched_patterns: Vec::new(),
            crisis_message: None,
            crisis_pack: None,
        }
    }

    /// Post-Inference Audit Engine.
    /// Audits draft payload against strict ICF coaching invariants:
    /// - Empathetic reflection is mandatory.
    /// - Exactly at most ONE open-ended coaching question.
    /// - Advice locked unless in Options phase and explicitly invited.
    /// - Scrubbing of clinical diagnostic claims and dependency language.
    pub fn audit_turn(
        &self,
        current_phase: CoachingPhase,
        advice_requested: bool,
        payload: &CoachingTurnPayload,
    ) -> Result<(), AuditViolation> {
        // 1. Reflection requirement
        if !payload.reflection_present || payload.reflection.trim().is_empty() {
            return Err(AuditViolation::MissingReflection);
        }

        // Typographic apostrophes (common on phone keyboards) must not evade the patterns.
        let reply = normalize_text(&payload.full_reply);

        // 2. Single question constraint
        let question_count = reply.chars().filter(|&c| c == '?').count();
        if question_count > 1 {
            return Err(AuditViolation::MultipleQuestions(question_count));
        }

        // 3. Advice Gate: Advice is strictly prohibited outside Options phase
        if current_phase != CoachingPhase::Options {
            if payload.advice_given {
                return Err(AuditViolation::UnsolicitedAdvice(format!("{:?}", current_phase)));
            }

            for pattern in &self.advice_prescriptive_patterns {
                if pattern.is_match(&reply) {
                    return Err(AuditViolation::UnsolicitedAdvice(format!(
                        "Prescriptive wording detected in {:?}",
                        current_phase
                    )));
                }
            }
        } else if !advice_requested && payload.advice_given {
            return Err(AuditViolation::UnsolicitedAdvice(
                "Advice given in Options without explicit user request".to_string(),
            ));
        }

        // 4. Clinical diagnosis scrubbing
        for pattern in &self.clinical_patterns {
            if let Some(m) = pattern.find(&reply) {
                return Err(AuditViolation::DiagnosticLanguage(m.as_str().to_string()));
            }
        }

        // 5. Dependency-forming / parasocial scrubbing
        for pattern in &self.dependency_patterns {
            if let Some(m) = pattern.find(&reply) {
                return Err(AuditViolation::DependencyLanguage(m.as_str().to_string()));
            }
        }

        Ok(())
    }

    /// Parses and audits raw JSON string output from LLM.
    pub fn audit_raw_json(
        &self,
        current_phase: CoachingPhase,
        advice_requested: bool,
        raw_json: &str,
    ) -> Result<CoachingTurnPayload, AuditViolation> {
        let payload: CoachingTurnPayload = serde_json::from_str(raw_json)
            .map_err(|e| AuditViolation::MalformedJson(e.to_string()))?;

        self.audit_turn(current_phase, advice_requested, &payload)?;
        Ok(payload)
    }
}
