# Trip domain and the arrival-to-souvenir arc

- **Requirement IDs:** `P1-10`, `P5-01`…`P5-13`
- **Milestone:** M2
- **Status:** ⛔ Trip lifecycle implementation is blocked by Q-07 return/relocation semantics.
  Content inventory and design review can proceed; do not commit the state machine/schema before
  that decision.
- **Depends on:** 56 route laws; 59 persistence; 60 selection/scheduling; 61 trip content/assets;
  Q-07.
- **Reviewed:** 2026-09-07 against merged baseline `2d9e8c3`.

## Verified starting point

Trip documentation and gated draft API shapes exist, but no durable trip lifecycle or trip routes.
The current app supports seven course pairs; a trip must bind an explicit target course and preserve
it across UI-language changes. Drafts are not approved trip semantics.

## Outcome

A durable trip state machine drives Set Arrival, Countdown, Daily Drop, Survival, and Souvenir
surfaces without duplicating state in routes. The arc works across timezone changes, missed days,
offline launches, and trip edits.

## Remaining work

1. [ ] Resolve Q-07 before schema work: return date, one-way/moving-abroad, extension, cancellation,
       and completed-trip history.
2. [ ] Bind each trip to its target course, preserve it when the UI/native language changes, and
       require reviewed destination content for that target. Define trip entities, state
       transitions, local/absolute day keys, destination/timezone, need ordering, drop schedule,
       content snapshot, prefetch status, and souvenir handoff.
3. [ ] Add migrations/repositories/outbox/merge policies and pure lifecycle/scheduling tests.
4. [ ] Build Set Arrival and Countdown, then Daily Drop, Survival, and Souvenir routes against the
       shared navigation and UI systems. Plan 70 owns native widget/notification surfaces.
5. [ ] Select/compress practice content with plan-60 rules and real learner state; no fake
       readiness, urgency, ladder, or souvenir number.
6. [ ] Define edit/cancel/offline/no-content/insufficient-audio/midnight/DST/expired-drop/relaunch
       states and make every one reachable in E2E fixtures.

## Acceptance criteria

- The trip lifecycle is deterministic under clock/timezone fixtures and persists across relaunch.
- A missed day changes no copy or scheduler state in a shaming way.
- Survival remains reachable and useful without server access.
- Souvenir values are derived from recorded practice and hand off cleanly to normal scheduling.

## Out of scope

Native widgets/notifications, billing Trip Pass, travel booking, and multiple simultaneous trips.

## Post-main review and archive disposition — 2026-09-09

The [review at `de81744`](../docs/reviews/2026-09-09-post-main-plan-review.md) records this plan's
current contribution, remaining work and gates.
[Delivered slices](archive/2026-09-09/IMPLEMENTED-SLICES.md) are retained in the archive; this plan
remains incomplete. Earlier verification is dated evidence, not acceptance of the current combined
branch.
