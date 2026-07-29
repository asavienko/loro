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
        .min(100.0) as u8;
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
        RefrainMode::Echo | RefrainMode::Chorus => Some(0.95),
        RefrainMode::Speed => Some(1.15),
        // Cloze, Call, and Cold withhold the model — that's the point.
        RefrainMode::Cloze | RefrainMode::Call | RefrainMode::Cold => None,
    }
}

/// Beat tempo in milliseconds. Speed mode's faster beat is the only cue that it differs.
#[must_use]
#[uniffi::export]
pub fn beat_ms_for_mode(mode: RefrainMode) -> u32 {
    match mode {
        RefrainMode::Speed => 340,
        _ => 720,
    }
}

/// Plain-language effort label, from the blueprint (`Loro.dc.html:3411`).
///
/// This is the progression a learner actually reads. It ships as a group for
/// translation, because the escalation matters more than the individual strings.
#[must_use]
#[uniffi::export]
pub fn effort_label(reps: u32, automaticity_pct: u8) -> String {
    if reps == 0 {
        "tap to begin".to_string()
    } else if automaticity_pct >= 100 {
        "instant & smooth".to_string()
    } else if automaticity_pct >= 66 {
        "quick & smooth".to_string()
    } else if automaticity_pct >= 33 {
        "getting smoother".to_string()
    } else {
        "warming up".to_string()
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
        assert_eq!(refrain_set_size(5), 3);
        assert_eq!(refrain_set_size(10), 5);
        assert_eq!(refrain_set_size(20), 8);
    }

    #[test]
    fn modes_rotate_then_hold_at_cold() {
        assert_eq!(mode_for_rep(0), RefrainMode::Echo);
        assert_eq!(mode_for_rep(3), RefrainMode::Cloze);
        assert_eq!(mode_for_rep(5), RefrainMode::Cold);
        assert_eq!(mode_for_rep(99), RefrainMode::Cold);
    }

    #[test]
    fn the_later_modes_withhold_the_model() {
        assert_eq!(model_rate_for_mode(RefrainMode::Echo), Some(0.95));
        assert_eq!(model_rate_for_mode(RefrainMode::Speed), Some(1.15));
        assert_eq!(model_rate_for_mode(RefrainMode::Cloze), None);
        assert_eq!(model_rate_for_mode(RefrainMode::Cold), None);
    }

    #[test]
    fn speed_mode_has_a_faster_beat() {
        assert!(beat_ms_for_mode(RefrainMode::Speed) < beat_ms_for_mode(RefrainMode::Echo));
    }

    #[test]
    fn the_effort_label_escalates() {
        assert_eq!(effort_label(0, 0), "tap to begin");
        assert_eq!(effort_label(1, 16), "warming up");
        assert_eq!(effort_label(3, 50), "getting smoother");
        assert_eq!(effort_label(4, 66), "quick & smooth");
        assert_eq!(effort_label(6, 100), "instant & smooth");
    }
}
