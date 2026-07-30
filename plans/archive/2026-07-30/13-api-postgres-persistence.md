# API persistence: Postgres, migrations, and a real readiness check

- **Requirement IDs:** `F-04`, `F-01`
- **Milestone:** M2
- **Size:** L
- **ADRs:** 0008 (NestJS + Postgres)

## Current state

The API is a working shell with ten endpoints and no storage:

- `apps/api/src/sync/sync.controller.ts:44` — `const store = new Map<string, StoredRow>()`, a module
  singleton (see [fix-sync-pull-cursor-and-scoping.md](06-fix-sync-pull-cursor-and-scoping.md)).
- `apps/api/src/health/health.controller.ts:28` — the readiness check reports `content: 'ok'`
  unconditionally, with a comment admitting it: "Postgres and Redis land with persistence; this
  reports what it actually knows rather than claiming green for absent dependencies." It is honest
  but it will keep saying `ok` after Postgres is added unless someone remembers to change it.
- `apps/api/docker-compose.yml` exists; `CLAUDE.md` correctly notes nothing needs it today.
- `docs/process/onboarding.md` §3 tells a new engineer to run `db:migrate` / `db:seed`, which are
  not defined anywhere — the doc runs ahead of the code (see
  [docs-drift-cleanup.md](44-docs-drift-cleanup.md)).

## The work

### 1. Schema and migrations

`docs/architecture/data-model.md` has the Postgres DDL. Implement it with Drizzle (same toolchain as
the client, so the two schemas can be reviewed side by side) and a real migration runner behind
`pnpm --filter @loro/api db:migrate` — the script the docs already promise.

Non-obvious requirements, all from decisions already made:

- **Per-field HLC storage.** Per-field LWW (`docs/architecture/sync-protocol.md`) means the row
  cannot carry one `updated_at`. Either a `jsonb` field map with an HLC per key or a narrow
  `(user_id, entity, entity_id, field, value, hlc)` table. The `jsonb` shape matches
  `StoredRow.fields` (`apps/api/src/sync/merge.ts`) and keeps the merge call unchanged — prefer it,
  and index on `(user_id, hlc)` for the pull cursor.
- **Tombstones** are rows, not deletions. `deleted_at` is already in the wire format.
- **A `row_hlc` column** for pull paging, monotonic per user.
- **`ON DELETE CASCADE` from the user** so GDPR erasure is one statement, not a checklist.

### 2. A repository layer, injected

Providers, not module singletons, so tests get isolation and the in-memory implementation stays
available for local dev without Docker (which is currently a genuine strength of this repo — keep
it). `DATABASE_URL` absent → in-memory repository + a loud startup warning, never a silent fallback
in a deployed environment (gate on `NODE_ENV`).

### 3. Readiness must actually check

Replace the hardcoded `content: 'ok'` with a real `SELECT 1` (short timeout, cached ~5 s so a
readiness probe storm cannot DoS the database) plus a migration-version check: if the schema version
is behind what the build expects, report **not ready**. The existing `merge` check is the right
pattern — it catches "the WASM did not make it into the image", a quiet failure — so extend that
thinking rather than replacing it.

### 4. Connection management

Pool sizing tied to the deployment topology in `docs/architecture/backend.md`; statement timeout;
`application_name` set so slow queries are attributable. Graceful shutdown that drains in-flight
requests before closing the pool — a blue/green cutover that drops connections mid-push makes
clients retry ops the server already accepted.

### 5. Content service, properly

`apps/api/src/content/content.controller.ts` serves the bundled catalog from `@loro/content`.
Content ships independently of the app (ADR-0009), so this needs a pack version table,
ETag/`If-None-Match`, and a cache header policy — not a database read per request. Keep the bundled
catalog as the fallback so the API stays runnable with no database, matching the AI service's "the
fallback is the local default, so it stays exercised and can't silently rot"
(`apps/api/src/ai/ai.service.ts:5–7`).

### 6. Seed data

`db:seed` creates one anonymous user, the catalog packs, and a small library — enough that a new
engineer can point a device at a local API and see a populated Progress screen.
`docs/process/environments.md` defines what each environment gets.

## Acceptance criteria

- `pnpm --filter @loro/api db:migrate` applies the schema to a clean Postgres; re-running is a
  no-op.
- `db:seed` produces a working account.
- The API still boots and serves with **no** `DATABASE_URL` (in-memory), and says so at startup.
- `/v1/health/ready` returns 503 when Postgres is down or the schema is behind, and 200 otherwise —
  verified by a test that stops the database.
- Sync rows persist across an API restart.
- Deleting a user cascades to every learner row; a verification query returns zero.
- Content responses carry an ETag and a 304 on repeat.
- CI's existing "the built API must serve, not just compile" step still passes
  (`.github/workflows/ci.yml`, bundle job).

## Tests

- Migration test against a throwaway database (Testcontainers, or the existing docker-compose in
  CI).
- Repository contract tests run against **both** implementations — the in-memory one and Postgres —
  from one shared suite. That is what keeps the dev fallback trustworthy.
- Readiness: database up, down, and schema-behind.
- Cascade-delete test.

## Risks

- **Two schemas to keep aligned** (SQLite client, Postgres server). They are deliberately not
  identical — the client stores UI state the server never sees — so document the mapping in
  `data-model.md` and add a test that every syncable field in `fieldPolicy.ts` exists in both.
- **CI time** if every test needs a database. Keep the shared contract suite fast and run the
  Postgres pass in one job.

## Out of scope

Read replicas, pooling at scale, and load testing — M4.
