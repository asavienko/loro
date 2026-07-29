# FSRS: port the real update with parity tests

- **Requirement IDs:** `P3-30`…`P3-40`, `P3B-01`…`P3B-08`
- **Milestone:** M0 leftover, needed by M3 (blocks the Review session and the Memory model screen)
- **Size:** M
- **ADRs:** 0004 (FSRS scheduler)
- **Non-negotiables touched:** #2 (every number shown to a learner is real)

## Current state

`packages/core-rs/src/fsrs/mod.rs` is explicit: **status skeleton.** The types, grade mapping,
interval formatter, and difficulty prior are implemented and tested (8 tests). The core update is a
`todo!`:

```rust
// fsrs/mod.rs:173
todo!("M0: port the FSRS update with parity tests against the reference implementation")
```

Meanwhile the app ships a fabricated stand-in — `apps/mobile/src/store/index.ts:312`:

```ts
fsrsReview: (_s, grade, at) => {
  const days = grade === 1 ? 0.007 : grade === 2 ? 1 : grade === 3 ? 3 : 5
  return { stability: days, difficulty: 5, due: at + days * 86_400_000 }
}
```

Four fixed intervals and `difficulty` pinned to 5. ADR-0004 explains precisely why that cannot ship:
the Memory-model screen plots `R(t) = 0.5^(t/S)` and reports stability in days
(`Loro.dc.html:963–1037`), so "anything else would mean that screen lies about the algorithm behind
it." The screen would render a real-looking forgetting curve from a lookup table.

`docs/architecture/scheduling.md:124` says it in one line: **displayed intervals must be real.**

## The work

### 1. Port the update

Implement stability, difficulty, and retrievability per the FSRS reference (the version named in
ADR-0004 — pin it explicitly, including the weight vector, and record where the weights came from).
Cover the full state machine: first review, subsequent review, lapse, and the same-day repeat case
(which the Refrain generates constantly — six reps of one phrase in one day is not six reviews, and
getting this wrong inflates stability enormously).

### 2. Parity tests against the reference

`tests/fsrs_parity.rs` is named in the module docs and does not exist. The crate now has
`tests/parity.rs` for calendar fixtures, which supplies the cross-language pattern to reuse, but it
does not exercise FSRS (see [testing-gaps.md](37-testing-gaps.md)).

- Generate a fixture set from the reference implementation: a few thousand `(state, grade, elapsed)`
  → `(stability, difficulty, due)` rows, committed as JSON.
- Assert equality within a documented float tolerance, and state why the tolerance is what it is.
- Include adversarial inputs: zero elapsed, negative elapsed (clock moved back), enormous elapsed
  (returned after a year), stability at the floor and ceiling.

### 3. Wire the decisions already written down

`docs/architecture/scheduling.md` has three FSRS decisions that are not defaults and are easy to
forget:

- **Grade mapping** (`:79`) — the five-level confidence rating on the Memory-model screen maps to
  four grades, with `Strong` → `Good` plus a stability bonus applied by the caller (`fsrs/mod.rs`
  documents this; make sure the caller actually applies it, and test that it does).
- **Learner-declared difficulty as a prior** (`:101`) — the connective thread's whole claim. The
  learner's Difficult/Easy rating seeds FSRS difficulty. This is the mechanism Q-03 measures, so it
  must be implemented in a way that can be measured (log the prior and the evolved value
  separately).
- **Trip compression** (`:152`) — intervals compress against an arrival date. Do not let compression
  corrupt the underlying stability; compress the _due date_, keep the memory state honest, or the
  post-trip schedule is wrong for months.

### 4. Daily load and the interval formatter

`scheduling.md:139` caps daily review load. Implement the cap in Rust with the queue ranking, so the
Review session and the widget agree. `formatInterval` (`apps/mobile/src/lib/format.ts:15`) already
formats real days — it is fine, but it renders `~10 min` for anything under 0.9 days, which merges
"10 minutes" and "20 hours". Check that against the blueprint (`Loro.dc.html:3009`) and against what
FSRS actually returns for a lapse.

### 5. Delete the stand-in

Remove `fsrsReview` from the mobile facade and route through `core-rs`. Until the port lands the
facade should **throw** rather than return invented intervals, and the Review session and Memory
model screens should not ship — a missing screen is honest, a fake curve is not.

## Acceptance criteria

- No `todo!` in `packages/core-rs/src/fsrs/`.
- Parity fixtures pass against the pinned reference within the stated tolerance.
- Six Refrain reps in one day do not produce six reviews' worth of stability.
- Learner-declared difficulty demonstrably shifts the initial difficulty, and the prior is logged
  separately from the evolved value.
- Trip compression changes due dates without corrupting stability; the post-trip schedule is
  correct.
- The mobile facade contains no interval arithmetic.
- Clock-moved-backwards and returned-after-a-year cases produce sane output, not `NaN` or a due date
  in the past forever.

## Tests

- The parity suite (above).
- Property tests: stability is non-decreasing on `Good`/`Easy` from the same state; a lapse never
  increases stability; `due > at` always; no `NaN` or infinity for any input in range.
- A golden schedule test: a 60-day simulated review history, asserting the exact interval sequence —
  this is the test that makes a weight change visible in review.

## Risks

- **Reference drift.** FSRS versions differ in weights and formulae. Pin the version in the ADR and
  fail the build if the fixture header's version does not match.
- **Float determinism across platforms.** `f32` operations should be identical on ARM and x86 for
  these operations, but transcendentals are the risk. Prefer explicit formulations, and include the
  parity test in CI on both architectures if that is cheap.

## Out of scope

FSRS weight optimisation from the learner's own review history. Real, valuable, and much later — it
needs a corpus that does not exist yet.
