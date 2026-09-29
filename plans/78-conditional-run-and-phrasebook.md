# Conditional Run and Phrasebook

- **Requirement IDs:** `LC-01`…`LC-15`
- **Milestone:** M5
- **Status:** ⛔ Run and ladder Phrasebook remain blocked by Q-05 and comparative M3 evidence.
  Existing ladder helpers are reusable inputs, not approval to build Loop C.
- **App swap (2026-09-30):** the first app this plan extended was replaced in `apps/mobile` by the
  v2.0 player (plan [104](104-prototype-react-native.md)); re-scope the screens against it before
  resuming.
- **Depends on:** 59 course history; 60 canonical selection; 71 approved experiment and data; 72
  applicable release evidence.
- **Reviewed:** 2026-09-07 against merged baseline `2d9e8c3`.

## Verified starting point

`packages/core-rs/src/ladder.rs` exists, but Run/Phrasebook routes and a Run engine do not. Keep
ladder-compatible data in ordinary engines. Plan 81 may expose search over existing owned phrases
independently; it must not release the gated ladder Phrasebook under another name.

## Decision gate

Do not implement these screens because they exist in the blueprint. First confirm the M3 loop
comparison has an owner, adequate sample, common outcome, guardrails, and evidence that Loop C is
worth its complexity. The default while evidence is absent is to continue recording compatible
ladder signals, not to build the UI.

## Outcome after approval

Phrasebook exposes real ladder distribution/history and filters; Run provides a deterministic,
resumable sequence using the existing `PracticeEngine` contract. Neither invents rung movement,
staleness, mastery, or readiness.

## Remaining work

1. [ ] Write the go/no-go decision and exact product scope; update Q-05 and roadmap before code.
2. [ ] Audit accumulated target-course ladder data/model validity and migrate only if the approved
       metric requires it.
3. [ ] Build Phrasebook first: scalable search/filter/tag/rung/history states with accessible
       histogram and honest no-data behavior.
4. [ ] Implement `RunEngine` and Run session/deal/ladder/finisher/resume/undo behavior through
       canonical selection and `applyDelta`.
5. [ ] Define engine switching, flags, trip interaction, offline behavior, sync conflicts, and
       rollback if the arm is disabled.
6. [ ] Add deterministic simulations, long-library performance, interrupted/resumed sessions,
       no-data/ mixed-rung states, accessibility, native E2E, and experiment-analysis parity.

## Acceptance criteria

- A recorded evidence decision authorizes the feature before implementation starts.
- Every rung/distribution/movement value derives from stored outcomes and canonical core math.
- Switching into/out of Run loses no progress and requires no network.
- If disabled, the app retains valid learner data and a usable primary loop.

## Out of scope

Competitive leaderboards, social ranking, speculative new ladder signals, and building Loop C to
avoid making the Q-05 decision.

## Post-main review and archive disposition — 2026-09-09

The [review at `de81744`](../docs/reviews/2026-09-09-post-main-plan-review.md) records this plan's
current contribution, remaining work and gates.
[Delivered slices](archive/2026-09-09/IMPLEMENTED-SLICES.md) are retained in the archive; this plan
remains incomplete. Earlier verification is dated evidence, not acceptance of the current combined
branch.
