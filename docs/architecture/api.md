# API contract

Target production base: `https://api.loro.app/v1` — REST over HTTPS, JSON. Shared request and
response Zod schemas in `packages/core/src/api/` are the intended authority; that package surface
does not exist yet.

> **Status (2026-07-30): target contract with a small implemented subset.** The deployed-shape
> contract on this page is the destination, not a claim that every route or guard exists. The
> current Nest service has the ten `/v1` routes in the table below. Its wire types are local
> TypeScript interfaces plus partial explicit runtime checks; shared Zod API schemas, auth, request
> headers, rate-limit middleware, Postgres, Redis, streaming, and external providers are not
> implemented. Plan [66](../../plans/66-backend-contract-data-and-security.md) closes the
> contract/data/security foundation before plans
> [67](../../plans/67-anonymous-auth-and-account-lifecycle.md),
> [68](../../plans/68-sync-and-offline-convergence.md), and
> [76](../../plans/76-roleplay-and-live-ai.md) extend it.

## Implemented surface

| Method | `/v1` route             | Current behavior and important limitation                                         |
| ------ | ----------------------- | --------------------------------------------------------------------------------- |
| `GET`  | `/health`               | Liveness: `{status, version}`                                                     |
| `GET`  | `/health/ready`         | Reports content ok and observes WASM merge; returns 503 when merge is unavailable |
| `GET`  | `/content/manifest`     | Manifest built directly from the bundled `@loro/content` catalog                  |
| `GET`  | `/content/diff`         | Empty when current; otherwise returns the whole current catalog, not history      |
| `GET`  | `/content/pack?id=<id>` | Pack selected by query parameter; there is no `/pack/:id` route                   |
| `POST` | `/sync/push`            | Validates entity/field policy and merges through Rust/WASM into process memory    |
| `POST` | `/sync/pull`            | Returns every row; `since` and `limit` are currently ignored                      |
| `POST` | `/sync/status`          | Diagnostic merge availability and in-memory row count                             |
| `POST` | `/ai/scene`             | Bundled/provider scene, validated; JSON only                                      |
| `GET`  | `/ai/themes`            | Bundled theme names plus configured provider name                                 |

No implemented endpoint authenticates a caller, scopes a row to a learner, accepts audio, charges an
entitlement, ingests analytics, or invokes a live AI/TTS provider. Until plans 66–68 land, the sync
routes are a development harness and must not be exposed as a multi-user service.

## Target transport conventions

These conventions become mandatory as the owning route groups land. They are not enforced by the
current app.

|             |                                                                                       |
| ----------- | ------------------------------------------------------------------------------------- |
| Auth        | `Authorization: Bearer <access_jwt>` on everything except `/auth/*` and `/health`     |
| Device      | `X-Loro-Device: <device_id>` required on `/sync/*`                                    |
| Version     | `X-Loro-App: <semver>+<build>` on every request; used for deprecation windows         |
| Idempotency | `Idempotency-Key` on `POST /billing/verify` and `POST /tts/*`                         |
| Errors      | RFC 9457 problem details                                                              |
| Timestamps  | Epoch milliseconds (integers) — except trip dates, which are `YYYY-MM-DD` local dates |
| IDs         | Client-generated UUIDv7 where the client creates the entity                           |
| Pagination  | Opaque cursors, never offsets                                                         |

### Error shape

```jsonc
// 4xx / 5xx
{
  "type": "https://loro.app/errors/schema-too-old",
  "title": "Client schema version is no longer supported",
  "status": 409,
  "detail": "Sync requires app version 1.4.0 or later.",
  "code": "SCHEMA_TOO_OLD", // stable, machine-readable
  "min_app_version": "1.4.0",
}
```

`code` is the contract; `title` and `detail` are for logs and are never shown verbatim to a learner.

| Code                   | Status | Client behaviour                                            |
| ---------------------- | ------ | ----------------------------------------------------------- |
| `UNAUTHENTICATED`      | 401    | Refresh once, then re-auth. **Never drop the outbox**       |
| `FORBIDDEN`            | 403    | Log; a bug if it happens                                    |
| `PLAN_REQUIRED`        | 402    | Show the paywall for the relevant feature                   |
| `SCHEMA_TOO_OLD`       | 409    | Prompt to update; pause sync; local use continues           |
| `RATE_LIMITED`         | 429    | Back off per `Retry-After`                                  |
| `BUDGET_EXCEEDED`      | 429    | Use the bundled fallback silently                           |
| `VALIDATION_FAILED`    | 422    | Dead-letter the op locally and report — never retry blindly |
| `PROVIDER_UNAVAILABLE` | 503    | Bundled fallback                                            |
| `INTERNAL`             | 500    | Backoff                                                     |
| `NOT_FOUND`            | 404    | Log; a missing known route is a client/server contract bug  |

---

## Auth — target, not implemented

### `POST /auth/apple` · `POST /auth/google`

```jsonc
// request
{ "identity_token": "eyJ…", "anon_id": "anon_7f3c…", "device": { "platform": "ios", "app_version": "1.2.0", "push_token": "…" } }

// 200
{
  "access_token": "eyJ…", "expires_in": 900,
  "refresh_token": "rt_…",
  "user": { "id": "usr_…", "plan": "free", "created_at": 1721558400000 },
  "device_id": "dev_…",
  "claim": { "performed": true, "mode": "merge" }   // or "bind" | null
}
```

`claim.mode` tells the client which path ran
([sync-protocol.md](sync-protocol.md#first-sign-in-on-a-device-with-local-data)): `bind` (no
existing data — nothing to merge) or `merge` (existing account — the client must push its full local
state before reporting success).

### `POST /auth/magic-link` → `POST /auth/magic-link/verify`

```jsonc
{ "email": "a@example.com" }                                    // 202, always, regardless of existence
{ "email": "a@example.com", "code": "294817", "anon_id": "…" }   // 200, same shape as above
```

The 202-regardless response prevents account enumeration.

### `POST /auth/refresh`

```jsonc
{ "refresh_token": "rt_…" }
// 200 → new access + rotated refresh. Reuse of a rotated token revokes the whole family.
```

### `POST /auth/claim`

For upgrading an anonymous device _after_ sign-in (rare — normally folded into the sign-in call).

---

## Sync

Protocol semantics: [sync-protocol.md](sync-protocol.md).

### Current sync contract and safety boundary

The current request field HLC is an object, not the target string shown below:

```jsonc
{
  "ops": [
    {
      "seq": 1042,
      "entity": "user_phrase",
      "entity_id": "0197…",
      "op": "upsert",
      "fields": {
        "difficulty": {
          "v": "hard",
          "hlc": { "physical": 1721558400123, "logical": 7, "node_id": "d3f9a1" },
        },
      },
    },
  ],
}
```

`push` caps batches at 500 operations, rejects unknown entities and fields without a declared merge
class per operation, returns `accepted`, `rejected`, `conflicts`, `server_hlc`, and `server_time`,
and requires the built WASM merge for accepted operations. The documented 512 KB limit is not yet
enforced. `pull` accepts `since` and `limit` syntactically but ignores both, returns every row in
the process-wide repository, and always reports `has_more: false`. Those are known development-only
limitations, not permitted production semantics.

The examples below describe the target user-scoped, cursor-paged protocol owned by plans 66–68.

### `POST /sync/push`

```jsonc
{
  "client_hlc": "1721559000000:0003:d3f9a1",
  "ops": [
    {
      "seq": 1042,
      "entity": "user_phrase",
      "entity_id": "up_8f2c…",
      "op": "upsert",
      "fields": {
        "difficulty": { "v": "hard", "hlc": "1721558400123:0007:d3f9a1" },
        "tags": { "v": ["pron"], "hlc": "1721558400123:0008:d3f9a1" },
      },
    },
  ],
}
```

```jsonc
// 200
{
  "accepted": [1042],
  "rejected": [], // [{ "seq": 1043, "code": "VALIDATION_FAILED", "field": "rung" }]
  "server_hlc": "1721559100000:0000:srv",
  "server_time": 1721559100000, // for client clock-skew detection
}
```

Limits: 500 ops or 512 KB per batch. Entities accepted: `user_phrase`, `trip`, `trip_drop`,
`trip_phrase`, `settings`, `refrain_day`, `review_log`, `latency_sample`, `take`, `session`,
`attempt`, `streak_day`.

### `POST /sync/pull`

```jsonc
{ "since": "1721550000000:0000:srv", "limit": 500 }
```

```jsonc
// 200
{
  "changes": [
    {
      "entity": "user_phrase",
      "entity_id": "up_1a…",
      "fields": { "loved": { "v": true, "hlc": "1721559000000:0001:a71c04" } },
      "deleted_at": null,
    },
  ],
  "next": "1721559100000:0002:srv",
  "has_more": false,
  "server_hlc": "1721559100000:0003:srv",
}
```

---

## Content

### Current content behavior

Content is loaded once from `@loro/content`. `lang` defaults to `es-ES` and any other value returns
`VALIDATION_FAILED`. The manifest reports real current counts and pack membership, but does not yet
set `ETag` or `Cache-Control`. `diff` has no version history: `from >= catalog_version` returns no
upserts; any older positive version returns every phrase; `from=0` additionally sets
`full_resync_required: true`. Pack lookup is `GET /content/pack?id=<id>`, and its response is
`{id, label, promised_count, phrases}`.

The cache headers, checksums, historical diffs, object storage, and path-parameter pack route below
are target behavior for the versioned content pipeline.

### `GET /content/manifest?lang=es-ES`

```jsonc
// 200 · ETag + Cache-Control: public, max-age=3600
{
  "catalog_version": 47,
  "lang": "es-ES",
  "phrase_count": 612,
  "packs": [{ "id": "cafe", "label": "Café & ordering", "emoji": "☕", "count": 8, "sha256": "…" }],
  "scenarios": [{ "id": "dinner", "label": "Dinner reservation", "emoji": "🍽", "count": 4 }],
  "audio_base": "https://cdn.loro.app/audio/",
  "min_app_version": "1.0.0",
}
```

### `GET /content/diff?lang=es-ES&from=44`

```jsonc
// 200
{
  "from": 44,
  "to": 47,
  "upserts": [
    {
      "id": "cafe1",
      "es": "Me pone un cortado, por favor",
      "en": "A cortado, please",
      "theme": "Café",
      "emoji": "☕",
      "resp": "meh PO-neh oon kor-TAH-doh por fah-VOR",
      "resp_ipa": "me ˈpone un koɾˈtaðo poɾ faˈβoɾ",
      "words": [{ "es": "Me pone", "gloss": "Could you give me", "say": "me pone" }],
      "example": { "es": "…", "en": "…" },
      "hint": null,
      "note": null,
      "register": "neutral",
      "cefr": "A1",
      "audio": { "uri": "sha256/ab12…", "sha256": "ab12…", "ms": 1840 },
      "f0_native": [0.34, 0.35, 0.37],
      "syl": [{ "t": "Me", "stress": 0.3, "dur": 0.7 }],
    },
  ],
  "deprecations": [{ "id": "old7", "deprecated_by": "cafe9" }],
  "full_resync_required": false, // true when the diff would exceed the full download
}
```

`full_resync_required` avoids a pathological case: a learner four months behind should download the
catalog once, not a diff larger than the catalog.

### `GET /content/pack/:id?lang=es-ES`

Full pack contents, used for trip prefetch. Same phrase shape as above.

### Audio

Not served by the API. `GET https://cdn.loro.app/audio/sha256/<hash>.m4a` — immutable,
content-addressed, `Cache-Control: public, max-age=31536000, immutable`. `mfcc_ref` blobs (for the
labs) live under `/ref/sha256/<hash>.bin` and are fetched only when the labs are enabled.

---

## AI

Guardrails, prompts, and caching: [ai-services.md](ai-services.md).

### Current scene behavior

`POST /ai/scene` currently reads only optional `theme` (and accepts but does not use `level`). It
returns JSON with `{scene_id, cached, fallback, scene}`. The registered `stub` provider serves the
bundled Café/Hotel scenes. An unregistered `AI_PROVIDER` logs a warning and serves bundled content;
provider output is validated before serving. There is no streaming, cache, rate limit, budget,
repair pass, persistence, live provider, tag profile, phrase selection, trip adaptation, coach,
translate, enrich, or chat-turn route yet. `GET /ai/themes` returns `{themes, provider}`.

The richer request/streaming response and remaining AI endpoints below are target behavior.

### `POST /ai/scene` — roleplay

```jsonc
{
  "theme": "Café",
  "level": "some",
  "tag_profile": { "pron": 4, "remember": 2, "useful": 6, "words": 1 },
  "phrase_ids": ["cafe1", "cafe4", "srv1"], // catalog ids the scene should exercise
  "trip": { "city": "Madrid", "type": "vacation" },
  "locale": "es-ES",
}
```

```jsonc
// 200 — text/event-stream when Accept: text/event-stream, else JSON
{
  "scene_id": "scn_a1b2",
  "cached": false,
  "scene": {
    "place": "Café Central",
    "city": "Madrid",
    "emoji": "☕",
    "role": "Camarero",
    "turns": [
      {
        "npc": { "es": "¡Buenas! ¿Qué le pongo?", "en": "Hi there! What can I get you?" },
        "options": [
          {
            "es": "Un cortado, por favor.",
            "en": "A cortado, please.",
            "best": true,
            "tip": "Perfecto — short, and exactly how locals order.",
            "phrase_id": "cafe1",
          },
          {
            "es": "¿Qué me recomienda?",
            "en": "What do you recommend?",
            "tip": "Nice opener — it invites the waiter to help.",
          },
          {
            "es": "¿Tienen leche de avena?",
            "en": "Do you have oat milk?",
            "tip": "Good stretch — \"de avena\" = oat.",
          },
        ],
      },
    ],
    "closer": { "es": "¡Gracias! ¡Que vaya bien!", "en": "Thank you! Have a good one!" },
  },
}
```

Response invariants, validated server-side before the response leaves
([ai-services.md](ai-services.md#output-validation)): 3–4 turns; exactly 3 options per turn;
**exactly one `best: true` per turn**; every option has a `tip`; all Spanish is `es-ES`; no option
exceeds 12 words.

### `POST /chat/turn` — guarded open chat, target

The open-chat surface is specified at `Loro Chat.dc.html:95–328`; its inspector reads the same turn
records at `Loro Chat.dc.html:331–449`. The endpoint accepts bounded text context only:

```jsonc
{
  "thread_id": "cht_a1b2",
  "topic_id": "cafe",
  "pace": "natural",
  "locale": "es-ES",
  "turns": [
    { "id": "trn_1", "speaker": "loro", "text": "¿Qué te apetece tomar?" },
    { "id": "trn_2", "speaker": "learner", "text": "Un cortado, por favor." },
  ],
  "request_id": "req_7f3a",
}
```

The server caps turn count and text length, treats every learner field as untrusted data, applies
identity/entitlement, rate, concurrency and budget guards, and returns validated structured text:

```jsonc
{
  "request_id": "req_7f3a",
  "provenance": "live",
  "reply": {
    "id": "trn_3",
    "es": "Marchando. ¿Solo o con leche?",
    "en": "Coming up. Black or with milk?",
  },
  "suggestions": [
    {
      "id": "sg_1",
      "es": "Con leche, por favor.",
      "en": "With milk, please.",
      "register": "neutral",
    },
  ],
  "corrections": [],
}
```

Audio bytes, file paths, native buffer handles and voice embeddings are structurally absent. Voice
input is transcribed on-device before this request, and the raw recording is released locally. The
API neither writes raw thread text to the sync store nor emits it to logs/telemetry. Provider
retention must satisfy the separately recorded privacy decision before live chat is release-enabled.
On timeout, invalid output, safety rejection, budget exhaustion or offline use, the client continues
from the versioned authored topic/reply graph; it does not wait out the prototype's fixed 1.2-second
reply timer (`Loro Chat.dc.html:586–596`). Personalized turns are not shared-cache material, though
stable prompts and authored/provider-independent resources may be cached.

### `POST /ai/coach`

A coach note for a specific chosen line, when the scene's pre-generated tip doesn't apply
(free-speech replies).

### `POST /ai/translate`

```jsonc
{ "lines": ["Una caña, por favor", "¿Está incluida la propina?"], "source": "es", "target": "en" }
// 200
{ "results": [{ "es": "Una caña, por favor", "en": "A beer, please", "confidence": 0.97 }] }
```

Used by Import and Capture. `confidence < 0.7` is surfaced to the learner as "check this
translation" rather than being silently accepted.

### `POST /ai/enrich` — internal, not learner-facing

Drafts `resp`, `words`, `example`, and `hint` for authoring. Requires a staff token; every output is
human-reviewed before merge ([`process/content-authoring.md`](../process/content-authoring.md)).

---

<a id="tts"></a>

## TTS — target, not implemented

### `POST /tts/render`

```jsonc
{ "text": "Una caña, por favor", "lang": "es-ES", "phrase_hash": "9f2a…" }
// 200
{ "uri": "sha256/cd34…", "sha256": "cd34…", "ms": 1420, "cached": true }
```

Content-addressed by `(text, lang, voice)`, so a phrase a thousand learners typed is rendered once.

There is deliberately no voice-clone endpoint. Recorded learner audio never leaves the device, so a
server route accepting a sample would violate [ADR-0011](adr/0011-analytics-and-privacy.md),
regardless of consent or retention settings.

---

<a id="billing"></a>

## Billing — target, not implemented

### `POST /billing/verify`

```jsonc
{ "platform": "ios", "receipt": "…", "product_id": "loro.plus.yearly" }
// 200
{ "plan": "plus", "expires_at": 1753094400000, "grace_until": 1753699200000, "source": "app_store" }
```

`grace_until` is what lets a learner keep Plus features while offline or during a billing hiccup —
important when they're abroad.

### `POST /billing/webhook` — provider → us, signature-verified

---

<a id="account"></a>

## Account — target, not implemented

### `GET /account/export`

```jsonc
// 202 — the export is built by a worker
{ "job_id": "exp_…", "status": "queued" }
// GET /account/export/:job_id → 200 { "status": "ready", "url": "signed-url", "expires_in": 3600 }
```

Contains every phrase, rating, tag, note, log entry, and trip — JSON, documented, re-importable.

### `DELETE /account`

```jsonc
{ "confirm": "DELETE" }
// 202 { "scheduled_for": 1721644800000 }   // 24h window during which sign-in cancels it
```

Hard delete, cascading, verified by a follow-up job.

---

## Analytics — target, not implemented

### `POST /analytics/batch`

```jsonc
{
  "events": [
    {
      "event_id": "evt_…",
      "name": "phrase_produced",
      "client_ts": 1721558400000,
      "props": {
        "phrase_id": "cafe1",
        "engine": "refrain",
        "mode": "cold",
        "latency_ms": 820,
        "verified_by": "asr",
      },
    },
  ],
}
// 202 { "accepted": 1, "rejected": [] }
```

Max 500 events/batch. `event_id` gives idempotent offline replay. Events whose names aren't in the
documented taxonomy ([metrics.md](../product/metrics.md#event-taxonomy)) are **rejected**, not
stored — that's what keeps the taxonomy real.

---

## Health

Current liveness is `GET /health` → `200 {"status":"ok","version":"…"}`. Current readiness is
`GET /health/ready`: `checks.content` is `ok`, `checks.merge` reflects actual WASM availability, and
the response is 503 with `status: "degraded"` when merge is unavailable. Postgres, Redis, object
storage, and providers are absent and therefore are not readiness checks yet.

---

<a id="rate-limits"></a>

## Target rate limits — declared, not enforced

The values below exist as constants in `src/common/errors.ts`; no guard or middleware currently
applies them and no rate-limit response headers are emitted. The source still contains an unused
legacy `ttsVoiceClone` constant; it does not authorize a route that would violate the on-device
audio rule and should disappear when rate limiting is implemented.

| Endpoint group               | Per user            | Per IP            |
| ---------------------------- | ------------------- | ----------------- |
| `/auth/*`                    | 10 / 15 min         | 30 / 15 min       |
| `/sync/*`                    | 120 / min           | 600 / min         |
| `/content/*`                 | 60 / min            | 600 / min         |
| `/ai/scene`                  | 20 / hour, 60 / day | 200 / hour        |
| `/chat/turn`                 | Decision required   | Decision required |
| `/ai/coach`, `/ai/translate` | 60 / hour           | 400 / hour        |
| `/tts/render`                | 100 / day           | 500 / day         |
| `/analytics/batch`           | 60 / min            | 600 / min         |

Responses carry `X-RateLimit-Limit`, `-Remaining`, `-Reset`, and `Retry-After` on 429. The chat row
is deliberately not a guessed number: measured cost/latency and the release entitlement/budget
decision must set both caps before the endpoint is enabled.

---

## Versioning and deprecation

- The path carries the major version (`/v1`). A breaking change means `/v2` with both live.
- Additive changes ship in place; clients must ignore unknown fields (enforced by the Zod schemas
  using `.passthrough()` on response parsing).
- `X-Loro-App` drives a **90-day deprecation window** for a minimum version. Beyond it, sync returns
  `SCHEMA_TOO_OLD` and the client prompts to update while continuing to work locally.
- The API is versioned independently of the catalog. `catalog_version` is data, not API surface.
