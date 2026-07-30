//! F0 extraction — YIN, with pYIN behind a flag if octave errors prove problematic.
//!
//! **Status: skeleton.** Lands in M3; validated by the M1 spike.
//! See docs/architecture/prosody-dsp.md#f0-pitch

/// Lowest F0 we look for — covers adult male Spanish speech.
pub const F0_MIN_HZ: f32 = 60.0;
/// Highest F0 we look for — covers adult female Spanish speech.
pub const F0_MAX_HZ: f32 = 400.0;
/// YIN aperiodicity threshold.
pub const YIN_THRESHOLD: f32 = 0.15;
/// Median-filter width, in frames, to remove octave jumps.
pub const MEDIAN_FILTER_FRAMES: usize = 5;
/// Unvoiced gaps shorter than this are interpolated across.
pub const MAX_INTERPOLATED_GAP_MS: f32 = 60.0;

/// Semitones in an octave — the unit F0 comparison happens in, because pitch is
/// perceived logarithmically and a ratio in Hz is not a distance in hearing.
const SEMITONES_PER_OCTAVE: f32 = 12.0;

/// The width of the normalised 0..1 scale: one octave either side of the speaker's own
/// median. Wider than any phrase-level contour, so real speech never clips at 0 or 1.
const NORMALISED_SPAN_SEMITONES: f32 = 2.0 * SEMITONES_PER_OCTAVE;

/// A frame's pitch estimate.
#[derive(Debug, Clone, Copy)]
pub struct PitchFrame {
    /// Hz, or 0.0 if unvoiced.
    pub hz: f32,
    /// Lower is more periodic.
    pub aperiodicity: f32,
    /// Whether this frame is voiced.
    pub voiced: bool,
}

/// Extract an F0 track.
///
/// # Panics
/// Not yet implemented — M3. Budget: ≤60 ms for 2 s of audio on the device floor.
#[must_use]
pub fn extract(_pcm: &[f32], _sample_rate: u32) -> Vec<PitchFrame> {
    todo!("M3: YIN over 25ms/10ms frames, median filter, gap interpolation")
}

/// Normalise an F0 track to semitones relative to the speaker's own median, then to 0..1.
///
/// **This is what makes the comparison fair.** A learner's absolute pitch is irrelevant;
/// the *shape* is the skill. Normalised the same way for both the native reference and
/// the learner, a bass and a soprano producing identical question intonation score
/// identically.
#[must_use]
#[uniffi::export]
pub fn normalize_f0(hz: &[f32]) -> Vec<f32> {
    let voiced: Vec<f32> = hz.iter().copied().filter(|f| *f > 0.0).collect();
    if voiced.is_empty() {
        return vec![0.0; hz.len()];
    }
    let median = {
        let mut v = voiced.clone();
        v.sort_by(f32::total_cmp);
        v[v.len() / 2]
    };
    hz.iter()
        .map(|f| {
            if *f <= 0.0 {
                0.0
            } else {
                let semitones = SEMITONES_PER_OCTAVE * (f / median).log2();
                ((semitones + SEMITONES_PER_OCTAVE) / NORMALISED_SPAN_SEMITONES).clamp(0.0, 1.0)
            }
        })
        .collect()
}

/// Median-filter a track to remove octave jumps. Implemented ahead of extraction
/// because it's independently testable.
#[must_use]
pub fn median_filter(track: &[f32], width: usize) -> Vec<f32> {
    if width < 2 || track.len() < width {
        return track.to_vec();
    }
    let half = width / 2;
    (0..track.len())
        .map(|i| {
            let lo = i.saturating_sub(half);
            let hi = (i + half + 1).min(track.len());
            let mut window: Vec<f32> = track[lo..hi].to_vec();
            window.sort_by(f32::total_cmp);
            window[window.len() / 2]
        })
        .collect()
}

#[cfg(test)]
mod tests {
    #![allow(clippy::float_cmp)] // exact-zero and exact-clamp sentinels are deliberate here

    use super::*;

    #[test]
    fn normalisation_puts_the_median_at_the_middle_of_the_scale() {
        // A speaker's own median is 0.5 by construction; that is what makes the scale fair.
        let out = normalize_f0(&[100.0, 100.0, 100.0]);
        for v in out {
            assert!(
                (v - 0.5).abs() < 0.001,
                "flat speech sits mid-scale, got {v}"
            );
        }
    }

    #[test]
    fn normalisation_clamps_rather_than_escaping_zero_to_one() {
        // Two octaves up and down — past the ±1 octave span, so it must clamp.
        let out = normalize_f0(&[25.0, 100.0, 400.0]);
        assert!(out.iter().all(|v| (0.0..=1.0).contains(v)), "{out:?}");
        assert!(
            (out[0] - 0.0).abs() < f32::EPSILON,
            "two octaves down clamps to 0"
        );
        assert!(
            (out[2] - 1.0).abs() < f32::EPSILON,
            "two octaves up clamps to 1"
        );
    }

    #[test]
    fn normalisation_makes_two_speakers_comparable() {
        // Same contour shape, an octave apart.
        let low = vec![100.0, 120.0, 150.0, 140.0];
        let high: Vec<f32> = low.iter().map(|f| f * 2.0).collect();
        let a = normalize_f0(&low);
        let b = normalize_f0(&high);
        for (x, y) in a.iter().zip(b.iter()) {
            assert!(
                (x - y).abs() < 0.001,
                "shape must survive a pitch shift: {x} vs {y}"
            );
        }
    }

    #[test]
    fn unvoiced_frames_normalise_to_zero() {
        let out = normalize_f0(&[0.0, 120.0, 0.0]);
        assert_eq!(out[0], 0.0);
        assert_eq!(out[2], 0.0);
        assert!(out[1] > 0.0);
    }

    #[test]
    fn a_fully_unvoiced_take_does_not_panic() {
        assert_eq!(normalize_f0(&[0.0, 0.0, 0.0]), vec![0.0, 0.0, 0.0]);
    }

    #[test]
    fn the_median_filter_removes_a_single_octave_jump() {
        // Frame 2 doubled — a classic YIN octave error.
        let noisy = [120.0, 122.0, 244.0, 121.0, 123.0];
        let clean = median_filter(&noisy, MEDIAN_FILTER_FRAMES);
        assert!(
            clean[2] < 150.0,
            "the spike should be smoothed, got {}",
            clean[2]
        );
    }

    #[test]
    fn the_median_filter_preserves_a_real_rise() {
        let rising = [100.0, 110.0, 120.0, 130.0, 140.0];
        let out = median_filter(&rising, 3);
        assert!(out[4] > out[0], "a genuine contour must survive filtering");
    }

    #[test]
    fn a_short_track_passes_through_unchanged() {
        assert_eq!(median_filter(&[100.0, 200.0], 5), vec![100.0, 200.0]);
    }
}
