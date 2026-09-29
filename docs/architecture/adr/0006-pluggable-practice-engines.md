# 0006 · Make the practice loop a plug-in, and have every engine maintain every progress signal

- **Status:** Accepted; implementation removed (2026-09-30) — the engines left `packages/core` with
  the first app (Git history at `52a0e3b`). The current app has one listening loop behind a pure
  state machine.
- **Date:** 2026-07-28
- **Deciders:** Product, tech lead

## Context

The blueprint does something unusual: it builds **three complete, mutually exclusive philosophies**
of what daily practice should be, to full interactive fidelity, and then explicitly declines to
choose between them. The transitions are labelled:

> _"or a different philosophy entirely ↓"_ — `Loro.dc.html:1299` _"or one more philosophy ↓"_ —
> `Loro.dc.html:1541`

And it states the tension directly:

> Loop A optimises retention across a growing library; Loop B builds **automaticity through depth**.
> — `Loro.dc.html:1307`

- **Loop A** — SRS over a growing library, plus pronunciation, prosody, and roleplay surfaces.
- **Loop B** — the Daily Refrain: 5 phrases, 3 waves, rotating manner per rep, until each locks in.
- **Loop C** — the Roguelike Run: a bounded run, a dealt finisher, a permanent five-rung ladder.

We do not have the data to choose. The three optimise different outcomes, suit different personas,
and each has a real failure mode ([`product/practice-loops.md`](../../product/practice-loops.md)).

## Options considered

### A · Pick one and build it

**Pros** Simplest codebase; fastest to a coherent v1. **Cons** Throws away two thirds of a carefully
considered design on a guess. If we pick wrong, the rewrite is not a refactor — it's a different
product. And the blueprint's author, who understood the problem best, declined to make this call
after building all three.

### B · Build all three fully in v1

**Pros** Nothing is lost; learners choose. **Cons** Three half-products. Loop C alone needs four
distinct finisher mechanics with real evaluation, including open-ended speech for the Deploy
finisher. It would push v1 out by months and none of the three would be excellent.

### C · One `PracticeEngine` interface, engines shipped incrementally, and **every engine maintains every

progress signal**

**Pros**

- The differences between the loops are exactly _selection, sequencing, and evaluation_ — a strategy
  interface fits the seam precisely. Everything else (phrase store, audio, ASR, DSP, design system,
  trip arc) is genuinely shared.
- v1 ships one loop excellently; the others land behind flags without a refactor.
- **Because every engine writes FSRS state, `rung`, and `automaticity` — even when it doesn't
  display them — switching loops is lossless and cross-engine comparison is possible on a common
  measure.**
- Engines are headless and unit-testable with an in-memory store, no renderer, no device.

**Cons**

- One interface plus a registry plus a conformance suite: real, if modest, cost.
- Rule 5 (maintain signals you don't display) is easy to violate silently.
- Some engines write signals whose semantics are a judgement call (what does a Refrain rep mean as
  an FSRS grade?).

## Decision

**Option C.** A single `PracticeEngine` contract in `packages/core`, five to seven implementations,
a flag-gated registry, and a **conformance suite every engine must pass**
([practice-engines.md](../practice-engines.md#conformance)).

Ship order: **v1** StreamEngine + RefrainEngine (hero) · **v1.1** SrsEngine, ProsodyEngine,
PronunciationEngine, RoleplayEngine · **v2** RunEngine.

The load-bearing rule:

> **Every engine maintains every progress signal it can legitimately compute, including ones it does
> not display.** ([overview.md](../overview.md#the-ten-rules), rule 5)

Enforced by the conformance suite, not by convention. A new engine is not done until it passes.

## Consequences

### Good

- We keep the optionality the blueprint deliberately preserved, at the cost of one interface.
- **The loop question becomes empirical.** With ≥2 engines live and a common 30-day cold-probe
  measure, we can compare retention rather than argue about philosophy
  ([`product/practice-loops.md`](../../product/practice-loops.md#how-well-actually-decide)).
- Switching loops is lossless, so a learner can try one without risk — which also means we can
  experiment without harming anyone.
- **The Phrasebook is not empty on the day Loop C ships**, because `rung` has been maintained since
  v1. This turns v2's biggest screen from a cold start into an immediate payoff.
- Engines are the most testable code in the app: pure selection and sequencing logic over an
  injected store and clock.
- v1 ships one loop _well_ rather than three loops adequately.

### Bad — accepted deliberately

- The interface has to accommodate genuinely different shapes — a passive listening stream with no
  gate, a scored DSP take, a dealt roguelike finisher. Handled with a `GateSpec` union and an
  engine-specific `meta` payload, which is a small amount of looseness in exchange for not forcing
  five things into one mould.
- **Implicit grade mappings are judgement calls.** "A Refrain rep produced within 2× median latency
  is an FSRS `Good`" is a reasonable claim, not a proven one. Mitigated by keeping every mapping in
  one table in `loro-core` and reviewing it against calibration data
  ([observability.md](../observability.md#learning-quality-telemetry)).
- Rule 5 costs a little work in every engine and is invisible to the learner, so it will feel like
  overhead. The conformance test is what stops it being skipped.
- Maintaining signals for unshipped loops means writing code whose value is deferred. Accepted
  knowingly: `rung` maintenance in v1 is cheap and its payoff (a populated Phrasebook, plus a depth
  metric usable immediately) is large.

### Revisit if…

- After a fair comparison one loop clearly wins on 30-day retention. Then we **keep the interface**
  (it's already paid for and it's how the labs plug in) but stop building alternatives.
- An engine needs a genuinely new _gate kind_. That signals new evaluation machinery, which is a
  bigger change than adding an engine and deserves its own ADR.
- The conformance suite starts being weakened to let an engine through. That means the interface is
  wrong, and the right response is to fix the interface, not the test.
