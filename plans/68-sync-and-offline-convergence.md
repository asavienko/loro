# Sync client, user-scoped pull, and offline convergence

- **Requirement IDs:** `F-03`, `F-04`, `F-07`
- **Milestone:** M2
- **Status:** Not started
- **Depends on:** 59 device persistence, the mobile Rust merge-binding slice of 60 (not FSRS/cloze
  completion), 66 durable server contract, 67 auth

## Outcome

Local writes always succeed and later converge across devices through a bounded, user-scoped,
cursor-based push/pull loop. Network failure is ordinary state, not a practice failure.

## Work

1. Finish server pull scoping/pagination and require an authenticated principal; remove any global
   repository key or caller-supplied user authority.
2. Build the mobile scheduler for transactional outbox batching, idempotent push, cursor pull, Rust
   merge/apply, acknowledgement, compaction, retry/backoff/jitter, and foreground/background
   triggers.
3. Persist cursors, attempts, dead letters, conflict/rescue metadata, and server clock observations.
   Never advance a cursor before local apply commits.
4. Define schema/version mismatch, tombstone retention, local clock anomaly, auth expiry, account
   reconciliation, catalog-phrase identity reconciliation across device-created row ids, and
   content-version interaction.
5. Expose a privacy-safe debug/rescue surface and support bundle without learner audio or sensitive
   phrase text by default.
6. Add deterministic simulations/property tests and real two-device tests for partitions, duplicate/
   reordered batches, crashes between stages, large libraries, sign-in merge, erasure, and replay.

## Acceptance criteria

- No request can pull another learner's rows; cursor/limit/`has_more` semantics are proven.
- Two devices adding the same catalog phrase converge to one live SQLite row without lost fields,
  duplicate history, `INSERT OR REPLACE`, or tombstone resurrection.
- Any crash/retry point converges without loss or duplicate effects.
- Practice screens never await the network or show a spinner for a local write.
- p95 sync meets the documented budget for a 2,000-phrase fixture at projected and 10× load.

## Out of scope

Content-asset downloading, trip audio prefetch, server-active practice, and collaboration features.
