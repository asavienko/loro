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
│   ├── mod.rs       # frame/rate constants, TakeResult, the score_take entry point
│   ├── pitch.rs     # F0: YIN / pYIN extraction, median filter, normalize_f0
│   │                #   (there is no MFCC module yet)
│   ├── align.rs     # DTW forced alignment against the native reference
│   ├── score.rs     # melody, per-syllable, stress, rhythm; the bands and band()
│   └── feedback.rs  # worst syllable → phoneme class → one concrete fix
├── calendar.rs      # local_day, streak grace window, DST, timezone travel
├── notify.rs        # the notification plan (caps, quiet hours, conditionality)
│
│                    # internal, never `pub`, absent from bindings/:
├── rng.rs           # the seeded LCG — the crate's only randomness
├── units.rs         # MS_PER_HOUR / MS_PER_DAY, so no module re-derives them
└── test_support.rs  # #[cfg(test)] PhraseState + Hlc fixtures for the module suites
```

Both F0 functions live in `pitch.rs` and both score-band items in `score.rs`, so `feedback.rs` no
longer reaches up into `dsp/mod.rs` for a threshold. UniFFI names are flat per crate, so `bindings/`
is byte-identical across that move — verified, not assumed.

## Status

Rust unit, official reference, compatibility, calendar and deterministic simulation suites run
through `cargo test`. Browser parity exercises the same generated WASM bytes; native tests exercise
the generated UniFFI boundary. Run clippy with `-D warnings` and `cargo fmt --check` before changes
land.

The [FSRS model and policy](../../docs/architecture/fsrs-model.md) pins FSRS-6, 50% desired
retention, minute learning steps and declared difficulty priors. Existing 90% preview schedules
retain their memory and history until an actual review adopts the canonical policy; state is never
reset on load.

| Module        | State                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------ |
| `rank`        | **Implemented** + tests — stream rank and repeat targets are blueprint contracts           |
| `graph`       | **Implemented** + tests — Discover `assoc_score` / `assoc_order` (plan 101)                |
| `asr`         | **Implemented** + tests — normalisation and forward-walk matching                          |
| `calendar`    | **Implemented** + tests — day boundaries, streak grace, timezone travel                    |
| `ladder`      | **Implemented** + tests — rungs, need score, the deterministic draw                        |
| `sync::hlc`   | **Implemented** + tests — HLC arithmetic and skew detection                                |
| `sync::merge` | **Implemented** + tests — `merge_row` with all five merge classes                          |
| `notify`      | **Implemented** + tests — the full notification policy                                     |
| `select`      | **Implemented** — priority set selection and multilingual cloze, used by app engines       |
| `fsrs`        | **Implemented** — FSRS-6 reference review, real due dates, native/WASM parity              |
| `dsp`         | Skeleton — normalisation, bands, correlation, axes, fix selection done; the pipeline is M3 |

DSP pitch, alignment, scoring and pipeline placeholders remain evidence-gated by plan 77. They are
not exposed as real scores. Scheduling, cloze/selection, ranking and token matching use the
canonical Rust implementation through the checked JSON dispatch in `bridge.rs`.

`core_call` crosses both WASM and the synchronous Expo native module. `browser/` embeds generated
WASM for offline startup; Swift/Kotlin bindings are generated into `bindings/`. The app's adapter
maps types and catalog text without reimplementing scheduling maths. Browser source/output drift is
checked by `pnpm check`; full rebuilt parity uses `scripts/embed-wasm.mjs --verify-build` after a
WASM build. Native module build and physical-device acceptance are separate from algorithm parity.

## Rules

1. **No I/O, no networking, no persistence.** Pure functions over passed-in state.
2. **No ambient nondeterminism.** No system clock, no unseeded RNG. Both are parameters.
3. **Every completed public function is unit-, golden-, parity-, or property-tested.** Public
   placeholders are explicitly documented and must not be bound into production paths.
4. **A moved golden score is explained in the PR**, never re-baselined silently
   ([code-review.md](../../docs/process/code-review.md#special-review-paths)).

Rule 2 is what makes the crate trivially testable and makes a bug report reproducible from a seed
and a state.

## Build

```bash
pnpm core-rs:build            # host + wasm + UniFFI bindings
cargo test                    # unit + integration
cargo test --test parity      # calendar cross-language fixtures
cargo bench                   # Criterion; CI fails on >10% regression
```

Targets: `aarch64-apple-ios`, `aarch64-apple-ios-sim`, `aarch64-linux-android`,
`armv7-linux-androideabi`, `x86_64-linux-android`, `wasm32-unknown-unknown`.

Before extending a module, define the canonical input/output and units, add reference or parity
vectors, implement the pure Rust function, export it through the required generated bindings, and
wire the adapter without a fabricated fallback. Remove any duplicate TypeScript implementation only
after boundary parity passes.
[Plan 60](../../plans/archive/2026-09-09/60-authoritative-core-maths.md) owns this sequence for
rank, FSRS, cloze/set selection, and token matching; plan 77 owns the evidence-gated DSP work.

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

## Missing golden corpus

No committed DSP golden corpus exists yet; the only integration file is `tests/parity.rs`. Plan 77
owns the consented corpus and score-stability gate. Learner audio must never enter that corpus or
any other repository path ([ADR-0011](../../docs/architecture/adr/0011-analytics-and-privacy.md)).
