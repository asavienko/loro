//! Set selection and cloze masking — Loop B's daily choices.
//!
//! **Status: partial.** Automaticity and the mode rotation are implemented; the full
//! priority-ordered set selection lands in M2 with the Refrain.
//!
//! See docs/architecture/scheduling.md#3--automaticity--loop-b

use crate::PhraseState;

/// Reps per phrase per day. Overlearning is deliberate: the target does **not**
/// shorten when rep 1 was perfect (`Loro.dc.html:1536`, `3361`).
pub const DEFAULT_REP_TARGET: u32 = 6;

/// Distinct lock-in days before a phrase graduates out of rotation.
pub const LOCK_IN_DAYS_TO_GRADUATE: u32 = 4;

/// The ceiling on automaticity. A *cap*, not a scale: reps past the target still count as
/// reps, they just don't read as more than "done".
const AUTOMATICITY_MAX_PCT: f64 = 100.0;

/// Playback rate when a model is offered — a touch under natural speed, which is what
/// makes a phrase imitable without sounding slowed down.
const MODEL_RATE_MODELLED: f32 = 0.95;

/// Playback rate for Speed mode. Above natural speed: the point of the mode.
const MODEL_RATE_SPEED: f32 = 1.15;

/// Beat period for every mode but Speed. ~83 bpm, a comfortable speaking pulse.
const BEAT_MS_DEFAULT: u32 = 720;

/// Beat period for Speed mode. Just over double time, and the only cue that the mode
/// differs — hence the size of the gap.
const BEAT_MS_SPEED: u32 = 340;

// ── Effort-state thresholds, in percent (`Loro.dc.html:3411`) ────────────────────────
/// At or above the target: peak effort state.
const EFFORT_INSTANT_PCT: u8 = 100;
/// Two thirds of the way: hot effort state.
const EFFORT_QUICK_PCT: u8 = 66;
/// One third of the way: warm effort state. Below this it is cold.
const EFFORT_SMOOTHER_PCT: u8 = 33;

/// Today's automaticity, from the blueprint (`Loro.dc.html:3378`).
#[must_use]
#[uniffi::export]
pub fn automaticity(reps_today: u32, target: u32) -> u8 {
    if target == 0 {
        return 0;
    }
    #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
    let pct = ((f64::from(reps_today) / f64::from(target)) * 100.0)
        .round()
        .min(AUTOMATICITY_MAX_PCT) as u8;
    pct
}

/// Set size from the learner's daily-minutes answer.
#[must_use]
#[uniffi::export]
pub fn refrain_set_size(daily_minutes: u32) -> u32 {
    match daily_minutes {
        0..=5 => 3,
        6..=10 => 5,
        _ => 8,
    }
}

/// The manner of one rep. From the blueprint (`Loro.dc.html:3353–3360`).
///
/// Six reps of one phrase are six different cognitive events — imitation, synchrony,
/// compression, generation, translation, free recall — not one event six times.
#[derive(Debug, Clone, Copy, PartialEq, Eq, uniffi::Enum)]
pub enum RefrainMode {
    /// Hear it, then say it back.
    Echo,
    /// Say it in unison — ride the beat.
    Chorus,
    /// Again, faster — keep the groove.
    Speed,
    /// Fill the gap out loud.
    Cloze,
    /// Say the Spanish for the cue.
    Call,
    /// From memory — no model.
    Cold,
}

/// The mode for a given rep index, clamped at the last.
#[must_use]
#[uniffi::export]
pub fn mode_for_rep(rep_index: u32) -> RefrainMode {
    match rep_index {
        0 => RefrainMode::Echo,
        1 => RefrainMode::Chorus,
        2 => RefrainMode::Speed,
        3 => RefrainMode::Cloze,
        4 => RefrainMode::Call,
        _ => RefrainMode::Cold,
    }
}

/// Model-audio playback rate for a mode, or `None` when no model is offered.
#[must_use]
#[uniffi::export]
pub fn model_rate_for_mode(mode: RefrainMode) -> Option<f32> {
    match mode {
        RefrainMode::Echo | RefrainMode::Chorus => Some(MODEL_RATE_MODELLED),
        RefrainMode::Speed => Some(MODEL_RATE_SPEED),
        // Cloze, Call, and Cold withhold the model — that's the point.
        RefrainMode::Cloze | RefrainMode::Call | RefrainMode::Cold => None,
    }
}

/// Beat tempo in milliseconds. Speed mode's faster beat is the only cue that it differs.
#[must_use]
#[uniffi::export]
pub fn beat_ms_for_mode(mode: RefrainMode) -> u32 {
    match mode {
        RefrainMode::Speed => BEAT_MS_SPEED,
        _ => BEAT_MS_DEFAULT,
    }
}

/// Presentation-neutral effort state, from the blueprint thresholds (`Loro.dc.html:3411`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, uniffi::Enum)]
pub enum EffortState {
    /// No repetitions yet; presentation invites the learner to begin.
    Ready,
    /// Below the first automaticity threshold.
    Cold,
    /// At least one third automatic.
    Warm,
    /// At least two thirds automatic.
    Hot,
    /// Fully automatic at the daily target.
    Peak,
}

/// Map repetitions and automaticity to a semantic state; presentation owns the wording.
#[must_use]
#[uniffi::export]
pub fn effort_state(reps: u32, automaticity_pct: u8) -> EffortState {
    if reps == 0 {
        EffortState::Ready
    } else if automaticity_pct >= EFFORT_INSTANT_PCT {
        EffortState::Peak
    } else if automaticity_pct >= EFFORT_QUICK_PCT {
        EffortState::Hot
    } else if automaticity_pct >= EFFORT_SMOOTHER_PCT {
        EffortState::Warm
    } else {
        EffortState::Cold
    }
}

/// Which tokens to blank for Cloze mode.
///
/// # Panics
/// Not yet implemented — lands in M2. Must select the most informative **content**
/// word, never an article or preposition.
#[must_use]
pub fn cloze_mask(_es: &str) -> Vec<u32> {
    todo!("M2: select the most informative content word, never a function word")
}

/// Choose today's closed set.
///
/// Priority order: phrases mid-graduation → today's trip drop → weakest by
/// automaticity → new material. Persisted once per day and **never recomputed
/// mid-day**, so a learner can always finish the set they were shown.
///
/// # Panics
/// Not yet implemented — lands in M2.
#[must_use]
pub fn select_refrain_set(
    _candidates: &[PhraseState],
    _size: u32,
    _local_day: &str,
) -> Vec<String> {
    todo!("M2: priority-ordered selection; see docs/architecture/scheduling.md")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn automaticity_reaches_a_hundred_at_the_target() {
        assert_eq!(automaticity(0, 6), 0);
        assert_eq!(automaticity(3, 6), 50);
        assert_eq!(automaticity(6, 6), 100);
    }

    #[test]
    fn automaticity_never_exceeds_a_hundred() {
        assert_eq!(automaticity(12, 6), 100);
    }

    #[test]
    fn a_zero_target_does_not_divide_by_zero() {
        assert_eq!(automaticity(3, 0), 0);
    }

    #[test]
    fn set_size_follows_the_daily_minutes_answer() {
        for (minutes, expect) in [
            (0, 3),
            (5, 3),
            (6, 5),
            (10, 5),
            (11, 8),
            (20, 8),
            (u32::MAX, 8),
        ] {
            assert_eq!(refrain_set_size(minutes), expect, "{minutes} minutes");
        }
    }

    /// The rotation in order, one per rep. `mode_for_rep` is written as a match on the
    /// index, so the table is the specification rather than a restatement of the code.
    const ROTATION: [RefrainMode; 6] = [
        RefrainMode::Echo,
        RefrainMode::Chorus,
        RefrainMode::Speed,
        RefrainMode::Cloze,
        RefrainMode::Call,
        RefrainMode::Cold,
    ];

    #[test]
    fn modes_rotate_then_hold_at_cold() {
        for (rep, expect) in ROTATION.iter().enumerate() {
            let rep = u32::try_from(rep).expect("six reps");
            assert_eq!(mode_for_rep(rep), *expect, "rep {rep}");
        }
        for rep in [6, 7, 99, u32::MAX] {
            assert_eq!(mode_for_rep(rep), RefrainMode::Cold, "rep {rep} holds");
        }
    }

    #[test]
    fn the_default_rep_target_spends_every_mode_exactly_once() {
        // Six reps of one phrase are six different cognitive events, not one six times.
        let used: Vec<RefrainMode> = (0..DEFAULT_REP_TARGET).map(mode_for_rep).collect();
        assert_eq!(
            used, ROTATION,
            "the target and the rotation must stay in step"
        );
    }

    #[test]
    fn the_later_modes_withhold_the_model() {
        for (mode, expect) in [
            (RefrainMode::Echo, Some(MODEL_RATE_MODELLED)),
            (RefrainMode::Chorus, Some(MODEL_RATE_MODELLED)),
            (RefrainMode::Speed, Some(MODEL_RATE_SPEED)),
            // Withholding the model is the point of these three.
            (RefrainMode::Cloze, None),
            (RefrainMode::Call, None),
            (RefrainMode::Cold, None),
        ] {
            assert_eq!(model_rate_for_mode(mode), expect, "{mode:?}");
        }
        // Under, then over, natural speed — checked at compile time.
        const {
            assert!(MODEL_RATE_MODELLED < 1.0);
            assert!(MODEL_RATE_SPEED > 1.0);
        }
    }

    #[test]
    fn speed_mode_has_a_faster_beat() {
        assert!(beat_ms_for_mode(RefrainMode::Speed) < beat_ms_for_mode(RefrainMode::Echo));
        for mode in ROTATION {
            let expect = if mode == RefrainMode::Speed {
                BEAT_MS_SPEED
            } else {
                BEAT_MS_DEFAULT
            };
            assert_eq!(beat_ms_for_mode(mode), expect, "{mode:?}");
        }
    }

    #[test]
    fn the_effort_state_escalates() {
        for (reps, pct, expect) in [
            (0, 0, EffortState::Ready),
            (0, 100, EffortState::Ready), // no reps outranks any percentage
            (1, 0, EffortState::Cold),
            (1, 16, EffortState::Cold),
            (1, EFFORT_SMOOTHER_PCT - 1, EffortState::Cold),
            (3, EFFORT_SMOOTHER_PCT, EffortState::Warm),
            (3, 50, EffortState::Warm),
            (4, EFFORT_QUICK_PCT, EffortState::Hot),
            (4, EFFORT_INSTANT_PCT - 1, EffortState::Hot),
            (6, EFFORT_INSTANT_PCT, EffortState::Peak),
            (9, u8::MAX, EffortState::Peak),
        ] {
            assert_eq!(effort_state(reps, pct), expect, "{reps} reps at {pct}%");
        }
    }
}
