# Sync protocol

Sync has implemented primitives and an implemented development API, but no end-to-end device sync
path. Rationale: [ADR-0003](adr/0003-offline-first-sqlite-sync.md).

## Implementation status

| Layer                       | Current state                                                                                                                 |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| HLC and row merge           | Implemented and tested in `packages/core-rs/src/sync/`.                                                                       |
| Field policy                | Implemented in `packages/core/src/sync/fieldPolicy.ts`; unknown fields are rejected by the API.                               |
| Local outbox                | Implemented for SQLite and memory persistence; SQLite supports ack, failure counts and merge-class-aware compaction.          |
| API push/pull               | Implemented at `POST /v1/sync/push` and `POST /v1/sync/pull`; a status diagnostic exists at `POST /v1/sync/status`.           |
| API merge runtime           | Uses the Rust merge compiled to WASM. Production refuses to start without it; development sync calls fail if it is absent.    |
| Server storage              | An unscoped in-memory `Map`; rows disappear on restart. No auth or Postgres.                                                  |
| Pull cursor                 | Not implemented. `since` and `limit` are accepted but ignored; pull returns every stored row and `has_more: false`.           |
| Mobile client               | Not implemented. Nothing drains the outbox, calls the endpoints, advances a device HLC from responses or applies pulled rows. |
| Store/outbox write coupling | Implemented by the mobile transaction adapter; read snapshots publish after local commit.                                     |

These endpoints are useful for exercising arbitration, not safe multi-user sync. Do not deploy them
as a learner-data service until authentication, tenant scoping, durable storage and real cursors
land.

## Position

The intended system treats the device's durable SQLite as the learner-facing source of truth. The
server is a convergence peer. A write completes locally and queues an operation; background sync
pushes and pulls later. The current app has not yet reached this position because its live store is
not persistent and it has no sync client.

## Time

Hybrid logical clocks order sync; local/streak day keys drive learner-facing calendar behaviour.
They are independent.

The Rust core implements HLC parsing/encoding, `tick`, `receive`, total ordering by physical time,
logical counter and node id, plus detection of a client more than 24 hours ahead of server time. No
mobile bridge currently supplies a stable installation node id or persists the last HLC. The SQLite
factory accepts an HLC callback, and its tests use a deterministic stand-in.

The wire encoding is:

```text
<physical_ms>:<zero-padded logical counter>:<node_id>
1721558400123:0007:d3f9a1
```

The API currently returns `${serverTime}:0000:srv`; it does not maintain a logical server clock.
That placeholder is adequate for development responses, not the final cursor/order source.

## Per-field LWW

Every syncable field is classified in `FIELD_POLICY`. Current classes are:

| Class           | Rule                                                            |
| --------------- | --------------------------------------------------------------- |
| `lww`           | Higher HLC wins for learner-set scalar state.                   |
| `max`           | Numerically greater value wins for monotonic values.            |
| `latest-review` | The FSRS group follows the side with the later `srsLastReview`. |
| `append-only`   | Rows union by primary key; an existing row is not field-merged. |
| `tombstone`     | Deletion prevents resurrection by a concurrent edit.            |

The policy currently declares `user_phrase`, trip entities, settings, Refrain/streak days and the
planned append-only log entities. Some declared entities have no SQLite table or client writer yet;
policy declaration is preparation, not evidence that they sync.

Two implementation details matter when extending this code:

- The API resolves every incoming field through the TypeScript policy and passes the resulting
  classes to Rust. It rejects an unknown entity as `schema_unknown` and an undeclared field as
  `VALIDATION_FAILED`; it does not guess LWW.
- The Rust merge function has an internal LWW fallback if a class is absent. Callers must therefore
  preserve the policy-validation boundary; invoking it directly with incomplete classes is unsafe.

For `max`, equal numeric values do not replace the existing value. For latest-review, an incoming
group without a later `srsLastReview` does not win. Keep an FSRS update complete as a group.

## Current wire contract

The service still uses local types in `apps/api/src/sync/sync.service.ts`. Shared current/target Zod
schemas now exist in `@loro/core/api/*`, with HTTP conformance tests and an explicit
[migration map](api-contracts.md#migration-map); they are not installed as middleware. Field HLCs on
the actual API wire are structured objects, not the encoded strings used by the local outbox
interface:

```jsonc
POST /v1/sync/push
{
  "client_hlc": "1721559000000:0003:d3f9a1",
  "ops": [{
    "seq": 1042,
    "entity": "user_phrase",
    "entity_id": "up_8f2c",
    "op": "upsert",
    "fields": {
      "difficulty": {
        "v": "hard",
        "hlc": { "physical": 1721558400123, "logical": 7, "node_id": "d3f9a1" }
      }
    }
  }]
}
```

Push accepts at most 500 operations. Each operation is processed independently; accepted sequence
numbers, rejected operations, conflict field names, `server_hlc` and `server_time` are returned. A
delete may omit fields and gets `deleted_at` from the request or current server time.

Current gaps in input enforcement are deliberate facts to fix, not protocol promises: there is no
shared Zod validation at the transport boundary, no byte-size cap, no authenticated device id,
limited primitive validation and no durable idempotency record beyond re-merging the current
in-memory row.

```jsonc
POST /v1/sync/pull
{ "since": "1721550000000:0000:srv", "limit": 500 }
```

The current implementation ignores both fields and returns all rows from the global repository:

```jsonc
{
  "changes": [],
  "next": "<placeholder server HLC>",
  "has_more": false,
  "server_hlc": "<another placeholder server HLC>",
}
```

There is no `device_id` in the implemented request types. Add it only as part of authenticated
device registration and a shared versioned wire schema.

## Local outbox reality

The SQLite outbox is ordered by autoincrement `seq`. It can return a bounded pending prefix,
acknowledge accepted sequences, increment attempts/store the last error and compact queued upserts.

Compaction is policy-aware:

- LWW fields may replace an earlier queued value for the same row.
- Max fields may fold by preserving the numeric maximum.
- append-only, latest-review, tombstone, delete and unknown-policy operations are not lossily
  folded.
- compaction stops at the first unmergeable operation for a row so sequence semantics remain
  understandable.

The memory outbox does not compact and no current client flushes either implementation. Rejections
are not moved to a dead-letter table because no such table or sync client exists.

Repository writes do not append automatically. The mobile runtime adapter wraps row mutations,
review events, checkpoints and required outbox fields in one transaction before publishing the read
projection. SQLite tests exercise rollback, replay and the queued target-schema payloads; native
force-quit evidence remains separate.

Outbox field values retain JSON arrays and objects: `tags`, `languagePair`, `setIds` and `waves` are
not double-encoded strings. Only the enclosing SQLite payload is serialized. Unscheduled phrases
omit the entire FSRS group; scheduled writes carry every group field together. Review operations use
a UUID persisted in the same transaction as the originating attempt. These payloads conform to the
shared target contract; the transport conversion to the legacy API HLC representation and remote
synchronization remain plan 68 work.

## Required end-to-end flow

When the missing client/server persistence work lands, the flow is:

1. A single mobile mutation service ticks the persisted HLC and commits row fields plus outbox op in
   one SQLite transaction.
2. A background client reads the oldest bounded batch and pushes it with authenticated installation
   identity.
3. Only accepted sequences are acknowledged. Retryable failures remain queued; permanent schema
   failures are quarantined without discarding unrelated operations.
4. The client pulls a tenant-scoped durable cursor, applies every page through the same Rust merge,
   persists the new cursor/HLC transactionally, and repeats while `has_more`.
5. UI state is refreshed from local persistence. No screen waits for this cycle.

Before step 4 can ship, catalog-phrase identity must be reconciled across devices. The API currently
allows two row ids for the same learner/catalog phrase, while SQLite permits one live row for that
pair. The shared contract must define a deterministic canonical id or a transactional merge of
duplicate rows before insertion, and prove that independent fields, tombstones, and history survive.

Foreground, connectivity regain and session end are sensible triggers; cadence/backoff values must
be owned by the eventual background scheduler and tested against native OS limits rather than
claimed here before implementation.

## First sign-in on a device with local data

Anonymous-to-account claim/merge is not implemented. The present repository has no user scope, so it
cannot safely distinguish two learners or perform the documented “keep all local data” promise.

The eventual flow must authenticate every request, derive `user_id` server-side, register a stable
device id, merge existing anonymous local rows without replacing them wholesale, and keep sign-out
distinct from confirmed erase. Until then, do not expose current sync routes to untrusted clients.

## What must never sync

- recorded PCM, recorded files or uploadable recording paths;
- local outbox bookkeeping;
- reproducible audio/AI caches;
- transient UI/session navigation state;
- catalog delivery rows, which use the content-version mechanism.

Derived pronunciation/prosody numbers may sync only after their schema and privacy/retention rules
exist. Merely listing an append-only entity in `FIELD_POLICY` does not authorise collection.

## Extension invariants

1. **One merge implementation.** Client and server call the Rust core; no TypeScript conflict-rule
   fork.
2. **Reject unknown policy.** Every field is classified before enqueue/accept; never default an
   unknown field to LWW.
3. **Preserve atomicity.** Local row, field HLC and outbox op commit together. Pulled rows,
   receive-HLC and cursor also commit together.
4. **Scope before persistence.** Server keys and queries include authenticated learner ownership;
   never add Postgres behind today's global `(entity,id)` interface and call it complete.
5. **Cursor from durable order.** A pull cursor must be stable, tenant-scoped and page without skips
   or duplicates under concurrent pushes. Wall-clock strings alone are not sufficient evidence.
6. **Keep retry lossless.** Ack only explicit accepts. Queue compaction follows merge classes; size
   pressure never truncates learner writes. Compaction also preserves ORDER across a tombstone: an
   edit must never be folded in front of a delete for the same row, because `tombstone` beats an
   edit at any HLC and the folded write would be applied and then discarded.
7. **Version one shared wire schema.** Client and API import the same validation/serialization
   contract, including HLC representation and rejection codes.
8. **Tombstones have lifecycle.** Define retention and device acknowledgement before garbage
   collection; otherwise stale devices resurrect deletes.
9. **Append-only means immutable identity.** Use collision-resistant client ids and union rows; do
   not compact separate events.
10. **Observe without private payloads.** Record counts, duration, age and conflicts, not learner
    text or audio.
11. **Reconcile duplicate phrase identities explicitly.** Two devices adding the same catalog phrase
    must converge to the one-row SQLite invariant without `INSERT OR REPLACE`, lost fields,
    resurrected tombstones, or duplicated history. The client repository no longer has an
    `INSERT OR REPLACE` to reach for: `SqlPhraseTable.upsert` conflicts on `id` alone, so a second
    row id for a live catalog phrase raises the unique-index error instead of silently replacing the
    row. Choosing the canonical identity is still plans 67–68's; until then the failure is loud.

<a id="testing"></a>

## Current verification and missing tests

Implemented tests cover HLC ordering/skew, Rust merge behaviour, field-policy coverage, API
push/rejection/conflict behaviour and SQLite outbox semantics — including, on the client side, that
a local upsert preserves `field_hlc` and `deleted_at`, that retry accumulates attempts without
reordering or dropping ops, and that neither `append` nor `compact` folds an edit across a delete
for the same row. The API E2E suite runs against the in-memory repository.

Plan 85 adds shared wire-schema compatibility tests, field-policy coverage and per-item validation
tests. Still required are a mobile sync-client suite, installed transport validation, tenant
isolation, durable cursor pagination under concurrency, server restart/idempotency, anonymous claim,
multi-device partition/reconvergence, tombstone collection and 30-day offline replay. Paths such as
`core-rs/tests/merge.rs`, `api/test/claim-merge.e2e.ts` and `mobile/src/data/sync/compact.test.ts`
do not exist and must not be cited as current coverage.
