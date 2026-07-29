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

/// The prosody lab's cue-level-up threshold. Tunable via the `prosody.levelUpThreshold`
/// flag, because we genuinely don't know the right value yet.
pub const LEVEL_UP_THRESHOLD: u8 = 88;

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
    let gain = ((f32::from(score) - prod) * 0.3).max(3.0);

    SkillAxes {
        #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
        production: ((prod + gain).round() as u8).min(99),
        recall: current
            .recall
            .saturating_add(if cue_level >= 2 { 6 } else { 2 })
            .min(99),
        perception: current.perception.saturating_add(1).min(99),
    }
}

/// Whether a take earns a cue level-up. The reward is the **removal of help**.
#[must_use]
#[uniffi::export]
pub fn earns_level_up(score: u8, cue_level: u8, threshold: u8) -> bool {
    score >= threshold && cue_level < 3
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

    #[test]
    fn production_tracks_the_score_with_a_minimum_gain() {
        let axes = SkillAxes {
            perception: 70,
            recall: 55,
            production: 40,
        };
        let next = advance_axes(axes, 90, 0);
        assert!(next.production > 40);
        // Even a score below current production yields the +3 floor.
        let stalled = advance_axes(axes, 30, 0);
        assert_eq!(stalled.production, 43);
    }

    #[test]
    fn recall_advances_faster_without_cues() {
        let axes = SkillAxes {
            perception: 70,
            recall: 55,
            production: 40,
        };
        let cued = advance_axes(axes, 90, 0);
        let cold = advance_axes(axes, 90, 3);
        assert_eq!(cued.recall, 57);
        assert_eq!(cold.recall, 61);
    }

    #[test]
    fn axes_are_capped_at_ninety_nine() {
        let maxed = SkillAxes {
            perception: 99,
            recall: 99,
            production: 99,
        };
        let next = advance_axes(maxed, 99, 3);
        assert_eq!(
            (next.perception, next.recall, next.production),
            (99, 99, 99)
        );
    }

    #[test]
    fn a_strong_take_levels_up_until_the_ladder_is_topped() {
        assert!(earns_level_up(90, 0, LEVEL_UP_THRESHOLD));
        assert!(!earns_level_up(80, 0, LEVEL_UP_THRESHOLD));
        assert!(
            !earns_level_up(99, 3, LEVEL_UP_THRESHOLD),
            "cue 3 is the last level"
        );
    }
}
