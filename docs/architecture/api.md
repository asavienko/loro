# API contract

`https://api.loro.app/v1` — REST over HTTPS, JSON. Request and response types are generated from Zod
schemas in `packages/core/src/api/`, so the client and server cannot drift.

**Conventions**

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

---

## Auth

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

## TTS

### `POST /tts/render`

```jsonc
{ "text": "Una caña, por favor", "lang": "es-ES", "phrase_hash": "9f2a…" }
// 200
{ "uri": "sha256/cd34…", "sha256": "cd34…", "ms": 1420, "cached": true }
```

Content-addressed by `(text, lang, voice)`, so a phrase a thousand learners typed is rendered once.

### `POST /tts/voice-clone` — v2, consent-gated

```jsonc
// multipart: sample (audio/m4a) + text + lang
// 402 if plan doesn't include it; 403 if voice_clone_consent is not recorded
{ "uri": "signed-url", "expires_in": 300, "retained": false }
```

**The only endpoint in the entire API that accepts learner audio.** Requires `voice_clone_consent`,
is per-use, and `retained: false` is a contract — the sample is processed and deleted within the
request ([ADR-0011](adr/0011-analytics-and-privacy.md)).

---

## Billing

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

## Account

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

## Analytics

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

`GET /health` → `200 {"status":"ok"}` (liveness) · `GET /health/ready` → dependency checks
(readiness, gates the blue-green cutover).

---

## Rate limits

| Endpoint group               | Per user            | Per IP      |
| ---------------------------- | ------------------- | ----------- |
| `/auth/*`                    | 10 / 15 min         | 30 / 15 min |
| `/sync/*`                    | 120 / min           | 600 / min   |
| `/content/*`                 | 60 / min            | 600 / min   |
| `/ai/scene`                  | 20 / hour, 60 / day | 200 / hour  |
| `/ai/coach`, `/ai/translate` | 60 / hour           | 400 / hour  |
| `/tts/render`                | 100 / day           | 500 / day   |
| `/tts/voice-clone`           | 20 / day            | 60 / day    |
| `/analytics/batch`           | 60 / min            | 600 / min   |

Responses carry `X-RateLimit-Limit`, `-Remaining`, `-Reset`, and `Retry-After` on 429.

---

## Versioning and deprecation

- The path carries the major version (`/v1`). A breaking change means `/v2` with both live.
- Additive changes ship in place; clients must ignore unknown fields (enforced by the Zod schemas
  using `.passthrough()` on response parsing).
- `X-Loro-App` drives a **90-day deprecation window** for a minimum version. Beyond it, sync returns
  `SCHEMA_TOO_OLD` and the client prompts to update while continuing to work locally.
- The API is versioned independently of the catalog. `catalog_version` is data, not API surface.
