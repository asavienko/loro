# Real FSRS Review and Memory surfaces

- **Requirement IDs:** `P3-30`…`P3-40`, `P3B-01`…`P3B-08`
- **Milestone:** M3
- **Status:** — Review and Memory remain to do; need 59 durable history and 60 canonical FSRS. Use
  72's shared harness as it develops, without waiting for whole-release sign-off.
- **Depends on:** 59 history/resume; 60 FSRS/selection; 56/81 route laws; 57 chart primitives; 72
  applicable harness only.
- **Reviewed:** 2026-09-07 against merged baseline `2d9e8c3`.

## Verified starting point

Neither Review nor Memory has an app route or production engine. SRS fields/types and partial Rust
functions exist, but `coreFacade.ts` still fabricates review intervals. Course histories must remain
isolated; missing history is not a zero-confidence curve.

## Outcome

Review uses real FSRS due state and tag-aware queues; Memory visualizes stored stability/
retrievability/lapses without manufacturing a curve, history, or confidence value.

## Remaining work

1. [ ] Define target-course-scoped Review session/queue/grade/resume/undo/interruption contracts and
       route states against canonical FSRS units and repository writes.
2. [ ] Implement tag-aware selection and all due/empty/no-history/mixed/custom-phrase states with
       deterministic fixtures.
3. [ ] Render Memory axes/curve/points/labels from actual histories and model outputs; state
       honestly when insufficient data exists.
4. [ ] Implement accessible chart summaries, focus order, Dynamic Type, reduced motion, and color-
       independent encoding.
5. [ ] Test long histories, lapses, timezone changes, migration, no due items, undo, interrupted
       session, outlier intervals, and parity between displayed values and stored/model data.

## Acceptance criteria

- Every scheduled interval and displayed curve value traces to plan-60 output and stored events.
- Review outcomes write only through `applyDelta`/repository transaction and survive relaunch/sync.
- No-data and low-confidence states show no invented trend.
- Native and browser states meet plan-72 gates.

## Out of scope

Experimenting with another scheduler, coaching AI, prosody scores, and Run ladder logic.
