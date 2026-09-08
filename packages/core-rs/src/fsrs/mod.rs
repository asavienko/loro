//! FSRS — the scheduling algorithm.
//!
//! FSRS-6 with the default 21 parameters, ported from the official `py-fsrs` v6.3.2
//! scheduler. `tests/fsrs_parity.rs` checks vectors produced by that pinned package.
//! Reference: <https://github.com/open-spaced-repetition/py-fsrs/tree/v6.3.2>.
//! Its MIT notice is retained at `tests/fixtures/fsrs-reference-LICENSE.txt`.
//!
//! Policy: 90% desired retention, no fuzz, no separate learning/relearning steps,
//! and intervals of 1..=36,500 elapsed 24-hour days. A same-day review updates memory
//! with the official short-term rule. The caller supplies every timestamp.
//!
//! FSRS stability is the time to **90%** recall, not the prototype's half-life curve
//! (`Loro.dc.html:963–1037`). All real retrievability uses this module's FSRS curve.

use crate::{Difficulty, Tag};
use serde::{Deserialize, Serialize};

/// The four grades FSRS understands.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, uniffi::Enum)]
#[serde(rename_all = "snake_case")]
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
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, uniffi::Record)]
pub struct FsrsState {
    /// Days until retrievability decays to 90%.
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
/// `Strong` maps to `Good`. The reference algorithm has four grades; adding a
/// caller-side stability bonus would create a second, non-reference scheduler.
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
/// This prior records the learner's declaration before they have reviewed a phrase.
/// `review` initializes canonical memory difficulty from its first observed grade;
/// the declaration itself remains available for ranking and bounded re-rating.
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

/// FSRS-6 retrievability at `t` elapsed days after the last review.
///
/// Stability is the interval at 90% recall. Negative elapsed time is clamped to zero;
/// invalid/non-finite inputs return zero rather than propagating NaN through ranking.
#[must_use]
#[uniffi::export]
#[allow(clippy::cast_possible_truncation)] // probability is in 0..=1
pub fn retrievability(days_since_review: f32, stability: f32) -> f32 {
    if !days_since_review.is_finite() || !stability.is_finite() || stability <= 0.0 {
        return 0.0;
    }
    memory_retrievability(f64::from(days_since_review.max(0.0)), f64::from(stability)) as f32
}

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

/// Algorithm and reference version used by persisted schedules.
pub const SCHEDULER_VERSION: &str = "fsrs-6/py-fsrs-6.3.2/default-90-no-steps";

const WEIGHTS: [f64; 21] = [
    0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796, 1.4835,
    0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542,
];
const STABILITY_MIN: f64 = 0.001;
const DESIRED_RETENTION: f64 = 0.9;
const MAX_INTERVAL_DAYS: f64 = 36_500.0;
const DAY_MS: i64 = 86_400_000;
// The shared boundary includes JavaScript Date, whose range is smaller than i64.
const MAX_TIMESTAMP_MS: i64 = 8_640_000_000_000_000;

/// A review that cannot safely produce a portable, finite schedule.
#[derive(Debug, Clone, Copy, PartialEq, Eq, uniffi::Error)]
pub enum FsrsError {
    /// Memory values are non-finite or outside their domain.
    InvalidState,
    /// Timestamp is outside the supported nonnegative JavaScript Date range.
    InvalidTimestamp,
    /// Applying an older review would rewind the complete memory state.
    ReviewBeforeLastReview,
    /// The next due timestamp would exceed the shared timestamp range.
    TimestampOverflow,
    /// The lapse counter cannot represent another failed review.
    LapseOverflow,
    /// Computed memory state cannot be represented as finite 32-bit values.
    NumericOverflow,
}

impl std::fmt::Display for FsrsError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(match self {
            Self::InvalidState => "invalid FSRS memory state",
            Self::InvalidTimestamp => "invalid FSRS review timestamp",
            Self::ReviewBeforeLastReview => "review predates last FSRS review",
            Self::TimestampOverflow => "FSRS due timestamp exceeds supported range",
            Self::LapseOverflow => "FSRS lapse count exceeds supported range",
            Self::NumericOverflow => "FSRS memory state exceeds supported range",
        })
    }
}

impl std::error::Error for FsrsError {}

fn memory_retrievability(elapsed_days: f64, stability: f64) -> f64 {
    let factor = DESIRED_RETENTION.powf(-1.0 / WEIGHTS[20]) - 1.0;
    (1.0 + factor * elapsed_days / stability).powf(-WEIGHTS[20])
}

fn difficulty_after_first_review(grade: Grade) -> f64 {
    WEIGHTS[4] - (WEIGHTS[5] * (f64::from(grade.as_u8()) - 1.0)).exp() + 1.0
}

fn difficulty_after_review(difficulty: f64, grade: Grade) -> f64 {
    let delta = -WEIGHTS[6] * (f64::from(grade.as_u8()) - 3.0);
    let damped = difficulty + (10.0 - difficulty) * delta / 9.0;
    (WEIGHTS[7] * difficulty_after_first_review(Grade::Easy) + (1.0 - WEIGHTS[7]) * damped)
        .clamp(1.0, 10.0)
}

fn stability_after_review(stability: f64, difficulty: f64, days: f64, grade: Grade) -> f64 {
    if days < 1.0 {
        let increase = (WEIGHTS[17] * (f64::from(grade.as_u8()) - 3.0 + WEIGHTS[18])).exp()
            * stability.powf(-WEIGHTS[19]);
        // v6.3.2 includes Hard in the no-decrease floor for successful same-day reviews.
        return stability
            * if grade == Grade::Again {
                increase
            } else {
                increase.max(1.0)
            };
    }

    let recall = memory_retrievability(days, stability);
    if grade == Grade::Again {
        let forgotten = WEIGHTS[11]
            * difficulty.powf(-WEIGHTS[12])
            * ((stability + 1.0).powf(WEIGHTS[13]) - 1.0)
            * ((1.0 - recall) * WEIGHTS[14]).exp();
        return forgotten.min(stability / (WEIGHTS[17] * WEIGHTS[18]).exp());
    }

    let hard = if grade == Grade::Hard {
        WEIGHTS[15]
    } else {
        1.0
    };
    let easy = if grade == Grade::Easy {
        WEIGHTS[16]
    } else {
        1.0
    };
    stability
        * (1.0
            + WEIGHTS[8].exp()
                * (11.0 - difficulty)
                * stability.powf(-WEIGHTS[9])
                * (((1.0 - recall) * WEIGHTS[10]).exp() - 1.0)
                * hard
                * easy)
}

/// Apply one review using FSRS-6 and the pinned default parameter set.
///
/// `last_review: None` means an unseen phrase: its first grade initializes memory
/// using the reference parameters. Declared difficulty remains a separate input to
/// ranking and re-rating; it does not alter the canonical first-review equation.
/// For established phrases, elapsed whole 24-hour days select the reference
/// short-/long-term update. Due dates are relative to `at_ms`, never to an old due.
/// An Again on an established phrase increments lapses; first exposure does not.
///
/// # Errors
/// Rejects non-finite or invalid memory values, out-of-order reviews, timestamp
/// overflow and lapse overflow. It never silently resets an established state.
#[uniffi::export]
#[allow(clippy::cast_possible_truncation, clippy::cast_precision_loss)]
// Intervals are bounded before casting; f64 arithmetic is rounded to the existing
// f32 storage boundary only once. Timestamps themselves never pass through floats.
pub fn review(state: FsrsState, grade: Grade, at_ms: i64) -> Result<FsrsState, FsrsError> {
    if !state.stability.is_finite()
        || state.stability < 0.0
        || !state.difficulty.is_finite()
        || !(DIFFICULTY_MIN..=DIFFICULTY_MAX).contains(&state.difficulty)
        || (state.last_review.is_some() && f64::from(state.stability) < STABILITY_MIN)
    {
        return Err(FsrsError::InvalidState);
    }
    if !(0..=MAX_TIMESTAMP_MS).contains(&at_ms)
        || state
            .last_review
            .is_some_and(|last| !(0..=MAX_TIMESTAMP_MS).contains(&last))
    {
        return Err(FsrsError::InvalidTimestamp);
    }

    let (stability, difficulty) = if let Some(last) = state.last_review {
        if at_ms < last {
            return Err(FsrsError::ReviewBeforeLastReview);
        }
        let days = ((at_ms - last) / DAY_MS) as f64;
        (
            stability_after_review(
                f64::from(state.stability),
                f64::from(state.difficulty),
                days,
                grade,
            )
            .max(STABILITY_MIN),
            difficulty_after_review(f64::from(state.difficulty), grade),
        )
    } else {
        (
            WEIGHTS[usize::from(grade.as_u8() - 1)],
            difficulty_after_first_review(grade).clamp(1.0, 10.0),
        )
    };
    if !stability.is_finite() || stability > f64::from(f32::MAX) {
        return Err(FsrsError::NumericOverflow);
    }

    // Keep the reference's evaluation order even though this simplifies to stability
    // at 90% retention: floating-point rounding at a half-day boundary must agree.
    let factor = DESIRED_RETENTION.powf(-1.0 / WEIGHTS[20]) - 1.0;
    let interval = (stability / factor) * (DESIRED_RETENTION.powf(-1.0 / WEIGHTS[20]) - 1.0);
    let interval_days = interval.round_ties_even().clamp(1.0, MAX_INTERVAL_DAYS) as i64;
    let due = at_ms
        .checked_add(interval_days * DAY_MS)
        .filter(|due| *due <= MAX_TIMESTAMP_MS)
        .ok_or(FsrsError::TimestampOverflow)?;
    let lapses = if state.last_review.is_some() && grade == Grade::Again {
        state
            .lapses
            .checked_add(1)
            .ok_or(FsrsError::LapseOverflow)?
    } else {
        state.lapses
    };

    Ok(FsrsState {
        stability: stability as f32,
        difficulty: difficulty as f32,
        due,
        last_review: Some(at_ms),
        lapses,
    })
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
            // Both descriptions represent the reference Good grade.
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
    fn canonical_retrievability_is_ninety_percent_at_stability() {
        assert!((retrievability(3.0, 3.0) - 0.9).abs() < 0.001);
        assert!((retrievability(0.0, 3.0) - 1.0).abs() < 0.001);
        assert!(retrievability(9.0, 3.0) < retrievability(3.0, 3.0));
        assert_eq!(retrievability(-3.0, 3.0), 1.0);
        for invalid in [f32::NAN, f32::INFINITY, f32::NEG_INFINITY] {
            assert_eq!(retrievability(invalid, 3.0), 0.0);
            assert_eq!(retrievability(3.0, invalid), 0.0);
        }
        assert_eq!(retrievability(3.0, 0.0), 0.0);
        assert_eq!(retrievability(3.0, -3.0), 0.0);
    }

    fn established_state() -> FsrsState {
        FsrsState {
            stability: 5.0,
            difficulty: 5.0,
            due: 2 * DAY_MS,
            last_review: Some(DAY_MS),
            lapses: 2,
        }
    }

    #[test]
    fn malformed_memory_never_silently_resets_progress() {
        for invalid in [f32::NAN, f32::INFINITY, f32::NEG_INFINITY, -1.0] {
            for state in [
                FsrsState {
                    stability: invalid,
                    ..established_state()
                },
                FsrsState {
                    difficulty: invalid,
                    ..established_state()
                },
            ] {
                assert_eq!(
                    review(state, Grade::Good, 3 * DAY_MS),
                    Err(FsrsError::InvalidState)
                );
            }
        }
        for (stability, difficulty) in [(0.0, 5.0), (0.0001, 5.0), (5.0, 0.0), (5.0, 11.0)] {
            let state = FsrsState {
                stability,
                difficulty,
                ..established_state()
            };
            assert_eq!(
                review(state, Grade::Good, 3 * DAY_MS),
                Err(FsrsError::InvalidState)
            );
        }
    }

    #[test]
    fn out_of_order_and_unportable_timestamps_are_rejected() {
        assert_eq!(
            review(established_state(), Grade::Good, DAY_MS - 1),
            Err(FsrsError::ReviewBeforeLastReview)
        );
        for at in [-1, i64::MIN, MAX_TIMESTAMP_MS + 1, i64::MAX] {
            assert_eq!(
                review(established_state(), Grade::Good, at),
                Err(FsrsError::InvalidTimestamp)
            );
        }
        assert_eq!(
            review(
                FsrsState {
                    last_review: Some(-1),
                    ..established_state()
                },
                Grade::Good,
                DAY_MS
            ),
            Err(FsrsError::InvalidTimestamp)
        );
        assert_eq!(
            review(established_state(), Grade::Good, MAX_TIMESTAMP_MS),
            Err(FsrsError::TimestampOverflow)
        );
    }

    #[test]
    fn lapses_do_not_wrap_or_count_initial_exposure() {
        assert_eq!(
            review(
                FsrsState {
                    lapses: u32::MAX,
                    ..established_state()
                },
                Grade::Again,
                3 * DAY_MS,
            ),
            Err(FsrsError::LapseOverflow)
        );
        let first = review(
            FsrsState {
                stability: 0.0,
                last_review: None,
                lapses: 0,
                ..established_state()
            },
            Grade::Again,
            DAY_MS,
        )
        .unwrap();
        assert_eq!(first.lapses, 0);
        assert_eq!(review(first, Grade::Again, DAY_MS).unwrap().lapses, 1);
    }

    proptest::proptest! {
        #[test]
        fn schedules_are_deterministic_finite_bounded_and_after_the_review(
            stability in 0.001_f32..100_000.0_f32,
            difficulty in 1.0_f32..=10.0_f32,
            elapsed_days in 0_i64..=36_500,
            grade_index in 0_usize..4,
        ) {
            let state = FsrsState { stability, difficulty, ..established_state() };
            let at = DAY_MS + elapsed_days * DAY_MS;
            let grade = [Grade::Again, Grade::Hard, Grade::Good, Grade::Easy][grade_index];
            let next = review(state, grade, at).unwrap();
            proptest::prop_assert_eq!(next, review(state, grade, at).unwrap());
            proptest::prop_assert!(next.stability.is_finite() && next.stability >= 0.001);
            proptest::prop_assert!((1.0..=10.0).contains(&next.difficulty));
            proptest::prop_assert!(next.due >= at + DAY_MS);
            proptest::prop_assert!(next.due <= at + 36_500 * DAY_MS);
            proptest::prop_assert_eq!((next.due - at) % DAY_MS, 0);
            proptest::prop_assert_eq!(next.last_review, Some(at));
            if grade != Grade::Again {
                proptest::prop_assert!(next.stability >= stability);
            }
        }
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
