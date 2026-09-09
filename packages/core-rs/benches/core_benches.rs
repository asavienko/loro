//! Criterion benchmarks for the hot-path functions.
//!
//! These are called synchronously from JS across the UniFFI boundary, so the budgets
//! are tight. CI fails on a >10% regression.
//!
//! Budgets — docs/architecture/performance.md#loro-core-rust
//!   stream_rank        <= 1 us      (per phrase; called across a 2 000-row library)
//!   match_tokens       <= 50 us
//!   merge_row          <= 20 us
//!   draw (500 phrases) <= 500 us
//!   plan_notifications <= 1 ms

use criterion::{criterion_group, criterion_main, Criterion};
use loro_core::asr::{match_tokens, tokenize};
use loro_core::ladder::{draw, need};
use loro_core::notify::{may_fire, Category, NotifyContext};
use loro_core::rank::{order_stream_candidates, stream_rank, StreamCandidate};
use loro_core::{Difficulty, LadderRung, PhraseState};
use std::hint::black_box;

fn phrase(i: usize) -> PhraseState {
    PhraseState {
        id: format!("p{i:04}"),
        difficulty: match i % 3 {
            0 => Difficulty::Easy,
            1 => Difficulty::Med,
            _ => Difficulty::Hard,
        },
        tags: vec![],
        loved: i.is_multiple_of(13),
        learned: i.is_multiple_of(17),
        plays: (i % 11) as u32,
        reps: (i % 7) as u32,
        last_practiced_at: Some(1_785_231_660_000 - (i as i64 % 30) * 86_400_000),
        srs_due: if i.is_multiple_of(5) {
            Some(1_785_231_660_000)
        } else {
            None
        },
        srs_stability: None,
        srs_difficulty: None,
        reps_today: 0,
        reps_today_day: None,
        lock_in_days: 0,
        rung: match i % 5 {
            0 => LadderRung::Accumulated,
            1 => LadderRung::Bent,
            2 => LadderRung::Transferred,
            3 => LadderRung::PressureTested,
            _ => LadderRung::Deployed,
        },
        stumbles: (i % 4) as u32,
        cue_level: 0,
    }
}

const NOW: i64 = 1_785_231_660_000;

fn bench_rank(c: &mut Criterion) {
    let p = phrase(7);
    c.bench_function("stream_rank", |b| {
        b.iter(|| stream_rank(black_box(&p), black_box(NOW)));
    });

    // The design target is a 2 000-phrase library. Production orders `StreamCandidate`s
    // whose `active` flag is the app's `isActive` rule, not a PhraseState filter here.
    let deck: Vec<StreamCandidate> = (0..2000)
        .map(|i| {
            let p = phrase(i);
            StreamCandidate {
                id: p.id,
                active: !p.learned,
                plays: p.plays,
                difficulty: p.difficulty,
                loved: p.loved,
                due: p.srs_due,
            }
        })
        .collect();
    c.bench_function("order_stream/2000", |b| {
        b.iter(|| order_stream_candidates(black_box(&deck), black_box(NOW)));
    });
}

fn bench_asr(c: &mut Criterion) {
    let target = tokenize("¿Dónde está la parada de taxis?");
    let heard = tokenize("dónde eh está um la parada de taxis");
    c.bench_function("match_tokens", |b| {
        b.iter(|| match_tokens(black_box(&heard), black_box(&target), 0, false));
    });
}

fn bench_ladder(c: &mut Criterion) {
    let deck: Vec<PhraseState> = (0..500).map(phrase).collect();
    c.bench_function("draw/500", |b| {
        b.iter(|| draw(black_box(&deck), black_box(42), None, black_box(NOW)));
    });
    let p = phrase(3);
    c.bench_function("need", |b| b.iter(|| need(black_box(&p), black_box(NOW))));
}

fn bench_notify(c: &mut Criterion) {
    let ctx = NotifyContext {
        hour: 9,
        practised_today: false,
        previous_wave_completed: true,
        enabled: vec![
            Category::DailyReminder,
            Category::WaveNudge,
            Category::TripDrop,
        ],
        already_scheduled: 0,
        trip_active: true,
        reveal_mode_count: 0,
    };
    c.bench_function("may_fire", |b| {
        b.iter(|| may_fire(black_box(Category::DailyReminder), black_box(&ctx)));
    });
}

criterion_group!(benches, bench_rank, bench_asr, bench_ladder, bench_notify);
criterion_main!(benches);
