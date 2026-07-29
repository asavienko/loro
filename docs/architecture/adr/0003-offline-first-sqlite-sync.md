# 0003 · Offline-first SQLite with per-field delta sync

- **Status:** Accepted
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

**Option D.** SQLite (`op-sqlite` + Drizzle) is the source of truth on the device. Every mutation
writes the row and appends an outbox row in one transaction. A background service drains the outbox
to `POST /sync/push` and applies `POST /sync/pull` through `loro-core::sync::merge_row` — the same
function the server runs.

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
