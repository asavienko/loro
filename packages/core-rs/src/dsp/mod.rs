//! Pitch, alignment, and scoring — the two labs' signal processing.
//!
//! **Status: skeleton.** Normalisation and the band thresholds are implemented; the
//! pipeline itself lands in M3, gated on the M1 validation spike.
//!
//! This module is where the product is most exposed to dishonesty. The blueprint fakes
//! these scores with a seeded PRNG (`Loro.dc.html:3068`, `3079`) and a linear blend
//! toward the native contour (`3158–3161`). That is correct for a prototype and
//! **unacceptable in a product**: a wrong score is worse than no score, because it
//! teaches the learner the wrong thing.
//!
//! Everything here runs **on-device**, from a PCM buffer that never leaves native
//! memory (ADR-0011).
//!
//! See docs/architecture/prosody-dsp.md

pub mod align;
pub mod feedback;
pub mod pitch;
pub mod score;

/// Frame size in milliseconds.
pub const FRAME_MS: f32 = 25.0;
/// Hop size in milliseconds — 10 ms gives ~100 F0 points per second.
pub const HOP_MS: f32 = 10.0;
/// Working sample rate. Sufficient for F0 (50–400 Hz) and MFCC, a quarter the data of 44.1 kHz.
pub const SAMPLE_RATE: u32 = 16_000;

/// Minimum signal-to-noise ratio, in dB, below which a take is **rejected rather than scored**.
///
/// Punishing a learner for a noisy café is a bug, not a low score.
pub const MIN_SNR_DB: f32 = 10.0;

/// Score band thresholds. From the blueprint (`Loro.dc.html:3083`) — the visual meaning
/// must not drift.
pub const BAND_GOOD: u8 = 85;
/// Amber band floor.
pub const BAND_OK: u8 = 70;

/// Why a take could not be scored. Each maps to honest copy, never a low score.
#[derive(Debug, Clone, Copy, PartialEq, Eq, uniffi::Enum)]
pub enum RejectReason {
    /// Too much background noise.
    LowSnr,
    /// No voiced frames found — the learner said nothing.
    NoVoicing,
    /// Far shorter than the reference.
    TooShort,
    /// The alignment cost was too high — they probably said something else.
    Unalignable,
}

/// The outcome of scoring a take.
#[derive(Debug, Clone, uniffi::Enum)]
pub enum TakeResult {
    /// A real score.
    Scored {
        /// 40..99.
        overall: u8,
        /// Per-syllable accuracy, 40..99.
        syllables: Vec<u8>,
        /// The learner's normalised contour, for display and the sparkline.
        contour: Vec<f32>,
        /// Index of the weakest syllable.
        worst_syllable: u32,
        /// Which feedback template to show.
        fix_code: String,
    },
    /// Not scorable. The UI says so honestly.
    Rejected {
        /// Why.
        reason: RejectReason,
    },
}

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
                let semitones = 12.0 * (f / median).log2();
                ((semitones + 12.0) / 24.0).clamp(0.0, 1.0)
            }
        })
        .collect()
}

/// Score a take end to end.
///
/// # Panics
/// Not yet implemented. Lands in M3, and **only if** the M1 validation spike passes:
/// native-speaker agreement ≥80% on 20 takes, worst-syllable identification ≥70%,
/// false-encouragement rate <5%. If it fails, the labs don't ship.
#[must_use]
pub fn score_take(_pcm: &[f32], _reference: &score::Reference) -> TakeResult {
    todo!("M3: pre-process → F0 + MFCC → DTW align → score → select one fix")
}

#[cfg(test)]
mod tests {
    #![allow(clippy::float_cmp)] // exact-zero sentinels are deliberate here

    use super::*;

    #[test]
    fn bands_match_the_blueprint_thresholds() {
        assert_eq!(band(92), 2);
        assert_eq!(band(85), 2);
        assert_eq!(band(84), 1);
        assert_eq!(band(70), 1);
        assert_eq!(band(69), 0);
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
}
