# Flags and experimentation: make the loop experiment possible

- **Requirement IDs:** cross-cutting; unblocks Q-01, Q-02, Q-05, Q-06
- **Milestone:** M2 (flags) → M3 (the loop experiment)
- **Spec:** `docs/process/experimentation.md`
- **Size:** M

## Current state

There is no flag system. `apps/mobile/src/store/index.ts:360`:

```ts
flags: { bool: (_k, d) => d, number: (_k, d) => d },
```

Every flag returns its default. The contract exists (`EngineContext.flags`,
`packages/core/src/engines/types.ts:181`) and there is no provider behind it.

Flags that already exist **in code** and cannot be set:

| Flag                       | Declared at                                                                                     | Why it matters                      |
| -------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------- |
| `prosody.levelUpThreshold` | `core-rs/src/dsp/score.rs:44` — "tunable … because we genuinely don't know the right value yet" | The cue ladder's pacing             |
| `refrain.repTarget`        | Q-01 says it is "already a flag"                                                                | The 4/6/8 experiment                |
| ASR `fuzzy`                | `core-rs/src/asr.rs` — off by default, "a pedagogical decision"                                 | Production-gate strictness          |
| The new/old set mix        | [select-rs-cloze-and-set-selection.md](18-select-rs-cloze-and-set-selection.md)                 | Whether today's set feels punishing |

So four decisions that were deliberately deferred to measurement cannot be measured.

## What blocks what

**Q-05 blocks M3 start**, and the reason is specific:

> the common cold probe has to be instrumented before the arms are live — **you cannot retro-fit the
> measure onto an experiment already running.**

Q-05 needs a named owner, a decision date, a pre-registered primary metric, and a required sample
size. The metric and design are drafted (`docs/product/practice-loops.md#how-well-actually-decide`);
the owner and the power calculation are not. Those are not engineering deliverables — but the
instrumentation and the assignment mechanism are, and they must exist first.

## The ethics constraint is real here

`docs/process/experimentation.md` includes "the ethics of experimenting on learning". This is not a
checkout-button colour test: an arm that teaches worse costs a learner weeks of their time before a
trip. So the design needs, explicitly:

- **A stopping rule** with pre-registered harm thresholds, monitored continuously, not at the end.
- **Guardrail metrics** that stop an arm regardless of the primary metric
  (`docs/product/metrics.md`).
- **No experiments on the honesty rules.** Never A/B a fabricated number against a real one, and
  never test whether shaming copy improves retention. The three non-negotiables are not hypotheses.
- **Sticky assignment** — a learner does not get reassigned mid-trip. Their practice history would
  become uninterpretable and, worse, their preparation inconsistent.

## The work

### 1. A real flag provider

Precedence: local debug override → remote config → default. Typed accessors (`bool`, `number`,
`string`, `variant`) matching the existing contract. Every flag declared in one registry with its
type, default, owner, and expiry date — a flag with no expiry becomes permanent branching, and
permanent branching is how codebases rot.

Offline-first: the last fetched config is cached and used; a flag never blocks a launch or a
practice path. Defaults must be safe, because "no config available" is a normal state for this app.

### 2. Deterministic assignment, computed in Rust

Bucketing must be identical on device and server (for analysis), and the widget may need it too. So
`core-rs`: `assign(experimentId, userId, arms) -> arm`, a pure hash — no RNG, matching the crate's
rule that "the clock and the RNG seed are parameters" (`core-rs/src/lib.rs`).

Sticky by construction: the same `(experimentId, userId)` always yields the same arm, so stickiness
needs no storage and cannot drift.

### 3. Wire the four existing flags

Each becomes settable, logged when non-default, and covered by a test asserting the non-default path
works — an unexercised flag branch is a latent bug that ships to whoever gets the experiment.

### 4. Instrument the common measure before any arm goes live

The cold probe (Q-02 discusses it as the cleanest source for the loop experiment's common measure).
Instrument it in **every** engine, so the arms are comparable — that is precisely the thing that
cannot be retro-fitted, and the reason this plan sits on M3's critical path
([observability-and-analytics.md](32-observability-and-analytics.md) §4).

### 5. A debug surface

Flag overrides, current assignments, and the emitted events, on device. Dogfooders need to see which
arm they are in; support needs it to reproduce a report.

### 6. Analysis path

Exposure events, assignment logged with the arm, and a documented query.
`docs/process/experimentation.md` should end up describing something runnable, not a methodology in
the abstract.

## Acceptance criteria

- Flags resolve through the documented precedence; local overrides win.
- Every flag is registered with type, default, owner, and expiry; CI warns on an expired flag.
- Assignment is deterministic, sticky, and identical in Rust and in analysis.
- The four existing flags are settable, logged, and have their non-default paths tested.
- The cold probe is instrumented in every engine before any experiment arm is enabled.
- Guardrail metrics and a stopping rule are defined for the loop experiment before it starts.
- No experiment can be configured against a non-negotiable — documented as policy in
  `experimentation.md` and enforced in review.
- A learner mid-trip is never reassigned.
- Flags work offline with safe defaults.

## Tests

- Precedence table test.
- Assignment determinism and distribution tests; Rust/analysis parity on a fixture.
- Offline behaviour: no config, stale config, corrupt config.
- Each flag's non-default branch.

## Risks

- **Q-05 may stay open.** Then the loop experiment does not start, and M3's gate is not met.
  Building the mechanism does not answer the ownership question — say so to whoever needs to decide
  rather than letting the infrastructure imply the decision is handled.
- **Flag debt.** Expiry dates plus a CI warning is the cheapest defence; without it this plan makes
  the codebase worse in a year.

## Out of scope

A bandit or adaptive-allocation system. Fixed arms with a pre-registered analysis is the right level
for pedagogy experiments.
