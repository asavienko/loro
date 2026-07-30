# Device SQLite as source of truth, with hydration and resume

- **Requirement IDs:** `F-02`, `F-03`, `F-04`, `LB-01`…`LB-10`
- **Milestone:** M1
- **Status:** Not started
- **Depends on:** 54 local correctness, 58 native workspace

## Outcome

The mobile app reads durable state from on-device SQLite, writes through repositories and outbox in
one transaction, and resumes practice after process death without mirroring durable truth in
Zustand.

## What already exists

Repository contracts, schema/migrations, outbox, memory parity, and a Node SQLite driver test seam
exist. The current production app does not instantiate them and still stores phrases/settings/days
in memory.

## Work

1. Implement the op-sqlite `SqlDriver` adapter and migration/bootstrap/erasure lifecycle behind the
   plan-58 platform port.
2. Extend the schema only for required current durable/session fields; every syncable field receives
   a declared field policy and migration.
3. Replace durable Zustand slices with repository-backed selectors/subscriptions. Keep only
   engine-session and ephemeral UI state in memory.
4. Persist session transitions, selected sets, wave progress, clock/day keys, settings, and pending
   operations; define crash-safe resume/abandon semantics.
5. Seed bundled content idempotently, preserve learner rows across content updates, and expose fatal
   migration recovery without destructive automatic reset.
6. Add device tests for fresh install, upgrade, force-quit/relaunch, midnight/timezone change,
   transaction crash, erasure, and web-target fallback.

## Acceptance criteria

- App relaunch preserves phrase identity, settings, day/streak state, session progress, and outbox.
- No durable field has a second Zustand source of truth or manual refresh path.
- Every write succeeds locally without awaiting the network.
- Migration failure is recoverable/diagnosable and never silently deletes learner data.

## Out of scope

Remote sync transport, auth, audio cache files, and trip-specific tables beyond approved schema
needs.
