# API contract

**Status: shared contracts and an implemented auth/sync API exist.** Plan 85 added Zod schemas,
inferred types, examples, an integration inventory and generated OpenAPI 3.1 documents. The running
Nest API uses PostgreSQL for accounts and tenant-scoped sync, WASM merge, and bundled AI/content
stubs. Billing, live Anthropic, account export/erasure and OS background sync remain plan-owned.

- [Current OpenAPI](openapi.current.json): the observed development surface.
- [Target OpenAPI](openapi.target.json): planned routes plus clearly marked gated drafts.
- [Contract guide](api-contracts.md): imports, generation, recovery semantics, runtime refinements,
  migration map and explicit draft decisions.
- [Integration inventory](backend-integration-inventory.md): every authored screen and supporting
  service, requirements, source references, offline behavior and owning plan.

`packages/core/src/api/` and its typed operation registries are the wire authority. This page is a
navigation guide; request/response fields and examples are generated rather than copied here.

## Implemented surface

Current base: `http://localhost:3000/v1`. Health and bundled content are unauthenticated. Auth and
sync require a bearer session and device binding. Sync is tenant-scoped PostgreSQL, **not** a global
in-memory harness.

| Method | Route                  | Success   | Current behavior                                            |
| ------ | ---------------------- | --------- | ----------------------------------------------------------- |
| GET    | `/health`              | 200       | Liveness                                                    |
| GET    | `/health/ready`        | 200 / 503 | Content/WASM checks; 503 is JSON checks, not a problem body |
| GET    | `/content/manifest`    | 200       | Bundled catalog counts; no ETag/cache headers               |
| GET    | `/content/diff`        | 200       | Whole catalog for older versions; no history                |
| GET    | `/content/pack?id=...` | 200       | Query-based lookup; unknown pack 422                        |
| POST   | `/sync/push`           | 201       | Per-operation merge/rejection; structured field HLCs        |
| POST   | `/sync/pull`           | 201       | Tenant-scoped page; honours `since` / `limit` / `has_more`  |
| POST   | `/sync/status`         | 201       | Global row count and WASM diagnostic                        |
| POST   | `/ai/scene`            | 201       | Stub/bundled JSON, optional level ignored                   |
| GET    | `/ai/themes`           | 200       | Bundled themes and configured provider name                 |

These statuses and bodies are verified over HTTP. Target schemas do not silently change them.

## Target transport conventions

Target base: `https://api.loro.app/v1`. All paths below are relative to `/v1`.

- Bearer identity for learner services. Sign-in/magic-link/refresh and health probes are public;
  **claim and draft logout are authenticated**, despite their `/auth` prefix. Staff enrichment
  requires verified staff authorization. The webhook signature protocol remains unresolved.
- `X-Loro-App: <semver>+<build>` except operational probes; sync also requires the registered
  `X-Loro-Device`. Principal/account ownership is derived server-side.
- Idempotency is explicit per operation. Sync uses principal/device/sequence; purchase/TTS/chat and
  claim use declared request keys. Refresh rotation has different replay semantics.
- Integer epoch milliseconds, real local calendar dates for trip/day keys, UUIDv7 for learner rows,
  opaque resource/account/device IDs, and opaque cursors. See the migration guide for the settings
  singleton and day-row keys.
- Strict typed requests and additive-compatible responses where safe. Privacy-sensitive payloads
  remain allowlisted. Envelope validation preserves per-item rejection for sync and analytics.

### Error shape

`ProblemSchema` represents RFC 9457 `application/problem+json`. `code` is machine-readable;
`title`/`detail` are not learner-facing copy. Readiness intentionally has a separate response.

| Code                 | Status | Recovery                                                       |
| -------------------- | ------ | -------------------------------------------------------------- |
| UNAUTHENTICATED      | 401    | Refresh once, then re-authenticate; retain outbox              |
| FORBIDDEN            | 403    | Stop/review authorization; do not retry blindly                |
| PLAN_REQUIRED        | 402    | Approved entitlement UX; pricing remains gated                 |
| SCHEMA_TOO_OLD       | 409    | Required minimum app version; local use continues              |
| CURSOR_EXPIRED       | 409    | Target-only: retain local state/outbox and rebootstrap         |
| RATE_LIMITED         | 429    | Respect Retry-After                                            |
| BUDGET_EXCEEDED      | 429    | Bundled fallback                                               |
| VALIDATION_FAILED    | 422    | Correct/quarantine failed item; preserve unrelated work        |
| PROVIDER_UNAVAILABLE | 503    | Bundled fallback or leave optional assistance unavailable      |
| INTERNAL             | 500    | Back off; no internal details                                  |
| NOT_FOUND            | 404    | Missing resource or cross-user identifier; preserve local work |

The current framework can emit INTERNAL with a framework status (e.g. malformed JSON 400). The
current schema preserves this observation; target problems enforce the code/status mapping.

## Auth

Planned: `POST /auth/apple`, `/auth/google`, `/auth/magic-link`, `/auth/magic-link/verify`,
`/auth/refresh`, and authenticated `/auth/claim`. Anonymous local use needs no request. An `anon_id`
is correlation, never proof of access to cloud rows. Device identity and account identity are
separate. Interrupted sign-in/claim must preserve all learner data. Plan 67 owns implementation.

## Sync

Planned `POST /sync/push` and `/sync/pull` use encoded HLC strings, per-entity values, complete FSRS
groups, explicit tombstones, tenant-bound durable paging and idempotent replay. Sync remains outside
the practice hot path. Draft trip entities are not enabled through stable schemas. Plans 54/59/66–68
own migration, atomic storage and convergence. See [sync-protocol.md](sync-protocol.md) and the
[wire migration map](api-contracts.md#migration-map).

## Content

Planned `GET /content/manifest`, `/content/diff`, and `/content/pack/{id}` distribute versioned
catalog data. The manifest describes checksummed full catalog/resources: pack membership, scenarios,
draft drop/chat resources, model audio and lab references. Full resources/audio are CDN downloads,
not learner uploads. Cache validation, history, publishing and licensed assets belong to plan 61.

## AI

Planned `POST /ai/scene`, `GET /ai/themes`, `POST /ai/coach`, `/ai/translate`, and staff-only
`/ai/enrich`. Scene output is fully validated before a JSON response or terminal SSE event. Optional
assistance falls back to authored content or an explicit unavailable result. Confidence is real or
null; low/unknown confidence requires review. Provider safety/quality cannot be proved by schemas.

Draft `POST /chat/turn` covers bounded text, suggestions and inspector feedback. Corrections carry
matching evidence; stale responses cannot attach to another request. Raw threads remain private and
local. Release/budget/retention gates Q-16/Q-18–Q-20 remain open; plan 82 owns service delivery. See
[ai-services.md](ai-services.md).

## TTS

Draft `POST /tts/render` accepts **text only**, with a checksum-addressed model-audio **metadata**
response (download URL + `sha256` + `ms`). Q-15 leaning pins live in core constants; live spend
still needs a key, and pronunciation review remains before calling clips production-quality.
Listening-class multi-voice requests (plan 99) need an additive voice id and `assetClass` so they
cannot collide with catalog reference audio; the JS client must not receive audio bytes. Device TTS
is the in-app fallback on a miss. No recorded-audio, ASR-upload or voice-clone endpoint exists or is
authorized. Share-out-of-app of neural audio is Q-22, not this route.

## Billing

Draft purchase verification, entitlement read, restore and webhook boundaries belong to plan 74.
Q-08/Q-12 must choose packaging/provider and the proof/signing/grace protocol. The webhook request
schema is intentionally `never`: there is no pretend universal provider payload. Cached Survival
content remains usable during billing/network outages.

## Account

Planned `GET /account/export`, `GET /account/export/{job_id}` and `DELETE /account`. Job status
covers queued/running/ready/failed/expired. The existing GET creation convention is retained with
no-store and pending-job reuse. Cloud exports are combined with private local data on-device.
Repeated deletion requests preserve the original scheduled time; sign-in during the documented 24h
window cancels deletion. Plan 67 owns erasure propagation and resurrection prevention.

Account read/device list/revoke/logout are additional **draft** transport proposals under plan 67;
no route is implemented by publishing its schema.

## Analytics

Planned `POST /analytics/batch` validates the
[metrics taxonomy](../product/metrics.md#event-taxonomy), rejects unknown events/properties,
deduplicates event IDs and injects principal/server time. No phrase text, thread text, correction,
transcript or audio is allowed. Consent, salt handling, retention and queue delivery remain plan 71.
`GET /config` is draft; Q-05 still blocks experiment activation.

## Rate limits

The existing backend constants remain planned defaults, not deployed guards:

| Group              | Per user               | Per IP                 |
| ------------------ | ---------------------- | ---------------------- |
| Auth               | 10 / 15 min            | 30 / 15 min            |
| Sync               | 120 / min              | 600 / min              |
| Content            | 60 / min               | 600 / min              |
| AI scene           | 20 / hour, 60 / day    | 200 / hour             |
| AI coach/translate | 60 / hour              | 400 / hour             |
| TTS                | 100 / day              | 500 / day              |
| Analytics          | 60 / min               | 600 / min              |
| Chat               | Q-18 decision required | Q-18 decision required |

Target 429 responses declare Retry-After and rate headers. Body/array limits are contract metadata
and schemas; middleware still needs to enforce byte limits. The unused legacy voice-clone limit is
not authorization to implement such a route.

## Versioning and deprecation

- `/v1` is the current major. A deployed breaking change requires an explicit compatibility
  migration or `/v2` with both versions live. The two generated files are **not** two running APIs.
- Additive changes use tolerant response parsing where safe; privacy allowlists remain deliberate
  exceptions. Current-to-target breaking differences are recorded, never silently applied.
- The planned minimum-app policy retains the documented 90-day deprecation window, driven by
  `X-Loro-App`. Unsupported sync clients receive SCHEMA_TOO_OLD while continuing local use.
- Catalog versioning is independent of API versioning. OpenAPI generation/checks run locally and
  through `pnpm check`; generated files must not be hand-edited.
