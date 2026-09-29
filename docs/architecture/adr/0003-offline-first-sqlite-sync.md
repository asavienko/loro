# 0003 · Offline-first SQLite with per-field delta sync

- **Status:** Accepted; implementation removed (2026-09-30) — the client SQLite persistence and
  outbox left with the first app (Git history at `52a0e3b`). The current app keeps a local learner
  log and does not sync; the server side of this decision stands.
- **Date:** 2026-07-28
- **Deciders:** Tech lead, mobile lead, backend lead

## Context

The product's most important moment is a learner standing in a taxi rank in Madrid with no data
plan, opening the survival deck
([`product/trip-arc.md`](../../product/trip-arc.md#regime-2--survival-mode)). The blueprint puts
`✈ OFFLINE` in the status bar of that screen and states _"works offline"_ in the banner
(`Loro.dc.html:2017`, `2019`).

Beyond the trip: practice happens on commutes, in tunnels, on planes. Every practice surface must
work with no network ([overview.md](../overview.md#the-ten-rules), rule 2).

We also want cross-device sync, because a learner with a phone and a tablet expects their library on
both.

The conflict domain is narrow and worth stating precisely:

- **One writer per row in practice.** One learner, usually one device at a time.
- **Scalar fields.** `difficulty`, `loved`, `reps`, `srs_due`. No collaborative text, no ordered
  lists requiring intent preservation, no simultaneous multi-user editing.
- **Monotonic counters** (`reps`, `plays`, `rung`) that are also reconstructable from append-only
  logs.

## Options considered

### A · Server-authoritative with an offline cache

**Pros** Simple mental model; the server can enforce invariants. **Cons** Writes must either block
on the network or be reconciled anyway, which reintroduces the whole problem. A learner offline for
a week would accumulate a divergent cache with no defined semantics. **Rejected on force #1** — this
is the option that fails in the taxi rank.

### B · A managed sync platform (PowerSync, ElectricSQL, WatermelonDB sync, Supabase Realtime)

**Pros** Someone else's problem; less code to own. **Cons**

- Sync semantics are fixed by the vendor, and ours are unusual: per-field LWW with **different merge
  classes per field** (LWW, max, grouped, append-only, tombstone-wins). Grouped FSRS-field merging
  in particular is not a primitive any of these offer.
- Another runtime dependency in the most critical path in the app.
- The migration cost if the vendor's model stops fitting is total.

### C · CRDTs (Automerge, Yjs, or hand-rolled)

**Pros** Correct by construction; no lost updates; well-understood theory. **Cons**

- Substantial machinery — a CRDT library in `loro-core`, per-row metadata growth, and an operation
  log that only grows.
- **Solves a problem we don't have.** CRDTs earn their complexity with concurrent multi-writer
  editing of structured documents. Our conflicts are one learner's two devices touching a scalar
  field.
- The counter case is already solved better: `reps` is derivable from `review_log`, which is
  append-only and therefore conflict-free without any CRDT.

### D · SQLite as the source of truth, outbox, per-field LWW over HLC

**Pros**

- Every write succeeds locally and immediately; nothing waits on a network.
- Per-field granularity means two devices editing _different_ fields of the same phrase both win,
  which covers the realistic concurrency case.
- Merge classes per field handle the cases LWW gets wrong: `max` for monotonic counters, grouped for
  FSRS state, tombstone-wins for deletes.
- The same merge function runs on both sides ([ADR-0002](0002-shared-rust-core.md)), so they cannot
  disagree.
- Small: HLC arithmetic plus a merge function plus an outbox table.

**Cons**

- Concurrent writes to the _same_ field lose one value.
- The server cannot enforce cross-row invariants at write time.

## Decision

**Option D.** SQLite is the source of truth on the device. Every mutation writes the row and appends
an outbox row in one transaction. A background service drains the outbox to `POST /sync/push` and
applies `POST /sync/pull` through `loro-core::sync::merge_row` — the same function the server runs.

The device access layer was originally written here as "`op-sqlite` + Drizzle". It is handwritten
SQL over a narrow driver interface; `op-sqlite` is still the intended device driver. See the
amendment below.

Per-field merge classes are declared in one place (`packages/core/src/sync/fieldPolicy.ts`) and a CI
test fails if any syncable field lacks a declared class
([sync-protocol.md](../sync-protocol.md#testing)).

## Consequences

### Good

- The taxi-rank case works, and so does every commute, tunnel, and flight.
- No offline UI at all: no banners on practice screens, no queue screen, no retry prompts, no
  "syncing…" state. The app behaves identically online and offline
  ([offline.md](../offline.md#2--there-is-no-offline-mode)).
- The server's availability target can be a modest 99.9%, because an outage delays sync rather than
  blocking learning ([backend.md](../backend.md#slos)). That's a real operational dividend.
- Local reads are synchronous over JSI, so the hot path (reading phrase state mid-rep) has no bridge
  hop ([performance.md](../performance.md#data-layer)).
- Merge classes make the failure modes explicit and testable rather than emergent.

### Bad — accepted deliberately

- **A concurrent same-field write loses one value.** Accepted: it requires one learner editing the
  same field on two devices within a sync window. The `max` class protects the cases where loss
  would be visible (counters), and the append-only logs are the ultimate truth for anything derived.
- No server-side invariant enforcement. Mitigated by validating ops on push, and by a nightly
  reconciliation job that rebuilds derived counters from the logs
  ([backend.md](../backend.md#sync)).
- **We own the protocol.** That is the real cost of this decision: HLC arithmetic, merge classes,
  outbox compaction, the sign-in merge, and the observability to know it's working. Mitigated by
  keeping it small, putting the logic in one tested function, and instrumenting the conflict rate as
  a first-class metric
  ([observability.md](../observability.md#sync-observability--the-highest-consequence-signal)).
- The sign-in merge is genuinely delicate and gets its own e2e test suite, because losing a
  learner's library on sign-in is unforgivable
  ([sync-protocol.md](../sync-protocol.md#first-sign-in-on-a-device-with-local-data)).

### Revisit if…

- **We add shared phrasebooks** (couples or families learning together). That makes it genuinely
  multi-writer, and CRDTs become the right answer for the shared subset. This is the most likely
  trigger.
- The conflict rate in production exceeds 0.5% sustained, meaning real concurrency is higher than
  modelled.
- Outbox compaction proves insufficient for learners who are offline for months.

---

## Amendment — 2026-07-30 · handwritten SQL on the client, no ORM

**What changed.** The Decision above named the device access layer "`op-sqlite` + Drizzle". There is
no Drizzle on the client and there never was one. `packages/core/src/persistence/` is handwritten
SQL over a narrow injected driver:

| Piece           | What it is                                                                                |
| --------------- | ----------------------------------------------------------------------------------------- |
| `driver.ts`     | Six synchronous methods — `exec`, `run`, `all`, `transaction`, `close` — plus row readers |
| `migrations.ts` | The DDL as SQL text, forward-only and numbered; refuses a database newer than the build   |
| `sqlite/*.ts`   | One module per table, authored statements, explicit column↔parameter tuples               |
| `memory.ts`     | The same interfaces over `Map`s, for the web target                                       |

The narrow driver is what the decision actually needed and Drizzle would not have given: the same
statements run under `node:sqlite` in CI today and under `op-sqlite` on device when the dev client
lands (plan 58). `op-sqlite` is unchanged as the intended device driver.

**Why handwritten.** Not preference — three properties this decision depends on.

1. **The schema is authored prose, and must be readable against it.**
   [`data-model.md`](../data-model.md) is the spec; `migrations.ts` keeps its column order, grouping
   and line breaks so the two can be read side by side. A generated schema inverts that: the
   document becomes a description of code, and a divergence stops being a bug in one file.
2. **The conflict clauses are the decision.** Preserving `field_hlc` and `deleted_at` on upsert, the
   partial unique index scoped to `deleted_at IS NULL`, folding `max` fields by their maximum —
   these are per-field-merge semantics expressed in SQL. They are not what a query builder's
   `onConflict` helper is for, and the bug this plan fixed (`INSERT OR REPLACE` resurrecting
   tombstones) is one an ORM's ergonomic upsert would have written for us.
3. **No second dependency in the most critical path.** The same reason option B was rejected. A
   driver interface with six methods can be reimplemented for a new SQLite binding in an afternoon.

**What it costs.** Real, and accepted:

- No compile-time link between a column and the code reading it. Mitigated by making the column list
  a `const` tuple whose length types the parameter array, so a column added without its parameter is
  a compile error rather than a row whose every later value holds its neighbour's — and by
  `sqlite/phrase.test.ts`, which round-trips the mapping with no database present.
- Migrations are hand-authored. That is deliberate given rule 1, and the migration tests cover
  fresh-to-head, idempotence, and refusal of a newer schema.
- No query-level type inference. Row readers (`readInt`, `readTextOrNull`, `readJson`) throw on a
  wrong type rather than casting, so the failure is at the boundary rather than a `NaN` on a
  progress screen.

**This says nothing about requiring the same access layer on the server.**
[ADR-0008](0008-backend-nestjs-postgres.md) chooses NestJS + Postgres + `pg` + handwritten SQL for
`apps/api` — a different runtime with a different constraint set (no driver portability requirement,
no bundle size, migrations run by operators). What remains retracted is the withdrawn consequence
that "Drizzle schemas are shared with the client": neither side uses Drizzle, the two DDL texts are
separate, and the sync contract — not a shared schema — is what keeps them honest. That contract is
[`fieldPolicy.ts`](../sync-protocol.md#per-field-lww), and it is CI-enforced.

**Revisit if…** the client schema grows past roughly a dozen tables and the hand-authored statements
start repeating a grammar rather than fifteen one-off queries; or a second client (a web app with
real persistence) needs the same schema, at which point generating both from one definition earns
its keep. Adding an ORM to the client before either is true would be adding a dependency to the
taxi-rank path for tidiness.
