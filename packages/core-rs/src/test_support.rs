//! Test fixtures shared across module test suites.
//!
//! `PhraseState` has seventeen fields and three modules' tests need one. Written out
//! once here, so adding a field is one edit rather than a hunt — and so a test reads as
//! "a phrase whose `plays` is 5" instead of sixteen lines of noise around it.
//!
//! Override with functional record update, which keeps the override visible:
//!
//! ```ignore
//! PhraseState { plays: 5, loved: true, ..test_support::phrase("p1") }
//! ```
//!
//! `benches/core_benches.rs` deliberately does **not** share this. A bench links the
//! library built without `cfg(test)`, so it would need a `test-support` feature — and both
//! CI bench jobs invoke `cargo bench` with no `--features` flag (`ci.yml:248`,
//! `core-rs.yml:60`, the latter bare), so gating on a feature breaks the build. The bench's
//! fixture is a *varied* deck (difficulty, rung and plays cycling by index) rather than this
//! neutral one, so it is a different fixture anyway, not a copy of this one.

use crate::sync::hlc::Hlc;
use crate::{Difficulty, LadderRung, PhraseState};

/// A phrase at rest: never played, never practised, nothing declared but `Med`.
///
/// Every numeric field is zero and every option `None`, so a test that sets one field
/// is unambiguously about that field.
pub(crate) fn phrase(id: &str) -> PhraseState {
    PhraseState {
        id: id.into(),
        difficulty: Difficulty::Med,
        tags: vec![],
        loved: false,
        learned: false,
        plays: 0,
        reps: 0,
        last_practiced_at: None,
        srs_due: None,
        srs_stability: None,
        srs_difficulty: None,
        reps_today: 0,
        reps_today_day: None,
        lock_in_days: 0,
        rung: LadderRung::Accumulated,
        stumbles: 0,
        cue_level: 0,
    }
}

/// An HLC reading. Shared by the `hlc` and `merge` suites, which each held their own copy
/// of this literal — and a merge test comparing readings built differently from the ones
/// the clock tests exercise is a test that no longer means what it says.
pub(crate) fn hlc(physical: i64, logical: u32, node_id: &str) -> Hlc {
    Hlc {
        physical,
        logical,
        node_id: node_id.into(),
    }
}
