# Close the gaps between the testing strategy and the tests that exist

- **Requirement IDs:** cross-cutting; supports the definition of done
- **Milestone:** M1 → M2
- **Spec:** `docs/process/testing-strategy.md`, `docs/process/definition-of-done.md`
- **Size:** M
- **Status:** 🟡 Partly implemented 2026-07-29. Calendar parity now runs from
  `packages/core-rs/tests/parity.rs`; shared IDs and mobile clock, store, formatting, and
  persistence (including real SQLite) now have unit/integration coverage. Still missing are the
  scheduler/sync simulation suites, the golden DSP corpus, the property suite, screen component
  tests, blueprint fixtures, and device E2E. Built-screen tests and implemented-function properties
  are unblocked; the full simulation waits on plans 17–19, and native/offline E2E waits on 09–12
  and 31.

## Current state

The unit suite and repository gate are a real foundation. The worktree now also has one Rust
integration test (`packages/core-rs/tests/parity.rs`) and five mobile test files covering format,
clock, store behaviour, state transitions, and persistence. But `docs/process/testing-strategy.md`
describes upper layers that still do not exist:

> The integration files named in `testing-strategy.md` (`sim.rs`, `merge.rs`, `golden/`) still do
> not exist. `parity.rs` proves the TS/Rust calendar mirror agrees; it does not prove scheduling,
> merge convergence, or DSP correctness.

> **A green build proves less than usual.** The five hand-checks in `onboarding.md` — audio, mic,
> the warming card, offline, sync — have no implementation behind them to check.

The Rust modules have good unit coverage of implemented functions; `dsp/align.rs` correctly has no
test while its central function remains `todo!`. Calendar now has integration-level parity coverage.
Everything else above unit level remains the subject of this plan.

On the app side, the new tests are valuable domain/data tests, not screen tests. Seven ported
screens still have no component or interaction tests, and there is no device E2E flow.

## The work

### 1. Complete `packages/core-rs/tests/`

- **`golden/`** — the fixture directory that four other plans depend on
  ([fix-shared-maths-duplication.md](05-fix-shared-maths-duplication.md),
  [fsrs-implementation-and-parity.md](17-fsrs-implementation-and-parity.md),
  [prosody-dsp-spike-and-pipeline.md](19-prosody-dsp-spike-and-pipeline.md),
  [select-rs-cloze-and-set-selection.md](18-select-rs-cloze-and-set-selection.md)). `.gitignore`
  already anticipates `packages/core-rs/tests/golden/recordings/` for consented audio fixtures.
- **`merge.rs`** — integration tests for the sync merge across full row shapes and all five merge
  classes, not just the unit cases in `sync/merge.rs`.
- **`sim.rs`** — the one that finds the real bugs: simulate a learner over 90 days across engines
  and assert invariants hold. Rung never decreases without `staleReset`; automaticity resets daily;
  graduation needs four lock-in days; FSRS due dates stay in the future; no signal goes `NaN`. A
  long-horizon simulation catches the class of bug unit tests structurally cannot.
- **Reuse `parity.rs`** — extend its shared-fixture approach for small TS mirrors; do not duplicate
  fixture loading and reporting in every parity plan.

### 2. Property-based testing where the properties are already written down

Several invariants are stated in comments and enforced by nothing:

| Property                                                | Stated at                             |
| ------------------------------------------------------- | ------------------------------------- |
| Order matters; insertions tolerated; progress monotonic | `core-rs/src/asr.rs:54–57`            |
| The ladder is monotonic — "you only climb or hold"      | `core-rs/src/lib.rs`, `LadderRung`    |
| Latency is measured or `None`, never estimated          | `core-rs/src/lib.rs`, `LatencySample` |
| Merge converges regardless of op order                  | `docs/architecture/sync-protocol.md`  |
| Scores never render 0 or 100                            | `core-rs/src/dsp/score.rs:39`         |
| A take costing over `MAX_ALIGN_COST` is `Unalignable`   | `core-rs/src/dsp/align.rs:18–20`      |

Each is a property test (`proptest` in Rust, fast-check in TS), and the merge-convergence one is the
most valuable test in the repo once sync exists ([sync-client-loop.md](15-sync-client-loop.md)).

### 3. Component and interaction tests for the app

Seven ported screens with none. Add React Native Testing Library and cover, per screen: each state
in `functional-spec.md`, the interactions that mutate the store, and the empty/error states. The
bugs in [fix-store-invariants.md](07-fix-store-invariants.md) are all reachable through the UI and
none was caught, which is the argument.

### 4. Blueprint-fidelity tests

The cheapest high-value idea available here. Every screen's view model is compared field-by-field
against the blueprint's `renderVals()` output for the same state. The blueprint is executable spec
(`docs/design/screen-catalog.md`), so its view models are usable as fixtures: extract them once per
screen into JSON, and assert the app's view model matches. That turns "the blueprint wins" from a
convention into a test, and it makes the divergence table explicit — any intentional divergence
becomes a documented exception in the fixture rather than a silent drift.

### 5. E2E

Maestro is already implied (`.gitignore` has `maestro-debug-output/`). Cover the one-sentence test
that M1 is judged on — onboarding → add → tag → stream repeat count changes → Progress reflects it —
plus the M2 airplane-mode test. Two flows, run per release, worth more than a hundred shallow ones.

### 6. Make the five hand-checks checkable

`docs/process/onboarding.md` lists five manual checks with nothing behind them. As each of audio,
mic, warming card, offline, and sync lands, the corresponding plan adds its automated coverage — and
the hand check stays as the device-level confirmation, recorded in
`docs/process/qa-device-matrix.md` rather than in a doc that nobody re-reads.

### 7. Coverage where it means something

Not a global percentage target — those get gamed. Instead: `packages/core-rs` and `packages/core`
are the reproducible-maths packages and should be held high (they carry the numbers); screens are
held to state-coverage (every state in the spec has a test) rather than line coverage. Write the
policy down in `testing-strategy.md` so it is a decision rather than a default.

## Acceptance criteria

- `packages/core-rs/tests/` exists with `golden/`, `merge.rs`, and `sim.rs`, all running in CI.
- Every property in the table above has a property test.
- The 90-day simulation runs in CI and asserts its invariants.
- Every built screen has component tests covering each state in `functional-spec.md`.
- Blueprint-fidelity fixtures exist for every ported screen; intentional divergences are explicit.
- Two E2E flows run per release.
- `testing-strategy.md` matches reality, and `CLAUDE.md`'s warnings about missing coverage are
  removed because they are no longer true.

## Tests

This plan's deliverable is the test system itself, so verification is meta-level:

- CI discovers and runs `parity.rs`, `merge.rs`, `sim.rs`, every property suite, and both Maestro
  flows from a clean checkout; a manifest test fails if a named suite is absent.
- Each property has a checked negative fixture or deliberately broken implementation proving the
  property test can fail for the intended reason.
- Blueprint extraction is deterministic: two runs produce no diff, and an intentionally changed
  view-model field produces a focused fixture failure naming the screen and field.
- The slow-suite split is exercised in CI, with the normal PR gate staying within its documented
  runtime budget and the slow job required before release.

## Risks

- **Test suite runtime.** The 90-day simulation and the DSP golden corpus are the slow ones; keep
  them in a separate CI job so the fast feedback loop stays fast.
- **Blueprint fixture extraction** needs a small script against `Loro.dc.html`, and the blueprint
  must not be edited to make it easier. Extract, do not modify.

## Out of scope

Load testing and performance tests —
[performance-budget-harness.md](38-performance-budget-harness.md).
