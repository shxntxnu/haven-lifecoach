//! Safety parity test: runs the SHARED fixtures in `resources/safety_fixtures/`.
//!
//! The web app's TypeScript guardian (`platforms/web/src/safety/guardian.ts`) runs the exact same
//! JSON files in its own test suite. If either implementation drifts, one of the two suites fails.

use haven_core::error::AuditViolation;
use haven_core::guardian::{CoachingTurnPayload, Guardian, RiskTier};
use haven_core::state_machine::CoachingPhase;
use serde::Deserialize;

const PRESCAN_JSON: &str = include_str!("../../../resources/safety_fixtures/prescan.json");
const AUDIT_JSON: &str = include_str!("../../../resources/safety_fixtures/audit.json");

#[derive(Deserialize)]
struct PrescanFixtures {
    cases: Vec<PrescanCase>,
}

#[derive(Deserialize)]
struct PrescanCase {
    id: String,
    input: String,
    tier: String,
}

#[derive(Deserialize)]
struct AuditFixtures {
    cases: Vec<AuditCase>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AuditCase {
    id: String,
    phase: CoachingPhase,
    advice_requested: bool,
    payload: AuditPayload,
    expect: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AuditPayload {
    reflection: String,
    full_reply: String,
    reflection_present: bool,
    advice_given: bool,
}

fn tier_name(tier: RiskTier) -> &'static str {
    match tier {
        RiskTier::Green => "green",
        RiskTier::Amber => "amber",
        RiskTier::Red => "red",
    }
}

fn violation_kind(violation: &AuditViolation) -> &'static str {
    match violation {
        AuditViolation::MissingReflection => "missing_reflection",
        AuditViolation::MultipleQuestions(_) => "multiple_questions",
        AuditViolation::UnsolicitedAdvice(_) => "unsolicited_advice",
        AuditViolation::DiagnosticLanguage(_) => "diagnostic_language",
        AuditViolation::DependencyLanguage(_) => "dependency_language",
        AuditViolation::MalformedJson(_) => "malformed_json",
    }
}

#[test]
fn shared_prescan_fixtures_match_expected_tiers() {
    let fixtures: PrescanFixtures = serde_json::from_str(PRESCAN_JSON).expect("valid prescan.json");
    assert!(!fixtures.cases.is_empty());
    let guardian = Guardian::new();

    for case in fixtures.cases {
        let result = guardian.pre_scan(&case.input, "UK");
        assert_eq!(
            tier_name(result.tier),
            case.tier,
            "pre-scan fixture '{}' failed for input: {:?}",
            case.id,
            case.input
        );
    }
}

#[test]
fn shared_audit_fixtures_match_expected_outcomes() {
    let fixtures: AuditFixtures = serde_json::from_str(AUDIT_JSON).expect("valid audit.json");
    assert!(!fixtures.cases.is_empty());
    let guardian = Guardian::new();

    for case in fixtures.cases {
        let payload = CoachingTurnPayload {
            reflection: case.payload.reflection,
            question: None,
            full_reply: case.payload.full_reply,
            reflection_present: case.payload.reflection_present,
            advice_given: case.payload.advice_given,
            risk_tier: RiskTier::Green,
        };

        let outcome = match guardian.audit_turn(case.phase, case.advice_requested, &payload) {
            Ok(()) => "ok",
            Err(ref violation) => violation_kind(violation),
        };

        assert_eq!(outcome, case.expect, "audit fixture '{}' failed", case.id);
    }
}
