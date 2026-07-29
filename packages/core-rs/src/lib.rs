//! loro-core — every number in Loro that must be identical wherever it is computed.
//!
//! See ../README.md and docs/architecture/adr/0002-shared-rust-core.md
//!
//! Invariants for this crate:
//!   1. No I/O, no networking, no persistence.
//!   2. No ambient nondeterminism — the clock and the RNG seed are parameters.
//!   3. Every public function is golden- or property-tested.

#![forbid(unsafe_code)]
#![warn(missing_docs, clippy::pedantic)]
#![allow(clippy::module_name_repetitions)]

pub mod asr;
pub mod calendar;
pub mod dsp;
pub mod fsrs;
pub mod ladder;
pub mod notify;
pub mod rank;
pub mod select;
pub mod sync;

uniffi::setup_scaffolding!();

// ─────────────────────────────────────────────────────────────────────────────
// Shared types crossing the FFI boundary
// ─────────────────────────────────────────────────────────────────────────────

/// The learner's declaration of how hard a phrase is for them.
#[derive(Debug, Clone, Copy, PartialEq, Eq, uniffi::Enum)]
pub enum Difficulty {
    /// Shown as "Easy".
    Easy,
    /// Shown as "Learning" — a status, not a rating.
    Med,
    /// Shown as "Difficult" — describing the phrase, not the learner.
    Hard,
}

/// "What's tricky about it" — the *nature* of the difficulty, never its magnitude.
#[derive(Debug, Clone, Copy, PartialEq, Eq, uniffi::Enum)]
pub enum Tag {
    /// The sounds are the problem.
    Pron,
    /// The meaning won't stick.
    Remember,
    /// "I will definitely need this."
    Useful,
    /// Specific lexical items trip me up.
    Words,
}

/// The five-rung ladder. Monotonic: "you only climb or hold."
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, uniffi::Enum)]
pub enum LadderRung {
    /// Recognise and repeat it.
    Accumulated,
    /// Change its form.
    Bent,
    /// Use it somewhere it wasn't taught.
    Transferred,
    /// Fast, distracted, under pressure.
    PressureTested,
    /// Spontaneous, unprompted, for real.
    Deployed,
}

/// A phrase's learner state, as far as this crate needs it.
#[derive(Debug, Clone, uniffi::Record)]
pub struct PhraseState {
    /// The learner's row id.
    pub id: String,
    /// Learner-declared difficulty.
    pub difficulty: Difficulty,
    /// Active tags.
    pub tags: Vec<Tag>,
    /// Surfaces more often.
    pub loved: bool,
    /// Left the active stream, still in review.
    pub learned: bool,
    /// Stream play count.
    pub plays: u32,
    /// Total reps across all engines.
    pub reps: u32,
    /// Epoch ms.
    pub last_practiced_at: Option<i64>,
    /// FSRS due date, epoch ms.
    pub srs_due: Option<i64>,
    /// FSRS stability, in days.
    pub srs_stability: Option<f32>,
    /// FSRS difficulty, 1..10.
    pub srs_difficulty: Option<f32>,
    /// Reps today, valid only for `reps_today_day`.
    pub reps_today: u32,
    /// The `local_day` `reps_today` belongs to.
    pub reps_today_day: Option<String>,
    /// Distinct days locked in; 4 → graduated.
    pub lock_in_days: u32,
    /// Ladder rung.
    pub rung: LadderRung,
    /// Failed productions, floor 0.
    pub stumbles: u32,
    /// Prosody cue level, 0..3.
    pub cue_level: u8,
}

/// A measured production latency.
///
/// `ms` is `Option` at the type level so every caller must handle "not measured".
/// The UI hides the read-out on `None` rather than substituting an estimate —
/// see docs/architecture/audio-speech.md#recording-and-latency
#[derive(Debug, Clone, Copy, uniffi::Record)]
pub struct LatencySample {
    /// Rep index within the phrase.
    pub rep_index: u32,
    /// Measured milliseconds, or `None` if onset was never detected.
    pub ms: Option<u32>,
}

// ─────────────────────────────────────────────────────────────────────────────
// WASM surface for the API. The server runs the SAME merge as the client — that
// is the entire point of this crate. See ADR-0002 and ADR-0008.
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(target_arch = "wasm32")]
mod wasm {
    use wasm_bindgen::prelude::*;

    /// Merge one row, from the server side. Byte-identical to the client path.
    ///
    /// # Errors
    /// Returns an error if either argument fails to deserialise.
    #[wasm_bindgen]
    pub fn merge_row(local: JsValue, remote: JsValue) -> Result<JsValue, JsValue> {
        let local: crate::sync::merge::Row =
            serde_wasm_bindgen::from_value(local).map_err(|e| JsValue::from_str(&e.to_string()))?;
        let remote: crate::sync::merge::RowOp = serde_wasm_bindgen::from_value(remote)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        let merged = crate::sync::merge::merge_row(&local, &remote);
        serde_wasm_bindgen::to_value(&merged).map_err(|e| JsValue::from_str(&e.to_string()))
    }
}
