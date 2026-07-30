# The sync client: flush, pull, apply, and the conflict surface

- **Requirement IDs:** `F-04`, `F-03`, `F-07`
- **Milestone:** M2
- **Size:** L
- **Depends on:** [sqlite-persistence-and-outbox.md](10-sqlite-persistence-and-outbox.md),
  [fix-sync-pull-cursor-and-scoping.md](06-fix-sync-pull-cursor-and-scoping.md),
  [auth-anonymous-first.md](14-auth-anonymous-first.md)

## What exists and what doesn't

The **merge** is real and shared: `apps/api/src/sync/merge.ts` loads the WASM built from
`packages/core-rs/src/sync/merge.rs`, and `merge.wasm.test.ts` proves the server runs it. The field
policy is enforced and CI-gated (`packages/core/src/sync/fieldPolicy.ts`). HLCs exist
(`core-rs/src/sync/hlc.rs`, 7 tests).

What does not exist: **any client**. Nothing in `apps/mobile` calls `/v1/sync/push` or `/pull`,
there is no outbox to drain, and no code applies remote changes.

## The rule that shapes the whole design

`docs/architecture/offline.md`: _no code path awaits the network._ So sync is a background
reconciler, never a step in a user flow. Nothing in the UI shows a spinner because sync is running;
nothing blocks because it failed.

## The work

### 1. The loop

A single `SyncEngine` service with one owner of the schedule:

- **Triggers**: app foreground, network regained (`expo-network`), outbox non-empty + debounce (~5 s
  so a burst of ratings becomes one push), a periodic tick (~15 min), and an explicit
  pull-to-refresh on Progress.
- **Never**: on every mutation. That is how a learner rating ten phrases in the stream produces ten
  round trips.
- **Serialised**: one push and one pull in flight, ever. A mutex, not a queue of promises.

### 2. Push

Drain the outbox in `seq` order, batched to the server's `MAX_OPS = 500`
(`apps/api/src/sync/sync.controller.ts:38`). On response:

- `accepted[]` → delete those ops.
- `rejected[]` → **do not retry blindly.** `schema_unknown` and `VALIDATION_FAILED` are permanent;
  retrying forever is a poison-pill loop. Move the op to a `sync_dead_letter` table, log a metric,
  and surface it in diagnostics — never lose it silently, never retry it forever.
- `conflicts[]` → record for telemetry (see §5).
- Network/5xx → exponential backoff with jitter, capped (~30 min), and **no attempt counter that
  eventually drops the op**.

### 3. Pull and apply

Store the server cursor (`next`) durably. Apply each remote row through the **same merge** the
server ran — `core-rs` over UniFFI on device — against the local row, then write the merged result
and _not_ an outbox op (applying a remote change must not echo it back).

The subtle part: a remote change can land while a local uncommitted outbox op targets the same
field. Order is defined by the merge class, not by arrival — that is what `fieldPolicy.ts` is for.
Apply the merge, then re-derive the outbox op's payload from the current local value if the class is
`lww`, and leave it alone if the class is `max` or `append-only`.

### 4. What the learner sees

Almost nothing, deliberately. One line in Settings: last synced, and a count if the outbox is
non-empty ("12 changes waiting"). No error banners for a failed sync — the device is the source of
truth and a failure has no learner-visible consequence.

The exception worth building: **the multi-device first-sync**. Signing in on a second device pulls a
library that was empty a moment ago. That needs a real "restoring your phrases" state, because a
silent 400-row insert looks like a bug.

### 5. Telemetry the protocol needs to be trusted

`docs/architecture/observability.md` and M4 both ask for conflict telemetry. Emit, with no learner
content in the payload:

- push batch size, latency, accepted/rejected counts by code
- conflicts by `(entity, field, mergeClass)` — the signal that tells you whether a chosen merge
  class is wrong
- outbox depth and oldest-op age (the real "is sync healthy" metric)
- clock skew: the server returns `server_time` for exactly this (`sync.controller.ts:117`, and its
  comment says so) and nothing reads it yet.

### 6. Anonymous → signed-in reconciliation

`F-02` promises "full app usable with no account, upgradeable without data loss". So the first
sign-in must upload the local library and reconcile it against whatever the account already has,
using the same merge — not "server wins" and not "local wins". Test it with three shapes: empty
server, empty local, and both non-empty with overlapping phrases.

## Acceptance criteria

- Airplane mode for a day: every mutation lands in the outbox, nothing retries in a tight loop,
  battery impact is negligible, and one foreground with network drains it in order.
- No user-facing flow awaits sync. Verified by a test that fails any `await` on the sync service
  from a screen.
- Two devices converge: interleaved edits to the same phrase end identical on both, and the result
  matches what the server computed.
- A permanently rejected op reaches dead-letter, not an infinite retry.
- First sign-in with a non-empty local library and a non-empty server loses nothing.
- Clock skew above a threshold is reported, and HLCs stay monotonic through it.

## Tests

- Deterministic convergence harness: two in-process clients + the real WASM merge, a randomised
  interleaving of N ops, asserting identical final state (property test, seeded).
- Backoff test with a fake timer: 5xx × 10 does not exceed the cap and does not drop ops.
- Reconciliation table test for the three sign-in shapes.
- `apps/api/src/sync/sync.e2e.test.ts` extended with a real client driver.

## Risks

- **The merge running in two runtimes** (WASM on the server, UniFFI on device) is the same Rust
  source but not the same binary. Add a cross-runtime golden test — same fixture, both bindings,
  identical output — to the `drift` CI job.
- **Wire-format drift**: `PushOp` is hand-typed in the controller (`sync.controller.ts:19–26`). Move
  the wire types into `@loro/core` so client and server cannot disagree, and validate with a schema
  rather than a cast.

## Out of scope

Real-time sync / websockets. Delta sync on foreground is the decided design.
