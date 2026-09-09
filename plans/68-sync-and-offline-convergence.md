# Sync client, user-scoped pull, and offline convergence

- **Requirement IDs:** `F-03`, `F-04`, `F-07`
- **Milestone:** M2
- **Status:** 🟡 Durable mobile push/pull, tenant-scoped PostgreSQL, Rust merge, catalog identity
  reconciliation and transactional cursor/ACK handling are implemented. OS background execution,
  rescue/export, load and physical-device convergence acceptance remain; hardware and lifecycle
  policy are the remaining gates.
- **Depends on:** 59 device persistence; 60 mobile merge binding only, not FSRS; 66 tenant cursor
  API; 67 identity.
- **Reviewed:** 2026-09-09 against checkout `42f4d57`; source/plan review only, no new device or
  deployment acceptance.

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

Local writes always succeed and later converge across devices through a bounded, user-scoped,
cursor-based push/pull loop. Network failure is ordinary state, not a practice failure.

## Remaining work

1. [ ] Add OS background execution under platform policy; current scheduling runs while the app is
       active and reacts to foreground/connectivity changes.
2. [ ] Complete tombstone retention, server compaction and content-version operational policy;
       extend schema-version mismatch and long-offline recovery acceptance without discarding data.
3. [ ] Expose privacy-safe debug/rescue/export and support bundles. Durable rejected operations
       already keep an actionable account error; learner-facing repair remains to do.
4. [ ] Expand deterministic fault histories and physical two-device tests for prolonged partitions,
       reordered delivery, process death, clock anomalies, account lifecycle and erasure.
5. [ ] Measure the 2,000-phrase and 10× load budgets against deployed durable PostgreSQL and target
       hardware. Passing isolated two-device HTTP tests does not establish production convergence or
       latency budgets.

## Acceptance criteria

- No request can pull another learner's rows; cursor/limit/`has_more` semantics are proven.
- Two devices adding the same catalog phrase converge to one live SQLite row without lost fields,
  duplicate history, `INSERT OR REPLACE`, or tombstone resurrection.
- Any crash/retry point converges without loss or duplicate effects.
- Practice screens never await the network or show a spinner for a local write.
- p95 sync meets the documented budget for a 2,000-phrase fixture at projected and 10× load.

## Delivery order and gates

1. Agree tombstone/compaction and long-offline recovery policy with 66/67 before adding destructive
   cleanup. Test expired cursors and schema mismatch while preserving unsent local writes.
2. Add bounded OS background scheduling and repair/export on the existing sync service. Foreground
   convergence must still work when the OS declines background time; keep account binding checks
   around asynchronous work and reuse 67's export/lifecycle contracts.
3. Expand deterministic fault histories first, then use 58 devices and 88's synthetic load profile
   for measurements. Verify server state, both local databases and pending outboxes together; an
   empty outbox alone is not convergence evidence.

## Out of scope

Content-asset downloading, trip audio prefetch, server-active practice, and collaboration features.
