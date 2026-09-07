# @loro/api

The implemented Loro backend skeleton: NestJS over an in-memory sync repository, the bundled
catalog, the shared Rust/WASM merge, and bundled AI scenes. Postgres, Redis, auth, TTS, billing,
accounts, analytics, queues, and live providers are target architecture, not running modules.

Architecture: [backend.md](../../docs/architecture/backend.md) · Contract:
[api.md](../../docs/architecture/api.md) · Rationale:
[ADR-0008](../../docs/architecture/adr/0008-backend-nestjs-postgres.md)

## What this service is for

Four jobs, and **none of them is running a practice session**:

1. **Arbitrate sync** — implemented for one process, using the same Rust/WASM merge as the client.
2. **Distribute content** — implemented from the bundled catalog; version history and object storage
   are not implemented.
3. **Proxy AI and TTS** — only the AI scene provider seam, bundled scenes, and scene validation are
   implemented. There is no live AI call or TTS module.
4. **Verify purchases and resolve entitlements** — planned, not implemented.

A learner can practise for weeks with this service unreachable
([overview.md](../../docs/architecture/overview.md#the-ten-rules), rule 2). The selected
[testing host](../../docs/architecture/backend.md#testing-infrastructure) accepts maintenance
downtime and has no production availability guarantee; plan 73 owns production objectives.

## Run it

```bash
pnpm core-rs:build              # once — sync and production startup need the WASM merge
pnpm --filter @loro/api dev     # tsx watch
curl localhost:3000/v1/health/ready
```

No database is read by the service yet. The sync store is an in-memory `Map`, so it empties on
restart and is neither authenticated nor user-scoped. `docker compose` can start Postgres, Redis,
and MinIO (`pnpm --filter @loro/api dev:up`), but today the API does not connect to them. Plan
[66](../../plans/66-backend-contract-data-and-security.md) owns shared wire schemas, Postgres, and a
deployable image; plans [67](../../plans/67-anonymous-auth-and-account-lifecycle.md) and
[68](../../plans/68-sync-and-offline-convergence.md) add identity and safe convergence.

**AI scenes are stubbed locally** (`AI_PROVIDER=stub`). No credentials are needed, there is no cost,
and the bundled fallback path stays exercised. There is no TTS implementation yet.

### Testing hosting

[Plan 88](../../plans/88-low-cost-backend-infrastructure.md) selects one Frankfurt EC2 instance,
local PostgreSQL, private S3 and a $25–35/month target. Nothing is provisioned yet. The database,
auth and isolation slices must pass before shared access; a running container does not establish
them. See [environments](../../docs/process/environments.md) and the
[operations runbook](../../docs/runbooks/backend-testing.md). Live AI, TTS, Redis and CDN remain
disabled or deferred.

### The endpoints that exist

| Method | Route                  | Notes                                                           |
| ------ | ---------------------- | --------------------------------------------------------------- |
| `GET`  | `/v1/health`           | Liveness                                                        |
| `GET`  | `/v1/health/ready`     | Readiness — **503 if the WASM merge is missing**                |
| `GET`  | `/v1/content/manifest` | Bundled catalog; counts come from `@loro/content`               |
| `GET`  | `/v1/content/diff`     | `?from=<version>`                                               |
| `GET`  | `/v1/content/pack`     | `?id=<pack>`                                                    |
| `POST` | `/v1/sync/push`        | Per-field merge; rejects any field with no declared merge class |
| `POST` | `/v1/sync/pull`        | Currently returns every in-memory row; ignores cursor and limit |
| `POST` | `/v1/sync/status`      | Diagnostic: is the shared Rust merge loaded?                    |
| `POST` | `/v1/ai/scene`         | Roleplay scene, validated before it can reach a learner         |
| `GET`  | `/v1/ai/themes`        |                                                                 |

`src/sync/sync.e2e.test.ts` drives representative health, content, sync, error, and AI behavior over
HTTP against a real Nest app. Controller/service unit suites cover additional cases. There is no
auth, tenant isolation, persistence, rate limiting, streaming, or external-service E2E coverage yet.

### Build

`pnpm --filter @loro/api build` bundles with esbuild to `dist/main.js`, which is what the container
runs. Not `tsc`: workspace packages are consumed as TypeScript source, so there is no `rootDir` that
contains the program — see the amendment on
[ADR-0014](../../docs/architecture/adr/0014-monorepo-tooling.md).

**In production the service refuses to start without the WASM merge.** A half-built image that
serves sync is worse than one that doesn't: pushes fail one at a time while the process looks
healthy. In development it starts with a warning and reports readiness as degraded.

## The one thing to understand first

```ts
// src/sync/sync.service.ts
const merged = mergeRow(current, op) // ← loro-core, compiled to WASM
```

**The server runs the same merge code as the client.** Two implementations of a conflict-resolution
rule will diverge on some edge case, and the divergence shows up months later as a learner losing a
rating, a note, or a rep count ([ADR-0002](../../docs/architecture/adr/0002-shared-rust-core.md)).

That's also why `packages/core/src/sync/` requires **two reviewers**, one from each side.

## Implemented modules

```
src/
├── ai/         bundled scene provider · validation · provider registry
├── common/     clock · environment access · RFC 9457 problem mapping/filter
├── content/    manifest · whole-catalog diff · pack-by-query from @loro/content
├── health/     liveness · WASM-aware readiness
└── sync/       push/pull/status · WASM adapter · in-memory repository
```

The intended auth, TTS, billing, account, analytics, persistence, cache, queue, and worker modules
are specified in [backend.md](../../docs/architecture/backend.md). Add them as separate modules at
their boundary; do not make existing controllers pretend those dependencies already exist.

**Two things are chosen in `src/app.module.ts` and nowhere else**, so swapping either is a new file
plus one line there rather than an edit to the logic that uses it:

| Seam                                       | Today                                       | Next                                 |
| ------------------------------------------ | ------------------------------------------- | ------------------------------------ |
| `SYNC_REPOSITORY` (`sync.repository.ts`)   | `InMemorySyncRepository` — a `Map`, per app | User-scoped Postgres via plans 66–68 |
| `SCENE_PROVIDERS` (`ai/scene-provider.ts`) | `StubSceneProvider` — bundled scenes        | Guarded live provider via plan 76    |

A provider registers under the `AI_PROVIDER` value that selects it, and `AiService` keys them by
name — so a second provider is never a second branch. An `AI_PROVIDER` naming a provider that isn't
registered logs a warning and serves the bundled scene, which is the documented posture for every AI
path: degrade loudly in the log, silently to the learner.

## Rules: enforced now versus required next

- **Not yet user-scoped:** `SyncRepository` keys rows by `(entity, id)`, and `pull()` returns all
  rows. Do not expose this service to multiple learners. Plan 68 must change the repository contract
  to require server-derived user scope and cursor paging.
- **Shared contracts exist; boundary wiring remains:** plan 85 supplies current/target/draft Zod
  schemas and generated OpenAPI in `@loro/core/api/*`. HTTP conformance tests protect current
  behavior. Controllers still use local interfaces/checks; plan 66 must install validated boundaries
  without turning per-item sync/analytics rejection into whole-batch rejection. See
  [api-contracts.md](../../docs/architecture/api-contracts.md).
- **Logging hardening is still required:** current code does not intentionally log request bodies,
  but there is no structured redaction allowlist yet. Add it before auth, accounts, or live
  providers introduce more sensitive values.
- **No endpoint is authorized to accept learner audio.** Recorded audio never leaves the device; a
  voice-clone route would violate ADR-0011. Current generic sync validation is not a privacy
  allowlist: wildcard append-only fields remain an input-hardening gap. Target schemas reject
  audio/paths/transcripts; plan 66 must enforce them before multi-user service exposure.
- **AI fallback is implemented; budgets, cache, rate limits, repair, and live providers are not.**
- **Migrations do not exist yet.** When persistence lands, use expand → migrate → contract.

## Tests

### Written

`src/contracts.e2e.test.ts` validates all ten current routes over HTTP with real WASM, including
partial sync rejection, framework problems and the unavailable-readiness 503 body. Target schema and
OpenAPI compatibility tests live in core/content; they do not prove missing services work.

| Test                                     | What it holds down                                                                        |
| ---------------------------------------- | ----------------------------------------------------------------------------------------- |
| `src/sync/sync.e2e.test.ts`              | Representative endpoints over HTTP, including readiness and the `max`-vs-later-clock case |
| `src/content/content.controller.test.ts` | Pack response order/bytes and unknown-pack error contract                                 |
| `src/sync/merge.wasm.test.ts`            | The five merge classes, run through the actual WASM build the client uses                 |
| `src/sync/sync.service.test.ts`          | The push guards without HTTP: the op cap, an unknown entity, an undeclared field          |
| `src/common/errors.test.ts`              | Problem details: every code's status, member order, and that nothing internal leaks       |
| `src/ai/scene.test.ts`                   | The pedagogical invariants — above all, exactly one `best` option per turn                |
| `src/ai/ai.service.test.ts`              | An invalid scene never reaches a learner; an unregistered provider degrades, not 500s     |

### Planned — these do not exist yet

Listed because they are the tests this service most needs, not because they are written. Each waits
on persistence or auth:

| Test                 | Why it matters                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------- |
| Anonymous claim      | **Sign-in with existing local data must lose nothing.** The worst bug this product can have |
| Two-device partition | Partition, diverge, reconverge                                                              |
| 30-day replay        | A month offline, then sync                                                                  |
| Tenant isolation     | Cross-user reads 404                                                                        |
| AI budget breach     | Invalid scene → repair → fallback; budget breach → silent fallback                          |

## Multilingual content (F-08)

Three additional endpoints under `/v1/content/v2`: `manifest`, `diff`, `pack`. They accept `target`
(`es-ES`, `bg-BG`, `ru-RU`) and `native` (`en`, `bg`, `ru`), rejecting equal-language pairs.
Payloads use `targetText` and `translations`; manifests expose review status and capability flags.
The original `/v1/content` endpoints retain their Spanish/English shape. AI scene requests accept
`targetLocale` and `nativeLanguage`, but the current stub rejects pairs other than English →
Spanish.
