# Real FSRS Review and Memory surfaces

- **Requirement IDs:** `P3-30`…`P3-40`, `P3B-01`…`P3B-08`
- **Milestone:** M3
- **Status:** Not started
- **Depends on:** 59 durable schedules, 60 real FSRS, 72 quality harness

## Outcome

Review uses real FSRS due state and tag-aware queues; Memory visualizes stored stability/
retrievability/lapses without manufacturing a curve, history, or confidence value.

## Work

1. Define Review session/queue/grade/resume/undo/interruption contracts and route states against
   canonical FSRS units and repository writes.
2. Implement tag-aware selection and all due/empty/no-history/mixed/custom-phrase states with
   deterministic fixtures.
3. Render Memory axes/curve/points/labels from actual histories and model outputs; state honestly
   when insufficient data exists.
4. Implement accessible chart summaries, focus order, Dynamic Type, reduced motion, and color-
   independent encoding.
5. Test long histories, lapses, timezone changes, migration, no due items, undo, interrupted
   session, outlier intervals, and parity between displayed values and stored/model data.

## Acceptance criteria

- Every scheduled interval and displayed curve value traces to plan-60 output and stored events.
- Review outcomes write only through `applyDelta`/repository transaction and survive relaunch/sync.
- No-data and low-confidence states show no invented trend.
- Native and browser states meet plan-72 gates.

## Out of scope

Experimenting with another scheduler, coaching AI, prosody scores, and Run ladder logic.
