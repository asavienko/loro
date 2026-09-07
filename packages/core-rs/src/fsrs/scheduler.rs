//! FSRS-6 equations ported from ts-fsrs c8ca282edc3fe1cdfa1c24912437938b63a25cb3.
//! Upstream is MIT licensed; attribution and full policy are in fsrs-model.md.
use super::{initial_difficulty, CardState, Confidence, FsrsState, Grade};
use crate::{Difficulty, Tag};

/// Identifies the complete parameter and adaptation policy, not just an algorithm family.
pub const ALGORITHM: &str = "fsrs-6-default-c8ca282-loro-v1";
/// Authored Loro review threshold, independent of the 90% stability definition.
pub const DESIRED_RETENTION: f64 = 0.5;
const W: [f64; 21] = [
    0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796, 1.4835,
    0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542,
];
const DAY_MS: i64 = 86_400_000;
const STEP_MS: i64 = 600_000;
const HARD_STEP_MS: i64 = 900_000;
const MAX_SAFE_MS: i64 = 9_007_199_254_740_991;
const MIN_STABILITY: f64 = 0.001;
const MAX_STABILITY: f64 = 36_500.0;

/// Explicit invalid-input failures cross both WASM and native bindings.
#[derive(Debug, Clone, PartialEq, Eq, uniffi::Error)]
pub enum FsrsError {
    /// Non-finite values, invalid memory state, or inconsistent lifecycle.
    InvalidState,
    /// Negative, backward or unsafe epoch milliseconds.
    InvalidTime,
    /// A legacy/foreign state must be explicitly converted before review.
    UnsupportedAlgorithm,
    /// A due timestamp or lapse counter cannot be represented.
    Overflow,
}
impl std::fmt::Display for FsrsError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "FSRS error: {self:?}")
    }
}
impl std::error::Error for FsrsError {}

fn round8(value: f64) -> f64 {
    (value * 100_000_000.0).round() / 100_000_000.0
}
fn factor() -> f64 {
    round8((0.9_f64.ln() / -W[20]).exp() - 1.0)
}
fn time(at_ms: i64) -> Result<(), FsrsError> {
    if (0..=MAX_SAFE_MS).contains(&at_ms) {
        Ok(())
    } else {
        Err(FsrsError::InvalidTime)
    }
}
fn raw_difficulty(grade: Grade) -> f64 {
    round8(W[4] - (f64::from(grade.as_u8() - 1) * W[5]).exp() + 1.0)
}

/// Reference first-observation memory state, without Loro's declared difficulty prior.
#[must_use]
pub fn reference_initial_memory(grade: Grade) -> (f64, f64) {
    (
        W[usize::from(grade.as_u8() - 1)].max(0.1),
        raw_difficulty(grade).clamp(1.0, 10.0),
    )
}

/// Create a new card without pretending that adding a phrase is a recall observation.
///
/// # Errors
/// Rejects unsafe timestamps.
#[uniffi::export]
pub fn initialize(declared: Difficulty, tags: &[Tag], at_ms: i64) -> Result<FsrsState, FsrsError> {
    time(at_ms)?;
    Ok(FsrsState {
        stability: 0.0,
        // Existing declaration priors are specified to one decimal place.
        difficulty: (f64::from(initial_difficulty(declared, tags)) * 10.0).round() / 10.0,
        due: at_ms,
        last_review: None,
        lapses: 0,
        state: CardState::New,
        algorithm: ALGORITHM.into(),
    })
}

/// FSRS-6 power curve. Stability is the interval at 90% recall.
///
/// # Errors
/// Rejects non-finite, negative elapsed time or nonpositive stability.
#[uniffi::export]
pub fn retrievability(days_since_review: f64, stability: f64) -> Result<f64, FsrsError> {
    if !days_since_review.is_finite()
        || days_since_review < 0.0
        || !stability.is_finite()
        || stability <= 0.0
    {
        return Err(FsrsError::InvalidState);
    }
    Ok(round8(
        (1.0 + factor() * days_since_review / stability).powf(-W[20]),
    ))
}

fn next_memory(stability: f64, difficulty: f64, elapsed: f64, grade: Grade) -> (f64, f64) {
    let g = f64::from(grade.as_u8());
    let damping = round8(-W[6] * (g - 3.0) * (10.0 - difficulty) / 9.0);
    let next_d = round8(W[7] * raw_difficulty(Grade::Easy) + (1.0 - W[7]) * (difficulty + damping))
        .clamp(1.0, 10.0);
    let r = round8((1.0 + factor() * elapsed / stability).powf(-W[20]));
    let next_s = if elapsed == 0.0 {
        let increase = stability.powf(-W[19]) * (W[17] * (g - 3.0 + W[18])).exp();
        stability
            * if grade == Grade::Again {
                increase
            } else {
                increase.max(1.0)
            }
    } else if grade == Grade::Again {
        let failed = round8(
            (W[11]
                * difficulty.powf(-W[12])
                * ((stability + 1.0).powf(W[13]) - 1.0)
                * (W[14] * (1.0 - r)).exp())
            .clamp(MIN_STABILITY, MAX_STABILITY),
        );
        round8(stability / (W[17] * W[18]).exp())
            .max(MIN_STABILITY)
            .min(failed)
    } else {
        let penalty = if grade == Grade::Hard { W[15] } else { 1.0 };
        let bonus = if grade == Grade::Easy { W[16] } else { 1.0 };
        stability
            * (1.0
                + W[8].exp()
                    * (11.0 - difficulty)
                    * stability.powf(-W[9])
                    * ((W[10] * (1.0 - r)).exp() - 1.0)
                    * penalty
                    * bonus)
    };
    (round8(next_s.clamp(MIN_STABILITY, MAX_STABILITY)), next_d)
}

fn validate(state: &FsrsState, at_ms: i64) -> Result<(), FsrsError> {
    time(at_ms)?;
    time(state.due)?;
    if state.algorithm != ALGORITHM {
        return Err(FsrsError::UnsupportedAlgorithm);
    }
    if !state.difficulty.is_finite()
        || !(1.0..=10.0).contains(&state.difficulty)
        || !state.stability.is_finite()
    {
        return Err(FsrsError::InvalidState);
    }
    if state.state == CardState::New {
        if state.stability != 0.0 || state.last_review.is_some() || state.lapses != 0 {
            return Err(FsrsError::InvalidState);
        }
        if at_ms < state.due {
            return Err(FsrsError::InvalidTime);
        }
    } else {
        if !(MIN_STABILITY..=MAX_STABILITY).contains(&state.stability) {
            return Err(FsrsError::InvalidState);
        }
        let last = state.last_review.ok_or(FsrsError::InvalidState)?;
        time(last)?;
        if at_ms < last || state.due < last {
            return Err(FsrsError::InvalidTime);
        }
    }
    Ok(())
}

#[allow(clippy::cast_possible_truncation)] // bounded to 1..36500 whole days before cast
fn scheduled_ms(stability: f64) -> i64 {
    let modifier = round8((DESIRED_RETENTION.powf(1.0 / -W[20]) - 1.0) / factor());
    ((stability * modifier).round().clamp(1.0, MAX_STABILITY) as i64) * DAY_MS
}

/// Apply an observed grade with full card state, no randomized interval fuzz.
///
/// # Errors
/// Rejects invalid/legacy state, backward time and timestamp/counter overflow.
#[uniffi::export]
pub fn review(mut state: FsrsState, grade: Grade, at_ms: i64) -> Result<FsrsState, FsrsError> {
    validate(&state, at_ms)?;
    let was_new = state.state == CardState::New;
    let was_review = state.state == CardState::Review;
    let (stability, difficulty) = if was_new {
        // Declared difficulty is a Loro prior; it is not reference initialization.
        (reference_initial_memory(grade).0, state.difficulty)
    } else {
        #[allow(clippy::cast_precision_loss)]
        // safe integer elapsed whole days within JS epoch range
        let elapsed = ((at_ms - state.last_review.ok_or(FsrsError::InvalidState)?) / DAY_MS) as f64;
        next_memory(state.stability, state.difficulty, elapsed, grade)
    };
    state.stability = stability;
    state.difficulty = difficulty;
    state.state = match grade {
        Grade::Again if was_new || state.state == CardState::Learning => CardState::Learning,
        Grade::Again => CardState::Relearning,
        Grade::Hard if was_new => CardState::Learning,
        Grade::Hard if !was_review => state.state,
        _ => CardState::Review,
    };
    if grade == Grade::Again && was_review {
        state.lapses = state.lapses.checked_add(1).ok_or(FsrsError::Overflow)?;
    }
    let delay = match state.state {
        CardState::Learning | CardState::Relearning => {
            if grade == Grade::Hard {
                HARD_STEP_MS
            } else {
                STEP_MS
            }
        }
        _ => scheduled_ms(stability),
    };
    state.due = at_ms
        .checked_add(delay)
        .filter(|due| *due <= MAX_SAFE_MS)
        .ok_or(FsrsError::Overflow)?;
    state.last_review = Some(at_ms);
    Ok(state)
}

/// Apply a changed declaration without manufacturing a review or rescheduling it.
///
/// # Errors
/// Rejects corrupt or foreign state using the same validation as review.
#[uniffi::export]
pub fn rerate(
    mut state: FsrsState,
    declared: Difficulty,
    tags: &[Tag],
) -> Result<FsrsState, FsrsError> {
    validate(&state, state.last_review.unwrap_or(state.due))?;
    let target = (f64::from(initial_difficulty(declared, tags)) * 10.0).round() / 10.0;
    state.difficulty = if state.state == CardState::New {
        target
    } else {
        (state.difficulty + (target - state.difficulty).clamp(-1.0, 1.0)).clamp(1.0, 10.0)
    };
    Ok(state)
}

/// Apply Loro confidence policy; Strong adds 10% stability to Good and recomputes due.
///
/// # Errors
/// Same validation and overflow failures as `review`.
#[uniffi::export]
pub fn review_confidence(
    state: FsrsState,
    confidence: Confidence,
    at_ms: i64,
) -> Result<FsrsState, FsrsError> {
    let mut next = review(state, super::grade_for_confidence(confidence), at_ms)?;
    if confidence == Confidence::Strong {
        next.stability = round8((next.stability * 1.1).min(MAX_STABILITY));
        next.due = at_ms
            .checked_add(scheduled_ms(next.stability))
            .filter(|due| *due <= MAX_SAFE_MS)
            .ok_or(FsrsError::Overflow)?;
    }
    Ok(next)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn exported_upstream_vectors_cover_all_grades_and_elapsed_boundaries() {
        let fixture: serde_json::Value =
            serde_json::from_str(include_str!("../../tests/fixtures/fsrs-6-reference.json"))
                .unwrap();
        for vector in fixture["vectors"].as_array().unwrap() {
            let grade = match vector["grade"].as_u64().unwrap() {
                1 => Grade::Again,
                2 => Grade::Hard,
                3 => Grade::Good,
                4 => Grade::Easy,
                _ => panic!("invalid fixture grade"),
            };
            let (s, d) = if vector["prior"].is_null() {
                reference_initial_memory(grade)
            } else {
                next_memory(
                    vector["prior"]["stability"].as_f64().unwrap(),
                    vector["prior"]["difficulty"].as_f64().unwrap(),
                    vector["elapsed"].as_f64().unwrap(),
                    grade,
                )
            };
            assert!(
                (s - vector["next"]["stability"].as_f64().unwrap()).abs() < 0.000_000_1,
                "{} stability: {s}",
                vector["name"]
            );
            assert!(
                (d - vector["next"]["difficulty"].as_f64().unwrap()).abs() < 0.000_000_1,
                "{} difficulty: {d}",
                vector["name"]
            );
        }
    }
    #[test]
    fn pinned_reference_memory_history() {
        // Upstream FSRS-6.test.ts "memory state using next_state[short-term]".
        let (mut s, mut d) = reference_initial_memory(Grade::Again);
        for elapsed in [0.0, 1.0, 3.0, 8.0, 21.0] {
            (s, d) = next_memory(s, d, elapsed, Grade::Good);
        }
        assert!((s - 53.62691).abs() < 0.0001, "{s}");
        assert!((d - 6.357_486_7).abs() < 0.0001, "{d}");
    }
    #[test]
    fn lifecycle_lapses_and_confidence_are_explicit_adaptations() {
        let new = initialize(Difficulty::Med, &[Tag::Remember], 0).unwrap();
        let learning = review(new.clone(), Grade::Again, 0).unwrap();
        assert_eq!(learning.state, CardState::Learning);
        assert_eq!(learning.due, STEP_MS);
        let good = review(new.clone(), Grade::Good, 0).unwrap();
        let strong = review_confidence(new, Confidence::Strong, 0).unwrap();
        assert!((strong.stability / good.stability - 1.1).abs() < 0.000_001);
        assert!(strong.due > good.due);
        let failed = review(good.clone(), Grade::Again, good.due).unwrap();
        assert_eq!(failed.state, CardState::Relearning);
        assert_eq!(failed.lapses, 1);
        assert!(failed.stability < good.stability);
        let failed_twice = review(failed.clone(), Grade::Again, failed.due).unwrap();
        assert_eq!(failed_twice.lapses, 1);
        let recovered = review(failed_twice.clone(), Grade::Good, failed_twice.due).unwrap();
        assert_eq!(recovered.state, CardState::Review);
        assert_eq!(recovered.lapses, 1);
    }
    #[test]
    fn intervals_are_curve_derived_and_elapsed_day_boundary_is_explicit() {
        let initial = initialize(Difficulty::Hard, &[], 0).unwrap();
        let first = review(initial, Grade::Good, 0).unwrap();
        assert!((first.difficulty - 7.5).abs() < f64::EPSILON);
        #[allow(clippy::cast_precision_loss)]
        let interval_days = first.due as f64 / DAY_MS as f64;
        assert!(
            (retrievability(interval_days, first.stability).unwrap() - DESIRED_RETENTION).abs()
                < 0.001
        );
        let same_day = review(first.clone(), Grade::Good, DAY_MS - 1).unwrap();
        let next_day = review(first.clone(), Grade::Good, DAY_MS).unwrap();
        assert!((same_day.stability - next_day.stability).abs() > 0.000_001);
        let mut max_lapses = first;
        max_lapses.lapses = u32::MAX;
        assert_eq!(
            review(max_lapses, Grade::Again, DAY_MS),
            Err(FsrsError::Overflow)
        );
    }

    #[test]
    fn rerating_preserves_scheduler_history_and_only_nudges_established_difficulty() {
        let state = review(initialize(Difficulty::Med, &[], 0).unwrap(), Grade::Good, 0).unwrap();
        let changed = rerate(state.clone(), Difficulty::Hard, &[]).unwrap();
        assert!((changed.difficulty - 6.0).abs() < f64::EPSILON);
        assert_eq!(
            FsrsState {
                difficulty: state.difficulty,
                ..changed
            },
            state
        );
        let new = initialize(Difficulty::Med, &[], 0).unwrap();
        assert!(
            (rerate(new, Difficulty::Hard, &[]).unwrap().difficulty - 7.5).abs() < f64::EPSILON
        );
    }

    #[test]
    fn invalid_inputs_fail_without_clamping_corrupt_state() {
        let good = review(
            initialize(Difficulty::Easy, &[], 10).unwrap(),
            Grade::Good,
            10,
        )
        .unwrap();
        assert_eq!(
            review(good.clone(), Grade::Good, 9),
            Err(FsrsError::InvalidTime)
        );
        for invalid in [f64::NAN, f64::INFINITY, -1.0, 0.0] {
            let mut broken = good.clone();
            broken.stability = invalid;
            assert!(review(broken, Grade::Good, 10).is_err());
        }
        let mut foreign = good.clone();
        foreign.algorithm = "legacy".into();
        assert_eq!(
            review(foreign, Grade::Good, 10),
            Err(FsrsError::UnsupportedAlgorithm)
        );
        assert!(review(good, Grade::Good, MAX_SAFE_MS).is_err());
    }
}
