# Real FSRS Review and Memory surfaces

- **Requirement IDs:** `P3-30`…`P3-40`, `P3B-01`…`P3B-08`
- **Milestone:** M3
- **Status:** 🟡 The course-scoped Review engine now creates a finite due queue and records explicit
  grades through canonical FSRS deltas; a reachable route, durable Review checkpoint/resume
  contract, and Memory remain. Canonical due order, cross-session daily budget and conformance also
  remain. Undo is blocked on reviewed plan-68 compensation/retry semantics; it must not be exposed
  by the initial Review route.
- **Depends on:** 59 history/resume; 60 FSRS/selection; 56/81 route laws; 57 chart primitives; 72
  applicable harness only.
- **Reviewed:** 2026-09-09 against `aafa61f`; current source, tests and retained review records
  inspected. This plan refresh supplies no new runtime, device or deployment acceptance.
- **Priority:** 3; Review engine/route before Memory.

Previous starting point: [archived snapshot](archive/2026-09-08/75-review-and-memory.md).

## Verified starting point

Neither Review nor Memory has an app route. Canonical Rust FSRS and durable practice history are
implemented through plans 59/60/94; `coreFacade.ts` delegates to Rust without a fabricated interval
fallback. The Review engine uses those existing boundaries. Course histories must remain isolated;
missing history is not a zero-confidence curve.

## Outcome

Review uses real FSRS due state and tag-aware queues; Memory visualizes stored stability/
retrievability/lapses without manufacturing a curve, history, or confidence value.

## Remaining work

1. [ ] Define the durable Review checkpoint/resume contract and a first-review policy for
       unscheduled phrases. The pure engine's explicit-grade attempt contract and local
       `committed_attempt` idempotency boundary exist; the route must persist and validate a stable
       event identity, target course, local day, phrase identity and content before resuming. Keep
       Undo a separate 68-owned compensation contract; it is not a prerequisite for the initial
       route.
2. [ ] Wire the conforming Review engine into a reachable route. It plans target-course due rows in
       repository order, caps daily work at `dailyMinutes × 4`, requires a learner-declared grade,
       and calls only the canonical FSRS facade. Persist grades through `applyDelta`,
       attempt/history and checkpoint writes in one transaction before publishing state. Add
       due/empty/no-history/mixed/custom route states with deterministic fixtures.
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

## Delivery order and gates

1. Define Review queue/grade/attempt/checkpoint contracts against 59/60, then implement the engine
   and reachable route. Verify a grade changes the canonical due state, survives relaunch and sync,
   and is not applied twice after retry or interruption. Use current 56/57/81 APIs; no full-plan
   completion, live provider or production recorded audio is required.
2. Deliver the Review engine and route before Memory visualization. Define whether Undo is a new
   compensating event or another reviewed operation, and verify retry/sync behavior with 68 before
   exposing it; never rewrite an acknowledged review silently.
3. Build accessible Memory charts from canonical outputs and retained history, with geometric
   assertions in `e2e/render.spec.ts`. Use 56/57/81 slices and 72's shared harness as they land;
   whole-release sign-off, Q-05 and live providers are not prerequisites to this feature.

## Out of scope

Experimenting with another scheduler, coaching AI, prosody scores, and Run ladder logic.

## Implemented slice — 2026-09-09

`packages/core/src/engines/review.ts` partitions live repository rows by target course and canonical
`isDue` eligibility, preserving repository order. It distinguishes an empty course, missing
schedules, nothing due and due candidates; mixed scheduled/unscheduled courses retain the
unscheduled rows separately. Graduation does not suppress due reviews; learner-marked learned
phrases do. Legacy rows remain Spanish and custom phrases use the same eligibility. Tag focus uses
the authored pronunciation → memory hook → useful → recall precedence.

`ReviewEngine` now consumes that boundary for already-due rows. It preserves repository-provided
order, caps the finite queue at `dailyMinutes × 4`, requires an explicit self-grade, and delegates
the resulting schedule to the canonical FSRS facade. Its delta carries canonical review evidence, so
the existing `applyDelta` transaction can write a phrase, `committed_attempt`, `review_event` and
outbox record atomically once the route supplies a stable attempt ID. It does not rank, create a
schedule for an unscheduled phrase, infer history from a schedule, or fabricate intervals. The next
slice must add the durable Review checkpoint and route resume validation for target course,
clock/day, phrase identity and content. Undo stays unavailable until plan 68 defines an idempotent
compensating operation; acknowledged events must never be silently rewritten. A pronunciation focus
is a prompt policy and does not claim available ASR/DSP or a measured pronunciation score.

Focused tests cover course/custom/legacy isolation, due boundaries, graduation/learned exclusions,
missing schedules, mixed tags, retained provenance and invalid clocks. No route or new
learner-visible state is introduced by this slice.

## Post-main review and archive disposition — 2026-09-09

The [review at `de81744`](../docs/reviews/2026-09-09-post-main-plan-review.md) records this plan's
current contribution, remaining work and gates.
[Delivered slices](archive/2026-09-09/IMPLEMENTED-SLICES.md) are retained in the archive; this plan
remains incomplete. Earlier verification is dated evidence, not acceptance of the current combined
branch.
