# Device SQLite as source of truth, with hydration and resume

- **Requirement IDs:** `F-02`, `F-03`, `F-04`, `LB-01`…`LB-10`
- **Milestone:** M1
- **Status:** 🟡 Implemented schema-3 transactions, native driver/bootstrap, hydration and atomic
  progress/checkpoint/review/outbox persistence. Host/SQLite/browser tests and Android one-rep
  force-stop/resume and course switching pass. iOS and the full native upgrade/offline matrix remain
  plan-58 acceptance gates.
- **Depends on:** 54 completed; existing 87 language/course contracts; 58 native driver/bridge; 60
  HLC and scheduler-state slices, not completion of its selection algorithms.
- **Implementation review:** 2026-09-07, based on `3a24e99`; evidence and remaining gates below.

## Outcome and scope

On-device SQLite owns learner data. The app restores the selected course and committed practice
after process death. A successful local action commits its state and required outbox writes together
before the UI reports success; it never waits for a server. Read-only observable snapshots may feed
Zustand, but no independently writable copy of durable state may live there.

This plan delivers persistence for the implemented manual learning loop. It does not wait for audio
or all of plan 64. Plan 64 owns production wave transitions and timing rules; 59 supplies their
checkpoint transaction, and 56/81 own navigation and exit/resume presentation.

## Starting point before this implementation

| Existing seam                                                                                                                                       | Gap this plan must close                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `packages/core/src/persistence/migrations.ts` has schema 2; `apps/mobile/src/data/languages.test.ts` covers legacy upgrades, courses and daily sets | Reuse these migrations; the production app has no SQLite bootstrap                                        |
| `sqlite/course.ts` saves `(user_id, target_locale)` session rows                                                                                    | `INSERT OR REPLACE` deletes/reinserts the row; fix this before native wiring                              |
| `SqlDriver.transaction()` is synchronous; phrase/settings repositories and outbox are independently callable                                        | `Persistence` exposes no transaction coordinator; the app must commit related writes through one boundary |
| `CourseRow.refrainSession` is nullable text; `store/state.ts` contains a richer in-memory resume object                                             | Define and validate a versioned checkpoint, rather than blindly serializing the store                     |
| `store/slices/session.ts` snapshots courses; `slices/practice.ts` sends late deltas to their owning course                                          | Preserve this isolation through asynchronous bootstrap and transactional writes                           |
| Phrase types and SQLite already carry six FSRS fields; `fieldPolicy.ts` groups them as `latest-review`                                              | Consume plan 60's complete scheduler result; do not invent duplicate columns or missing review history    |

Paths beginning `sqlite/` are under `packages/core/src/persistence/`; `store/` paths are under
`apps/mobile/src/`. Repository tests prove SQL behavior, not device durability. Plan 89's account
credentials already have a separate lifecycle; signing in must not re-key or erase local learning
data before plan 67 defines reconciliation.

## Implementation sequence

Each numbered slice is a coherent, independently verifiable change. Keep the plan partial until the
device acceptance criteria pass.

### 1. Safe course saves — ready now

- [x] Replace `SqlCourseTable.save` with `ON CONFLICT(user_id, target_locale) DO UPDATE` over only
      its owned columns. Preserve the row identity and unrelated columns; do not alter schema 2 for
      this fix or touch completed plan-54 phrase/settings behavior.
- [x] Add real-SQLite regression coverage for repeated saves, nullable-field clearing, another
      user/course remaining untouched, and an extra column/related row surviving an update. Extend
      the existing legacy-upgrade test to save and reopen the migrated course without changing
      queued ops.

### 2. Durable contracts and transaction boundary — ready before native integration

- [x] Inventory `AppData`, `CourseState`, `RefrainResume` and settings as global, course-local,
      checkpointed or ephemeral. Include `languageChosen`, per-course onboarding, selected phrase,
      Stream cursor, frozen sets, substitutions, wave completion and global streak days. Define
      legacy defaults explicitly; restore every course without seeding it again.
- [x] Define a versioned checkpoint containing stable session/item/phrase identity, course, day,
      cursor and the data required to resume a committed transition. Define decoding,
      unknown-version, deleted-phrase and changed-catalog recovery. Keep functions, native handles,
      PCM and speculative scores out. Plan 64 supplies future wave-specific transitions rather than
      a second checkpoint store.
- [x] Add an injectable transaction coordinator around the existing repositories. Keep SQL in the
      data layer and never await inside `SqlDriver.transaction`. Compute/await engine results
      outside it, then validate their expected course/session/revision before committing against
      current rows.
- [x] Preserve `engine.record(...) → applyDelta` as the only progress-write path. A committed
      attempt must atomically update its phrase, relevant day/streak state, checkpoint, and syncable
      field writes. Define stable attempt identity/replay handling so retries or process death
      cannot double-count a rep or advance a cursor without its progress. Reuse plan 60's
      review-event contract when FSRS writes are integrated; only add forward migrations for proven
      missing fields/tables.
- [x] Keep course resume local. Queue only entities/fields declared syncable, with their existing
      merge classes; new syncable fields require policy and wire-contract coverage. Native/target
      settings remain one atomic `languagePair`. Use plan 60's canonical HLC port and persist its
      restart state; no timestamp-string stand-in and no dependency on server availability.

### 3. Device driver and bootstrap — requires plan 58's native substrate

- [x] Adapt the selected op-sqlite version to the existing `SqlDriver`: bindings, foreign keys,
      nested transaction semantics, rollback, close/reopen and schema-version checks. Plan 58 owns
      module installation/config plugins; 59 owns database lifecycle and adapter behavior.
- [x] Open and migrate once, restore settings/course state, then permit learner routes and writes.
      Provide explicit initializing, ready and recoverable/fatal failure states using plan 56's
      shell. A failed open/migration must preserve the database and offer retry; never fall back
      silently to a fresh in-memory session. Keep explicit local erasure separate from
      sign-out/account deletion.
- [x] Define the web adapter policy explicitly. The existing memory fallback may remain for web
      development with its reload limitation documented; it is not device durability evidence.
      Browser persistence is a separate decision, not an accidental localStorage implementation.

### 4. Hydration, write-through and resume — integrate by mutation family

- [x] Replace direct durable writes in onboarding, language switching, phrase edits/deletes/undo,
      settings and practice with repository transactions. Publish updated read snapshots after
      commit; on disk-full/transaction failure, retain the prior checkpoint and show a retryable
      failure.
- [x] Scope phrase reads and writes by owner and course; current phrase repositories filter by user,
      not target. Keep late results associated with their originating course, reject stale or
      deleted-session results, and prevent a switch from changing their destination or day stamp.
- [x] Make first-course seeding idempotent and transactional with its onboarding/settings record.
      Preserve phrase IDs, personal meanings and tombstones; catalog activation belongs to plan 61.
      Plan 90's future English default must never replace an existing learner's saved course or
      legacy Spanish identity. Do not reconstruct history lost by earlier in-memory-only sessions.
- [x] Resume the last committed transition without reapplying an attempt. Preserve the frozen set
      and completed reps; derive midnight/day rollover through the existing clock policy.
      Distinguish `localDay()` from the global `streakDay()` grace window. Reset transient
      highlights and native handles. Apply plan-64 abandon/rollover rules and plan-81 exit choices
      through this same boundary.

## Acceptance and verification

- SQLite/memory contract tests and disk-backed close/reopen tests cover the same owned fields.
  Native tests independently prove fresh install, schema-1/2 upgrade, repeated migration,
  force-quit/relaunch, course switching, midnight/timezone change and offline operation.
- Inject failure before/after each part of a practice transaction and at commit: progress, review
  event where applicable, checkpoint and outbox are all present once or all absent. Test replay of
  the same attempt and stale completion after switching course.
- Verify unknown/newer schema, invalid checkpoint, disk-full, duplicate bootstrap, seeding retry,
  local wipe and sign-out preserving learning data. Failures never silently reset learner rows.
- Newly exposed learner states receive E2E manifest rows and browser accessibility/text-scale
  coverage. Run `pnpm check` and `pnpm test:e2e` for integration changes; use plan 58's native
  harness for device claims. Driver/SQL-only slices need focused SQLite proof, not invented UI
  states.
- Record per-slice evidence and remaining gates. Durable FSRS integration requires plan 60's
  canonical result/history contract; this does not block the course-upsert correction or bootstrap.

## Out of scope

Remote sync transport, account reconciliation/export/deletion, scheduling algorithm implementation,
production wave semantics, audio cache/playback, browser durable storage, and unapproved trip
tables.

## Delivered evidence and remaining gates — 2026-09-07

- [Device persistence architecture](../docs/architecture/device-persistence.md) records ownership,
  schema-3 migration, validated checkpoints, hydration, explicit web memory policy and recovery.
- Real SQLite tests cover course upserts, schema-1/2 upgrades, rollback at each practice table and
  COMMIT, reopen/hydration, replay, cross-course completion, stale phrase/session rejection and
  unchanged projections after failure. Outbox tests validate actual queued values against the target
  sync schema, including course-scoped day IDs and full scheduler groups.
- The op-sqlite adapter is tested against real SQLite behind its synchronous transport. Native
  bootstrap has retryable failure and no volatile fallback. Browser states cover startup and save
  failure; form drafts and practice cursors survive failed commits.
- Android fresh install, one-rep force-stop/relaunch and course restart are verified. iOS, native
  database upgrades and the full midnight/timezone/offline matrix still require plan 58. Source
  implementation completion above does not claim those device checks passed. Local tombstone undo is
  implemented; remote restoration and equal-review-time rerating reconciliation remain plan-68
  protocol work.

Android smoke evidence: the same session resumed at cursor 1 after force-stop, with exactly one rep,
one attempt and one review; the outbox stayed at nine operations before and after restart. Switching
to Bulgarian persisted that selection while Spanish retained its rep and cursor. See
[native runtime evidence](../docs/native-core-runtime.md).

Final integration verification: `pnpm check` passed all 23 tasks; all 138 browser E2E tests and four
production-bundle smoke tests passed. Formatting and the iOS JavaScript/Hermes export passed; the
latter is not an iOS native build or device test.
