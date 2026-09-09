# Core, persistence and backend

## Ownership map

| Concern                              | Start here                                                             | Decision that avoids rework                                                                       |
| ------------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Practice output                      | `packages/core/src/engines/types.ts`, `apps/mobile/src/store/delta.ts` | Record through the engine and apply `ProgressDelta`; no screen writes progress directly.          |
| Active/due eligibility               | `packages/core/src/domain/phrase.ts`                                   | Keep SQL selection equivalent; use persistence parity tests.                                      |
| Scheduling, matching, selection, DSP | `packages/core-rs/src/`, mobile core facade/bridge                     | Rust owns reproducible numbers. Replace fallbacks through its boundary, not another TS algorithm. |
| Device storage                       | `packages/core/src/persistence/`, `apps/mobile/src/data/`              | Follow the `SqlDriver` and repository seams; no client ORM.                                       |
| Merge fields                         | `packages/core/src/sync/fieldPolicy.ts`                                | Declare merge class and complete field groups before wiring consumers.                            |
| HTTP contracts                       | `packages/core/src/api/`, `api-tooling/`                               | Preserve current, target and draft distinctions; regenerate OpenAPI.                              |
| Runtime backend                      | `apps/api/src/app.module.ts`, feature modules                          | Registration and real routing prove wiring; adapter tests alone do not.                           |

Read `docs/architecture/practice-engines.md`, `scheduling.md`, `data-model.md`, `sync-protocol.md`
or `api-contracts.md` only for the boundary being changed. Discover current bridge and runtime
persistence files with `rg --files`; their availability has changed across worktrees.

## Persistence and maths pitfalls

Local writes own specific columns. Preserve merge-owned `field_hlc` and deletion-owned `deleted_at`;
`INSERT OR REPLACE` can erase clocks or resurrect rows. A course-save path once retained this defect
after other repositories were fixed, so inspect the actual caller.

Durable practice must commit progress, the complete scheduler result, attempt/review identity,
checkpoint and outbox atomically. Prove rollback and duplicate-attempt behavior using real SQLite.
Do not replace previously committed progress with an invalid resume snapshot. Validate course, local
day, phrase identity/text, mode and bounds before resuming. Replan at midnight before recording an
action. `clock.localDay()` and `clock.streakDay()` have different semantics.

The old core facade and Refrain engine both fabricated scheduling values. Removing only one did not
make scheduling canonical. Check engine dependency injection and all callers; persist the full state
and algorithm identity. Read the current FSRS policy/ADR before reconciling branches: concurrent
implementations have used incompatible retention, rerating and cloze policies. Do not resolve those
differences by taking whichever file merges most easily. Preserve valid historical state; never
relabel fabricated state or synthesize historical reviews as canonical evidence.

Prove host/WASM/native boundary parity separately. Include empty inputs, Unicode normalization,
combining marks and Cyrillic in matching. Missing reviewed cloze metadata must follow the agreed
fallback; do not guess a word mask from the prototype. Native compilation, algorithm parity and
device acceptance are different results.

## Contracts, accounts and sync

Keep observed API behavior explicit when documenting it. Do not silently normalize status codes,
serialization, pagination or readiness responses while claiming a contract-only change. Target
schemas are not evidence of installed Nest validation. Regenerate through `pnpm contracts:generate`
and run `pnpm contracts:check`; generated JSON should be deterministic.

Contract and provider work previously ran independently. Use one agreed handoff before runtime
wiring; do not introduce substitute app-facing types or competing session stores. The isolated
Anthropic transport was deliberately unregistered. Inspect its current module registration and
guardrails before claiming `AI_PROVIDER` or a key enables it. A separate `MUSIC_PROVIDER` is
not `TTS_PROVIDER`; generated tracks still cannot become pronunciation references.

Inspect current source before repeating a dual-ownership cleanup: Stream must not bypass
`StreamEngine`, and Refrain numbers belong in Rust. The
[refactoring-strategies review](../../../../docs/reviews/2026-09-09-refactoring-strategies.md)
inventories that shipped debt; it is not authorization to add libraries or rewrite `features/`.

For account/sync integration, use real database/routing tests for tenant and device isolation,
refresh replay/revocation, anonymous claim and conflict recovery. The isolated PostgreSQL helper
owns its destructive test database; never point those tests at an existing service database. Two
auth branches once defined incompatible `auth_sessions`, JWTs, refresh responses and SecureStore
formats. Preserve account IDs and provide an explicit migration instead of treating these as
interchangeable schemas. Preserve OAuth state/PKCE/callback cancellation when adding email sign-in.

Offline network failures must not discard valid stored credentials. Outbox acknowledgement, clock
correction, merge shadow and entity materialization must agree before declaring convergence. A
reviewed regression involved correcting SQL clocks while leaving a future-clock `sync_rows` shadow
unchanged: outbox became empty but devices diverged. Test receipt correction against the shadow and
preserve newer pending clocks.

Apply the privacy contract to every new field: raw recordings/handles, ASR transcripts, embeddings
and private chat history are not ordinary sync payloads. A public catalog gateway may block auth and
sync even after authenticated endpoints exist in source; verify the deployed access policy.
