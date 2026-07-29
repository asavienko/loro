//! Forced alignment — DTW against the native reference.
//!
//! **Status: skeleton.** Lands in M3.
//!
//! DTW rather than a trained acoustic model, deliberately: the lab is always entered
//! with a *known target phrase*, and the speaking gate has already confirmed the learner
//! said approximately the right thing. We are time-warping one utterance of a known
//! phrase onto a reference utterance of the same phrase — DTW's home ground.
//!
//! If validation shows DTW isn't accurate enough, the fallback is a real forced aligner
//! (a 10–40 MB per-language model), which is why option (a) was tried first.
//!
//! See docs/architecture/prosody-dsp.md#3--forced-alignment

/// Sakoe-Chiba band width, as a fraction of the sequence length.
pub const DTW_BAND: f32 = 0.2;

/// Warping cost above which the take is treated as **unalignable** — the learner
/// probably said something different, so we ask rather than score.
pub const MAX_ALIGN_COST: f32 = 8.0;

/// One syllable's span in the learner's audio.
#[derive(Debug, Clone, Copy)]
pub struct SyllableSpan {
    /// First frame, inclusive.
    pub start_frame: usize,
    /// Last frame, exclusive.
    pub end_frame: usize,
}

/// The result of aligning a take to the reference.
#[derive(Debug, Clone)]
pub enum Alignment {
    /// Aligned, with a span per reference syllable.
    Aligned {
        /// One span per syllable, in order.
        spans: Vec<SyllableSpan>,
        /// Normalised warping cost.
        cost: f32,
    },
    /// The take didn't match the phrase closely enough to score.
    Unalignable {
        /// The cost we saw.
        cost: f32,
    },
}

/// Align learner MFCC frames to reference frames, then map reference syllable spans across.
///
/// # Panics
/// Not yet implemented — M3. Budget: ≤80 ms for 2 s of audio, banded.
#[must_use]
pub fn align_dtw(
    _learner_mfcc: &[Vec<f32>],
    _reference_mfcc: &[Vec<f32>],
    _reference_spans: &[SyllableSpan],
) -> Alignment {
    todo!("M3: banded DTW, then map reference spans through the warping path")
}
