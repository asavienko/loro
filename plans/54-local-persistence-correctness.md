# Local persistence correctness before device wiring

- **Requirement IDs:** `F-03`, `F-04`, `LB-03`
- **Milestone:** M1
- **Status:** ✅ Implemented — all five work items and all four acceptance criteria. `pnpm check`
  (23 tasks) and `pnpm test:e2e` (65) green.
- **Depends on:** plan 53 ✅ for final adapter/context seams

## Outcome

The existing driver-agnostic persistence layer preserves deletion and per-field merge history, and
stores every Refrain-day field the domain exposes. Device SQLite and sync must not amplify known
corruption defects.

## What already exists

Schema v1, migrations, repository interfaces, SQLite repositories, nested transactions, outbox
coalescing, erasure, and tests against real `node:sqlite` are implemented. This plan does not
replace them or add the on-device driver.

## Work

1. Replace destructive phrase/settings upserts that clear `field_hlc` or `deleted_at` with explicit
   conflict updates that preserve tombstones and merge metadata unless the incoming operation owns
   those fields.
2. Add `waves` to `RefrainDayRow`, migration/repository mappings, memory parity, and round-trip
   tests; remove the persisted `[]` fallback.
3. Align active-phrase eligibility with graduation and deletion rules across memory, SQLite, and the
   mobile repository adapter.
4. Test retry, nested transaction, soft-delete/reinsert, outbox coalescing, and GDPR erasure paths
   using adversarial row histories.
5. Document the implemented handwritten SQL architecture and resolve the stale Drizzle claim with an
   ADR amendment; do not introduce a second ORM without a measured reason.

## Acceptance criteria

- A stale upsert cannot resurrect a tombstone or erase a newer per-field HLC.
- `waves` round-trips through memory and SQLite and survives reopen/migration.
- Graduated/deleted rows cannot re-enter practice through any repository implementation.
- Existing migration, repository, outbox, and field-policy tests remain green.

## Out of scope

The op-sqlite driver, app hydration, server Postgres, sync transport, and any learner-visible
screen.

## What was implemented

1. `SqlPhraseTable.upsert` and `SqlSettingsTable.save` are explicit `ON CONFLICT DO UPDATE` clauses
   over the columns the write owns. `INSERT OR REPLACE` is a delete-then-insert, so it reset
   `field_hlc` to `{}`, `deleted_at` to `NULL`, and — on `settings` — the nine columns the
   repository never writes, including all three privacy consents. `softDelete` is guarded on
   `deleted_at IS NULL`, and the memory table no longer clears its tombstone on upsert.
2. `RefrainDayRow.waves` is read and written by both implementations; the bound `'[]'` literal is
   gone. **No new migration:** v1 already declares `waves TEXT NOT NULL DEFAULT '[]'`, and editing a
   shipped migration is forbidden. `refrain_day.waves` already had its `lww` merge class.
3. `isActive` / `isDue` live in `domain/phrase.ts` and are called by the memory table, the Refrain
   selector, and the store's repository adapter. That adapter's recorded divergence (it omitted
   `graduatedAt === null`) is gone — a behaviour change, so `pnpm test:e2e` was re-run.
4. Adversarial coverage in `apps/mobile/src/data/persistence.test.ts` (49 → 77 tests) for retry,
   nested mutation boundaries, delete-then-re-add, coalescing, and erasure asserted against
   `sqlite_master` rather than the repositories that filter tombstones.
5. [ADR-0003 gains an amendment](../docs/architecture/adr/0003-offline-first-sqlite-sync.md#amendment--2026-07-30--handwritten-sql-on-the-client-no-orm)
   recording the handwritten-SQL client, why, what it costs, and its revisit trigger. ADR-0008's
   "shared Drizzle schema" pro is withdrawn; the server's Drizzle decision is untouched.

## Found while working, deliberately NOT fixed here

- **The outbox could fold an edit backward past a delete.** Both `append` and `compact` ignored a
  `delete` sitting between two upserts, so the later write landed in front of the tombstone and
  `tombstone` beats an edit at any HLC. This one WAS fixed, under work item 4 — it is a coalescing
  defect an adversarial history surfaced, and the plan asked for that history.
- **`refrain_day.substituted` has no declared merge class** in
  `packages/core/src/sync/fieldPolicy.ts`, while `setIds` and `waves` do. `fieldPolicy.test.ts` only
  checks `user_phrase` against `PhraseState`, so nothing fails. Choosing a class is a sync decision
  and [data-model.md](../docs/architecture/data-model.md) already says `refrain_day`'s sync
  representation must be resolved before a client sends it — plan 68's, with plan 66 for policy
  parity.
- **Two row ids for one catalog phrase now raise the unique-index error** instead of silently
  replacing the live row. Loud is better than lossy, but it is not convergence; plans 67–68 own the
  canonical-identity rule.
