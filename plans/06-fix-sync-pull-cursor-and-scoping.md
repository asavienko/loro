# Fix `/sync/pull`: no cursor, no limit, no user scoping, one global store

- **Requirement IDs:** `F-04`, `F-01`, `F-02`
- **Milestone:** M2 (blocks sync + accounts)
- **Size:** M

## The problem

`apps/api/src/sync/sync.controller.ts` is honest about being thin — the merge really is in
`loro-core` and that part is right. The pull endpoint, though, has four defects that each become a
production incident once a second learner or a second device exists.

### 1. `since` is accepted and ignored

```ts
@Post('pull')
pull(@Body() _body: PullBody): { … } {
  return { changes: [...store.values()], next: `${Date.now()}:0000:srv`, has_more: false, … }
}
```

`PullBody` declares `since` and `limit` (lines 33–36) and the parameter is discarded. So every pull
is a full-table read, `next` is a fresh timestamp unrelated to the data returned, and a client that
stores `next` and pulls again gets everything again. The protocol described in
`docs/architecture/sync-protocol.md` is a _delta_ sync; this is a full sync that reports itself as a
delta, which is the worst of both.

### 2. `has_more` is hardcoded `false`

A client trusts it and stops paging. With `limit` unimplemented there is nothing to page, so the
combination is currently consistent — and becomes a silent truncation the moment a limit is added
without fixing this.

### 3. No user scoping — the store is one global `Map`

```ts
const store = new Map<string, StoredRow>() // line 44
```

Keyed on `${entity}:${entity_id}` only. Every learner writes into the same namespace and every pull
returns **every learner's rows**. With phrase ids currently equal to catalog ids
([fix-user-phrase-identity.md](04-fix-user-phrase-identity.md)), two learners who both add `cafe1`
overwrite each other's ratings. This is a cross-tenant data leak and a data-loss bug at the same
time, and there is no auth on the endpoint to scope it with (`apps/api/src/app.module.ts` registers
no guard).

### 4. Module-level mutable state

The `Map` is a module singleton, not a provider. It survives across requests (intended for the stub)
but also across tests, defeats `Test.createTestingModule` isolation, and cannot be swapped for the
repository that Postgres needs.

## The work

### 1. A repository interface, injected

```ts
export interface SyncRepository {
  get(userId: UserId, entity: SyncEntity, id: string): Promise<StoredRow | null>
  put(userId: UserId, row: StoredRow, hlc: string): Promise<void>
  since(
    userId: UserId,
    cursor: Hlc,
    limit: number,
  ): Promise<{ rows: StoredRow[]; next: Hlc; hasMore: boolean }>
}
```

Two implementations: `InMemorySyncRepository` (per-instance, injected as a provider so tests get a
fresh one) and the Postgres one from [api-postgres-persistence.md](13-api-postgres-persistence.md).
Delete the module-level `Map`.

### 2. Store the HLC per row and page on it

Every stored row needs the server HLC at which it was last written. `pull` then becomes
`WHERE user_id = $1 AND hlc > $2 ORDER BY hlc LIMIT $3 + 1`, with `has_more` derived from whether
the extra row came back and `next` set to the **last returned row's** HLC — not `Date.now()`. Cap
`limit` at a documented maximum (mirror `MAX_OPS = 500` on the push side, line 38) and clamp rather
than reject.

HLC generation already exists in `packages/core-rs/src/sync/hlc.rs` with 7 tests; the controller
currently fabricates `` `${Date.now()}:0000:srv` `` in three places (lines 115, 130, and 132). Route
all three through the Rust HLC so ordering is monotonic under a clock that steps backwards.

**Leave `server_time: Date.now()` (line 117) alone.** It looks like a fourth instance of the same
mistake and isn't: it exists so the client can detect its own clock skew, which requires a real
wall-clock reading. Its comment says so. Converting it to an HLC would delete the only skew signal
the protocol has, and [the sync client](15-sync-client-loop.md) is specified to read it.

### 3. Scope everything by user

Requires [auth-anonymous-first.md](14-auth-anonymous-first.md). Until it lands, take the device/user
id from a required header and **document it as a stub with a deliberate 401 when absent** — a stub
that fails closed is safe; one that shares a namespace is not.

Add a compile-time guard: the repository takes `UserId` as its first parameter on every method, so
forgetting to scope a query is a type error.

### 4. Tombstones and the delete path

`push` synthesises `deleted_at: Date.now()` when a delete arrives without one (line 102). That makes
the server the authority on a client-side event time, which the offline-first model says it never is
(`docs/architecture/offline.md`). Reject a delete with no `deleted_at` as `VALIDATION_FAILED`
instead, and make sure tombstones are returned by `pull` — a delete that never reaches device 2 is a
resurrected phrase.

### 5. Conflict telemetry

`push` collects `conflicts` (line 107) and returns them; nothing records them.
`docs/product/metrics.md` and M4's "conflict telemetry" both want this. Emit a counter per
`(entity, field, mergeClass)` so the per-field LWW rules can be validated against real traffic
rather than assumed.

## Acceptance criteria

- `pull` with a cursor returns only rows newer than it; pulling twice with the returned `next`
  returns nothing the second time.
- `limit` is honoured; `has_more` is true exactly when more rows exist.
- `next` is always a real row HLC or the caller's cursor when nothing changed.
- Two users' rows never appear in each other's pull. A missing identity is a 401, not a shared
  bucket.
- Every HLC comes from `core-rs`; `server_time` still reports a real wall clock.
- A delete with no `deleted_at` is rejected; tombstones are pulled.
- Tests get a fresh repository per case.

## Tests

Extend `apps/api/src/sync/sync.e2e.test.ts`:

- push → pull → pull-with-next (empty) → push → pull (one row).
- Paging: 12 rows, `limit: 5`, three pages, no duplicates, no gaps.
- Two users, interleaved pushes of the same `entity_id`, each pull isolated.
- Delete propagation and tombstone visibility.
- Batch over `MAX_OPS` rejected; batch of exactly `MAX_OPS` accepted.

## Out of scope

Compaction of old tombstones and the retention job — M4 hardening.
