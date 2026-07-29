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
    use super::*;

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
