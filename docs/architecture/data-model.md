# Data model

The data model has two layers today: a tested SQLite persistence library and a larger target model
for the finished product. They are not the same thing yet.

## Implementation status

| Area            | Current state                                                                                                                                                                    |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mobile runtime  | The Zustand app store is in memory and does not open a persistence adapter. Reloading the web target loses learner state.                                                        |
| SQLite library  | Implemented in `packages/core/src/persistence/`; schema v1, migrations, repositories and an outbox are tested against real SQLite through `apps/mobile/src/data/driver.node.ts`. |
| Device SQLite   | Not implemented. There is no `op-sqlite` driver or native composition root yet.                                                                                                  |
| Web persistence | `openMemoryPersistence()` exists, but the live web store does not use it and it deliberately forgets data on reload.                                                             |
| Catalog storage | The app reads `@loro/content`; catalog tables are not materialised into SQLite.                                                                                                  |
| Server database | Not implemented. The sync API injects an in-memory `Map`, not Postgres.                                                                                                          |

This distinction is a release concern: the persistence library proves SQL behaviour, but it does not
make the app offline-durable until the mobile store is hydrated from it and every mutation is
written through it.

## Migrations

### Current SQLite schema (v1)

`packages/core/src/persistence/migrations.ts` is the executable schema. It contains one forward-only
migration and creates:

| Table            | Implemented use                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `user_phrase`    | Full current `PhraseState`, learner ownership, per-field sync metadata and soft deletion.                                      |
| `settings`       | The full planned settings row; the current repository reads/writes only onboarding, goal, level, daily minutes and wave times. |
| `refrain_day`    | Frozen set ids, wave JSON and substitutions; the repository currently exposes set ids and substitutions.                       |
| `streak_day`     | One row per streak-day key, with accumulated minutes.                                                                          |
| `outbox`         | Ordered sync operations with payload, HLC, attempts and last error.                                                            |
| `kv`             | Reserved key/value storage; no repository uses it yet.                                                                         |
| `schema_version` | Applied migration number, name and timestamp.                                                                                  |

The schema also enforces the important current invariants:

- `user_phrase` must reference a catalog phrase or contain learner-authored Spanish.
- A learner may have only one live row for a catalog phrase.
- All phrase reads are learner-scoped and exclude tombstones.
- Active reads exclude learned and graduated phrases; due reads require a real due time.
- A database newer than the binary is refused rather than opened unsafely.
- `wipe()` drops all owned tables and recreates the schema so learner rows are not left in SQLite's
  live tables.

The repositories are synchronous because local reads and writes must not acquire a network-shaped
API. The driver is injected through the narrow `SqlDriver` interface; `node:sqlite` is the tested
implementation and `op-sqlite` remains the intended device implementation.

### What v1 does not create

The following durable product entities are still target design, not current SQLite tables:

- catalog phrases, words, syllables, packs, scenarios and search indexes;
- review, latency, take, session and attempt logs;
- trips, drops and trip membership;
- analytics, audio and AI caches.

Add these with new numbered migrations and repositories when their feature lands. Do not add empty
tables merely to make the schema resemble a future ERD; storage should arrive with a writer, a
reader, migration tests and retention/erasure behaviour.

## Current repositories

`Persistence` exposes `phrases`, `settings`, `refrainDay`, `practiceDays`, `outbox` and `wipe`.
SQLite and in-memory implementations satisfy the same interface and share conformance tests.

There is one intentional but easy-to-miss seam: phrase/settings repository writes do **not** append
an outbox operation automatically. A caller may put a repository mutation and `outbox.append()` in
one driver transaction, and tests prove rollback/commit atomicity, but no live mobile write path
does so yet. Wiring persistence must introduce one mutation boundary that performs both operations;
calling these two APIs independently from screens would create crash windows and lost sync writes.

`refrain_day` and `streak_day` currently have no row HLC. Although their entity names and policies
exist in the sync field policy, they are not yet emitted by a client. Their sync representation must
be resolved before the client begins sending them.

There is also an unresolved identity mismatch at the persistence boundary. SQLite permits one live
row per `(user_id, phrase_id)`, while the current API accepts distinct row ids when two devices add
the same catalog phrase. Pulling both rows into SQLite has no documented lossless reconciliation
rule and can collide with the partial unique index. Plans 67–68 must choose and test a canonical
identity or transactional duplicate-collapse rule before mobile sync is wired; `INSERT OR REPLACE`
is not an acceptable conflict strategy because it can silently discard fields or history.

## Catalog and learner-state boundary

The durable design keeps two domains separate:

- the catalog is immutable, versioned shared content;
- learner state is private and mutable, keyed to a catalog phrase when applicable.

They join by `phrase_id`; catalog delivery never participates in learner-state merge. Today the
catalog remains packaged JSON from `packages/content`, while learner-state SQLite is an unwired
library. Future catalog materialisation must remain replaceable independently of learner rows and
must never cascade-delete a learner's history when content is deprecated.

## Target server model

Postgres remains the intended server store, with authenticated user/device ownership, JSONB,
timestamps, tenant-scoped queries, account erasure and growth-table retention. None of that schema
or repository code exists today. In particular, the current sync repository has no `user_id`, no
device table, no cursor index and no durable rows. See [sync-protocol.md](sync-protocol.md) for the
implemented API limits.

Do not describe the client and server as “one Drizzle schema”: there is no Drizzle schema in this
repository and the current SQLite is authored as reviewed SQL migrations.

## Extension invariants

Every persistence extension must preserve these rules:

1. **Migrate forward.** Append a numbered migration; never edit a migration that may have shipped.
2. **Keep old databases upgradeable.** Test fresh-to-head, previous-to-head, idempotence and refusal
   of a newer schema. Destructive changes require an expand/migrate/contract sequence.
3. **Write state and outbox atomically.** Once sync is wired, a syncable mutation and its operation
   must commit in the same SQLite transaction or both roll back.
4. **Classify sync fields first.** A new syncable field or entity must have an explicit merge class
   in `packages/core/src/sync/fieldPolicy.ts` and tests. Unknown is never treated as LWW.
5. **Keep algorithmic groups coherent.** FSRS fields move as one latest-review group; monotonic
   values never become LWW fields.
6. **Use tombstones for synced deletion.** Hard deletion is reserved for confirmed local/account
   erasure after the server-side lifecycle is defined.
7. **Keep recorded audio out.** No database, outbox or sync payload may contain PCM, recorded files
   or paths that enable upload. A `take` may eventually store derived scores only.
8. **Centralise clocks.** Repositories receive timestamps/HLCs; they do not call `new Date()` or
   invent a second HLC implementation.
9. **Scope every learner query.** Device SQL uses `user_id`; server storage must derive tenant scope
   from authenticated identity, never a client-supplied owner id.
10. **Ship a complete vertical slice.** Schema, repository, live composition, hydration, mutation
    path, erasure, tests and documentation land together for a feature to count as persisted.

### Client rules

The migration, atomic-write, tombstone, clock and vertical-slice invariants above are the client
rules. Backup/restore behaviour, OTA rollback and fixtures from each released schema version still
need implementation before the first device database ships.

### Server rules

Server migrations will use expand/migrate/contract, run separately from application startup and
preserve compatibility with supported clients. Growth-table indexes/backfills must be online and
tenant-scoped. These are target rules: no server schema or migration runner exists yet.

## Data volume

No production data-volume measurements exist because neither device SQLite nor Postgres is wired.
Size budgets for logs and media must be set from native measurements when those writers exist. The
current tests use the documented design ceiling of 2,000 phrases to justify phrase indexes, but do
not establish database, log-retention or cache-size forecasts.

## Current verification

The SQLite tests in `apps/mobile/src/data/persistence.test.ts` exercise migration safety,
constraints, phrase/settings/day repositories, tombstones, outbox ordering and acknowledgement,
failure tracking, class-aware compaction, transaction rollback and wipe against real SQLite. They do
not exercise a device driver, app hydration, a sync client, process restart, Postgres or account
scoping; those require new integration and device tests when their implementations land.
