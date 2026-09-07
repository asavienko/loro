//! Stream ranking and repeat targets.
//!
//! Both formulae come from the blueprint and are **contracts**, not display models.
//! See docs/architecture/scheduling.md#1--stream-rank

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
    let mut r = i32::try_from(p.plays).unwrap_or(i32::MAX);

    r = r.saturating_add(match p.difficulty {
        Difficulty::Hard => HARD_OFFSET,
        Difficulty::Easy => EASY_OFFSET,
        Difficulty::Med => MED_OFFSET,
    });

    if p.loved {
        r = r.saturating_add(LOVED_OFFSET);
    }

    if let Some(due) = p.srs_due {
        if due <= now_ms {
            r = r.saturating_add(DUE_OFFSET);
        }
    }

    r
}

/// Order the active queue. Excludes learned phrases.
#[must_use]
pub fn order_stream(phrases: &[PhraseState], now_ms: i64) -> Vec<String> {
    let mut active: Vec<&PhraseState> = phrases.iter().filter(|p| !p.learned).collect();
    // Stable sort with the id as a tiebreaker, so the order is deterministic
    // regardless of input order — the conformance suite depends on this.
    active.sort_by(|a, b| {
        stream_rank(a, now_ms)
            .cmp(&stream_rank(b, now_ms))
            .then_with(|| a.id.cmp(&b.id))
    });
    active.into_iter().map(|p| p.id.clone()).collect()
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
    fn oversized_play_counts_saturate_without_overflow() {
        assert_eq!(
            stream_rank(&phrase("max", Difficulty::Easy, u32::MAX, false), 0),
            i32::MAX
        );
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

    #[test]
    fn learned_phrases_leave_the_stream() {
        let mut learned = phrase("l", Difficulty::Med, 0, false);
        learned.learned = true;
        let active = phrase("a", Difficulty::Med, 0, false);
        let order = order_stream(&[learned, active], 0);
        assert_eq!(order, vec!["a".to_string()]);
    }

    #[test]
    fn ordering_is_deterministic_regardless_of_input_order() {
        let a = phrase("a", Difficulty::Med, 3, false);
        let b = phrase("b", Difficulty::Med, 3, false);
        assert_eq!(
            order_stream(&[a.clone(), b.clone()], 0),
            order_stream(&[b, a], 0)
        );
    }
}
