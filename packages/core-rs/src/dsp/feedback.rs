//! Feedback selection — the single most valuable output of the DSP.
//!
//! One concrete, physical fix. Never a list. The blueprint's every example is a single
//! sentence, and that restraint is why they land:
//!
//!   "Soften the ñ in baño — say 'ba-nyo', tongue to the roof of the mouth."
//!   "Move the stress to the end: ca-FÉ and fa-VOR."
//!   "You flatten the ending — keep the pitch climbing. That rise is what makes it a question."
//!
//! Templates are curated per phoneme class and authored **with the content**, keyed by
//! `(target_language, ui_language)` — "say 'ba-nyo'" only helps an English speaker.

/// What kind of error we detected. Selection is ordered, not scored.
#[derive(Debug, Clone, Copy, PartialEq, Eq, uniffi::Enum)]
pub enum FixKind {
    /// The contour's overall shape is wrong (a question that doesn't rise, etc.).
    /// Outranks everything on the prosody screen.
    ContourShape,
    /// Stress is on the wrong syllable. Outranks any single-syllable fix —
    /// stress errors damage intelligibility more.
    StressPosition,
    /// One syllable's segments are off.
    Segmental,
    /// Nothing actionable — the take was good.
    None,
}

/// A selected fix.
#[derive(Debug, Clone, uniffi::Record)]
pub struct Fix {
    /// What kind.
    pub kind: FixKind,
    /// Which template fired, e.g. `es.trill.rr`. Logged as `fix_code`.
    pub code: String,
    /// The syllable it refers to, if any.
    pub syllable_index: Option<u32>,
}

/// Select at most one fix.
///
/// Order:
///   1. A contour-shape mismatch (prosody screen only).
///   2. A stress-position mismatch.
///   3. The lowest-scoring syllable — preferring the **earliest** when several are within
///      5 points, because fixing an early error often fixes what follows.
///
/// A phrase's authored `note` takes precedence when the detected error matches the one
/// the content author anticipated.
#[must_use]
pub fn select_fix(
    syllable_scores: &[u8],
    stress_mismatch: Option<u32>,
    contour_mismatch: bool,
    is_prosody_screen: bool,
) -> Fix {
    if contour_mismatch && is_prosody_screen {
        return Fix {
            kind: FixKind::ContourShape,
            code: "contour.shape".into(),
            syllable_index: None,
        };
    }

    if let Some(idx) = stress_mismatch {
        return Fix {
            kind: FixKind::StressPosition,
            code: "stress.position".into(),
            syllable_index: Some(idx),
        };
    }

    let Some(worst) = worst_syllable(syllable_scores) else {
        return Fix {
            kind: FixKind::None,
            code: "none".into(),
            syllable_index: None,
        };
    };

    // A syllable in the good band isn't worth a correction.
    if syllable_scores[worst as usize] >= super::score::BAND_GOOD {
        return Fix {
            kind: FixKind::None,
            code: "none".into(),
            syllable_index: None,
        };
    }

    Fix {
        kind: FixKind::Segmental,
        // The real code comes from the phoneme class at this position, resolved from
        // the phrase's resp_ipa at M3.
        code: "segmental.pending".into(),
        syllable_index: Some(worst),
    }
}

/// How close to the worst score still counts as a tie, in points.
///
/// Within this band the *earliest* syllable wins rather than the lowest-scoring one,
/// because fixing an early error often fixes what follows — and because a 2-point gap is
/// inside the DSP's own accuracy, so "lowest" would be picking noise.
const NEAR_TIE_POINTS: u8 = 5;

/// The weakest syllable, preferring the earliest among near-ties.
#[must_use]
pub fn worst_syllable(scores: &[u8]) -> Option<u32> {
    let min = *scores.iter().min()?;
    scores
        .iter()
        .position(|s| *s <= min.saturating_add(NEAR_TIE_POINTS))
        .and_then(|i| u32::try_from(i).ok())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn contour_shape_outranks_everything_on_the_prosody_screen() {
        let fix = select_fix(&[50, 60, 70], Some(1), true, true);
        assert_eq!(fix.kind, FixKind::ContourShape);
    }

    #[test]
    fn contour_shape_is_ignored_on_the_pronunciation_screen() {
        let fix = select_fix(&[50, 60, 70], None, true, false);
        assert_eq!(fix.kind, FixKind::Segmental);
    }

    #[test]
    fn stress_position_outranks_a_single_syllable_fix() {
        let fix = select_fix(&[50, 90, 90], Some(2), false, false);
        assert_eq!(fix.kind, FixKind::StressPosition);
        assert_eq!(fix.syllable_index, Some(2));
    }

    #[test]
    fn the_earliest_of_several_near_ties_is_chosen() {
        // 62, 64, and 60 are all within 5 — fixing the earliest often fixes the rest.
        assert_eq!(worst_syllable(&[90, 62, 64, 60]), Some(1));
    }

    #[test]
    fn a_clear_worst_syllable_is_chosen() {
        assert_eq!(worst_syllable(&[90, 88, 51, 92]), Some(2));
    }

    #[test]
    fn a_good_take_gets_no_correction() {
        let fix = select_fix(&[92, 95, 90], None, false, true);
        assert_eq!(fix.kind, FixKind::None);
    }

    #[test]
    fn no_syllables_is_safe() {
        assert_eq!(worst_syllable(&[]), None);
        assert_eq!(select_fix(&[], None, false, false).kind, FixKind::None);
    }
}
