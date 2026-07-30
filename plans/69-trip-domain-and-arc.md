# Trip domain and the arrival-to-souvenir arc

- **Requirement IDs:** `P1-10`, `P5-01`…`P5-13`
- **Milestone:** M2
- **Status:** Blocked on Q-07 trip-end semantics
- **Depends on:** 56 navigation, 59 persistence, 60 scheduling/selection, 61 trip content/assets

## Outcome

A durable trip state machine drives Set Arrival, Countdown, Daily Drop, Survival, and Souvenir
surfaces without duplicating state in routes. The arc works across timezone changes, missed days,
offline launches, and trip edits.

## Work

1. Resolve Q-07 before schema work: return date, one-way/moving-abroad, extension, cancellation, and
   completed-trip history.
2. Define trip entities, state transitions, local/absolute day keys, destination/timezone, need
   ordering, drop schedule, content snapshot, prefetch status, and souvenir handoff.
3. Add migrations/repositories/outbox/merge policies and pure lifecycle/scheduling tests.
4. Build Set Arrival and Countdown, then Daily Drop, Survival, and Souvenir routes against the
   shared navigation and UI systems. Plan 70 owns native widget/notification surfaces.
5. Select/compress practice content with plan-60 rules and real learner state; no fake readiness,
   urgency, ladder, or souvenir number.
6. Define edit/cancel/offline/no-content/insufficient-audio/midnight/DST/expired-drop/relaunch
   states and make every one reachable in E2E fixtures.

## Acceptance criteria

- The trip lifecycle is deterministic under clock/timezone fixtures and persists across relaunch.
- A missed day changes no copy or scheduler state in a shaming way.
- Survival remains reachable and useful without server access.
- Souvenir values are derived from recorded practice and hand off cleanly to normal scheduling.

## Out of scope

Native widgets/notifications, billing Trip Pass, travel booking, and multiple simultaneous trips.
