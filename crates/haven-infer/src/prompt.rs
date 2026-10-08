//! Prompt assembly and strict ICF JSON schema constraints.
//!
//! Formats system instructions, conversation slots, and operational constraints
//! adhering to International Coaching Federation (ICF) and Motivational Interviewing standards.

use haven_core::policy::CoachingTechnique;
use haven_core::state_machine::{CoachingMode, CoachingPhase};

#[derive(Debug, Clone)]
pub struct PromptContext {
    pub phase: CoachingPhase,
    pub mode: CoachingMode,
    pub technique: CoachingTechnique,
    pub contract: Option<String>,
    pub focus_topic: Option<String>,
    pub semantic_profile: Vec<String>,
    pub retrieved_episodes: Vec<String>,
    pub dialogue_history: Vec<(String, String)>,
    pub advice_requested: bool,
    pub corrective_instruction: Option<String>,
}

impl PromptContext {
    pub fn new(phase: CoachingPhase, mode: CoachingMode, technique: CoachingTechnique) -> Self {
        Self {
            phase,
            mode,
            technique,
            contract: None,
            focus_topic: None,
            semantic_profile: Vec::new(),
            retrieved_episodes: Vec::new(),
            dialogue_history: Vec::new(),
            advice_requested: false,
            corrective_instruction: None,
        }
    }
}

pub struct PromptAssembler;

impl PromptAssembler {
    /// Builds the full formatted prompt with operational instructions, context slots, and JSON schema.
    pub fn build_prompt(ctx: &PromptContext, user_turn: &str) -> String {
        let mut prompt = String::new();

        // System Persona & Clinical Boundaries
        prompt.push_str(
            "You are Haven, a compassionate, coach-grade personal development thinking partner.\n\
             You are NOT a therapist, you do NOT diagnose medical conditions, and you NEVER give unsolicited advice.\n\
             You operate strictly under International Coaching Federation (ICF) and Motivational Interviewing standards.\n\n",
        );

        // Context Slots
        prompt.push_str(&format!("CURRENT PHASE: {:?}\n", ctx.phase));
        prompt.push_str(&format!("ACTIVE MODE: {:?}\n", ctx.mode));
        prompt.push_str(&format!("SELECTED TECHNIQUE: {}\n", ctx.technique.display_name()));

        let contract_str = ctx.contract.as_deref().unwrap_or("None established yet");
        prompt.push_str(&format!("SESSION CONTRACT: {}\n", contract_str));

        if let Some(ref topic) = ctx.focus_topic {
            prompt.push_str(&format!("CLIENT FOCUS AGENDA: {}\n", topic));
        }

        if !ctx.semantic_profile.is_empty() {
            prompt.push_str(&format!("CLIENT PROFILE: {}\n", ctx.semantic_profile.join(" | ")));
        } else {
            prompt.push_str("CLIENT PROFILE: No prior profile records\n");
        }

        if !ctx.retrieved_episodes.is_empty() {
            prompt.push_str(&format!("RETRIEVED PAST EPISODES: {}\n", ctx.retrieved_episodes.join(" | ")));
        }

        // Operational Rules
        prompt.push_str(
            "\nSTRICT OPERATIONAL RULES:\n\
             1. Always start your response with an empathetic, non-judgmental REFLECTION of what the client felt or stated.\n\
             2. Ask at most ONE open-ended question (prefer 'what' or 'how'; avoid judgmental 'why').\n",
        );

        if ctx.phase == CoachingPhase::Options && ctx.advice_requested {
            prompt.push_str(
                "3. ADVICE PERMITTED: The user has explicitly invited ideas. Offer 2-3 brief, distinct options and ask which resonates.\n",
            );
        } else {
            prompt.push_str(
                "3. STRICT ADVICE GATE: DO NOT offer solutions, advice, suggestions, or action ideas. Help the client find their own way forward.\n",
            );
        }

        prompt.push_str("4. Never pressure the user toward action. All actions must be originated and sized by the user.\n");

        if ctx.mode == CoachingMode::Steady {
            prompt.push_str("5. In Steady mode, keep your response strictly under 3 sentences with grounded reassurance.\n");
        }

        // Corrective Feedback Injection (Self-Healing Retry Loop)
        if let Some(ref err) = ctx.corrective_instruction {
            prompt.push_str(&format!(
                "\nCRITICAL CORRECTION FROM PREVIOUS ATTEMPT:\n\
                 Your last response was rejected: {}.\n\
                 You must correct this violation in your new response.\n",
                err
            ));
        }

        // Dialogue History
        if !ctx.dialogue_history.is_empty() {
            prompt.push_str("\nCONVERSATION HISTORY:\n");
            for (speaker, text) in &ctx.dialogue_history {
                prompt.push_str(&format!("{}: {}\n", speaker, text));
            }
        }

        // Current User Turn
        prompt.push_str(&format!("\nCLIENT: {}\n", user_turn));

        // Output JSON Schema Constraints
        prompt.push_str(
            "\nRespond ONLY with a valid JSON object matching this exact schema:\n\
             {\n  \
               \"reflection\": \"Empathetic reflection acknowledging feelings and meaning...\",\n  \
               \"question\": \"Single open-ended coaching inquiry (or null if finalizing action)...\",\n  \
               \"full_reply\": \"Combined reflection and inquiry ready for presentation...\",\n  \
               \"reflection_present\": true,\n  \
               \"advice_given\": false,\n  \
               \"risk_tier\": \"green\"\n\
             }\n",
        );

        prompt
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_prompt_assembler_slot_injection() {
        let mut ctx = PromptContext::new(
            CoachingPhase::Explore,
            CoachingMode::Explore,
            CoachingTechnique::ValuesClarification,
        );
        ctx.contract = Some("Explore career growth".to_string());
        ctx.focus_topic = Some("Negotiating senior role".to_string());
        ctx.semantic_profile = vec!["Values autonomy".to_string()];

        let prompt = PromptAssembler::build_prompt(&ctx, "I feel undervalued at work.");

        assert!(prompt.contains("CURRENT PHASE: Explore"));
        assert!(prompt.contains("ACTIVE MODE: Explore"));
        assert!(prompt.contains("SELECTED TECHNIQUE: Values Clarification"));
        assert!(prompt.contains("SESSION CONTRACT: Explore career growth"));
        assert!(prompt.contains("CLIENT FOCUS AGENDA: Negotiating senior role"));
        assert!(prompt.contains("CLIENT PROFILE: Values autonomy"));
        assert!(prompt.contains("STRICT ADVICE GATE"));
        assert!(prompt.contains("CLIENT: I feel undervalued at work."));
    }

    #[test]
    fn test_prompt_assembler_corrective_feedback_injection() {
        let mut ctx = PromptContext::new(
            CoachingPhase::Commit,
            CoachingMode::Build,
            CoachingTechnique::MicroStepBreakdown,
        );
        ctx.corrective_instruction = Some("Multiple questions detected".to_string());

        let prompt = PromptAssembler::build_prompt(&ctx, "I can start on Monday.");
        assert!(prompt.contains("CRITICAL CORRECTION FROM PREVIOUS ATTEMPT"));
        assert!(prompt.contains("Multiple questions detected"));
    }
}
