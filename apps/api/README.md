# @loro/api

The NestJS backend: content packs, accounts, sharing, AI generation, phrase clips, songs and
progress for the app, on PostgreSQL. How it is built:
[backend.md](../../docs/architecture/backend.md); its routes:
[api.md](../../docs/architecture/api.md); what the app does with it:
[library.md](../../docs/architecture/library.md).

## Run

Use Node 22 (`nvm use 22`) with cargo on the PATH (`export PATH="$HOME/.cargo/bin:$PATH"`). From the
repository root:

```bash
pnpm core-rs:build                    # the Rust merge's WASM build (sync and readiness)
pnpm --filter @loro/api dev:up        # PostgreSQL 16 on :5432 (Redis and MinIO too, unused)
pnpm env:decrypt                      # writes apps/api/.env; or copy .env.example
pnpm --filter @loro/api dev           # :3000/v1, reloading on change (`start` runs it once)
curl localhost:3000/v1/health/ready
```

The API loads `apps/api/.env` when it starts. Every variable, its default and its comment are in
`.env.example`; what they change is in [environments.md](../../docs/process/environments.md).
Signing in locally (keys, the email-code inbox, Google and Apple):
[the auth module](src/auth/README.md) and
[library.md](../../docs/architecture/library.md#running-it-locally). With `.env.example`'s values,
AI, music and TTS spend nothing: the labelled fallbacks answer, and phrases have no clips.

`DATABASE_URL` is required for accounts, the library and sync; there is no in-memory fallback.
Without it those routes are `503` and readiness reports the database unavailable. The schema is
applied on the first query ([backend.md](../../docs/architecture/backend.md#storage)). In production
(`NODE_ENV=production`) the API refuses to start without the WASM build or with an unreachable
database.

## Test

```bash
pnpm --filter @loro/api test          # vitest
pnpm --filter @loro/api exec vitest run src/library/covers.test.ts
pnpm --filter @loro/api typecheck
pnpm --filter @loro/api lint
bash scripts/ci-auth-postgres.sh      # the whole suite on a disposable PostgreSQL
```

The `*.postgres.test.ts` suites skip unless `LORO_TEST_DATABASE_URL` is set. They create an isolated
schema per run, so the database user must be allowed to create schemas.
`scripts/ci-auth-postgres.sh` starts a PostgreSQL 16 container, runs every suite against it on one
worker and removes it; `pnpm ci:local` runs it. No test sends email or contacts Anthropic,
ElevenLabs, Google or Apple.

After changing a contract in `packages/core/src/api/`, run `pnpm contracts:generate`
([api.md](../../docs/architecture/api.md#contracts)).

## Build

`pnpm --filter @loro/api build` bundles `src/main.ts` with esbuild into `dist/main.js`. It bundles
`@loro/core` and `@loro/content`, because the distroless Node 22 image won't strip TypeScript under
`node_modules` after `pnpm deploy`, and keeps npm packages and `@loro/core-rs` external. On the
host, `dev` and `start` run the workspace TypeScript directly through tsx.

`Dockerfile` builds the image (build from the repository root): distroless Node 22, non-root, with
the WASM build copied in from `packages/core-rs/pkg`. `scripts/ci-api-image.sh` builds it and checks
it against an isolated database. Deploying it:
[ec2-deployment.md](../../docs/process/ec2-deployment.md).
