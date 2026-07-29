# loro-core

Every number in Loro that must be **identical wherever it is computed**.

Rationale: [ADR-0002](../../docs/architecture/adr/0002-shared-rust-core.md)

## Why this crate exists

| Number                                   | Computed on           | Consequence of divergence                                         |
| ---------------------------------------- | --------------------- | ----------------------------------------------------------------- |
| **The sync merge**                       | client **and** server | **Silent data loss** — the two sides converge on different values |
| FSRS intervals                           | iOS, Android, server  | Two devices disagree about when a card is due                     |
| Pronunciation / prosody scores           | iOS, Android          | The same take scores differently on a learner's two phones        |
| Stream rank, Refrain selection, the draw | iOS, Android          | Different practice on different devices                           |
| The notification plan                    | iOS, Android          | Policy violations on one platform only                            |

The sync-merge row is the one that justifies the whole crate. Two implementations of a
conflict-resolution rule will diverge on some edge case, and nobody finds out for months.

## Modules

```
src/
├── lib.rs           # UniFFI + wasm-bindgen surface
├── fsrs/            # stability, difficulty, grade mapping, interval formatting
├── rank.rs          # stream rank, repeat targets
├── select.rs        # Refrain set selection, cloze masking
├── ladder.rs        # rungs, need score, the Loop C draw
├── sync/
│   ├── hlc.rs       # hybrid logical clock
│   └── merge.rs     # merge_row — THE function both client and server run
├── asr.rs           # normalisation + forward-walk token matching
├── dsp/
│   ├── pitch.rs     # YIN / pYIN F0 extraction
│   ├── mfcc.rs
│   ├── align.rs     # DTW forced alignment against the native reference
│   ├── score.rs     # melody, per-syllable, stress, rhythm
│   └── feedback.rs  # worst syllable → phoneme class → one concrete fix
├── calendar.rs      # local_day, streak grace window, DST, timezone travel
└── notify.rs        # the notification plan (caps, quiet hours, conditionality)
```

## Status

**94 tests passing. Clippy clean under `-D warnings`, `cargo fmt` clean.**

| Module        | State                                                                                        |
| ------------- | -------------------------------------------------------------------------------------------- |
| `rank`        | **Implemented** + tests — stream rank and repeat targets are blueprint contracts             |
| `asr`         | **Implemented** + tests — normalisation and forward-walk matching                            |
| `calendar`    | **Implemented** + tests — day boundaries, streak grace, timezone travel                      |
| `ladder`      | **Implemented** + tests — rungs, need score, the deterministic draw                          |
| `sync::hlc`   | **Implemented** + tests — HLC arithmetic and skew detection                                  |
| `sync::merge` | **Implemented** + tests — `merge_row` with all five merge classes                            |
| `notify`      | **Implemented** + tests — the full notification policy                                       |
| `select`      | Partial — automaticity, modes, and labels done; `select_refrain_set` and `cloze_mask` are M2 |
| `fsrs`        | Partial — grade mapping, difficulty prior, curve, formatting done; `review()` is M0          |
| `dsp`         | Skeleton — normalisation, bands, correlation, axes, fix selection done; the pipeline is M3   |

The three `todo!()`s (`fsrs::review`, `select::select_refrain_set`, `dsp::score_take`) are the real
work, and each is scheduled in [roadmap.md](../../docs/product/roadmap.md). The surrounding pure
functions are implemented and tested first because they're where the blueprint's contracts live.

## Rules

1. **No I/O, no networking, no persistence.** Pure functions over passed-in state.
2. **No ambient nondeterminism.** No system clock, no unseeded RNG. Both are parameters.
3. **Every public function is golden- or property-tested.**
4. **A moved golden score is explained in the PR**, never re-baselined silently
   ([code-review.md](../../docs/process/code-review.md#special-review-paths)).

Rule 2 is what makes the crate trivially testable and makes a bug report reproducible from a seed
and a state.

## Build

```bash
pnpm core-rs:build            # host + wasm + UniFFI bindings
cargo test                    # unit + integration
cargo test --test golden      # ~50 recorded utterances vs expected DSP output
cargo test --test parity      # Swift, Kotlin, and WASM agree
cargo bench                   # Criterion; CI fails on >10% regression
```

Targets: `aarch64-apple-ios`, `aarch64-apple-ios-sim`, `aarch64-linux-android`,
`armv7-linux-androideabi`, `x86_64-linux-android`, `wasm32-unknown-unknown`.

## Performance budgets

Called synchronously from JS, so these are tight
([performance.md](../../docs/architecture/performance.md#loro-core-rust)):

| Function                                | Budget                            |
| --------------------------------------- | --------------------------------- |
| `stream_rank`                           | ≤ 1 µs                            |
| `fsrs_next_interval`                    | ≤ 10 µs                           |
| `match_tokens`                          | ≤ 50 µs                           |
| `merge_row`                             | ≤ 20 µs                           |
| `select_refrain_set` (2 000 candidates) | ≤ 2 ms                            |
| `extract_pitch` (2 s audio)             | ≤ 60 ms _(async, native thread)_  |
| `align_dtw` (2 s audio)                 | ≤ 80 ms _(async, native thread)_  |
| `score_take` (full pipeline)            | ≤ 200 ms _(async, native thread)_ |

## Golden tests

`tests/golden/` holds ~50 recorded utterances with committed expected output. Any DSP change that
moves a score beyond the stability threshold fails CI.

**Recordings require documented speaker consent** and are the only audio files in the repo. Learner
audio never enters this directory or any other
([ADR-0011](../../docs/architecture/adr/0011-analytics-and-privacy.md)).
