//! Melody, per-syllable, stress, and rhythm scoring.
//!
//! **Status: skeleton.** The weightings and the skill-axis update are implemented (the
//! latter is a blueprint contract); the acoustic scoring lands in M3.
//!
//! See docs/architecture/prosody-dsp.md#4--scoring

/// The native reference data a phrase carries, built at content-build time.
#[derive(Debug, Clone)]
pub struct Reference {
    /// 14-point normalised contour — what the UI draws.
    pub f0_display: Vec<f32>,
    /// Full-resolution normalised contour — what scoring uses.
    pub f0_full: Vec<f32>,
    /// Quantised reference MFCC, for DTW.
    pub mfcc: Vec<Vec<f32>>,
    /// Per-syllable stress (0..1) and relative duration.
    pub syllables: Vec<(f32, f32)>,
}

/// Melody score weights. Correlation is weighted heavily because **shape matters more
/// than absolute offset** — a learner whose rise happens correctly but two semitones
/// lower has good prosody.
pub const W_SIMILARITY: f32 = 0.6;
/// Weight on Pearson correlation.
pub const W_CORRELATION: f32 = 0.4;

/// Deviation in normalised units above which a contour point is marked off-target.
/// From the blueprint (`Loro.dc.html:3220`) — the visual meaning must not drift.
pub const OFF_TARGET_THRESHOLD: f32 = 0.15;

/// Per-syllable score weights.
pub const W_SPECTRAL: f32 = 0.6;
/// Weight on duration agreement.
pub const W_DURATION: f32 = 0.25;
/// Weight on voicing agreement.
pub const W_VOICING: f32 = 0.15;

/// Melody score floor and ceiling. We never show 0 or 100 — neither is honest.
pub const SCORE_MIN: u8 = 40;
/// Score ceiling.
pub const SCORE_MAX: u8 = 99;

/// Score band thresholds. From the blueprint (`Loro.dc.html:3083`) — the visual meaning
/// must not drift.
pub const BAND_GOOD: u8 = 85;
/// Amber band floor.
pub const BAND_OK: u8 = 70;

/// Which band a score falls in.
#[must_use]
#[uniffi::export]
#[allow(clippy::bool_to_int_with_if)] // three bands, not a boolean
pub fn band(score: u8) -> u8 {
    if score >= BAND_GOOD {
        2
    } else if score >= BAND_OK {
        1
    } else {
        0
    }
}

/// The prosody lab's cue-level-up threshold. Tunable via the `prosody.levelUpThreshold`
/// flag, because we genuinely don't know the right value yet.
pub const LEVEL_UP_THRESHOLD: u8 = 88;

/// Top cue level. Level 3 is no help at all, so there is nothing left to remove — and the
/// reward for a strong take *is* the removal of help.
const MAX_CUE_LEVEL: u8 = 3;

// ── Skill-axis advance (`Loro.dc.html:3180–3182`) ────────────────────────────────────

/// Share of the gap between the current production axis and the take's score that one
/// take closes. Under a half, so a single lucky take can't declare the skill learned.
const PRODUCTION_GAIN_RATE: f32 = 0.3;

/// Floor on the production gain, applied even when the take scored *below* the current
/// axis. Showing up is progress; non-negotiable #3 says no screen shames a bad day.
const MIN_PRODUCTION_GAIN: f32 = 3.0;

/// Cue level at or above which recall is being genuinely trained, because the learner is
/// retrieving rather than reading.
const UNCUED_FROM_LEVEL: u8 = 2;

/// Recall gain when retrieving without much help. Three times the cued gain: recalling
/// *without* cues is what trains recall, and the asymmetry is the pedagogy.
const RECALL_GAIN_UNCUED: u8 = 6;

/// Recall gain when the cues are still doing the work.
const RECALL_GAIN_CUED: u8 = 2;

/// Perception gain per take. Creeps: mere exposure is worth something, but only just.
const PERCEPTION_GAIN: u8 = 1;

/// Pearson correlation between two equal-length series. Implemented ahead of the
/// pipeline because it's independently testable.
#[must_use]
#[allow(clippy::cast_precision_loss)] // contour lengths are in the hundreds
pub fn pearson(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }
    let n = a.len() as f32;
    let ma = a.iter().sum::<f32>() / n;
    let mb = b.iter().sum::<f32>() / n;
    let mut num = 0.0;
    let mut da = 0.0;
    let mut db = 0.0;
    for (x, y) in a.iter().zip(b.iter()) {
        let dx = x - ma;
        let dy = y - mb;
        num += dx * dy;
        da += dx * dx;
        db += dy * dy;
    }
    if da == 0.0 || db == 0.0 {
        return 0.0;
    }
    num / (da.sqrt() * db.sqrt())
}

/// Contour points that deviate beyond the threshold — the dark dots on the chart.
#[must_use]
pub fn off_target_indices(learner: &[f32], native: &[f32]) -> Vec<u32> {
    learner
        .iter()
        .zip(native.iter())
        .enumerate()
        .filter(|(_, (l, n))| (*l - *n).abs() > OFF_TARGET_THRESHOLD)
        .filter_map(|(i, _)| u32::try_from(i).ok())
        .collect()
}

/// The three skill axes for a phrase.
#[derive(Debug, Clone, Copy, uniffi::Record)]
pub struct SkillAxes {
    /// Recognising it.
    pub perception: u8,
    /// Retrieving it.
    pub recall: u8,
    /// Saying it.
    pub production: u8,
}

/// Advance the axes after a take. A blueprint contract (`Loro.dc.html:3180–3182`).
///
/// The asymmetry is the pedagogy: **Recall advances faster at high cue levels**, because
/// recalling *without* cues is what trains recall. Production tracks the actual score.
/// Perception creeps up from mere exposure.
#[must_use]
#[uniffi::export]
pub fn advance_axes(current: SkillAxes, score: u8, cue_level: u8) -> SkillAxes {
    let prod = f32::from(current.production);
    let gain = ((f32::from(score) - prod) * PRODUCTION_GAIN_RATE).max(MIN_PRODUCTION_GAIN);

    SkillAxes {
        #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
        production: ((prod + gain).round() as u8).min(SCORE_MAX),
        recall: current
            .recall
            .saturating_add(if cue_level >= UNCUED_FROM_LEVEL {
                RECALL_GAIN_UNCUED
            } else {
                RECALL_GAIN_CUED
            })
            .min(SCORE_MAX),
        perception: current
            .perception
            .saturating_add(PERCEPTION_GAIN)
            .min(SCORE_MAX),
    }
}

/// Whether a take earns a cue level-up. The reward is the **removal of help**.
#[must_use]
#[uniffi::export]
pub fn earns_level_up(score: u8, cue_level: u8, threshold: u8) -> bool {
    score >= threshold && cue_level < MAX_CUE_LEVEL
}

/// Compute the melody score.
///
/// # Panics
/// Not yet implemented — M3.
#[must_use]
pub fn melody_score(_learner: &[f32], _native: &[f32]) -> u8 {
    todo!("M3: 0.6*similarity + 0.4*max(0, correlation), clamped to 40..99")
}

#[cfg(test)]
mod tests {
    #![allow(clippy::float_cmp)] // exact-zero sentinels are deliberate here

    use super::*;

    #[test]
    fn bands_match_the_blueprint_thresholds() {
        for (score, expect, why) in [
            (u8::MAX, 2, "above anything scorable"),
            (92, 2, "comfortably good"),
            (BAND_GOOD, 2, "exactly the good floor"),
            (BAND_GOOD - 1, 1, "one under it"),
            (BAND_OK, 1, "exactly the amber floor"),
            (BAND_OK - 1, 0, "one under it"),
            (0, 0, "the bottom"),
        ] {
            assert_eq!(band(score), expect, "band({score}) — {why}");
        }
    }

    #[test]
    fn the_score_bands_sit_inside_the_score_range() {
        // A band floor outside 40..99 would be a band no real score can reach.
        const {
            assert!(SCORE_MIN < BAND_OK);
            assert!(BAND_OK < BAND_GOOD);
            assert!(BAND_GOOD < SCORE_MAX);
        }
    }

    #[test]
    fn identical_series_correlate_perfectly() {
        let a = [0.1, 0.4, 0.8, 0.6];
        assert!((pearson(&a, &a) - 1.0).abs() < 0.001);
    }

    #[test]
    fn an_offset_contour_still_correlates_perfectly() {
        // The whole point: a learner two semitones low but shaped correctly.
        let native = [0.2, 0.5, 0.9, 0.7];
        let learner: Vec<f32> = native.iter().map(|v| v - 0.1).collect();
        assert!(pearson(&native, &learner) > 0.99);
    }

    #[test]
    fn an_inverted_contour_correlates_negatively() {
        let rising = [0.2, 0.4, 0.6, 0.8];
        let falling = [0.8, 0.6, 0.4, 0.2];
        assert!(pearson(&rising, &falling) < -0.99);
    }

    #[test]
    fn a_flat_series_correlates_with_nothing() {
        assert_eq!(pearson(&[0.5, 0.5, 0.5], &[0.1, 0.5, 0.9]), 0.0);
    }

    #[test]
    fn off_target_points_are_flagged_at_the_blueprint_threshold() {
        let native = [0.5, 0.5, 0.5, 0.5];
        let learner = [0.5, 0.60, 0.70, 0.5];
        // 0.10 is within tolerance; 0.20 is not.
        assert_eq!(off_target_indices(&learner, &native), vec![2]);
    }

    /// The axes a take starts from, for the advance tests below.
    const START: SkillAxes = SkillAxes {
        perception: 70,
        recall: 55,
        production: 40,
    };

    #[test]
    fn production_tracks_the_score_with_a_minimum_gain() {
        // 0.3 of the 50-point gap is 15, well over the floor.
        assert_eq!(advance_axes(START, 90, 0).production, 55);
        // Even a score below current production yields the floor, not a fall.
        assert_eq!(advance_axes(START, 30, 0).production, 43);
        assert_eq!(
            advance_axes(START, 0, 0).production,
            43,
            "and never below it"
        );
    }

    #[test]
    fn an_axis_never_falls() {
        for score in [0, 30, 40, 88, 99] {
            for cue_level in 0..=MAX_CUE_LEVEL {
                let next = advance_axes(START, score, cue_level);
                assert!(next.production >= START.production, "score {score}");
                assert!(next.recall >= START.recall, "score {score}");
                assert!(next.perception >= START.perception, "score {score}");
            }
        }
    }

    #[test]
    fn recall_advances_faster_without_cues() {
        for cue_level in 0..UNCUED_FROM_LEVEL {
            let next = advance_axes(START, 90, cue_level);
            assert_eq!(
                next.recall,
                START.recall + RECALL_GAIN_CUED,
                "cue {cue_level}"
            );
        }
        for cue_level in UNCUED_FROM_LEVEL..=MAX_CUE_LEVEL {
            let next = advance_axes(START, 90, cue_level);
            assert_eq!(
                next.recall,
                START.recall + RECALL_GAIN_UNCUED,
                "cue {cue_level}"
            );
        }
        // The exact numbers, so the asymmetry can't be tuned away silently.
        assert_eq!(advance_axes(START, 90, 0).recall, 57);
        assert_eq!(advance_axes(START, 90, 3).recall, 61);
    }

    #[test]
    fn axes_are_capped_at_ninety_nine() {
        let maxed = SkillAxes {
            perception: SCORE_MAX,
            recall: SCORE_MAX,
            production: SCORE_MAX,
        };
        let next = advance_axes(maxed, 99, 3);
        assert_eq!(
            (next.perception, next.recall, next.production),
            (SCORE_MAX, SCORE_MAX, SCORE_MAX)
        );
        // Saturating, not wrapping: one point below the cap lands on it, never past.
        let near = SkillAxes {
            perception: SCORE_MAX - 1,
            recall: SCORE_MAX - 1,
            production: SCORE_MAX - 1,
        };
        let next = advance_axes(near, 99, 3);
        assert_eq!(
            (next.perception, next.recall, next.production),
            (SCORE_MAX, SCORE_MAX, SCORE_MAX)
        );
    }

    #[test]
    fn a_strong_take_levels_up_until_the_ladder_is_topped() {
        assert!(earns_level_up(90, 0, LEVEL_UP_THRESHOLD));
        assert!(earns_level_up(LEVEL_UP_THRESHOLD, 0, LEVEL_UP_THRESHOLD));
        assert!(!earns_level_up(
            LEVEL_UP_THRESHOLD - 1,
            0,
            LEVEL_UP_THRESHOLD
        ));
        for cue_level in 0..MAX_CUE_LEVEL {
            assert!(
                earns_level_up(99, cue_level, LEVEL_UP_THRESHOLD),
                "{cue_level}"
            );
        }
        assert!(
            !earns_level_up(99, MAX_CUE_LEVEL, LEVEL_UP_THRESHOLD),
            "cue 3 is the last level — there is no more help to remove"
        );
    }
}
