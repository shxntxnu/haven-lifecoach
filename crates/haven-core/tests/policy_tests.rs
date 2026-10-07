//! Comprehensive tests for Thompson Sampling Contextual Bandit policy.

use std::collections::HashMap;
use haven_core::policy::{CoachingTechnique, ThompsonBandit};
use haven_core::state_machine::CoachingMode;

#[test]
fn test_bandit_initialization_priors() {
    let bandit = ThompsonBandit::new();
    let stats = bandit.get_stats(CoachingMode::Explore, CoachingTechnique::ValuesClarification).unwrap();
    assert_eq!(stats.alpha, 1.0);
    assert_eq!(stats.beta, 1.0);
    assert!(!stats.vetoed);
}

#[test]
fn test_posterior_update_feedback() {
    let mut bandit = ThompsonBandit::new();
    let mode = CoachingMode::Build;
    let tech = CoachingTechnique::MicroStepBreakdown;

    bandit.record_feedback(mode, tech, true);
    let stats = bandit.get_stats(mode, tech).unwrap();
    assert_eq!(stats.alpha, 2.0);
    assert_eq!(stats.beta, 1.0);

    bandit.record_feedback(mode, tech, false);
    let stats = bandit.get_stats(mode, tech).unwrap();
    assert_eq!(stats.alpha, 2.0);
    assert_eq!(stats.beta, 2.0);
}

#[test]
fn test_posterior_update_checkout_score() {
    let mut bandit = ThompsonBandit::new();
    let mode = CoachingMode::Perform;
    let tech = CoachingTechnique::StrengthsReframing;

    // Checkout score 5 rewards alpha
    bandit.record_checkout_score(mode, tech, 5);
    let stats = bandit.get_stats(mode, tech).unwrap();
    assert_eq!(stats.alpha, 2.0);
    assert_eq!(stats.beta, 1.0);

    // Checkout score 3 is neutral
    bandit.record_checkout_score(mode, tech, 3);
    let stats = bandit.get_stats(mode, tech).unwrap();
    assert_eq!(stats.alpha, 2.0);
    assert_eq!(stats.beta, 1.0);

    // Checkout score 1 penalizes beta
    bandit.record_checkout_score(mode, tech, 1);
    let stats = bandit.get_stats(mode, tech).unwrap();
    assert_eq!(stats.alpha, 2.0);
    assert_eq!(stats.beta, 2.0);
}

#[test]
fn test_technique_convergence_toward_rewarded() {
    let mut bandit = ThompsonBandit::new();
    let mode = CoachingMode::Explore;
    let rewarded_tech = CoachingTechnique::ValuesClarification;
    let penalized_tech = CoachingTechnique::ExceptionSeeking;

    // Train the bandit: 25 positive rewards for ValuesClarification, 25 negative for ExceptionSeeking
    for _ in 0..25 {
        bandit.record_feedback(mode, rewarded_tech, true);
        bandit.record_feedback(mode, penalized_tech, false);
    }

    let allowed = [rewarded_tech, penalized_tech];
    let mut counts: HashMap<CoachingTechnique, usize> = HashMap::new();
    let iterations = 1000;

    for _ in 0..iterations {
        let chosen = bandit.select_technique(mode, Some(&allowed));
        *counts.entry(chosen).or_insert(0) += 1;
    }

    let rewarded_count = counts.get(&rewarded_tech).copied().unwrap_or(0);
    let penalized_count = counts.get(&penalized_tech).copied().unwrap_or(0);

    // With 10% exploration floor, rewarded technique should capture ~95% of choices
    assert!(
        rewarded_count > 850,
        "Rewarded tech was only chosen {}/{} times",
        rewarded_count,
        iterations
    );
    // Exploration floor guarantees penalized tech is still sampled > 2% of the time
    assert!(
        penalized_count > 20,
        "Exploration floor failed: penalized tech only chosen {} times",
        penalized_count
    );
}

#[test]
fn test_technique_veto_enforcement() {
    let mut bandit = ThompsonBandit::new();
    let mode = CoachingMode::Steady;
    let vetoed_tech = CoachingTechnique::MicroStepBreakdown;

    // Heavily boost alpha for vetoed technique
    for _ in 0..50 {
        bandit.record_feedback(mode, vetoed_tech, true);
    }

    // Now veto it
    bandit.set_veto(mode, vetoed_tech, true);

    // In 500 selections, the vetoed technique must NEVER be selected
    for _ in 0..500 {
        let chosen = bandit.select_technique(mode, None);
        assert_ne!(
            chosen, vetoed_tech,
            "Vetoed technique was selected despite active veto!"
        );
    }
}

#[test]
fn test_stats_export_and_restoration() {
    let mut bandit1 = ThompsonBandit::new();
    bandit1.record_feedback(CoachingMode::Build, CoachingTechnique::ScalingInquiry, true);
    bandit1.set_veto(CoachingMode::Build, CoachingTechnique::ScalingInquiry, true);

    let exported = bandit1.to_stats();
    assert!(!exported.is_empty());

    let bandit2 = ThompsonBandit::from_stats(exported);
    let stats = bandit2
        .get_stats(CoachingMode::Build, CoachingTechnique::ScalingInquiry)
        .unwrap();
    assert_eq!(stats.alpha, 2.0);
    assert_eq!(stats.beta, 1.0);
    assert!(stats.vetoed);
}
