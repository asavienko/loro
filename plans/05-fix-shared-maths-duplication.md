# Fix the duplicated maths: three implementations of numbers ADR-0002 says must exist once

- **Requirement IDs:** `F-04`, `LB-21`, `P3-02`
- **Milestone:** M1 (architectural bug — the divergence is already there)
- **Size:** M–L

## The problem

ADR-0002 exists because "two implementations of the sync merge would diverge and lose learner data".
The same argument applies to every number in `core-rs`, and today several of them have **two or
three** implementations that nothing checks against each other.

| Number                | Rust (canonical)                               | TypeScript copy                                      | Third copy                          |
| --------------------- | ---------------------------------------------- | ---------------------------------------------------- | ----------------------------------- |
| Stream rank           | `core-rs/src/rank.rs:34 stream_rank`           | `store/index.ts:304 core.streamRank`                 | `app/practice/stream.tsx:48 rank()` |
| Repeat target         | `core-rs/src/rank.rs:14 repeat_target`         | `store/index.ts:303 repeatTarget`                    | `stream.tsx:61 repeatTarget`        |
| Automaticity          | `core-rs/src/select.rs:20 automaticity`        | `core/…/refrain/index.ts:91`                         | —                                   |
| Refrain set size      | `core-rs/src/select.rs:34 refrain_set_size`    | `core/…/refrain/index.ts:45`                         | —                                   |
| Mode for rep          | `core-rs/src/select.rs:65 mode_for_rep`        | `core/…/refrain/index.ts:52`                         | —                                   |
| Model rate            | `core-rs/src/select.rs:79 model_rate_for_mode` | `core/…/refrain/index.ts:58`                         | —                                   |
| Beat ms               | `core-rs/src/select.rs:91 beat_ms_for_mode`    | `core/…/refrain/index.ts:74`                         | —                                   |
| Effort label          | `core-rs/src/select.rs:104 effort_label`       | `core/…/refrain/index.ts:100`                        | —                                   |
| Refrain set selection | `core-rs/src/select.rs:137 select_refrain_set` | `core/…/refrain/index.ts:157`                        | —                                   |
| Warm band             | **none**                                       | `core/…/refrain/index.ts:110`                        | —                                   |
| Cloze mask            | `core-rs/src/select.rs:125` (`todo!`)          | `store/index.ts:311 clozeMask: () => [1]`            | —                                   |
| FSRS review           | `core-rs/src/fsrs/mod.rs:173` (`todo!`)        | `store/index.ts:312 fsrsReview` (invented intervals) | —                                   |
| ASR token match       | `core-rs/src/asr.rs:64 match_tokens`           | `store/index.ts:316 matchTokens`                     | —                                   |

The last row is the inverse problem and easy to miss: `warmBand` has **no** canonical Rust source,
yet it thresholds on 100/66/33 — the same cut points `effort_label` hardcodes in Rust
(`select.rs:104–114`). It drives the warming card's colour on the hero screen, and the widget will
need the same bands without a JS runtime to ask. Decide its home in §2 rather than discovering the
divergence when the widget renders a different colour from the app.

Two of these are worse than duplicates — they are **fabrications standing in for the real thing**:

```ts
// store/index.ts:312
fsrsReview: (_s, grade, at) => {
  const days = grade === 1 ? 0.007 : grade === 2 ? 1 : grade === 3 ? 3 : 5
  return { stability: days, difficulty: 5, due: at + days * 86_400_000 }
}
```

That is a made-up interval table with `difficulty` pinned to 5, feeding a field the Memory-model
screen is specified to plot as a real forgetting curve
(`docs/architecture/adr/0004-fsrs-scheduler.md` — "anything else would mean that screen lies about
the algorithm behind it"). And `clozeMask: () => [1]` always blanks the second token, which
`select.rs:121–122` explicitly says must be "the most informative **content** word, never an article
or preposition" — and the `todo!` at `:125` repeats it as "never a function word".

## Why it is not simply "wire up UniFFI"

The TS copies exist for a reason worth preserving: `@loro/core` must run in Node for the API and in
Vitest with no native binding, and the engines are deliberately pure and injectable
(`packages/core/src/engines/types.ts:186–203`). Deleting the TS side is not the answer. **Pinning it
to the Rust side with an executable parity check is.**

## The work

### 1. Delete the third copies outright

`stream.tsx:48` and `stream.tsx:61` re-derive rank and repeat target inline. They read the same
constants today; nothing guarantees they will tomorrow. Both come from the injected facade.

### 2. Choose the policy per number, and write it down

Add a table to `docs/architecture/adr/0002-shared-rust-core.md`:

- **Rust-only, called over FFI** — anything the native widget or the DSP path needs, and anything
  too costly to re-derive (DSP, FSRS update, merge).
- **Rust canonical + TS mirror, parity-tested** — small pure functions the engines need
  synchronously in Node (rank, repeat target, automaticity, set size, mode/rate/beat, effort label,
  warm band, token match).
- **TS-only** — presentation formatting (`src/lib/format.ts`). Explicitly not shared maths.

### 3. Build the parity harness

The mechanism that makes a mirror safe:

1. A single JSON fixture set per function, committed under `packages/core-rs/tests/golden/` (the
   `tests/` directory now contains calendar parity coverage, but the shared-maths golden corpus is
   still missing — see [testing-gaps.md](37-testing-gaps.md)). Reuse the cross-language fixture
   pattern in `packages/core-rs/tests/parity.rs`; do not build a second harness.
2. A Rust test that runs the fixtures through the canonical implementation and asserts the recorded
   output.
3. A Vitest test that loads the _same_ fixture file and asserts the TS mirror produces
   byte-identical output.
4. A generator (`cargo run --bin gen-golden`) that regenerates fixtures from Rust — so Rust is the
   author and TS is the follower, never the reverse.

Add it to the `drift` CI job (`.github/workflows/ci.yml`) which already exists for exactly this
class of problem.

### 4. Replace the two fabrications

- `fsrsReview` → the real port
  ([fsrs-implementation-and-parity.md](17-fsrs-implementation-and-parity.md)).
- `clozeMask` → the real selector
  ([select-rs-cloze-and-set-selection.md](18-select-rs-cloze-and-set-selection.md)).

Until those land, the facade should **throw or return `null`** rather than return an invented value,
and the screens that need them should not ship. A missing feature is honest; a fake interval is not.

### 5. A lint boundary

Extend the layer-boundary lint (`eslint.config.mjs`) so `apps/mobile/app/**` cannot define a
function whose name matches a `LoroCoreFacade` member. Cheap, and it catches the exact regression
that produced `stream.tsx:48`.

## Acceptance criteria

- No maths function is implemented twice without a parity fixture covering it.
- `stream.tsx` contains no ranking or repeat-target arithmetic.
- Changing a Rust constant and not regenerating fixtures fails CI.
- Changing a TS mirror to disagree with Rust fails CI.
- The facade no longer returns invented FSRS intervals or a fixed cloze mask.
- ADR-0002 documents the per-function policy.

## Tests

- One Rust fixture runner and one TypeScript runner consume the same corpus for every mirrored
  function; deliberately changing either implementation without regenerating the corpus fails.
- A generator drift test proves committed fixtures are byte-for-byte current with Rust output.
- Mobile lint fixtures include a forbidden app-local facade implementation and a permitted call
  through `EngineContext.core`.
- Existing engine conformance and screen tests run with the facade throwing for unfinished FSRS and
  cloze functions, proving no shipping path silently falls back to fabricated values.

## Risks

- **Fixture churn** — golden files change whenever a constant is tuned. That is the intended cost;
  the diff makes the tuning reviewable.
- **UniFFI availability in Node** — the API consumes the WASM build for the merge
  (`apps/api/src/sync/merge.ts`), so the pattern exists. Reuse it rather than adding a second FFI
  path.

## Out of scope

Moving presentation formatting into Rust. It is not shared maths and it would make copy changes need
a native build.
