//! Deterministic scheduler exercise, not a claim of learning efficacy.
use loro_core::fsrs::{initialize, review, CardState, FsrsState, Grade};
use loro_core::Difficulty;
const DAY: i64 = 86_400_000;
const CAP: usize = 20;
const SEED: u64 = 0x5f59_6036_5001;

fn year(seed: u64) -> (Vec<FsrsState>, Vec<(usize, i64, i64)>, usize) {
    let mut random = seed;
    let mut cards: Vec<_> = (0..64)
        .map(|_| initialize(Difficulty::Med, &[], 0).unwrap())
        .collect();
    let mut history = Vec::new();
    let mut overflow_days = 0;
    for day in 0..365 {
        let at = day * DAY;
        let mut due: Vec<_> = cards
            .iter()
            .enumerate()
            .filter(|(_, card)| card.due <= at)
            .map(|(id, card)| (card.due, id))
            .collect();
        due.sort_unstable(); // timestamp first, stable ID resolves ties
        if due.len() > CAP {
            overflow_days += 1;
        }
        for &(_, id) in due.iter().take(CAP) {
            random = random
                .wrapping_mul(6_364_136_223_846_793_005)
                .wrapping_add(1);
            let grade = match (random >> 32) % 10 {
                0..=2 => Grade::Again,
                3 => Grade::Hard,
                9 => Grade::Easy,
                _ => Grade::Good,
            };
            let prior_lapses = cards[id].lapses;
            cards[id] = review(cards[id].clone(), grade, at).unwrap();
            assert!(cards[id].stability.is_finite());
            assert!((0.001..=36_500.0).contains(&cards[id].stability));
            assert!((1.0..=10.0).contains(&cards[id].difficulty));
            assert!(cards[id].due > at);
            assert!(cards[id].lapses >= prior_lapses);
            assert_eq!(cards[id].last_review, Some(at));
            history.push((id, at, cards[id].due));
        }
        // Over-cap reviews retain their original due and become tomorrow's backlog.
        for &(original_due, id) in due.iter().skip(CAP) {
            assert_eq!(cards[id].due, original_due);
        }
    }
    (cards, history, overflow_days)
}

#[test]
fn deterministic_365_day_scheduler_with_capped_backlog_and_lapses() {
    let first = year(SEED);
    let replay = year(SEED);
    assert_eq!(first, replay);
    assert!(first.1.len() > 100);
    assert!(first.2 > 0);
    assert!(first.0.iter().all(|card| card.state != CardState::New));
    assert!(first.0.iter().any(|card| card.lapses > 0));
    println!(
        "seed={SEED}; reviews={}; overflow_days={}",
        first.1.len(),
        first.2
    );
}
