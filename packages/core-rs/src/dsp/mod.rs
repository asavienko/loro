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
