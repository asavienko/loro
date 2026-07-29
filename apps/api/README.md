# @loro/api

The Loro backend. NestJS, Postgres, Redis.

Architecture: [backend.md](../../docs/architecture/backend.md) · Contract:
[api.md](../../docs/architecture/api.md) · Rationale:
[ADR-0008](../../docs/architecture/adr/0008-backend-nestjs-postgres.md)

## What this service is for

Four jobs, and **none of them is running a practice session**:

1. **Arbitrate sync** — apply per-field merge rules using the _same_ implementation as the client.
2. **Distribute content** — versioned catalog, diffs, packs, signed CDN URLs.
3. **Proxy AI and TTS** — with caching, budgets, rate limits, and output validation.
4. **Verify purchases** and resolve entitlements.

A learner can practise for weeks with this service unreachable
([overview.md](../../docs/architecture/overview.md#the-ten-rules), rule 2). That's why the
availability SLO is a modest 99.9% and why best-effort out-of-hours on-call is defensible.

## Run it

```bash
pnpm core-rs:build              # once — the WASM merge; the service needs it
pnpm --filter @loro/api dev     # tsx watch
curl localhost:3000/v1/health/ready
```

No database required yet: **persistence is not wired**. The sync store is an in-memory `Map`, so it
empties on restart. The merge semantics it enforces are already the real ones — the same Rust code
the client runs — which is the part worth getting right first. Postgres, Redis, and MinIO are in
`docker compose` (`pnpm --filter @loro/api dev:up`) ready for when the repository layer lands.

**AI and TTS are stubbed locally** (`AI_PROVIDER=stub`). No credentials needed, no cost, works
offline — and the bundled fallback path stays exercised.

### The endpoints that exist

| Method | Route                  | Notes                                                           |
| ------ | ---------------------- | --------------------------------------------------------------- |
| `GET`  | `/v1/health`           | Liveness                                                        |
| `GET`  | `/v1/health/ready`     | Readiness — **503 if the WASM merge is missing**                |
| `GET`  | `/v1/content/manifest` | 31 phrases, 12 packs, 5 scenarios                               |
| `GET`  | `/v1/content/diff`     | `?from=<version>`                                               |
| `GET`  | `/v1/content/pack`     | `?id=<pack>`                                                    |
| `POST` | `/v1/sync/push`        | Per-field merge; rejects any field with no declared merge class |
| `POST` | `/v1/sync/pull`        |                                                                 |
| `POST` | `/v1/sync/status`      | Diagnostic: is the shared Rust merge loaded?                    |
| `POST` | `/v1/ai/scene`         | Roleplay scene, validated before it can reach a learner         |
| `GET`  | `/v1/ai/themes`        |                                                                 |

`src/sync/sync.e2e.test.ts` drives all of these over HTTP against a real Nest app.

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
// src/sync/sync.controller.ts
const merged = mergeRow(current, op) // ← loro-core, compiled to WASM
```

**The server runs the same merge code as the client.** Two implementations of a conflict-resolution
rule will diverge on some edge case, and the divergence shows up months later as a learner losing a
rating, a note, or a rep count ([ADR-0002](../../docs/architecture/adr/0002-shared-rust-core.md)).

That's also why `packages/core/src/sync/` requires **two reviewers**, one from each side.

## Modules

```
src/
├── auth/       apple · google · magic link · refresh rotation · anonymous claim
├── sync/       push/pull — thin, because the logic is in loro-core
├── content/    manifest · diff · packs · signed CDN URLs
├── ai/         Claude proxy: rate limit → budget → cache → validate → fallback
├── tts/        render on demand · voice-clone (the ONLY endpoint accepting audio)
├── billing/    receipt verification, entitlements with an offline grace period
├── account/    export (GDPR) · deletion (hard cascade, verified)
├── analytics/  ingest → warehouse
├── health/
└── workers/    content-build · tts-render · enrich · reconcile · analytics-etl · notify
```

Workers run from this same image with a different entrypoint. They share the domain types and DB
layer, but a slow content build must never contend with a learner's sync request.

## Rules

- **Every query is scoped by `user_id`**, and the repository layer requires it as a parameter. There
  is no `db.query` reachable from a controller, so a cross-tenant read is a compile-time
  impossibility rather than a review concern.
- **Validation uses the Zod schemas from `@loro/core`**, shared with the client, so the contract
  cannot drift.
- **No PII in logs.** Structured logging with an allowlist. `user_id` only, never email.
- **`POST /tts/voice-clone` is the only endpoint that accepts learner audio.** Consent-gated,
  per-use, and `retained: false` is a contract verified by a test that the temp file is gone after
  the request ([ADR-0011](../../docs/architecture/adr/0011-analytics-and-privacy.md)).
- **AI budgets fail silently to bundled fallbacks.** A learner should not be able to tell.
- **Migrations are expand → migrate → contract**, so a deploy is never coupled to a client release.

## Tests

### Written

| Test                          | What it holds down                                                                        |
| ----------------------------- | ----------------------------------------------------------------------------------------- |
| `src/sync/sync.e2e.test.ts`   | Every endpoint over HTTP against a real Nest app, including the `max`-vs-later-clock case |
| `src/sync/merge.wasm.test.ts` | The five merge classes, run through the actual WASM build the client uses                 |
| `src/common/errors.test.ts`   | Problem details: every code's status, and that nothing internal leaks                     |

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
