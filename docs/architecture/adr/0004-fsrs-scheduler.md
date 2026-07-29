# 0004 · Use FSRS as the scheduling algorithm

- **Status:** Accepted
- **Date:** 2026-07-28
- **Deciders:** Tech lead, product

## Context

The blueprint's Memory-model screen (`Loro.dc.html:963–1037`) plots a retention curve
`R(t) = 0.5^(t/S)`, marks a **50% review threshold**, reports **stability in days**, and shows
recall at +7 days. It then redraws the curve live as the learner rates their confidence, and
explains:

> _"Scheduled to resurface right as memory nears 50% — never too early, never too late."_ —
> `Loro.dc.html:3041`

That screen is not a decoration on top of a scheduler. **It is a scheduler's memory model, drawn.**
So the choice of algorithm is constrained: whatever we ship has to be the thing that screen is
showing, or the screen is lying.

The blueprint's own numbers are a display model: fixed intervals (`<5 min`, `~10 min`, `1 day`,
`5 days`) and hand-picked confidence multipliers (`0.35 / 0.9 / 1.7 / 2.7 / 4.3`). Good enough for a
prototype, not a scheduler.

We also have an unusual asset: **the learner tells us a phrase's difficulty when they add it**
([`product/learning-model.md`](../../product/learning-model.md)). Most schedulers spend several
reviews estimating that.

## Options considered

### A · SM-2 (Anki's classic algorithm)

**Pros** Simple, famous, easy to implement and explain. **Cons** Its model is an ease factor and a
repetition count — there is no _stability_ and no _retrievability_, so **there is nothing to plot on
the Memory-model screen**. We would have to invent a curve for display that the scheduler doesn't
actually use. That is precisely the dishonesty
[`product/learning-model.md`](../../product/learning-model.md#where-the-blueprints-numbers-came-from--and-what-is-real)
forbids.

### B · A hand-rolled interval scheme

**Pros** Total control; can be tuned to the blueprint's numbers exactly. **Cons** We would be
inventing a memory model with no validation, no published parameters, and no way to know whether
it's well-calibrated. Language learners deserve better than our intuition, and we'd have no way to
tell we'd got it wrong.

### C · FSRS (Free Spaced Repetition Scheduler)

**Pros**

- Its state **is** stability + difficulty + retrievability. `R(t) = 0.9^(t/S)` in the canonical form
  — the same shape the blueprint plots, and the threshold is a parameter (the blueprint's 50% is a
  desired-retention setting).
- Open, published, validated on very large review datasets, with a reference implementation to port
  and test against.
- **Parameters can be re-optimised from our own `review_log`**, so the scheduler gets better for
  _our_ learners rather than staying at generic defaults.
- Explicitly models difficulty as a per-card property, which is exactly where the learner's
  declaration slots in as a prior.

**Cons**

- More complex than SM-2 (~20 parameters).
- Re-optimisation is a real piece of work.
- Its grade vocabulary is four grades; we have three different rating UIs to map on.

### D · A learned per-learner model

**Rejected.** Not enough data at launch, not explainable to the learner, not reproducible across
platforms ([ADR-0002](0002-shared-rust-core.md)), and it would make the Memory-model screen
unplottable.

## Decision

**FSRS**, ported into `loro-core` with parity tests against the reference implementation.

Three Loro-specific adaptations:

1. **Learner-declared difficulty seeds FSRS difficulty.** `easy → 3.5 · med → 5.0 · hard → 7.5`,
   adjusted `+0.8` for a `remember` tag and `+0.4` for `words`. `pron` deliberately does not raise
   difficulty — it changes the _drill_, not the memory load. Re-rating later **nudges** difficulty
   by a bounded ±1.0 rather than overwriting learned state.
2. **Every engine feeds FSRS**, including the ones that never show an interval — a Refrain rep, a
   completed Speak-to-progress phrase, and a high-scoring prosody take all map onto grades
   ([scheduling.md](../scheduling.md#grade-mapping)). This is rule 5.
3. **Displayed intervals are FSRS's real output**, formatted with the blueprint's own formatter. The
   fixed labels in the prototype do not ship.

Daily review load is capped at `daily_minutes × 4` cards, with overflow deferred by due date and the
cap disclosed to the learner — the review-debt failure mode is the main way SRS apps lose people
([`product/practice-loops.md`](../../product/practice-loops.md#loop-a--the-engine)).

## Consequences

### Good

- The Memory-model screen is honest: the curve drawn is the curve used.
- The confidence UI maps cleanly — five levels onto four grades, with `Strong` carrying a small
  stability bonus over `Good`.
- Learner-declared difficulty removes FSRS's cold-start problem, which is a genuine advantage over
  every competitor using the same algorithm.
- Calibration is measurable: predicted retrievability vs observed recall, plotted weekly
  ([observability.md](../observability.md#learning-quality-telemetry)). If we're miscalibrated we
  will know, and we can re-optimise from `review_log`.
- Trip mode can compress intervals against a real deadline without breaking the model.

### Bad — accepted deliberately

- Complexity: ~20 parameters, and a port that must be parity-tested. Mitigated by golden tests
  against the reference implementation in CI.
- Re-optimisation is future work. We ship with published defaults, which are known to be decent, and
  the calibration dashboard tells us when it's worth doing.
- `review_log` must be retained **forever** on the client, because it's the input to re-optimisation
  ([data-model.md](../data-model.md#data-volume)). It's small (~20k rows/year, scalars only).
- Mapping implicit engine outcomes to grades is a judgement call, and a wrong mapping quietly
  degrades scheduling. Mitigated by making the mapping a single table in `loro-core` and reviewing
  it against calibration data.

### Revisit if…

- Calibration shows systematic miscalibration that re-optimising parameters doesn't fix — that would
  mean our learners' memory behaviour differs from FSRS's training population in a structural way
  (plausible: phrases with audio are not flashcards).
- FSRS-6 or a successor changes the state model in a way that breaks the Memory-model screen's
  visualisation contract.
- The implicit-grade mappings turn out to be doing more harm than good, in which case non-SRS
  engines would only feed FSRS on explicit gates.
