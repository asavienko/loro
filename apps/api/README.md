# @loro/api

NestJS backend with durable PostgreSQL authentication and tenant-scoped sync, the shared Rust/WASM
merge and HLC, bundled multilingual content, bundled AI scenes, and a gated stub TTS render. Redis,
live AI/ElevenLabs seed audio, billing, account export/deletion jobs, and background workers remain
unimplemented. Cloud ASR and voice cloning are not offered.

## Run

Use Node 22 (`source ~/.nvm/nvm.sh && nvm use 22`), with Cargo on PATH.

```bash
pnpm core-rs:build
pnpm --filter @loro/api dev:up
# Supply DATABASE_URL and auth settings using the encrypted environment workflow.
pnpm --filter @loro/api dev
curl localhost:3000/v1/health/ready
```

`DATABASE_URL` is required for auth and sync. On first use, the API installs its additive schema in
one PostgreSQL transaction protected by an advisory lock. Existing OAuth account UUIDs and refresh
families migrate without deleting their tables. Production startup fails when a configured database
is unavailable or the shared Rust build is absent. A content-only deployment with auth disabled can
start without a database; readiness correctly returns 503. No runtime falls back to memory storage.
The memory repository is only a test adapter.

Configure permitted browser origins through `CORS_ALLOWED_ORIGINS` (comma-separated exact origins)
and the HTTPS origins derived from `AUTH_REDIRECT_URIS`. Bearer authorization does not use cookies.
`AUTH_ENABLED=false` disables all sign-in; `true` enables the configured browser provider flow. See
[Google/Apple setup](../../docs/architecture/google-apple-auth.md). TLS termination and deployment
credentials remain operator setup. See [authentication configuration](src/auth/README.md) for real
provider keys and the HTTPS email delivery protocol; sign-in is unavailable until configured. No
test sends email or contacts Google/Apple.

## Runtime endpoints

All paths have the `/v1` prefix. Content and health remain public.

| Method   | Path                                                           | Behavior                                                        |
| -------- | -------------------------------------------------------------- | --------------------------------------------------------------- |
| GET      | `/health`, `/health/ready`                                     | Liveness and actual WASM/database readiness                     |
| GET      | `/content/manifest`, `/content/diff`, `/content/pack`          | Bundled Spanish/English content                                 |
| GET      | `/content/v2/manifest`, `/content/v2/diff`, `/content/v2/pack` | Bundled supported language pairs                                |
| GET      | `/auth/providers`                                              | Configured Google/Apple browser OAuth providers                 |
| POST     | `/auth/{provider}/start`, `/auth/exchange`                     | PKCE-bound handoff into the shared registered-device session    |
| GET/POST | `/auth/{provider}/callback`                                    | Google query / Apple form callback; one-use app ticket redirect |
| GET      | `/auth/capabilities`                                           | Configured Apple, Google and email choices                      |
| POST     | `/auth/apple`, `/auth/google`                                  | Verified provider ID token and registered installation          |
| POST     | `/auth/magic-link`, `/auth/magic-link/verify`                  | Deliver and verify a ten-minute email code                      |
| POST     | `/auth/refresh`, `/auth/logout`, `/auth/claim`                 | Rotating refresh, session revocation, local-upload correlation  |
| GET      | `/me`, `/auth/me`                                              | Authenticated account and registered device                     |
| POST     | `/sync/push`, `/sync/pull`, `/sync/status`                     | Bearer and matching `X-Loro-Device` required                    |
| POST     | `/ai/scene`                                                    | Bundled, validated roleplay scene                               |
| GET      | `/ai/themes`                                                   | Available bundled themes                                        |
| POST     | `/tts/render`                                                  | Authenticated ElevenLabs; identity JSON only. Default stub 503; `TTS_STUB_RENDER=1` listening-class may omit a bearer locally |
| GET      | `/tts/assets/:sha256`                                          | Authenticated checksum bytes, or unauthenticated when stub-render listening is on |

OAuth uses `@loro/core/api/oauth`; other auth and sync use `@loro/core/api/account` and
`@loro/core/api/sync` schemas at the transport boundary. Push validates the shared envelope, its
500-operation/512-KiB caps, then each operation independently; malformed writes cannot authorize
extra fields such as recording paths or audio. Creating a phrase requires `targetLocale`,
`phraseId`, `source` and `addedAt`; subsequent updates may be partial. Catalog identity is immutable
within a row. New own phrases also require their text under the shared schema.

## Convergence and durability

`src/app.module.ts` selects `PostgresDatabase`, `PostgresSyncRepository` and the bundled AI
provider. Every sync transaction serializes its account with a PostgreSQL advisory lock. Rows,
immutable change revisions, accepted operation receipts and the canonical Rust HLC commit together.
`(user_id,device_id,seq)` is the durable replay key: an exact retry returns its original acceptance
and aliases, while changed content at the same sequence is rejected. A failed transaction commits
none of those records.

Latest-review FSRS state carries its scheduling algorithm as one atomic group. The Rust merge
normalizes complete legacy groups with missing provenance to the recorded old preview policy after
wire receipt hashing. Same-review-time updates use the common group HLC; no synthetic review time is
invented. Historical review logs with incomplete journal metadata remain immutable history rather
than fabricated complete reviews.

Clock stamps more than 24 hours ahead are corrected by the shared Rust helper. Each accepted receipt
stores exact `clock_corrections` by operation sequence and field, and retries return those original
corrections even after server time advances. A device never reconstructs an accepted field clock
from a later retry response time. A durable account limit of 120 sync requests per minute applies
across devices and returns `Retry-After`.

Pull cursors are opaque random tokens persisted with account ownership, the last revision and a
snapshot watermark. Every continuation finishes its original snapshot, so concurrent later pushes
appear on the following cycle without skipping a committed row. A cursor from another account or an
unknown cursor returns `CURSOR_EXPIRED`; the device retains local writes and starts a full pull.

The first stored UUID for `(account,targetLocale,catalog phrase)` becomes canonical. Other IDs are
persisted as aliases, their fields merge through Rust, and both push and pull return alias mappings.
Historical log/Refrain references are normalized while reading; mobile applies aliases before rows
and acknowledgements. A deliberate catalog re-add carries `replaces: {id, deleted_at}` naming an
observed retained tombstone. The API verifies its account, catalog identity and exact deletion time,
then records a new generation under a new UUID. Concurrent re-adds based on the same proof converge;
old IDs and aliases remain tombstoned. An unknown offline duplicate without proof belongs to the
original generation. Tombstone pulls expose only optional `catalog_identity` (catalog ID and target
locale), allowing a fresh device to re-add after observing deletion without returning learner text.
Different target-language courses remain separate. Tombstones, receipts, aliases and cursors are
retained without garbage collection, preserving offline replay; a bounded retention policy needs
explicit device acknowledgement before it can be enabled.

Recorded audio, filesystem paths, credentials and device permission state never enter the sync
allowlist. The error filter logs only route and error class, never SQL/provider exception messages,
payloads or tokens. AI endpoints remain unavailable in account deployments until their separate
budget/ownership boundary is reviewed. Anonymous IDs correlate local uploads and never transfer
another account's server data. The API reports upload required until the device uploads its durable
local state.

## Verification

```bash
pnpm --filter @loro/api typecheck
pnpm --filter @loro/api lint
pnpm --filter @loro/api test
bash scripts/ci-auth-postgres.sh  # creates, tests and removes a disposable local database
pnpm --filter @loro/api build
```

Unit/HTTP tests cover target validation, bearer/device enforcement, tenant isolation, partial
rejections, Rust merge, cursor paging, alias reconciliation and tombstones. The optional real
PostgreSQL suites create isolated schemas and exercise restart persistence, rollback, concurrent
writes/refresh, one-use email codes, committed guess limits and refresh reuse revocation. They skip
explicitly if `LORO_TEST_DATABASE_URL` is absent. Build with esbuild. Host/dev consume workspace
TypeScript as source. The production image bundles `@loro/core` and `@loro/content` into
`dist/main.js` because distroless Node 22.22 will not strip types under `node_modules` after
`pnpm deploy`.

Passing local tests does not configure a deployed database, identity provider, email sender, TLS,
key rotation, backup/restore operations or account deletion/export jobs. Those release tasks remain
visible in [plans 66–68](../../plans/README.md).
