# Sync protocol

How a learner's data gets between devices without ever blocking a practice session.

Rationale: [ADR-0003](adr/0003-offline-first-sqlite-sync.md)

---

## Position

**The device is the source of truth. The server is a sync peer and an arbiter, not an owner.**

Every write succeeds locally, immediately, in a transaction, and appends an outbox row. Sync drains
the outbox opportunistically. There is no write path that waits on the network, and no screen shows
a spinner because of sync.

Consequences we accept deliberately:

- Two devices editing the same field concurrently will resolve to one value, and the other is lost.
- The server cannot enforce cross-row invariants at write time.

Consequences we get:

- The app works identically on a plane, in a taxi rank in Madrid, and on wifi.
- No offline queue UI, no "syncing…" state, no conflict prompts.

---

## Why not CRDTs

Considered and rejected. Our conflict domain is:

- **Single-writer-per-row in practice.** One learner, usually one device at a time.
- **Scalar fields.** `difficulty`, `loved`, `reps`, `srs_due`. There is no collaborative text, no
  ordered list requiring intent preservation, no simultaneous multi-user editing.
- **Counters that are derivable.** `reps` and `plays` are reconstructable from `review_log` and
  `attempt`, which are append-only and therefore conflict-free by construction.

Per-field last-write-wins over a hybrid logical clock gives the same practical outcome as a CRDT for
this shape of data, with an order of magnitude less machinery and no library dependency in
`loro-core`. If we later add shared phrasebooks (multi-writer), that's the moment to revisit — and
it would be a new ADR.

---

## Time

Two independent clocks, and conflating them is a bug class.

| Clock                                        | Used for                                                | Never used for              |
| -------------------------------------------- | ------------------------------------------------------- | --------------------------- |
| **HLC** — hybrid logical clock               | Ordering sync operations, per-field conflict resolution | Anything shown to a learner |
| **`local_day`** — device local calendar date | Day boundaries, streaks, trip transitions, `reps_today` | Sync ordering               |

### HLC

```
hlc = "<physical_ms>:<logical_counter>:<node_id>"
      1721558400123:0007:d3f9a1
```

```ts
function tick(last: Hlc, wallMs: number, nodeId: string): Hlc {
  const physical = Math.max(last.physical, wallMs)
  const logical = physical === last.physical ? last.logical + 1 : 0
  return { physical, logical, nodeId }
}

function receive(last: Hlc, remote: Hlc, wallMs: number, nodeId: string): Hlc {
  const physical = Math.max(last.physical, remote.physical, wallMs)
  let logical = 0
  if (physical === last.physical && physical === remote.physical) {
    logical = Math.max(last.logical, remote.logical) + 1
  } else if (physical === last.physical) {
    logical = last.logical + 1
  } else if (physical === remote.physical) {
    logical = remote.logical + 1
  }
  return { physical, logical, nodeId }
}
```

**Properties**

- Monotonic per device, even if the wall clock jumps backwards (NTP correction, manual change,
  timezone travel).
- Totally ordered across devices — `node_id` breaks ties deterministically, so both peers reach the
  same answer without coordination.
- Roughly tracks real time, which makes debugging tractable.

**Clock skew.** A device whose clock is wildly wrong will produce HLCs far in the future and win
every conflict. Mitigation: on each sync response the server returns its own time; if the client's
physical component exceeds it by more than 24 hours, the client clamps future ticks toward server
time and logs it. We never _reject_ a client's writes for skew — that would lose real learner data.

### `local_day`

```
local_day = format(deviceLocalDate, 'YYYY-MM-DD')
```

Used because every day-boundary decision must work offline
([scheduling.md](scheduling.md#day-boundaries)). Two devices in different timezones may briefly
disagree about `reps_today`; that resolves on the next sync and is invisible to the learner because
automaticity is recomputed from `lock_in_days` and today's counter, not from a synced total.

---

## Per-field LWW

Each syncable row carries a `field_hlc` map:

```jsonc
// user_phrase.field_hlc
{
  "difficulty": "1721558400123:0007:d3f9a1",
  "tags": "1721558100000:0002:d3f9a1",
  "loved": "1721559000000:0001:a71c04", // set on another device
  "srs_due": "1721559000000:0003:a71c04",
}
```

Merge rule, applied per field:

```
if remote.field_hlc[f] > local.field_hlc[f]:  take remote value and its HLC
else:                                          keep local
```

**Merge classes.** Not every field is LWW; the class is declared per field in
`packages/core/src/sync/fieldPolicy.ts` and enforced in `loro-core::sync::merge_row`.

| Class             | Fields                                                                                | Rule                                                                         |
| ----------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **LWW**           | `difficulty`, `tags`, `loved`, `learned`, `note`, `cue_level`, `settings.*`, `trip.*` | Highest HLC wins                                                             |
| **Max**           | `reps`, `plays`, `rung`, `lock_in_days`, `ax_*`, `stumbles`                           | `max(local, remote)` — monotonic, so never regresses                         |
| **Latest-review** | `srs_stability`, `srs_difficulty`, `srs_due`, `srs_last_review`, `srs_state`          | Merged **as a group**, taking whichever side has the later `srs_last_review` |
| **Append-only**   | `review_log`, `latency_sample`, `take`, `attempt`, `session`                          | No merge; union by primary key                                               |
| **Tombstone**     | `deleted_at`                                                                          | A delete wins over a concurrent edit at any HLC                              |

Two of these deserve emphasis:

**Max, not LWW, for monotonic counters.** If device A is at `reps: 20` offline and device B does 3
reviews reaching `reps: 18`, LWW on B's later HLC would _lower_ A's count. `max` cannot. And because
`reps` is also derivable from `review_log`, the server periodically reconciles it as a background
job — `max` is the fast path, the log is the truth.

**FSRS fields merge as a unit.** Taking `stability` from one device and `due` from another would
produce a scheduling state that no algorithm ever computed. The group rule keeps FSRS state
internally consistent.

**Delete wins.** A learner who removes a phrase on their phone must not have it resurrected by a
stale edit from their tablet. The undo window ([functional-spec.md](../product/functional-spec.md))
is local and pre-sync, so this doesn't fight undo.

---

## The protocol

Two endpoints. Full request/response shapes in [api.md](api.md#sync).

```
POST /v1/sync/push     outbox batch  → accepted seqs, server HLC
POST /v1/sync/pull     since HLC     → changed rows, next cursor, server HLC
```

### Push

```jsonc
POST /v1/sync/push
{
  "device_id": "d3f9a1…",
  "client_hlc": "1721559000000:0003:d3f9a1",
  "ops": [
    {
      "seq": 1042,
      "entity": "user_phrase",
      "entity_id": "up_8f2c…",
      "op": "upsert",
      "fields": {
        "difficulty": { "v": "hard", "hlc": "1721558400123:0007:d3f9a1" },
        "tags":       { "v": ["pron"], "hlc": "1721558400123:0008:d3f9a1" }
      }
    },
    { "seq": 1043, "entity": "review_log", "entity_id": "rl_…", "op": "upsert", "fields": { … } }
  ]
}
```

```jsonc
200
{ "accepted": [1042, 1043], "rejected": [], "server_hlc": "1721559100000:0000:srv" }
```

- **Only changed fields are sent**, with their individual HLCs. A row with one changed field sends
  one field.
- Batches are capped at 500 ops / 512 KB. The outbox drains in `seq` order.
- **Idempotent.** Re-pushing an already-applied op is a no-op — the HLC comparison makes it so.
- `rejected` carries a reason per seq (`schema_unknown`, `entity_forbidden`). Rejected ops are moved
  to a dead-letter table locally and reported, never silently dropped.

### Pull

```jsonc
POST /v1/sync/pull
{ "device_id": "d3f9a1…", "since": "1721550000000:0000:srv", "limit": 500 }
```

```jsonc
200
{
  "changes": [ { "entity": "user_phrase", "entity_id": "up_1a…", "fields": { … }, "deleted_at": null } ],
  "next": "1721559100000:0002:srv",
  "has_more": false,
  "server_hlc": "1721559100000:0003:srv"
}
```

The client applies changes through `loro-core::sync::merge_row` — the same function the server uses,
so both sides always agree on the outcome.

### Cadence

| Trigger                                       | Behaviour                                          |
| --------------------------------------------- | -------------------------------------------------- |
| App foreground                                | Push then pull                                     |
| Session end                                   | Push                                               |
| Outbox exceeds 50 rows                        | Push                                               |
| Every 15 min while foregrounded and connected | Push then pull                                     |
| Connectivity regained                         | Push then pull                                     |
| App background                                | Push once, best-effort, within the OS grace window |
| Manual (Settings → Sync now)                  | Push then pull, with a visible result              |

**Never on the practice hot path.** Sync is a background concern; a rep never waits for it.

### Failure handling

| Failure                   | Behaviour                                                                                                        |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Network error / timeout   | Exponential backoff, 2s → 5m, jittered. Outbox retained                                                          |
| 401                       | Refresh the token once, retry once, then require re-auth without losing the outbox                               |
| 409 (schema too old)      | Prompt for an app update; sync pauses, local use continues                                                       |
| 5xx                       | Backoff. After 5 failures, log once and stop retrying until the next foreground                                  |
| Outbox older than 30 days | Log a warning event — this means sync has been broken silently                                                   |
| Outbox above 10 000 rows  | Compact: collapse repeated upserts of the same `(entity, entity_id)` into one, keeping the highest HLC per field |

The outbox is never truncated to make sync succeed. Dropping a learner's data to fix a sync error is
never the right trade.

---

## First sign-in on a device with local data

The anonymous-first flow ([prd.md](../product/prd.md) `F-02`) makes this the most delicate path in
the protocol.

```
Anonymous learner has 120 local phrases, then signs in with Apple.
```

```
1. Client sends anon_id with the auth request.
2. Server looks up the account:
   a) No existing account for that identity
      → claim: bind anon_id to the new user. Push everything. Nothing merged, nothing lost.
   b) Existing account with data
      → MERGE. Push the whole local outbox (a full-state push for every local row),
        then pull. Per-field LWW resolves overlaps; disjoint rows union.
        Duplicate catalog phrases collapse on the (user_id, phrase_id) unique index,
        keeping the row with the higher `reps`.
3. Both directions complete before the UI reports "signed in".
```

**We never discard local data on sign-in.** Case (b) merges, even when it produces a slightly odd
union (two rows' ratings resolved by timestamp). A learner who loses 120 phrases by signing in has
been failed in a way no other bug matches.

Sign-_out_ keeps local data and stops syncing. Sign-out-and-erase is a separate, confirmed action.

---

## What is not synced

| Not synced              | Why                                                                        |
| ----------------------- | -------------------------------------------------------------------------- |
| `outbox`                | Per-device by definition                                                   |
| `audio_cache`           | Re-fetchable from the CDN                                                  |
| `ai_cache`              | Re-fetchable; device-local                                                 |
| `analytics_queue`       | Goes to the analytics pipeline, not sync                                   |
| **Recorded audio**      | Never leaves the device ([ADR-0011](adr/0011-analytics-and-privacy.md))    |
| Ephemeral session state | Meaningless on another device mid-session                                  |
| Catalog tables          | Delivered by content sync, a separate mechanism ([api.md](api.md#content)) |

`session`, `attempt`, and `latency_sample` **are** synced (append-only) — they're needed for
cross-device progress and for the learning-quality telemetry that decides the loop question.

---

## Observability

Every sync emits `sync_completed` or `sync_failed` ([metrics.md](../product/metrics.md)) with
`pushed`, `pulled`, `conflicts`, `duration_ms`.

| Metric              | Alert                                                                      |
| ------------------- | -------------------------------------------------------------------------- |
| Conflict rate       | > 0.5% of merged rows — suggests a merge-class error, not real concurrency |
| Sync failure rate   | > 2% of attempts                                                           |
| Outbox age p95      | > 24 h                                                                     |
| Push batch size p95 | > 400 ops — suggests sync is falling behind                                |
| Rows rejected       | any sustained non-zero                                                     |

A conflict-rate spike is the canary for a field being in the wrong merge class. Because merges run
through one shared function, a fix is one change in `loro-core` and it corrects both sides.

---

## Testing

| Test                                                                                 | Location                                                             |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| HLC monotonicity under clock jumps (backwards, forwards, equal)                      | `core-rs/tests/hlc.rs`                                               |
| Merge commutativity and idempotency — `merge(a,b) == merge(b,a)` for LWW/Max classes | `core-rs/tests/merge.rs`                                             |
| Every field has a declared merge class                                               | `core/src/sync/fieldPolicy.test.ts` (fails on an unclassified field) |
| Two-device simulation: concurrent edits, partitions, reconvergence                   | `api/test/sync.e2e.ts`                                               |
| Sign-in merge, both cases, with overlapping libraries                                | `api/test/claim-merge.e2e.ts`                                        |
| Offline-for-30-days replay                                                           | `api/test/sync-replay.e2e.ts`                                        |
| Outbox compaction correctness                                                        | `mobile/src/data/sync/compact.test.ts`                               |
| Tombstone precedence over concurrent edits                                           | `core-rs/tests/merge.rs`                                             |

The "every field has a declared merge class" test is the important one: it makes adding a field to
`user_phrase` without thinking about sync a **build failure** rather than a subtle data-loss bug
discovered by a learner.
