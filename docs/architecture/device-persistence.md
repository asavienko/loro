# Device persistence and committed resume

Plan 59 (`F-02`, `F-03`, `F-04`, `LB-01`–`LB-10`) connects the implemented manual learning loop to
local repositories. Native bootstrap opens `loro.sqlite` through op-sqlite, applies forward
migrations, and hydrates the store before mounting learner routes. The web development target uses
volatile memory: reloading loses its learning data. Memory is never a fallback for a failed native
open or migration.

This describes implemented code and automated SQLite coverage. **Native force-quit/relaunch,
fresh-install/upgrade and airplane-mode acceptance remain unverified on a device.** Audio,
recognition, sync transport and account reconciliation have separate delivery gates.

## Ownership and mutation inventory

| Scope                | Data                                                                                                                       | Storage                                                           |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Global local learner | Native/target language pair, goal, level, daily minutes, wave times                                                        | `settings`; the pair remains one atomic field                     |
| Global local learner | Language selection completed, installation identity, last canonical HLC                                                    | Owner-scoped `local_metadata`                                     |
| Global local learner | Distinct practice days using the streak grace-window key                                                                   | `streak_day`; never a stored streak counter                       |
| Course               | Phrases, personal meanings, progress and complete scheduler state                                                          | `user_phrase`, with legacy null target interpreted as Spanish     |
| Course               | Onboarding, selected phrase, Stream cursor                                                                                 | `course_session`; owned-column upsert preserves unrelated columns |
| Course               | Stable phrase order                                                                                                        | `local_metadata` under `phrase-order:<locale>`                    |
| Course and local day | Frozen Refrain membership, substitutions and completed waves                                                               | `refrain_day`; current manual writes preserve existing waves      |
| Course checkpoint    | Version, local day, revision, Stream cursor and Refrain session/item plan, cursor, measured latency history and done state | Validated `session_checkpoint`                                    |
| Course history       | Committed attempt identity and scalar scheduler review results                                                             | `committed_attempt`, `review_event`                               |
| Sync queue           | Declared syncable field changes and their canonical clocks                                                                 | Owner-scoped `outbox`                                             |
| Ephemeral            | Toast/undo functions, focus, open sheets, animation and native handles                                                     | Process/React state; never checkpointed                           |

The active course fields in `AppData` are an observable projection. The inactive `courses` entries
are projections of the same course rows, not another database. `createRuntimePersistence()` maps
these fields to tables and reconstructs them on load; no serialized whole-store blob is written.
Legacy settings without a language pair default to English UI/Spanish target. Existing course rows
and phrases hydrate without running first-course seeding again. Old unversioned
`course_session.refrain_session` text is retained by migration but is not trusted as a checkpoint.

## The commit boundary

`src/store/store.ts` stages a complete action, including nested slice calls and wrapped undo, before
publishing it. `src/data/runtimePersistence.ts` commits the resulting mutation inside
`Persistence.transaction()`, then returns a fresh repository projection. If storage throws, the
previous visible snapshot remains and the shell reports the write failure. Retrying the learner
action is separate from dismissing that message.

Engine computation finishes outside the transaction. Practice outcomes still enter through
`engine.record(...) → applyDelta`; the context carries the originating course, local day, streak day
and stable attempt identity. Refrain additionally checks the expected session identity/cursor
against its persisted checkpoint. An already committed attempt is a no-op. The attempt marker,
phrase progress, applicable scalar review, day history, checkpoint and required outbox operations
commit together. A failed write or COMMIT restores them together.

Only fields declared by `FIELD_POLICY` enter the sync queue. Scheduler fields in the `latest-review`
group travel together, including algorithm provenance; scalar review history is append-only.
Checkpoint revisions, session plans, phrase order and installation metadata remain local.
Native/target settings stay one `languagePair` value.

The injected canonical Rust HLC callback receives its persisted previous value. Its result is saved
inside the same transaction as the mutation. TypeScript parses/serializes that state but does not
implement clock ordering. Transactions are synchronous and reject Promise results; nested work uses
savepoints. Awaiting HTTP, engines or native work inside this boundary is unsupported.

## Schema and recovery

Migration 3 appends `srs_algorithm` to phrase rows, scopes legacy outbox rows to `local`, and adds
`local_metadata`, `session_checkpoint`, `committed_attempt` and `review_event`. Existing schema-1/2
rows, scheduler fields, queued payloads, retry counts and course identities remain intact. Every
migration has its own transaction. A newer database schema is refused; bootstrap preserves the file
and exposes retry rather than clearing it.

Checkpoint version 1 is decoded with bounded text, items and history plus validation of nested
session fields. Unknown versions, malformed data and disallowed payload fields are treated as an
unavailable checkpoint, without erasing phrase progress. Hydration resumes a Refrain checkpoint only
on its matching local day and when its item phrases still exist in the course/catalog. Missing
selections and deleted set members are filtered. A non-resumable checkpoint restores an empty
transient Refrain resume; committed phrase progress and global streak history remain. The existing
clock/day-rollover policy handles the next day's set. Full production wave/abandon semantics remain
plan 64 work.

Ordinary phrase upserts preserve tombstones and merge clocks. Explicit local undo uses
`PhraseTable.restore()`; that is not a claim that a remote tombstone can be reversed. Plans 67/68
must resolve remote deletion/reconciliation before enabling transport. Learning rows continue to
belong to the local owner after optional account sign-in; credentials have their separate lifecycle.

Explicit local reset erases that owner's rows and queued operations transactionally. It preserves
other owners and does not reuse outbox sequence numbers, so stale acknowledgements cannot delete new
writes. Legacy unscoped `kv` belongs to the local owner. Sign-out does not invoke this reset.

## Verification and source map

Real Node SQLite tests cover schema-1/2 upgrades, file close/reopen, row identity preservation,
owner/course isolation, duplicate attempts, nested rollback, per-table injected write failures and a
deferred-constraint COMMIT failure. These verify database behavior, not native device durability.
The op-sqlite adapter also has contract tests; browser startup/error states have separate UI
coverage.

- `packages/core/src/persistence/`: schema, repositories, checkpoint validator and transaction API.
- `apps/mobile/src/data/driver.opsqlite.native.ts`: native driver.
- `apps/mobile/src/data/openRuntimePersistence.native.ts`: native open/migration and clock identity.
- `apps/mobile/src/data/runtimePersistence.ts`: table projection and atomic mutation adapter.
- `apps/mobile/src/store/bootstrap.ts`: core/storage loading, retry and route gating.
- `apps/mobile/src/data/commit.test.ts`: fault boundaries, upgrades, replay and reopen evidence.

The remaining device gate is fresh install, schema upgrade, force-quit during practice, course
switching, day/timezone change and offline relaunch on an actual native build. No browser test or
mocked native module substitutes for it.
