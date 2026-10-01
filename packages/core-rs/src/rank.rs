//! Stream ranking and repeat targets.
//!
//! Both formulae come from the blueprint and are **contracts**, not display models.

use crate::{Difficulty, PhraseState};

// ── Stream-rank offsets (`Loro.dc.html:2527`) ────────────────────────────────────────
//
// All in "plays" units, and all smaller in magnitude than the play counts they adjust —
// that is what makes `plays` dominate and stops any bias from starving a phrase. Sort is
// ascending, so a *negative* offset means "sooner".

/// Difficult phrases come sooner: worth six plays of a head start.
const HARD_OFFSET: i32 = -6;

/// Easy phrases wait: they cost four plays.
const EASY_OFFSET: i32 = 4;

/// "Learning" is the neutral case, named so the match arms read as one scale.
const MED_OFFSET: i32 = 0;

/// A loved phrase surfaces more often. Smaller than `HARD_OFFSET`: what the learner
/// declared about the phrase outweighs what they favourited.
const LOVED_OFFSET: i32 = -3;

/// A due phrase deserves to be heard — but only modestly. Deliberately the smallest
/// offset: the stream stays a listening experience rather than a covert review queue.
const DUE_OFFSET: i32 = -4;

/// How many times a phrase repeats before the stream advances.
///
/// From `Loro.dc.html:2526`. Visible to the learner: rating something Difficult
/// makes it repeat more, and the toast says so.
#[must_use]
#[uniffi::export]
pub fn repeat_target(difficulty: Difficulty) -> u32 {
    match difficulty {
        Difficulty::Hard => 4,
        Difficulty::Med => 3,
        Difficulty::Easy => 2,
    }
}

/// Queue rank for the hands-free stream. Sort **ascending**.
///
/// From `Loro.dc.html:2527`, plus one extension: a due phrase deserves to be heard.
///
/// `plays` dominates, which naturally round-robins — everything is heard before
/// anything repeats — while the difficulty offsets bias *which* things come sooner
/// without ever starving a phrase.
///
/// The due term is deliberately only `-4`: the stream should stay a listening
/// experience, not become a covert review queue.
#[must_use]
#[uniffi::export]
pub fn stream_rank(p: &PhraseState, now_ms: i64) -> i32 {
    stream_rank_values(p.plays, p.difficulty, p.loved, p.srs_due, now_ms)
}

/// Scalar boundary for platforms that do not need the entire phrase record.
#[must_use]
pub fn stream_rank_values(
    plays: u32,
    difficulty: Difficulty,
    loved: bool,
    due: Option<i64>,
    now_ms: i64,
) -> i32 {
    let r = i32::try_from(plays).unwrap_or(i32::MAX);
    let offset = match difficulty {
        Difficulty::Hard => HARD_OFFSET,
        Difficulty::Easy => EASY_OFFSET,
        Difficulty::Med => MED_OFFSET,
    } + if loved { LOVED_OFFSET } else { 0 }
        + if due.is_some_and(|due| due <= now_ms) {
            DUE_OFFSET
        } else {
            0
        };
    r.saturating_add(offset)
}

/// Minimal scheduling input for an ordered stream; eligibility uses the app/domain rule.
#[derive(serde::Deserialize)]
pub struct StreamCandidate {
    /// Stable learner phrase identity.
    pub id: String,
    /// True only for live, unlearned, ungraduated phrases.
    pub active: bool,
    /// Number of completed listens.
    pub plays: u32,
    /// Learner-declared difficulty.
    pub difficulty: Difficulty,
    /// Whether the learner loves the phrase.
    pub loved: bool,
    /// Actual scheduled review time, if any.
    pub due: Option<i64>,
}

/// Order eligible stream candidates with platform-independent ID ties.
///
/// Eligibility is the caller's `active` flag (`isActive` in TypeScript: not learned and
/// not graduated). This crate's `PhraseState` has no `graduated_at`, so production WASM
/// uses this candidate path rather than filtering a phrase record here.
#[must_use]
pub fn order_stream_candidates(candidates: &[StreamCandidate], now_ms: i64) -> Vec<String> {
    let mut active: Vec<_> = candidates
        .iter()
        .filter(|candidate| candidate.active)
        .collect();
    // Stable sort with the id as a tiebreaker, so the order is deterministic
    // regardless of input order — the conformance suite depends on this.
    active.sort_by(|a, b| {
        stream_rank_values(a.plays, a.difficulty, a.loved, a.due, now_ms)
            .cmp(&stream_rank_values(
                b.plays,
                b.difficulty,
                b.loved,
                b.due,
                now_ms,
            ))
            .then_with(|| a.id.cmp(&b.id))
    });
    active
        .into_iter()
        .map(|candidate| candidate.id.clone())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_support;

    fn phrase(id: &str, difficulty: Difficulty, plays: u32, loved: bool) -> PhraseState {
        PhraseState {
            difficulty,
            loved,
            plays,
            ..test_support::phrase(id)
        }
    }

    #[test]
    fn repeat_targets_match_the_blueprint() {
        assert_eq!(repeat_target(Difficulty::Hard), 4);
        assert_eq!(repeat_target(Difficulty::Med), 3);
        assert_eq!(repeat_target(Difficulty::Easy), 2);
    }

    /// The exact ranks, not just their order. Two platforms computing this differently is
    /// what ADR-0002 exists to prevent, and only an absolute assertion catches that.
    #[test]
    fn the_rank_offsets_are_exactly_the_blueprints() {
        const PLAYS: u32 = 5;
        let at = |d, loved| stream_rank(&phrase("p", d, PLAYS, loved), 0);
        let plays = i32::try_from(PLAYS).expect("small");

        assert_eq!(at(Difficulty::Med, false), plays, "Med is the neutral case");
        assert_eq!(at(Difficulty::Hard, false), plays - 6);
        assert_eq!(at(Difficulty::Easy, false), plays + 4);
        assert_eq!(at(Difficulty::Med, true), plays - 3, "loved");

        let mut due = phrase("d", Difficulty::Med, PLAYS, false);
        due.srs_due = Some(0);
        assert_eq!(stream_rank(&due, 1_000), plays - 4, "due");

        // Offsets accumulate rather than override.
        let mut all = phrase("a", Difficulty::Hard, PLAYS, true);
        all.srs_due = Some(0);
        assert_eq!(stream_rank(&all, 1_000), plays - 6 - 3 - 4);
    }

    #[test]
    fn a_phrase_not_yet_due_gets_no_boost() {
        let mut later = phrase("l", Difficulty::Med, 5, false);
        later.srs_due = Some(2_000);
        assert_eq!(
            stream_rank(&later, 1_000),
            5,
            "due in the future is not due"
        );
        // Due exactly now counts as due.
        later.srs_due = Some(1_000);
        assert_eq!(stream_rank(&later, 1_000), 1);
    }

    #[test]
    fn difficult_phrases_come_sooner_than_easy_ones() {
        let hard = phrase("h", Difficulty::Hard, 5, false);
        let easy = phrase("e", Difficulty::Easy, 5, false);
        assert!(stream_rank(&hard, 0) < stream_rank(&easy, 0));
    }

    #[test]
    fn loved_phrases_surface_more_often() {
        let loved = phrase("l", Difficulty::Med, 5, true);
        let plain = phrase("p", Difficulty::Med, 5, false);
        assert!(stream_rank(&loved, 0) < stream_rank(&plain, 0));
    }

    #[test]
    fn plays_dominate_so_nothing_starves() {
        // An easy phrase never played still comes before a hard one played many times.
        let fresh_easy = phrase("fe", Difficulty::Easy, 0, false);
        let stale_hard = phrase("sh", Difficulty::Hard, 20, false);
        assert!(stream_rank(&fresh_easy, 0) < stream_rank(&stale_hard, 0));
    }

    #[test]
    fn due_phrases_get_a_modest_boost() {
        let mut due = phrase("d", Difficulty::Med, 5, false);
        due.srs_due = Some(0);
        let not_due = phrase("n", Difficulty::Med, 5, false);
        assert_eq!(stream_rank(&due, 1_000) + 4, stream_rank(&not_due, 1_000));
    }

    fn candidate(
        id: &str,
        difficulty: Difficulty,
        plays: u32,
        loved: bool,
        active: bool,
    ) -> StreamCandidate {
        StreamCandidate {
            id: id.to_string(),
            active,
            plays,
            difficulty,
            loved,
            due: None,
        }
    }

    #[test]
    fn inactive_candidates_leave_the_stream() {
        let learned = candidate("l", Difficulty::Med, 0, false, false);
        let graduated = candidate("g", Difficulty::Med, 0, false, false);
        let active = candidate("a", Difficulty::Med, 0, false, true);
        let order = order_stream_candidates(&[learned, graduated, active], 0);
        assert_eq!(order, vec!["a".to_string()]);
    }

    #[test]
    fn ordering_is_deterministic_regardless_of_input_order() {
        let a = candidate("a", Difficulty::Med, 3, false, true);
        let b = candidate("b", Difficulty::Med, 3, false, true);
        assert_eq!(
            order_stream_candidates(&[a, b], 0),
            order_stream_candidates(
                &[
                    candidate("b", Difficulty::Med, 3, false, true),
                    candidate("a", Difficulty::Med, 3, false, true)
                ],
                0
            )
        );
    }
}
