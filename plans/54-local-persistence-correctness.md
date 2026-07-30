# Local persistence correctness before device wiring

- **Requirement IDs:** `F-03`, `F-04`, `LB-03`
- **Milestone:** M1
- **Status:** Not started
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
