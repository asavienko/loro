# 0004 · Use FSRS as the scheduling algorithm

- **Status:** Accepted
- **Date:** 2026-07-28

## Context

The app has to decide when each phrase comes back, and every number it shows about memory must be
real. The scheduler therefore needs an explicit memory model — stability, difficulty, predicted
recall — not just an interval table.

## Options considered

- **SM-2.** Simple and familiar, but it has no stability or retrievability, so there is no real
  memory curve to show.
- **A hand-made interval scheme.** Full control, no validation and no way to know it is wrong.
- **FSRS.** Its state is stability, difficulty and retrievability; it is published, validated on
  large review datasets and has a reference implementation to test against; its parameters can later
  be re-fitted from Loro's own review log.
- **A learned per-learner model.** Too little data, not explainable, not reproducible across
  platforms.

## Decision

**FSRS-6 with published default parameters**, ported into `packages/core-rs` and parity-tested
against the reference ([ADR-0002](0002-shared-rust-core.md)). The core schedules to 50% desired
retention, uses one ten-minute learning step and maps the app's three ratings onto FSRS grades. The
details are in [fsrs-model.md](../fsrs-model.md).

## Consequences

- Intervals and recall shown to the learner are FSRS's real output.
- About twenty parameters and a port that must stay in parity; golden fixtures guard it.
- Re-fitting parameters is future work and needs the review log kept.
- A changed parameter vector or policy needs a new algorithm id and a migration.
- The 50% retention puts reviews years apart after a few good ones, so the app shortens the core's
  date to its 90%-recall point; which retention should decide reviews is open
  ([Q-24](../../decisions/open-questions.md#q-24)).
