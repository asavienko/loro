//! FSRS — the scheduling algorithm.
//!
//! **Status: skeleton.** The types, the grade mapping, the interval formatter, and the
//! difficulty prior are implemented. The core stability/difficulty update is a port of
//! the reference implementation and lands in M0 with parity tests
//! (`tests/fsrs_parity.rs`).
//!
//! FSRS was chosen because the blueprint's Memory-model screen already *is* FSRS made
//! visible — it plots `R(t) = 0.5^(t/S)`, marks a 50% review threshold, and reports
//! stability in days (`Loro.dc.html:963–1037`). Anything else would mean that screen
//! lies about the algorithm behind it. See ADR-0004.

use crate::{Difficulty, Tag};

/// The four grades FSRS understands.
#[derive(Debug, Clone, Copy, PartialEq, Eq, uniffi::Enum)]
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

/// A phrase's memory state.
#[derive(Debug, Clone, Copy, uniffi::Record)]
pub struct FsrsState {
    /// Days until retrievability decays to the review threshold.
    pub stability: f32,
    /// Intrinsic difficulty for this learner, 1..10.
    pub difficulty: f32,
    /// Next review, epoch ms.
    pub due: i64,
    /// Last review, epoch ms.
    pub last_review: Option<i64>,
    /// Failed reviews.
    pub lapses: u32,
}

/// The learner's five-level confidence rating (the Memory-model screen), mapped to a grade.
///
/// `Strong` maps to `Good` with a stability bonus applied by the caller — it's better
/// than Good but not instant.
#[derive(Debug, Clone, Copy, PartialEq, Eq, uniffi::Enum)]
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
        Difficulty::Easy => 3.5,
        Difficulty::Med => 5.0,
        Difficulty::Hard => 7.5,
    };
    if tags.contains(&Tag::Remember) {
        d += 0.8;
    }
    if tags.contains(&Tag::Words) {
        d += 0.4;
    }
    d.clamp(1.0, 10.0)
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
    (current + delta).clamp(1.0, 10.0)
}

/// Retrievability at `t` days after the last review, in the blueprint's display form.
///
/// The Memory-model screen plots exactly this curve, so it must stay the shape the
/// screen draws.
#[must_use]
#[uniffi::export]
pub fn retrievability(days_since_review: f32, stability: f32) -> f32 {
    if stability <= 0.0 {
        return 0.0;
    }
    0.5_f32.powf(days_since_review / stability)
}

/// Format an interval for display, from the blueprint (`Loro.dc.html:3009`).
///
/// The blueprint's *fixed* interval labels are a display model; these are formatted
/// from FSRS's real output.
#[must_use]
#[uniffi::export]
#[allow(clippy::cast_possible_truncation)] // rounded, and bounded by the branches above
pub fn format_interval(days: f32) -> String {
    if days < 0.9 {
        "~10 min".to_string()
    } else if days < 1.6 {
        "tomorrow".to_string()
    } else if days < 30.0 {
        format!("{} days", days.round() as i32)
    } else {
        format!("{} wks", (days / 7.0).round() as i32)
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

/// Apply a review and produce the next state.
///
/// # Panics
/// Not yet implemented — lands in M0 with `tests/fsrs_parity.rs` asserting parity
/// against the reference implementation.
#[must_use]
pub fn review(_state: FsrsState, _grade: Grade, _at_ms: i64) -> FsrsState {
    todo!("M0: port the FSRS update with parity tests against the reference implementation")
}

#[cfg(test)]
mod tests {
    #![allow(clippy::float_cmp)] // exact-zero sentinels are deliberate here

    use super::*;

    #[test]
    fn confidence_maps_onto_four_grades() {
        assert_eq!(grade_for_confidence(Confidence::Forgot), Grade::Again);
        assert_eq!(grade_for_confidence(Confidence::Shaky), Grade::Hard);
        assert_eq!(grade_for_confidence(Confidence::Ok), Grade::Good);
        assert_eq!(grade_for_confidence(Confidence::Strong), Grade::Good);
        assert_eq!(grade_for_confidence(Confidence::Instant), Grade::Easy);
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
    fn a_rerating_nudges_rather_than_resets() {
        // 20 reviews in, established at 4.0, learner now says Difficult (target 7.5).
        let nudged = nudge_difficulty(4.0, Difficulty::Hard, &[]);
        assert!(
            (nudged - 5.0).abs() < f32::EPSILON,
            "bounded to +1.0, got {nudged}"
        );
    }

    #[test]
    fn retrievability_halves_at_one_stability_period() {
        assert!((retrievability(3.0, 3.0) - 0.5).abs() < 0.001);
        assert!((retrievability(0.0, 3.0) - 1.0).abs() < 0.001);
        assert!(retrievability(9.0, 3.0) < 0.2);
    }

    #[test]
    fn intervals_format_the_way_the_blueprint_does() {
        assert_eq!(format_interval(0.2), "~10 min");
        assert_eq!(format_interval(1.0), "tomorrow");
        assert_eq!(format_interval(5.0), "5 days");
        assert_eq!(format_interval(42.0), "6 wks");
    }

    #[test]
    fn the_daily_cap_scales_with_the_learners_time() {
        assert_eq!(daily_review_cap(5, 4), 20);
        assert_eq!(daily_review_cap(20, 4), 80);
    }
}
