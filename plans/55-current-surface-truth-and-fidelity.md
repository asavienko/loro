# Current-surface truth and blueprint fidelity

- **Requirement IDs:** `P1-01`…`P1-12`, `P2-01`…`P2-40`, `P3-01`…`P3-12`, `P4-01`…`P4-08`,
  `LB-01`…`LB-10`, `P2-13`, `P2-26`
- **Milestone:** M1
- **Status:** Not started
- **Depends on:** plan 53 ✅ behavior-preserving baseline

## Outcome

The seven implemented learner screens and app shell match the blueprint contract where the product
can support it, and never imply playback, progress, routing, timing, or persistence that does not
exist.

## What already exists

All current routes have browser E2E state coverage, accessibility checks, text-scale coverage, a
central copy catalog, split UI primitives/components, and token-based color enforcement. Those
completed plan-51/52 outcomes are inputs, not work items.

## Work

1. Re-run the blueprint `renderVals()` audit for every current state and record deliberate
   divergences with requirement IDs.
2. Remove or honestly disable the Stream 35% progress over silence and non-advancing repeat dots
   until native playback owns real position.
3. Make Browse theme drill, onboarding answers, remove confirmation/undo, Today wave labels, and the
   zero-height mastery histogram truthful. Route dependency-backed fixes to plans 56/60/64 rather
   than fabricate interim behavior.
4. Fix current latency formatting so measured sub-300 ms samples are not raised and long samples are
   not capped; keep speech-onset measurement in plan 63.
5. Add blueprint fixtures or focused render assertions for geometry/state that semantic E2E cannot
   see, without screenshot-testing every pixel.
6. Update the state manifest for every new error, confirmation, empty, disabled, and completion
   state added here.

## Acceptance criteria

- No current control or number claims an unavailable action or fabricated state.
- All blueprint differences are either fixed or listed in the divergence table with a product or
  technical reason.
- `pnpm check`, all current browser E2E, bundle smoke, accessibility, and text-scale gates pass.
- Existing learner copy changes only when the intended product contract changes.

## Out of scope

New routes, real audio/speech, persisted waves, navigation architecture, and unbuilt screens.
