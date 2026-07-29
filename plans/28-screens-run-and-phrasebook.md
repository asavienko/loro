# Screens 13 & 14 — the Run and the Phrasebook (Loop C)

- **Requirement IDs:** `LC-01`…`LC-15`
- **Milestone:** M5 (v2) — **conditional, gated on M3 data**
- **Blueprint:** Run `1572–1694`, Phrasebook `1708–1767`, logic `RogueLogic` `3426–3571`
- **Spec:** `functional-spec.md#13-the-run`, `#14-phrasebook--collection--ladder`
- **Screenshots:** `04-rest.png`, `c-rogue.png`, `c-ladder.png`, `j1.png`
- **Size:** XL

## Read this before starting

`docs/product/roadmap.md`, M5: **gated on M3 data.** Only build this if the loop comparison
(`docs/product/practice-loops.md#how-well-actually-decide`) says variety-and-depth is worth
pursuing, or if Refrain retention is plateauing. And Q-05 — _who owns the loop decision, and when_ —
is currently **open and blocking**, with no named owner and no power calculation.

So the honest first step of this plan is not code. It is: is the gate satisfied? If Q-05 has not
been answered, this plan cannot legitimately start, and saying so is more useful than building it
anyway.

## What already exists — more than you would expect

Loop C's _data_ is deliberately maintained from v1, so the Phrasebook is not empty on day one
(ADR-0006, and `ProgressDelta` comments at `packages/core/src/engines/types.ts:126`):

- `LadderRung` — the five rungs, `Accumulated → Bent → Transferred → PressureTested → Deployed`,
  declared `PartialOrd`/`Ord` in Rust because the ladder is monotonic: "you only climb or hold"
  (`packages/core-rs/src/lib.rs`).
- `packages/core-rs/src/ladder.rs` — `climb()`, `need()`, and `draw()` implemented with 9 tests.
- `PhraseState.rung` and `.stumbles` persisted and updated by whichever engine is active.
- `docs/architecture/scheduling.md:228–294` — how rungs are earned per engine, staleness and need,
  and the draw.

This is the single best-executed piece of optionality in the repo: `docs/product/roadmap.md` notes
that delaying Loop C "costs us nothing we can't recover" precisely because the ladder data accrues
regardless. Verify that claim before building — if v1 engines have _not_ actually been writing
`rung` ([fix-store-invariants.md](07-fix-store-invariants.md) §4 says the store currently drops
engine deltas), then the data does not exist and the premise fails. **That check is worth doing
now**, not in M5, because the window to fix it is while v1 is running.

## The work

### 1. The Phrasebook first (`LC-12`…`LC-15`)

It is cheaper, it ships value immediately from data already collected, and Q-04 asks whether the
ladder should become a _visible_ progress surface in v1 — possibly joining or replacing the four
mastery buckets on Progress. Building the Phrasebook answers Q-04 empirically.

Collection view, rung distribution, per-phrase rung history, and what it takes to climb the next
rung (`ladder::need`).

### 2. The Run (`LC-01`…`LC-11`)

Five phases with the draw, four finishers with real evaluation. `ladder::draw()` exists and is
tested. The hard part named in the roadmap: **the Deploy finisher's open-ended speech evaluation —
the hardest thing in the product.** Do not start there. Sequence the finishers by evaluation
difficulty and ship the run with the tractable ones, gating Deploy behind its own decision.

### 3. `RunEngine`

Implements `PracticeEngine`, passes the conformance suite, maintains every rule-5 signal including
FSRS and automaticity it never displays. Same discipline as every other engine — that is what makes
the loop experiment interpretable.

### 4. Staleness without punishment

`ladder::need()` and `staleReset` (`ProgressDelta`) mean a phrase can decay. Non-negotiable #3
constrains how that is shown: a phrase falling back is information, never a penalty, and never
framed as losing something the learner earned. The ladder is documented as monotonic per rung —
check what `staleReset` actually does against that claim, because "you only climb or hold" and a
reset are in tension, and the resolution should be written down.

## Acceptance criteria

- The gate is documented as satisfied (Q-05 answered, M3 data reviewed) before implementation
  starts.
- v1 ladder data is verified to exist and be correct before it is displayed.
- Phrasebook shows real rung distribution and per-phrase history.
- The Run's implemented finishers evaluate for real; unimplemented ones are absent, not stubbed.
- `RunEngine` passes conformance including undisplayed signals.
- Staleness is shown as information, with no loss framing.
- M5 exit criteria: the ladder distribution is a metric people check weekly, and rung ≥2 correlates
  with 30-day retention.

## Tests

- Engine conformance.
- `ladder::climb`/`need`/`draw` already have 9 tests; extend with long-horizon simulations (a 90-day
  history producing a plausible rung distribution).
- Property test: rung never decreases except through an explicit `staleReset`.

## Out of scope

Deploy's open-ended evaluation until it has its own plan and its own risk assessment.
