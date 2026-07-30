# Conditional Run and Phrasebook

- **Requirement IDs:** `LC-01`…`LC-15`
- **Milestone:** M5
- **Status:** Blocked on Q-05 and M3 comparative evidence
- **Depends on:** 59 durable ladder history, 60 deterministic selection/maths, 71 experiment
  decision/data, 72 quality gates

## Decision gate

Do not implement these screens because they exist in the blueprint. First confirm the M3 loop
comparison has an owner, adequate sample, common outcome, guardrails, and evidence that Loop C is
worth its complexity. The default while evidence is absent is to continue recording compatible
ladder signals, not to build the UI.

## Outcome after approval

Phrasebook exposes real ladder distribution/history and filters; Run provides a deterministic,
resumable sequence using the existing `PracticeEngine` contract. Neither invents rung movement,
staleness, mastery, or readiness.

## Work

1. Write the go/no-go decision and exact product scope; update Q-05 and roadmap before code.
2. Audit accumulated ladder data/model validity and migrate only if the approved metric requires it.
3. Build Phrasebook first: scalable search/filter/tag/rung/history states with accessible histogram
   and honest no-data behavior.
4. Implement `RunEngine` and Run session/deal/ladder/finisher/resume/undo behavior through canonical
   selection and `applyDelta`.
5. Define engine switching, flags, trip interaction, offline behavior, sync conflicts, and rollback
   if the arm is disabled.
6. Add deterministic simulations, long-library performance, interrupted/resumed sessions, no-data/
   mixed-rung states, accessibility, native E2E, and experiment-analysis parity.

## Acceptance criteria

- A recorded evidence decision authorizes the feature before implementation starts.
- Every rung/distribution/movement value derives from stored outcomes and canonical core math.
- Switching into/out of Run loses no progress and requires no network.
- If disabled, the app retains valid learner data and a usable primary loop.

## Out of scope

Competitive leaderboards, social ranking, speculative new ladder signals, and building Loop C to
avoid making the Q-05 decision.
