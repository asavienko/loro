# SQLite persistence and the sync outbox

- **Requirement IDs:** `F-03`, `F-04`
- **Milestone:** M1 (declared M1 scope in `docs/product/roadmap.md`, partly built)
- **Size:** L
- **Depends on:** [fix-user-phrase-identity.md](04-fix-user-phrase-identity.md),
  [fix-local-day-boundary.md](01-fix-local-day-boundary.md); the remaining native driver and HLC
  bridge depend on [native-toolchain-and-dev-client.md](09-native-toolchain-and-dev-client.md)
- **ADRs:** 0003 (offline-first SQLite sync), 0012 (state management)
- **Status:** 🟡 Partly implemented 2026-07-29.

  **Done, in `packages/core/src/persistence/`, tested against real SQLite** (44 tests via Node 22's
  `node:sqlite` — see `apps/mobile/src/data/`): §1 schema v1 matching `data-model.md` column for
  column, with a forward-only runner that refuses a newer database; §2 the phrase, settings,
  refrain-day and practice-day repositories behind interfaces, with the day-one indexes; §4 the
  outbox — append inside the caller's transaction, `lww` coalescing that correctly refuses to fold
  `max` fields, compaction that merges without ever dropping a write; §5 the no-encryption posture
  noted in the DDL; §6 a `wipe()` that drops rather than deletes. Plus the in-memory set the Risks
  section below asks for, so `expo start --web` keeps working. **Raw SQL, not Drizzle** — Drizzle
  has no `node:sqlite` driver, so choosing it would have meant shipping this untested until plan 09.

  **Left, and what blocks it:**

  1. The `op-sqlite` driver — a custom native module. No `ios/`/`android/` and no Xcode in this
     checkout, so it needs
     [09-native-toolchain-and-dev-client](09-native-toolchain-and-dev-client.md), exactly as the
     Risks section predicts. Everything above is written against `SqlDriver` so this is the only
     missing piece of storage itself.
  2. §3 (zustand as a cache: hydration, the `hydrated` flag, write-through) — blocked on (1) **and**
     on something this plan did not anticipate: every outbox op needs an HLC, and `core-rs`'s HLC
     (`src/sync/hlc.rs`) has no JS bridge. `OutboxAppend.hlc` is therefore a required input and is
     never generated locally — inventing one is the second implementation ADR-0002 exists to
     prevent.

  Both are additions behind `SqlDriver` and `OutboxAppend.hlc`, not rework.

## Why this is the highest-leverage missing piece

`apps/mobile/src/store/index.ts:8` states it plainly: "v1 keeps this in memory." So the app forgets
everything on restart. That makes it impossible to test the things v1 is judged on — the streak, the
four-day lock-in that graduates a phrase (`LOCK_IN_DAYS_TO_GRADUATE = 4`), FSRS intervals measured
in days, the trip countdown, or the airplane-mode test in the M2 exit criteria. Every one of those
mechanics only exists across sessions.

It is also the seam that makes several other plans possible: sync has nothing to push without an
outbox, and widgets have nothing to read without a durable store.

## The design already decided

`docs/architecture/data-model.md` has the SQLite DDL; `docs/architecture/offline.md` has the rule
that matters most:

> The device is the source of truth; every write succeeds locally and appends to an outbox. **No
> code path awaits the network.**

The store's comment names the intended seam: "the repository shape below is the seam they slot into"
(`store/index.ts:9`) — `PhraseRepository` at `packages/core/src/engines/types.ts:154`.

## The work

### 1. Database and migrations

- `op-sqlite` (already anticipated in `apps/mobile/package.json`'s `$comment`) with Drizzle for the
  schema and the migration runner. `expo install` it rather than hand-pinning.
- Migrations as numbered SQL files with a `schema_version` table; the runner applies forward-only
  and refuses to run against a newer schema than it knows (a downgraded app must not silently drop
  columns).
- The M0 deliverable in the roadmap — "Schema v1 applies on a fresh install" — is the acceptance
  bar.

### 2. Repositories, not a global store

Implement `PhraseRepository` against SQLite, plus `SettingsRepository`, `SessionRepository`,
`PracticeDayRepository`, and `OutboxRepository`. Keep them behind the existing interfaces so
`engineContext()` (`store/index.ts:342`) changes shape but not contract, and the engines' tests keep
running with the in-memory fake.

**Indexes from day one**, because M4 tests at 2 000 phrases: `(learned, srs_due)`,
`(reps_today_day)`, `(phrase_id)`, and whatever the rank query needs.

### 3. Zustand becomes a cache, not the truth

ADR-0012 already picks the pattern. Concretely:

- Writes go to SQLite first, then update the store from the row that was written (not from the
  optimistic value) so the two cannot drift.
- Reads hydrate on launch. Hydration must be **fast** — the airplane-mode test is "fresh launch,
  survival mode fully usable in <2 s" — so load the working set (active phrases, today's set,
  settings) synchronously-ish and defer the long tail.
- One `hydrated` flag gates the first render; no screen reads an empty store and renders an empty
  state that then flickers into content.

### 4. The outbox

Every mutation appends `{ seq, entity, entity_id, op, fields, hlc, attempts }` in the **same
transaction** as the row write. Not after — a crash between the two is a lost sync op.

- `seq` is a local monotonic counter, matching the push wire format (`PushOp.seq`,
  `apps/api/src/sync/sync.controller.ts:20`).
- HLC comes from `core-rs` (`packages/core-rs/src/sync/hlc.rs`).
- Coalesce: a second `lww` write to the same `(entity, id, field)` before flush replaces the first
  rather than queuing two ops. `max` and `append-only` classes must **not** coalesce — check each
  against `packages/core/src/sync/fieldPolicy.ts`.
- Bounded growth: if the outbox exceeds N ops (offline for weeks), compact by entity rather than
  dropping. Never drop a learner's write.

### 5. Learner data is sensitive

`.gitignore` already refuses `*.sqlite` and `**/recordings/*.wav` — respect the same posture at
runtime: no learner rows in logs, no database path in crash reports. SQLCipher is deliberately
deferred (Q-09); note in the DDL comment that the file relies on OS full-disk encryption so the
decision stays visible.

### 6. Reset and account deletion

`reset()` must drop and recreate the database, not just clear the store — GDPR erasure
(`docs/architecture/security-privacy.md`) is a real duty and a half-cleared local database is the
usual way it gets missed.

## Acceptance criteria

- Kill and relaunch the app: phrases, ratings, tags, notes, reps, today's set, settings, and
  practice days all survive.
- Fresh install applies schema v1 and lands on onboarding with an empty, working store.
- Cold launch to interactive under 2 s on the device floor in `docs/process/qa-device-matrix.md`.
- Every mutation appends exactly one outbox op, in the same transaction.
- Airplane mode: 50 mutations, no network calls attempted, all 50 in the outbox in order.
- `reset()` leaves no learner rows on disk.
- 2 000-phrase fixture: stream query and Progress rollup both under budget
  (`docs/architecture/performance.md`).

## Tests

- Migration tests: fresh install, v1→v2 upgrade, refusal to downgrade.
- Repository tests against a real in-memory SQLite.
- Outbox: transactional atomicity (simulate a failure between row and op), coalescing per merge
  class, ordering under concurrent writes.
- A hydration test asserting the working set loads without the long tail.
- Perf test at 2 000 rows.

## Risks

- **`op-sqlite` needs a custom native build** — so this depends on
  [native-toolchain-and-dev-client.md](09-native-toolchain-and-dev-client.md), and Expo Go stops
  being a usable target the moment it lands. Sequence accordingly.
- **Web target** (`npx expo start --web`, currently the fastest way to see the screens) has no
  op-sqlite. Keep an in-memory repository implementation as the web fallback so the screens stay
  developable.

## Out of scope

The sync client loop itself (flush, retry, backoff) — that is the sync plan. This plan produces the
outbox it drains.
