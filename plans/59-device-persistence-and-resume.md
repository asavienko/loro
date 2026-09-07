# Device SQLite as source of truth, with hydration and resume

- **Requirement IDs:** `F-02`, `F-03`, `F-04`, `LB-01`…`LB-10`
- **Milestone:** M1
- **Status:** 🟡 Schema-2 course/settings/day repositories and SQLite tests exist. Device driver,
  hydration, write-through and crash resume remain; native integration needs 58. Course-upsert
  correction and migration tests can start now.
- **Depends on:** 54 completed; 58 for the device driver; consume the implemented language/course
  contracts from 87.
- **Reviewed:** 2026-09-07 against merged baseline `2d9e8c3`.

## Verified starting point

`packages/core/src/persistence/migrations.ts` already has schema 2, atomic languagePair settings and
course-scoped daily sets; `apps/mobile/src/data/languages.test.ts` exercises them with SQLite. The
store is still in memory. `packages/core/src/persistence/sqlite/course.ts` uses `INSERT OR REPLACE`;
replace it with an owned-column conflict update before device wiring, preserving 54's
phrase/settings guarantees.

## Outcome

The mobile app reads durable state from on-device SQLite, writes through repositories and outbox in
one transaction, and resumes practice after process death without mirroring durable truth in
Zustand.

## What already exists

Repository contracts, schema/migrations, outbox, memory parity, and a Node SQLite driver test seam
exist. The current production app does not instantiate them and still stores phrases/settings/days
in memory.

Plan 87 delivered schema-2 language settings, course-session repositories and target-scoped daily
sets. Hydrate every course, restore the active target, and write course transitions transactionally
with existing repositories/outbox. Native/target settings use the atomic `languagePair` field.

## Remaining work

1. [ ] Implement the op-sqlite `SqlDriver` adapter and migration/bootstrap/erasure lifecycle behind
       the plan-58 platform port.
2. [ ] Correct `SqlCourseTable.save` to use owned-column `ON CONFLICT DO UPDATE`; test repeated
       writes and preserve unrelated columns. Reuse schema 2 and add forward migrations only for
       genuinely missing durable/session fields. Every syncable field gets a declared merge policy.
3. [ ] Hydrate all courses, restore the active pair, and keep global streak days separate from
       target-local day/session state. Replace durable Zustand slices with repository-backed
       selectors/subscriptions. Keep only engine-session and ephemeral UI state in memory.
4. [ ] Persist session transitions, selected sets, wave progress, clock/day keys, settings, and
       pending operations; define crash-safe resume/abandon semantics.
5. [ ] Seed bundled content idempotently, preserve learner rows across content updates, and expose
       fatal migration recovery without destructive automatic reset.
6. [ ] Add device tests for fresh install, upgrade, force-quit/relaunch, midnight/timezone change,
       transaction crash, erasure, and web-target fallback.

## Acceptance criteria

- App relaunch preserves phrase identity, settings, day/streak state, session progress, and outbox.
- No durable field has a second Zustand source of truth or manual refresh path.
- Every write succeeds locally without awaiting the network.
- Migration failure is recoverable/diagnosable and never silently deletes learner data.

## Out of scope

Remote sync transport, auth, audio cache files, and trip-specific tables beyond approved schema
needs.
