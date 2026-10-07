//! Thompson Sampling Contextual Bandit for technique selection.
//!
//! Adapts coaching interventions without altering underlying LLM model weights.
//! Maintains independent Beta distributions per coaching mode and technique,
//! updating strictly on user checkout ratings and one-tap feedback.

use std::collections::HashMap;
use rand::seq::SliceRandom;
use rand::Rng;
use rand_distr::{Beta, Distribution};
use serde::{Deserialize, Serialize};

use crate::state_machine::CoachingMode;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum CoachingTechnique {
    ValuesClarification,
    ScalingInquiry,
    StrengthsReframing,
    MicroStepBreakdown,
    PerspectiveShift,
    ExceptionSeeking,
    GroundingBreath,
}

impl CoachingTechnique {
    pub fn all() -> &'static [CoachingTechnique] {
        &[
            CoachingTechnique::ValuesClarification,
            CoachingTechnique::ScalingInquiry,
            CoachingTechnique::StrengthsReframing,
            CoachingTechnique::MicroStepBreakdown,
            CoachingTechnique::PerspectiveShift,
            CoachingTechnique::ExceptionSeeking,
            CoachingTechnique::GroundingBreath,
        ]
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            CoachingTechnique::ValuesClarification => "Values Clarification",
            CoachingTechnique::ScalingInquiry => "Scaling Inquiry",
            CoachingTechnique::StrengthsReframing => "Strengths Reframing",
            CoachingTechnique::MicroStepBreakdown => "Micro-Step Breakdown",
            CoachingTechnique::PerspectiveShift => "Perspective Shift",
            CoachingTechnique::ExceptionSeeking => "Exception Seeking",
            CoachingTechnique::GroundingBreath => "Grounding Breath",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TechniqueStats {
    pub mode: CoachingMode,
    pub technique: CoachingTechnique,
    pub alpha: f64,
    pub beta: f64,
    pub vetoed: bool,
}

impl TechniqueStats {
    pub fn new(mode: CoachingMode, technique: CoachingTechnique) -> Self {
        Self {
            mode,
            technique,
            alpha: 1.0,
            beta: 1.0,
            vetoed: false,
        }
    }
}

#[derive(Debug, Clone)]
pub struct ThompsonBandit {
    stats: HashMap<(CoachingMode, CoachingTechnique), TechniqueStats>,
    exploration_floor: f64,
}

impl Default for ThompsonBandit {
    fn default() -> Self {
        Self::new()
    }
}

impl ThompsonBandit {
    pub const DEFAULT_EXPLORATION_FLOOR: f64 = 0.10;

    /// Initialize bandit with Beta(1.0, 1.0) priors across all mode-technique combinations.
    pub fn new() -> Self {
        let mut stats = HashMap::new();
        let modes = [
            CoachingMode::Steady,
            CoachingMode::Explore,
            CoachingMode::Build,
            CoachingMode::Perform,
        ];

        for &mode in &modes {
            for &technique in CoachingTechnique::all() {
                stats.insert(
                    (mode, technique),
                    TechniqueStats::new(mode, technique),
                );
            }
        }

        Self {
            stats,
            exploration_floor: Self::DEFAULT_EXPLORATION_FLOOR,
        }
    }

    /// Restore bandit from persisted technique stats records.
    pub fn from_stats(stats_list: Vec<TechniqueStats>) -> Self {
        let mut bandit = Self::new();
        for s in stats_list {
            bandit.stats.insert((s.mode, s.technique), s);
        }
        bandit
    }

    /// Export current technique stats for database persistence.
    pub fn to_stats(&self) -> Vec<TechniqueStats> {
        self.stats.values().cloned().collect()
    }

    pub fn set_exploration_floor(&mut self, epsilon: f64) {
        self.exploration_floor = epsilon.clamp(0.0, 1.0);
    }

    pub fn get_exploration_floor(&self) -> f64 {
        self.exploration_floor
    }

    pub fn get_stats(&self, mode: CoachingMode, technique: CoachingTechnique) -> Option<&TechniqueStats> {
        self.stats.get(&(mode, technique))
    }

    /// Toggle user veto for a specific mode and technique.
    pub fn set_veto(&mut self, mode: CoachingMode, technique: CoachingTechnique, vetoed: bool) {
        if let Some(entry) = self.stats.get_mut(&(mode, technique)) {
            entry.vetoed = vetoed;
        }
    }

    /// Select a coaching technique using Thompson Sampling with an exploration floor.
    ///
    /// 1. Filters by allowed list and non-vetoed status.
    /// 2. With probability epsilon (0.10): Selects uniform random technique.
    /// 3. With probability 1 - epsilon: Samples theta ~ Beta(alpha, beta) and selects argmax(theta).
    pub fn select_technique(
        &self,
        mode: CoachingMode,
        allowed: Option<&[CoachingTechnique]>,
    ) -> CoachingTechnique {
        let candidate_pool = match allowed {
            Some(list) => list,
            None => CoachingTechnique::all(),
        };

        // Filter out vetoed techniques
        let eligible: Vec<CoachingTechnique> = candidate_pool
            .iter()
            .copied()
            .filter(|&tech| {
                self.stats
                    .get(&(mode, tech))
                    .map(|s| !s.vetoed)
                    .unwrap_or(true)
            })
            .collect();

        // Fallback if all techniques are vetoed or empty
        if eligible.is_empty() {
            return candidate_pool.first().copied().unwrap_or(CoachingTechnique::ValuesClarification);
        }

        let mut rng = rand::thread_rng();

        // Exploration floor: uniform random selection with probability epsilon
        if rng.gen_bool(self.exploration_floor) {
            return *eligible.choose(&mut rng).unwrap();
        }

        // Exploitation: sample theta ~ Beta(alpha, beta) for each eligible technique
        let mut best_technique = eligible[0];
        let mut max_theta = -1.0;

        for &tech in &eligible {
            let (alpha, beta_param) = self
                .stats
                .get(&(mode, tech))
                .map(|s| (s.alpha.max(0.1), s.beta.max(0.1)))
                .unwrap_or((1.0, 1.0));

            let theta = match Beta::new(alpha, beta_param) {
                Ok(dist) => dist.sample(&mut rng),
                Err(_) => 0.5,
            };

            if theta > max_theta {
                max_theta = theta;
                best_technique = tech;
            }
        }

        best_technique
    }

    /// Record one-tap feedback ("That helped" = true, "Not quite" = false).
    pub fn record_feedback(&mut self, mode: CoachingMode, technique: CoachingTechnique, helpful: bool) {
        let entry = self
            .stats
            .entry((mode, technique))
            .or_insert_with(|| TechniqueStats::new(mode, technique));

        if helpful {
            entry.alpha += 1.0;
        } else {
            entry.beta += 1.0;
        }
    }

    /// Update posterior distribution based on session checkout score (1..=5).
    /// - Score 4 or 5: Treated as positive reward (+1 alpha).
    /// - Score 1 or 2: Treated as negative reward (+1 beta).
    /// - Score 3: Neutral (no change).
    pub fn record_checkout_score(
        &mut self,
        mode: CoachingMode,
        technique: CoachingTechnique,
        score: u8,
    ) {
        match score {
            4 | 5 => self.record_feedback(mode, technique, true),
            1 | 2 => self.record_feedback(mode, technique, false),
            _ => {} // Score 3 is neutral
        }
    }
}
