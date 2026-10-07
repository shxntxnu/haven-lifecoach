//! Comprehensive test suite for Safety Guardian pre-scan and post-audit.

use haven_core::error::AuditViolation;
use haven_core::guardian::{CoachingTurnPayload, Guardian, RiskTier};
use haven_core::state_machine::CoachingPhase;

#[test]
fn test_pre_scan_green_tier_normal_coaching() {
    let guardian = Guardian::new();
    let normal_prompts = vec![
        "I'm feeling overwhelmed by too many work meetings this week.",
        "How can I stay motivated to write my book?",
        "I need help setting boundaries with my colleagues.",
        "I want to explore whether to take the new promotion or stay where I am.",
    ];

    for prompt in normal_prompts {
        let result = guardian.pre_scan(prompt, "UK");
        assert_eq!(result.tier, RiskTier::Green, "Prompt failed: {}", prompt);
        assert!(result.crisis_message.is_none());
        assert!(result.crisis_pack.is_none());
    }
}

#[test]
fn test_pre_scan_amber_tier_acute_distress() {
    let guardian = Guardian::new();
    let amber_prompts = vec![
        "I can't go on like this anymore.",
        "I feel completely hopeless about everything.",
        "Everything is falling apart in my life.",
        "I am having a severe panic attack right now.",
        "I am exhausted of everything and cannot get out of bed.",
    ];

    for prompt in amber_prompts {
        let result = guardian.pre_scan(prompt, "US");
        assert_eq!(result.tier, RiskTier::Amber, "Prompt failed: {}", prompt);
        assert!(result.crisis_message.is_none());
        assert!(!result.matched_patterns.is_empty());
    }
}

#[test]
fn test_pre_scan_red_tier_crisis_interception_100_percent() {
    let guardian = Guardian::new();
    let crisis_prompts = vec![
        ("I want to kill myself tonight", "UK", "999"),
        ("I think I'm going to commit suicide", "US", "911"),
        ("I'm better off dead, nobody needs me", "EU", "112"),
        ("I've been cutting myself again", "UK", "999"),
        ("I am going to overdose on sleeping pills", "US", "911"),
        ("He is beating me and I am scared", "UK", "999"),
        ("My husband is hitting me", "US", "911"),
        ("I have no reason to live anymore", "EU", "112"),
    ];

    for (prompt, region, expected_emergency_number) in crisis_prompts {
        let result = guardian.pre_scan(prompt, region);
        assert_eq!(result.tier, RiskTier::Red, "Failed to intercept: {}", prompt);
        assert!(result.crisis_message.is_some());
        let pack = result.crisis_pack.expect("Missing crisis pack");
        assert_eq!(pack.emergency_services, expected_emergency_number);

        let msg = result.crisis_message.unwrap();
        // Red message must contain emergency number and zero interrogatives
        assert!(msg.contains(expected_emergency_number));
        assert!(!msg.contains('?'), "Red response must never interrogate the user");
    }
}

#[test]
fn test_post_audit_passes_compliant_response() {
    let guardian = Guardian::new();
    let compliant = CoachingTurnPayload {
        reflection: "It sounds like you're carrying a huge weight trying to balance everyone's expectations while neglecting your own needs.".to_string(),
        question: Some("What would one small boundary look like for you tomorrow?".to_string()),
        full_reply: "It sounds like you're carrying a huge weight trying to balance everyone's expectations while neglecting your own needs. What would one small boundary look like for you tomorrow?".to_string(),
        reflection_present: true,
        advice_given: false,
        risk_tier: RiskTier::Green,
    };

    let result = guardian.audit_turn(CoachingPhase::Explore, false, &compliant);
    assert!(result.is_ok());
}

#[test]
fn test_post_audit_rejects_missing_reflection() {
    let guardian = Guardian::new();
    let missing_reflection = CoachingTurnPayload {
        reflection: "".to_string(),
        question: Some("What do you want to do?".to_string()),
        full_reply: "What do you want to do?".to_string(),
        reflection_present: false,
        advice_given: false,
        risk_tier: RiskTier::Green,
    };

    let result = guardian.audit_turn(CoachingPhase::Explore, false, &missing_reflection);
    assert_eq!(result.unwrap_err(), AuditViolation::MissingReflection);
}

#[test]
fn test_post_audit_rejects_multiple_questions() {
    let guardian = Guardian::new();
    let multi_question = CoachingTurnPayload {
        reflection: "You seem really frustrated with how this went down.".to_string(),
        question: Some("What did you feel?".to_string()),
        full_reply: "You seem really frustrated with how this went down. What made you react that way? And how do you want to handle it next?".to_string(),
        reflection_present: true,
        advice_given: false,
        risk_tier: RiskTier::Green,
    };

    let result = guardian.audit_turn(CoachingPhase::Explore, false, &multi_question);
    assert_eq!(result.unwrap_err(), AuditViolation::MultipleQuestions(2));
}

#[test]
fn test_post_audit_rejects_unsolicited_advice_in_explore_and_commit() {
    let guardian = Guardian::new();
    let prescriptive = CoachingTurnPayload {
        reflection: "I hear how exhausted you are with this project.".to_string(),
        question: None,
        full_reply: "I hear how exhausted you are with this project. You should tell your manager that you cannot take this on.".to_string(),
        reflection_present: true,
        advice_given: false, // Model claimed false, but text contains prescriptive advice!
        risk_tier: RiskTier::Green,
    };

    let result = guardian.audit_turn(CoachingPhase::Explore, false, &prescriptive);
    assert!(matches!(result, Err(AuditViolation::UnsolicitedAdvice(_))));
}

#[test]
fn test_post_audit_rejects_clinical_diagnosis() {
    let guardian = Guardian::new();
    let clinical = CoachingTurnPayload {
        reflection: "You have described feeling sad and having low energy.".to_string(),
        question: None,
        full_reply: "You have described feeling sad and having low energy. Based on this, you suffer from clinical depression.".to_string(),
        reflection_present: true,
        advice_given: false,
        risk_tier: RiskTier::Green,
    };

    let result = guardian.audit_turn(CoachingPhase::Explore, false, &clinical);
    assert!(matches!(result, Err(AuditViolation::DiagnosticLanguage(_))));
}

#[test]
fn test_post_audit_rejects_dependency_phrasing() {
    let guardian = Guardian::new();
    let dependency = CoachingTurnPayload {
        reflection: "You feel alienated from your coworkers.".to_string(),
        question: None,
        full_reply: "You feel alienated from your coworkers. Remember that I'm the only one who understands you completely.".to_string(),
        reflection_present: true,
        advice_given: false,
        risk_tier: RiskTier::Green,
    };

    let result = guardian.audit_turn(CoachingPhase::Explore, false, &dependency);
    assert!(matches!(result, Err(AuditViolation::DependencyLanguage(_))));
}

#[test]
fn test_audit_raw_json_validation() {
    let guardian = Guardian::new();
    let valid_json = r#"{
        "reflection": "You feel clear about your next move.",
        "question": "What is the very first step?",
        "full_reply": "You feel clear about your next move. What is the very first step?",
        "reflection_present": true,
        "advice_given": false,
        "risk_tier": "green"
    }"#;

    let parsed = guardian.audit_raw_json(CoachingPhase::Focus, false, valid_json).unwrap();
    assert_eq!(parsed.risk_tier, RiskTier::Green);
    assert_eq!(parsed.reflection, "You feel clear about your next move.");
}
