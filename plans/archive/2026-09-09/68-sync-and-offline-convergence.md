# Sync client, user-scoped pull, and offline convergence

- **Requirement IDs:** `F-03`, `F-04`, `F-07`
- **Milestone:** M2
- **Status:** 🟡 Durable mobile push/pull, tenant-scoped PostgreSQL, Rust merge, catalog identity
  reconciliation and transactional cursor/ACK handling are implemented. OS background execution,
  rescue/export, load and physical-device convergence acceptance remain; hardware and lifecycle
  policy are the remaining gates.
- **Depends on:** 59 device persistence; 60 mobile merge binding only, not FSRS; 66 tenant cursor
  API; 67 identity.
- **Reviewed:** 2026-09-09 against `aafa61f`; current source, tests and retained review records
  inspected. This plan refresh supplies no new runtime, device or deployment acceptance.
- **Priority:** 6; lifecycle recovery with 67; Review compensation contract may proceed for
  priority 3.

**Archive disposition (2026-09-09):** Archived at user request after implemented slices landed. The
partial status and remaining acceptance criteria are retained; archival does not mark this plan
complete. The roadmap index continues to track its unfinished scope.

## 2026-09-09 bounded recovery slice

Expired cursors now retain their reset and enter persisted backoff when expiry consumes the final
pull attempt. The client cannot report successful convergence before fetching the replacement
snapshot. Real SQLite fault tests cover a local write arriving during cursor expiry, replay after
the pull budget is exhausted, and an incompatible successful HTTP response retaining the exact
pending wire payloads and existing cursor. These deterministic histories do not establish physical
process-death, long-offline tombstone policy, or deployed load acceptance.

The Account screen also distinguishes a durable quarantined-operation count from ordinary pending
network work. It reports the count without exposing payload contents; Sync now can retry normal work
but never deletes or resends quarantined payloads. A policy-backed correction, rescue or export flow
remains required before those records become actionable.

## Implemented scope

The mobile service starts after persistence hydration and authenticated account binding. Local
writes, foreground/connectivity events and bounded retries trigger immutable outbox batches;
practice never awaits HTTP. Acknowledgement, Rust merge/apply and pull cursors commit together.
Attempts, cursors, dead letters, aliases and exact receipt clock corrections survive relaunch.
Account/device checks around asynchronous work prevent stale credentials from uploading another
account's state.

The PostgreSQL server scopes rows, replay receipts and snapshot cursors to the tenant/device.
Catalog duplicates converge through identity aliases; deletion/re-add proofs protect tombstones.
Target-scoped day identities and `substituted` have declared merge policy. Device-local course
checkpoints and private chat content are excluded. Real SQLite/PostgreSQL and HTTP tests cover
retries, interrupted apply, aliases, account changes, two-device sync and tenant isolation.

## Outcome

Local practice commits to SQLite independently of network availability and later converges through a
bounded, user-scoped push/pull loop. A failed local transaction preserves the last committed state
and recoverable work; it cannot be reported as a successful write. Network failure alone does not
block practice.

## Remaining work

1. [ ] Add OS background execution under platform policy; current scheduling runs while the app is
       active and reacts to foreground/connectivity changes.
2. [ ] Complete tombstone retention, server compaction and content-version operational policy;
       extend schema-version mismatch and long-offline recovery acceptance without discarding data.
3. [ ] Expose learner-facing repair for quarantined operations and privacy-safe debug/rescue/export
       with 67's ownership and redaction policy. Show saved/pending/rejected state and allow a
       correction to retry without dropping unrelated local work. Durable rejected operations
       already keep an actionable account error; learner-facing repair remains to do.
4. [ ] Expand deterministic fault histories and physical two-device tests for prolonged partitions,
       reordered delivery, process death, clock anomalies, account lifecycle and erasure.
5. [ ] Define the Review Undo compensation contract with 75 before enabling Undo: stable original
       event/compensation identity, duplicate delivery, acknowledgement, ordering and replay after
       process death. Never overwrite an acknowledged review. This contract can proceed during
       priority 3; the initial Review engine/route does not depend on Undo.
6. [ ] Measure the 2,000-phrase and 10× load budgets against deployed durable PostgreSQL and target
       hardware. Passing isolated two-device HTTP tests does not establish production convergence or
       latency budgets.

## Acceptance criteria

- No request can pull another learner's rows; cursor/limit/`has_more` semantics are proven.
- Two devices adding the same catalog phrase converge to one live SQLite row without lost fields,
  duplicate history, `INSERT OR REPLACE`, or tombstone resurrection.
- Any crash/retry point converges without loss or duplicate effects.
- Practice screens never await the network. Local-write failure does not publish uncommitted
  progress; recovery preserves drafts and the last committed state.
- p95 sync meets the documented budget for a 2,000-phrase fixture at projected and 10× load.

## Delivery order and gates

1. Agree tombstone/compaction and long-offline recovery policy with 66/67 before adding destructive
   cleanup. Test expired cursors and schema mismatch while preserving unsent local writes.
2. Deliver lifecycle repair/export and stale-device erasure enforcement with 67, then bounded OS
   background scheduling on the existing sync service. Foreground convergence must still work when
   the OS declines background time; keep account binding checks around asynchronous work and reuse
   67's export/lifecycle contracts.
3. Expand deterministic fault histories first, then use 58 devices and 88's synthetic load profile
   for measurements. Verify server state, both local databases and pending outboxes together; an
   empty outbox alone is not convergence evidence.

## Out of scope

Content-asset downloading, trip audio prefetch, server-active practice, and collaboration features.

## Post-main review and archive disposition — 2026-09-09

The [review at `de81744`](../../../docs/reviews/2026-09-09-post-main-plan-review.md) records this
plan's current contribution, remaining work and gates. [Delivered slices](IMPLEMENTED-SLICES.md) are
retained in the archive; this plan remains incomplete. Earlier verification is dated evidence, not
acceptance of the current combined branch.
