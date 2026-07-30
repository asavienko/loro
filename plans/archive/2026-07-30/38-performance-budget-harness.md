# Make the performance budgets measurable

- **Requirement IDs:** cross-cutting; the M2 <2 s bar and the M4 scale bar
- **Milestone:** M2 → M4
- **Spec:** `docs/architecture/performance.md`
- **Size:** M

## Current state

`docs/architecture/performance.md` specifies "budgets per screen and per subsystem, **with how each
is measured**". One of them is enforced today: `.github/workflows/ci.yml`'s `budgets` job runs the
`loro-core` Criterion benches and fails on a >10% regression. That is a good mechanism and the model
for everything else here.

What is not measured:

- **Cold launch.** The M2 exit criterion is airplane mode, fresh launch, survival mode usable in
  **<2 s**. Nothing measures it. Persistence primitives exist, but hydration and the on-device
  driver do not, so the final launch path is not wired yet.
- **Per-screen render and interaction budgets.** Eight screens shipped, none measured.
- **Audio start latency.** The Refrain's Chorus mode rides a beat, so start jitter is audible in a
  way it is not in a normal player ([audio-playback-module.md](11-audio-playback-module.md)).
- **DSP on the device floor.** `packages/core-rs/src/dsp/pitch.rs:31` budgets ≤60 ms for 2 s of
  audio; Criterion measures it on a CI x86 runner, which says nothing about a mid-range Android.
- **Sync at scale.** M4's bar is p95 sync under 800 ms with a 2 000-phrase library.
- **Library performance at 2 000 phrases.** M4 wants virtualised lists and indexed search, tested at
  that size. Today the stream sorts the whole array on every render
  (`apps/mobile/app/practice/stream.tsx:47`, inside a `useMemo` keyed on `phrases`, so any mutation
  re-sorts everything).
- **Bundle size.** CI reports the Hermes bytecode size to the step summary but does not gate on it,
  so a 50% growth passes silently.

## The work

### 1. A fixture library at scale

Everything else depends on this: a generator producing 100 / 500 / 2 000-phrase libraries with
realistic state distributions (mixed mastery, FSRS history, tags, notes). Committed as a generator,
not as data. Without it, "tested at 2 000 phrases" is untestable.

### 2. Cold launch, measured on device

- Instrument launch phases: process start → JS bundle loaded → store hydrated → first meaningful
  paint → interactive.
- Measure on the floor device from `docs/process/qa-device-matrix.md`, **cold** (not warm) — a warm
  launch measurement is the usual way this budget gets falsely reported as met.
- Record the numbers in `performance.md` alongside how they were measured, and track them across
  releases so a regression is visible rather than discovered at release.

### 3. Per-screen budgets

Render time and interaction latency per screen, with the 2 000-phrase fixture loaded. The likely
offenders, identifiable by reading the code today:

- `stream.tsx` — full sort per store mutation.
- `progress.tsx` — recomputes the mastery histogram over all phrases (`useMastery`,
  `apps/mobile/src/store/index.ts:291`, which iterates every phrase on every render).
- `add.tsx` (500 lines) — the browse list is unvirtualised.

Fix by memoising on the right keys, virtualising lists, and moving rollups into indexed queries once
SQLite lands ([sqlite-persistence-and-outbox.md](10-sqlite-persistence-and-outbox.md)).

### 4. Extend the Criterion benches to the real hot paths

Existing benches: `packages/core-rs/benches/core_benches.rs`. Add ranking at 2 000 phrases, set
selection, the merge over large batches, and — once implemented — the whole DSP pipeline. Keep
the >10% gate.

### 5. Device-floor DSP measurement

Criterion on CI cannot answer the question the budget asks. Add a small on-device benchmark harness
(a debug screen or an instrumented test) that runs the DSP path on a fixed fixture and reports
timings, run per release on the floor device. The prosody spike should establish this harness since
it needs the same measurement
([prosody-dsp-spike-and-pipeline.md](19-prosody-dsp-spike-and-pipeline.md)).

### 6. Sync and API load

p95 sync with a 2 000-phrase library; API load test to 10× projected peak (M4 exit criterion). Needs
the Postgres implementation and realistic payloads; use the same fixture generator so client and
server tests describe the same learner.

### 7. Gate the bundle size

CI already computes it. Turn the report into a budget with a threshold and a documented allowance
for growth. Audio assets will dominate app size later, so track them separately
([content-scale-to-600.md](36-content-scale-to-600.md)).

### 8. One dashboard

Every budget, its current value, its threshold, and its trend — in a place someone looks at. A
budget in a markdown table with no reading is a wish (`performance.md` currently is exactly that for
most rows).

## Acceptance criteria

- The fixture generator produces 100/500/2 000-phrase libraries with realistic state.
- Cold launch measured on the floor device, cold, recorded, and tracked; the <2 s airplane-mode bar
  is demonstrated, not asserted.
- Every screen has a measured render and interaction number at 2 000 phrases.
- No screen re-sorts or re-aggregates the full library on every render.
- Criterion covers ranking, selection, merge, and DSP; the >10% gate still fires.
- DSP measured on the device floor against the ≤60 ms budget.
- p95 sync under 800 ms at 2 000 phrases; API load test passes at 10× peak.
- Bundle size gated, not merely reported.
- `performance.md` contains real measured numbers with their method.

## Tests

- The benches and gates above.
- A regression test per fixed hot path (e.g. "rating a phrase does not re-sort the library" asserted
  via a render counter).
- A load-test script committed and runnable, not a one-off.

## Risks

- **Measuring on the wrong hardware** is the failure mode that makes every number here misleading.
  Floor device or it does not count.
- **CI cost** of device benchmarking. Run per release, not per PR; keep the Criterion gate per PR.

## Out of scope

Battery and thermal profiling — real for the hands-free stream, and worth its own pass once the
audio module exists.
