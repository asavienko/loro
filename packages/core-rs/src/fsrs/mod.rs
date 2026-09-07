//! Canonical FSRS-6 memory updates with explicit Loro scheduling policy.
//! See `docs/architecture/fsrs-model.md` for the pinned reference and adaptations.

use crate::{Difficulty, Tag};

/// The four grades FSRS understands.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize, uniffi::Enum)]
pub enum Grade {
    /// Couldn't recall it.
    Again,
    /// Recalled with difficulty.
    Hard,
    /// Recalled.
    Good,
    /// Recalled instantly.
    Easy,
}

impl Grade {
    /// FSRS's 1..4 numbering.
    #[must_use]
    pub const fn as_u8(self) -> u8 {
        match self {
            Self::Again => 1,
            Self::Hard => 2,
            Self::Good => 3,
            Self::Easy => 4,
        }
    }
}

/// Scheduler lifecycle; Loro uses one explicit ten-minute learning/relearning step.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize, uniffi::Enum)]
#[serde(rename_all = "lowercase")]
pub enum CardState {
    /// No review evidence yet.
    New,
    /// Initial recall has not succeeded.
    Learning,
    /// Established scheduled review.
    Review,
    /// A scheduled review failed.
    Relearning,
}

/// Complete atomic scheduler group, including algorithm provenance.
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, uniffi::Record)]
pub struct FsrsState {
    /// Days until recall reaches 90%, NOT the selected scheduling threshold.
    pub stability: f64,
    /// Intrinsic difficulty in 1..10.
    pub difficulty: f64,
    /// Next review, epoch milliseconds.
    pub due: i64,
    /// Last observed review, epoch milliseconds; absent for new cards.
    pub last_review: Option<i64>,
    /// Failed established reviews (not repeated learning failures).
    pub lapses: u32,
    /// Learning lifecycle.
    pub state: CardState,
    /// Versioned algorithm, parameters and Loro policy identifier.
    pub algorithm: String,
}

/// The learner's five-level confidence rating (the Memory-model screen), mapped to a grade.
///
/// `Strong` maps to `Good`; `review_confidence` applies the documented 10% stability
/// bonus in the canonical core.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize, uniffi::Enum)]
pub enum Confidence {
    /// Blank.
    Forgot,
    /// Guessed.
    Shaky,
    /// Effortful.
    Ok,
    /// Quick.
    Strong,
    /// Automatic.
    Instant,
}

// ── The difficulty scale ─────────────────────────────────────────────────────────────
//
// FSRS's own 1..10, as declared on `FsrsState::difficulty`. Every function that produces
// a difficulty clamps to this range, and it is one range so the two cannot drift apart.

/// Easiest a phrase can be for a learner.
const DIFFICULTY_MIN: f32 = 1.0;
/// Hardest a phrase can be for a learner.
const DIFFICULTY_MAX: f32 = 10.0;

// ── Priors, seeded from the learner's own declaration ────────────────────────────────
//
// Loro's structural advantage over other FSRS apps: no cold start. Spaced either side of
// `PRIOR_MED` so that a declaration moves the prior by more than either tag can.

/// Prior for a phrase the learner called Easy.
const PRIOR_EASY: f32 = 3.5;
/// Prior for "Learning" — mid-scale, the neutral declaration.
const PRIOR_MED: f32 = 5.0;
/// Prior for a phrase the learner called Difficult.
const PRIOR_HARD: f32 = 7.5;

/// What "the meaning won't stick" adds. The largest tag adjustment: `Remember` is a
/// statement about memory load, which is exactly what difficulty models.
const TAG_REMEMBER_ADJUSTMENT: f32 = 0.8;

/// What "specific words trip me up" adds. Half of `Remember`: a lexical snag is a smaller
/// memory cost than a whole meaning that won't stick.
///
/// `Pron` and `Useful` are deliberately absent — `Pron` changes the *drill*, not the
/// memory load, and `Useful` is motivation.
const TAG_WORDS_ADJUSTMENT: f32 = 0.4;

/// Map a five-level confidence onto a grade.
#[must_use]
#[uniffi::export]
pub fn grade_for_confidence(c: Confidence) -> Grade {
    match c {
        Confidence::Forgot => Grade::Again,
        Confidence::Shaky => Grade::Hard,
        Confidence::Ok | Confidence::Strong => Grade::Good,
        Confidence::Instant => Grade::Easy,
    }
}

/// Seed FSRS difficulty from the learner's own declaration.
///
/// This is Loro's structural advantage over every other app using FSRS: the learner
/// tells us a phrase's difficulty when they add it, so there is no cold start.
///
/// `pron` deliberately does **not** raise difficulty — it changes the *drill*, not the
/// memory load.
#[must_use]
#[uniffi::export]
pub fn initial_difficulty(declared: Difficulty, tags: &[Tag]) -> f32 {
    let mut d: f32 = match declared {
        Difficulty::Easy => PRIOR_EASY,
        Difficulty::Med => PRIOR_MED,
        Difficulty::Hard => PRIOR_HARD,
    };
    if tags.contains(&Tag::Remember) {
        d += TAG_REMEMBER_ADJUSTMENT;
    }
    if tags.contains(&Tag::Words) {
        d += TAG_WORDS_ADJUSTMENT;
    }
    d.clamp(DIFFICULTY_MIN, DIFFICULTY_MAX)
}

/// How far a re-rating may nudge an established difficulty.
///
/// Re-rating **adjusts, never resets**: a learner changing a phrase to Difficult after
/// 20 reviews shouldn't discard hard-won state.
pub const RERATE_MAX_NUDGE: f32 = 1.0;

/// Nudge an established difficulty toward a new declaration, bounded.
#[must_use]
#[uniffi::export]
pub fn nudge_difficulty(current: f32, declared: Difficulty, tags: &[Tag]) -> f32 {
    let target = initial_difficulty(declared, tags);
    let delta = (target - current).clamp(-RERATE_MAX_NUDGE, RERATE_MAX_NUDGE);
    (current + delta).clamp(DIFFICULTY_MIN, DIFFICULTY_MAX)
}

mod scheduler;
pub use scheduler::{
    initialize, reference_initial_memory, rerate, retrievability, review, review_confidence,
    FsrsError, ALGORITHM, DESIRED_RETENTION,
};

// ── Display thresholds for `format_interval` (`Loro.dc.html:3009`) ───────────────────

/// Below this many days, the review is same-session: shown as the relearn step, not a
/// date. Just under 1 so that an interval of exactly one day reads as "tomorrow".
const INTERVAL_SUB_DAY_MAX: f32 = 0.9;

/// Below this, "tomorrow". Above 1.5 so a 1.5-day interval rounds *to* tomorrow rather
/// than displaying as "2 days".
const INTERVAL_TOMORROW_MAX: f32 = 1.6;

/// Below this, count in days; at or above it, count in weeks. A month of days is a number
/// a learner stops being able to feel.
const INTERVAL_DAYS_MAX: f32 = 30.0;

/// Days per week, for the weeks read-out.
const DAYS_PER_WEEK: f32 = 7.0;

/// Format an interval for display, from the blueprint (`Loro.dc.html:3009`).
///
/// The blueprint's *fixed* interval labels are a display model; these are formatted
/// from FSRS's real output.
#[must_use]
#[uniffi::export]
#[allow(clippy::cast_possible_truncation)] // rounded, and bounded by the branches above
pub fn format_interval(days: f32) -> String {
    if days < INTERVAL_SUB_DAY_MAX {
        "~10 min".to_string()
    } else if days < INTERVAL_TOMORROW_MAX {
        "tomorrow".to_string()
    } else if days < INTERVAL_DAYS_MAX {
        format!("{} days", days.round() as i32)
    } else {
        format!("{} wks", (days / DAYS_PER_WEEK).round() as i32)
    }
}

/// Daily review cap, so a queue never becomes a wall.
///
/// Uncapped review queues are how SRS apps lose learners in month two.
#[must_use]
#[uniffi::export]
pub fn daily_review_cap(daily_minutes: u32, multiplier: u32) -> u32 {
    daily_minutes * multiplier
}

#[cfg(test)]
mod tests {
    #![allow(clippy::float_cmp)] // exact-zero sentinels are deliberate here

    use super::*;

    #[test]
    fn confidence_maps_onto_four_grades() {
        for (confidence, grade) in [
            (Confidence::Forgot, Grade::Again),
            (Confidence::Shaky, Grade::Hard),
            (Confidence::Ok, Grade::Good),
            // The grade mapping is separate from review_confidence's stability bonus.
            (Confidence::Strong, Grade::Good),
            (Confidence::Instant, Grade::Easy),
        ] {
            assert_eq!(grade_for_confidence(confidence), grade, "{confidence:?}");
        }
    }

    #[test]
    fn grades_number_the_way_fsrs_expects() {
        assert_eq!(
            [Grade::Again, Grade::Hard, Grade::Good, Grade::Easy].map(Grade::as_u8),
            [1, 2, 3, 4]
        );
    }

    #[test]
    fn declared_difficulty_seeds_the_prior() {
        assert!(
            initial_difficulty(Difficulty::Easy, &[]) < initial_difficulty(Difficulty::Med, &[])
        );
        assert!(
            initial_difficulty(Difficulty::Med, &[]) < initial_difficulty(Difficulty::Hard, &[])
        );
    }

    #[test]
    fn remember_raises_difficulty_but_pron_does_not() {
        let base = initial_difficulty(Difficulty::Med, &[]);
        assert!(initial_difficulty(Difficulty::Med, &[Tag::Remember]) > base);
        assert_eq!(initial_difficulty(Difficulty::Med, &[Tag::Pron]), base);
    }

    #[test]
    fn every_prior_lands_inside_the_fsrs_scale() {
        // All sixteen tag subsets, so no combination can push the prior out of 1..10.
        const TAGS: [Tag; 4] = [Tag::Pron, Tag::Remember, Tag::Useful, Tag::Words];
        for declared in [Difficulty::Easy, Difficulty::Med, Difficulty::Hard] {
            for mask in 0..(1u8 << TAGS.len()) {
                let tags: Vec<Tag> = TAGS
                    .iter()
                    .enumerate()
                    .filter(|(i, _)| mask & (1 << i) != 0)
                    .map(|(_, t)| *t)
                    .collect();
                let d = initial_difficulty(declared, &tags);
                assert!(
                    (DIFFICULTY_MIN..=DIFFICULTY_MAX).contains(&d),
                    "{declared:?} with {tags:?} gave {d}"
                );
            }
        }
    }

    #[test]
    fn a_rerating_nudges_rather_than_resets() {
        // 20 reviews in, established at 4.0, learner now says Difficult (target 7.5).
        let nudged = nudge_difficulty(4.0, Difficulty::Hard, &[]);
        assert!(
            (nudged - 5.0).abs() < f32::EPSILON,
            "bounded to +1.0, got {nudged}"
        );
    }

    #[test]
    fn a_rerating_downwards_is_bounded_the_same_way() {
        // Established at 8.0, learner now says Easy (target 3.5). One rung, not five.
        let nudged = nudge_difficulty(8.0, Difficulty::Easy, &[]);
        assert!(
            (nudged - 7.0).abs() < f32::EPSILON,
            "bounded to -1.0, got {nudged}"
        );
    }

    #[test]
    fn a_nudge_pulls_an_out_of_range_difficulty_back_into_the_scale() {
        // A corrupt or migrated row must not stay outside 1..10.
        assert!(nudge_difficulty(20.0, Difficulty::Hard, &[]) <= DIFFICULTY_MAX);
        assert!(nudge_difficulty(-5.0, Difficulty::Easy, &[]) >= DIFFICULTY_MIN);
    }

    #[test]
    fn retrievability_uses_fsrs_ninety_percent_stability() {
        assert!((retrievability(3.0, 3.0).unwrap() - 0.9).abs() < 0.000_001);
        assert_eq!(retrievability(0.0, 3.0).unwrap(), 1.0);
        assert!(retrievability(-1.0, 3.0).is_err());
        assert!(retrievability(1.0, 0.0).is_err());
    }

    #[test]
    fn intervals_format_the_way_the_blueprint_does() {
        for (days, expect) in [
            (0.0, "~10 min"),
            (0.2, "~10 min"),
            // Each boundary from both sides, so a threshold can't move unnoticed.
            (INTERVAL_SUB_DAY_MAX, "tomorrow"),
            (1.0, "tomorrow"),
            (1.5, "tomorrow"),
            (INTERVAL_TOMORROW_MAX, "2 days"),
            (5.0, "5 days"),
            (29.4, "29 days"),
            (INTERVAL_DAYS_MAX, "4 wks"),
            (42.0, "6 wks"),
            (365.0, "52 wks"),
        ] {
            assert_eq!(format_interval(days), expect, "{days} days");
        }
    }

    #[test]
    fn the_daily_cap_scales_with_the_learners_time() {
        assert_eq!(daily_review_cap(5, 4), 20);
        assert_eq!(daily_review_cap(20, 4), 80);
    }
}
