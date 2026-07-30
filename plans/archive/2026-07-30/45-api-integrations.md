# Plan — API and provider integrations

- **Requirement IDs:** `AI-01`…`AI-05` · `AS-01`…`AS-06` · `F-01`…`F-04`, `F-07` · `P2-09`, `P2-15`
  · `P3-20`…`P3-28` · `P3A-01`…`P3A-10` · `P3C-*`, `P3D-*` · `N-01`…`N-04` · monetization (`Q-08`),
  store mechanics (`Q-12`)
- **Milestone:** M1 → M5 (it spans the whole roadmap; see the phase table in §10)
- **Size:** L — but it is a **programme, not a single plan.** See "How this relates to the focused
  plans" below before starting anything in it
- **Status:** proposal. Nothing in here is built yet beyond what the "Where we actually are" table
  records

**Scope.** Every outbound integration the product needs: the LLM (Anthropic), text-to-speech,
speech-to-text, plus the auth, billing, storage, and observability providers that the AI and speech
paths depend on. For each: the contract, the code that has to exist, the credentials, and the
verification. Ends with a single credential inventory and a sequencing plan.

## How this relates to the focused plans

This plan predates the rest of `plans/` and is organised **by provider**, while every other plan is
organised **by deliverable**. That makes it the right place to look up a contract, a credential, or
a vendor decision — and the wrong place to work from directly, because five of its sections cover
ground a focused plan also covers at more depth.

Where they overlap, **the focused plan is authoritative for what to build; this plan is
authoritative for what to send over the wire.** Concretely:

| This plan                             | Focused plan                                                                                                                 | Split                                                                                                                                                 |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| §3.3 Auth                             | [auth-anonymous-first.md](14-auth-anonymous-first.md)                                                                        | Focused plan owns the anonymous-first model and reconciliation; this one owns JWKS verification, token shapes, and the magic-link provider gap (§7.3) |
| §3.4 Persistence, cache, queue        | [api-postgres-persistence.md](13-api-postgres-persistence.md), [security-hardening-api.md](39-security-hardening-api.md)     | Focused plans own schema, migrations, repositories, and guards; this one owns the Redis/BullMQ/throttler wiring list                                  |
| §5 TTS                                | [content-scale-to-600.md](36-content-scale-to-600.md), [audio-playback-module.md](11-audio-playback-module.md)               | **Read §5.1's D7 against `content-scale-to-600.md` §2** — that plan owns the prior talent-vs-TTS question D7 assumes away                             |
| §6 STT + `loro-audio` / `loro-speech` | [asr-speech-module.md](12-asr-speech-module.md), [native-toolchain-and-dev-client.md](09-native-toolchain-and-dev-client.md) | Focused plans own the module APIs, the by-handle privacy contract, and the toolchain; this one owns the cloud-ASR decision (D4/Q-15)                  |
| §7.1 Billing                          | [monetization-paywall.md](40-monetization-paywall.md)                                                                        | Focused plan owns pricing and the paywall (blocked on Q-08); this one owns the store-mechanics credentials (Q-12)                                     |
| §7.4 Observability                    | [observability-and-analytics.md](32-observability-and-analytics.md)                                                          | Focused plan owns what gets measured; this one owns the DSN/OTEL credential inventory                                                                 |

Two things in here have **no** focused-plan counterpart and are only specified here: **§3.1 the
shared `packages/core/src/api/` contract package** (the highest-leverage missing piece in the repo,
and a dependency of the typed client, the sync client, and every screen that talks to the API) and
**§4 the Anthropic integration itself**. Start there if you start here.

---

## 1 · Where we actually are

Verified against the tree, not the docs.

| Thing                                                                   | State                                                                                                                |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `@anthropic-ai/sdk@^0.115.0`                                            | **Declared as a dependency, never imported.** No file in `apps/api/src` references it                                |
| `AiService`                                                             | Two hand-authored fallback scenes + `validate()`. `scene()` logs a warning and returns the fallback for any provider |
| `POST /ai/scene`                                                        | Exists, unauthenticated, no rate limit, no cache, no budget, ignores `level`/`tag_profile`/`phrase_ids`/`trip`       |
| `GET /ai/themes`                                                        | Exists (not in `api.md` — undocumented surface)                                                                      |
| `/ai/coach`, `/ai/translate`, `/ai/enrich`                              | **Do not exist**                                                                                                     |
| `/tts/*`                                                                | **Does not exist.** No TTS provider chosen anywhere in the docs                                                      |
| `/auth/*`, `/billing/*`, `/account/*`, `/analytics/*`                   | **Do not exist**                                                                                                     |
| `packages/core/src/api/`                                                | **Does not exist**, although `api.md` says every request/response type is generated from Zod schemas there           |
| HTTP client in the app                                                  | **None.** No `fetch`, no `EXPO_PUBLIC_API_URL` read, anywhere in `apps/mobile`                                       |
| `ioredis`, `drizzle-orm`, `bullmq`, `@nestjs/throttler`, `jose`, `pino` | Declared dependencies, **zero imports**                                                                              |
| `apps/api/src/workers/`                                                 | **Does not exist**                                                                                                   |
| `packages/content/src/{enrich,render,publish}.ts`                       | **Do not exist**, although `package.json` declares `enrich`/`render`/`publish` scripts pointing at them              |
| `packages/core-rs/src/asr.rs`, `src/dsp/`                               | **Exist** (233 / 696 lines) with inline tests — matching and DSP maths are further along than the plumbing           |
| `modules/loro-audio`, `modules/loro-speech`                             | **Do not exist.** No native module in the repo; `app.config.ts` has the purpose strings and background modes only    |

**The shape of the problem:** the Rust maths and the design are ahead; every wire is missing.
Nothing in §4–§7 can be built before §3.

---

## 2 · Ten decisions this plan takes, and why

Read this section first — it is where the plan diverges from what the docs currently say. Each is a
recommendation with the cost of the alternative stated; each needs an owner's yes.

| #   | Decision                                                                                                                                 | Why                                                                                                                                                                                                                                                                                                          |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | **Drop prompt caching from the scene cost model.** Keep the Redis/Postgres response cache as the only cache                              | `claude-sonnet-5`'s minimum cacheable prefix is **1024 tokens**; the drafted scene system prompt is ~330. It will silently never cache (`cache_creation_input_tokens: 0`). Even if it did, the cacheable span is just that system prompt: 330 × (3.00 − 0.30)/1e6 ≈ $0.0009 against a $0.0171 scene, **~5%** |
| D2  | **Use structured outputs (`output_config.format`), not "Output: JSON. Nothing else."**                                                   | Guarantees a parseable, schema-shaped response; removes a whole class of repair attempt. Pedagogical invariants still validate server-side — JSON Schema can't express "exactly one `best`" or "≤12 words". **The derived schema must be reduced to the supported keyword set first — see §3.1**             |
| D3  | **`/ai/scene` streams the _validated_ scene, never raw provider output**                                                                 | `ai-services.md`'s own pipeline validates and persists _before_ streaming. Streaming provider tokens would put an unvalidated scene on a learner's screen, which rule 3 of ADR-0010 forbids. SSE stays in the contract as a progressive reveal                                                               |
| D4  | **Cut cloud ASR from v1 and v1.1.** Ladder becomes on-device → language-pack prompt → reveal mode                                        | It needs an audio-accepting endpoint, which contradicts ADR-0011's "exactly one endpoint accepts audio" invariant and its P0 egress canary. ADR-0005's own revisit trigger points at an optional Whisper download, not cloud. See §6.4                                                                       |
| D5  | **`/ai/enrich` becomes a CLI (`pnpm content:enrich`), not an HTTP endpoint**                                                             | The only caller is the content pipeline in CI. An endpoint means inventing a staff token type and exposing a paid model on the public surface for zero benefit                                                                                                                                               |
| D6  | **Catalog audio is public and immutable on the CDN. No signed URLs**                                                                     | It's P5 public content by `security-privacy.md`'s own classification and content-addressed by `sha256`. `backend.md`'s `audio.service.ts # signed CDN URLs` is wrong. Signing stays for `/account/export` artefacts only                                                                                     |
| D7  | **TTS provider: Google Cloud TTS `es-ES-Neural2` or Azure `es-ES-ElviraNeural`**, chosen by a blind listening test on the 31-phrase seed | Both pin voice + model version, both emit 24 kHz mono, both are ~$16/1M chars. ElevenLabs is more natural but its model versions roll, which breaks "one voice per variant, forever". See §5.1                                                                                                               |
| D8  | **Never set `output_config.effort` or `thinking` on `claude-haiku-4-5`**                                                                 | `effort` **errors** on Haiku 4.5. Coach and translate run plain                                                                                                                                                                                                                                              |
| D9  | **Never set `temperature` / `top_p` / `top_k` on any call**                                                                              | Non-default sampling params are **rejected with a 400** on `claude-sonnet-5` and `claude-opus-5`. Steer with the prompt                                                                                                                                                                                      |
| D10 | **Budget accounting debits measured `usage`, never an estimate**                                                                         | Rule 2 ("every number is real") applies to our own numbers too. `countTokens` gates admission; `response.usage` debits the ledger                                                                                                                                                                            |

---

## 3 · Phase 0 — the foundation every integration sits on

Nothing in §4–§7 is buildable without these. This is the bulk of the work and it is not
integration-specific.

### 3.1 The shared contract — `packages/core/src/api/`

`api.md` claims this exists. It doesn't. It is the single highest-leverage missing piece: it is what
stops the client and server drifting, and it is imported by both.

```
packages/core/src/api/
├── index.ts            # barrel
├── problem.ts          # RFC 9457 ProblemDetails + the LoroErrorCode union (already in apps/api/src/common/errors.ts — move it here)
├── headers.ts          # X-Loro-Device, X-Loro-App, Idempotency-Key constants + parsers
├── auth.ts             # AppleSignInRequest, GoogleSignInRequest, MagicLinkRequest, RefreshRequest, ClaimRequest, TokenResponse
├── sync.ts             # PushRequest/Response, PullRequest/Response, Op, FieldValue, Hlc
├── content.ts          # ManifestResponse, DiffResponse, PackResponse
├── ai.ts               # SceneRequest/Response, Scene, SceneTurn, SceneOption, CoachRequest/Response, TranslateRequest/Response
├── tts.ts              # RenderRequest/Response, VoiceCloneRequest/Response
├── billing.ts          # VerifyRequest/Response, WebhookPayload
├── account.ts          # ExportJob, DeleteRequest
├── analytics.ts        # BatchRequest/Response, Event (allowlist-typed per metrics.md)
└── jsonSchema.ts       # z.toJSONSchema() wrappers for the structured-output schemas
```

Rules, enforced by the existing eslint boundary rule and by review:

- **Zod is the single source of truth.** Structured-output JSON Schemas are _derived_ with
  `z.toJSONSchema()` (zod 4, already the pinned version), never hand-written. Two definitions would
  drift and the drift would be a 400 in production.
- **But a raw `z.toJSONSchema()` output is not a valid structured-output schema.** Structured
  outputs accept a subset of JSON Schema: `minLength` / `maxLength`, numeric bounds (`minimum`,
  `maximum`, `multipleOf`), array-length constraints, and recursive schemas are **all unsupported**,
  and every object **must** carry `additionalProperties: false`. The caps this plan relies on are
  exactly those keywords — 200 chars per phrase, 12 phrases per request (§4.6), "exactly 3 options"
  (§4.5) — so the naive derivation emits a schema the API rejects. Two consequences, both in
  `jsonSchema.ts`:
  - Use the SDK's `zodOutputFormat()` (`@anthropic-ai/sdk/helpers/zod`), which strips the
    unsupported keywords and re-validates them client-side, rather than passing `z.toJSONSchema()`
    straight through. Where a schema is built by hand, strip them explicitly and unit-test that the
    emitted schema contains none of them.
  - Derive from a `.strict()` variant of the schema so the output carries
    `additionalProperties: false` on every object.

  **The caps do not disappear** — they stay enforced by the Zod parse at the controller boundary
  (which is where §4.6 puts them anyway) and by `guard.validateScene()`. The schema constrains
  shape; Zod constrains values. Keeping both is the point.

- **Two directions, two strictness rules — don't collapse them.** The **model-facing** schema
  (derived for `output_config.format`) is `.strict()`; the **client-facing** response schema parses
  with `.passthrough()`, per `api.md`'s additive-change rule — clients must ignore unknown fields.
  One Zod object can't be both, so `ai.ts` exports the shape once and `jsonSchema.ts` derives the
  strict variant from it. A single schema forced to serve both roles is how the additive-change rule
  gets quietly broken.
- The `Scene` types currently living in `apps/api/src/ai/ai.service.ts` move here. The API imports
  them; so does the app.

### 3.2 The typed client — `apps/mobile/src/data/api/`

```
apps/mobile/src/data/api/
├── client.ts           # fetch wrapper: base URL, headers, timeout, abort, retry/backoff
├── problem.ts          # ProblemDetails → LoroError, and the documented per-code client behaviour
├── auth.ts             # token store (SecureStore) + refresh-once-then-reauth, single-flight
├── endpoints/{auth,sync,content,ai,tts,billing,account,analytics}.ts
└── __fakes__/          # an in-memory server for component tests
```

Non-negotiables from `offline.md` and `api.md`:

- **No call awaits on the learner's path.** Every write goes to SQLite + outbox and returns; the
  client is a background drainer. A `Promise` returned from `client.ts` that a screen awaits is a
  bug the lint rule should catch.
- `UNAUTHENTICATED` → refresh once, then re-auth. **Never drop the outbox.**
- `BUDGET_EXCEEDED` / `PROVIDER_UNAVAILABLE` → bundled fallback, **silently**. No toast, no banner.
- Connectivity is probed on transition only, and `captive` is treated as `offline`
  ([`offline.md`](../../../docs/architecture/offline.md#detecting-connectivity)).
- Certificate pinning on `api.loro.app` with a backup pin, per `security-privacy.md`.

### 3.3 Auth — `apps/api/src/auth/` (`F-01`, `F-02`)

Every AI and TTS endpoint is rate-limited and budgeted **per user**, which is impossible without
identity. This is the gate on all of §4 and §5.2.

| Piece                                  | Notes                                                                                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /auth/apple`                     | Verify `identity_token` against Apple's JWKS (`appleid.apple.com/auth/keys`) with `jose`. Check `aud` = Services ID, `iss`, `exp`, `nonce` |
| `POST /auth/google`                    | Verify `id_token` against Google's JWKS. `aud` must be in the allowed client-ID set (iOS, Android, web)                                    |
| `POST /auth/magic-link` → `/verify`    | **Needs a transactional email provider — no doc names one.** See §7.3. 202 regardless of existence                                         |
| `POST /auth/refresh`                   | Opaque, 90 d, rotating, Argon2id-hashed. Reuse revokes the family and logs it                                                              |
| `POST /auth/claim`                     | Transactional anon→user bind/merge. Failure here is a **P0** (`observability.md`)                                                          |
| `JwtGuard`, `PlanGuard`, `DeviceGuard` | ES256, 15 min, claims `sub`/`plan`/`device_id`/`ver`                                                                                       |

**Correction needed:** `api.md`'s `/auth/apple` request carries `device.push_token`. Per
`widgets-notifications.md`, _every_ v1 notification is local and no push token is needed. Make it
optional-and-unused in v1, or drop it until a server-push category exists.

### 3.4 Persistence, cache, queue, rate limit

| Piece                                       | Where                            | Blocks                                                                    |
| ------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------- |
| Drizzle schema + migrations                 | `apps/api/src/common/db/`        | Auth, sync, AI cache persistence, budget ledger, billing                  |
| `db:migrate` / `db:seed` scripts            | `apps/api/package.json`          | `onboarding.md` §3 already tells people to run these; they aren't defined |
| Redis client                                | `apps/api/src/common/redis/`     | AI response cache, rate limits, budget counters                           |
| BullMQ producers                            | `apps/api/src/common/queue/`     | `tts-render`, `enrich`, `content-build`, `analytics-etl`                  |
| `ThrottlerModule` + a Redis storage adapter | `apps/api/src/common/ratelimit/` | Every per-user/per-IP limit in `api.md`'s table                           |
| Repository layer requiring `user_id`        | `apps/api/src/common/db/`        | The cross-tenant compile-time guarantee in `security-privacy.md`          |

**Readiness must report the truth.** `health.controller.ts` today hard-codes `content: 'ok'` and
checks only the WASM merge. As each dependency lands it gets a real check: `db`, `redis`, `storage`,
`ai_provider` (config presence only — never a live provider call on a readiness probe),
`tts_provider`.

### 3.5 Observability for the integration paths

Per `observability.md`, `/ai/*` is traced at **100% sampling** (low volume, high cost). Spans:

```
POST /v1/ai/scene
├── ratelimit.check
├── budget.check
├── cache.lookup          ← the span that matters most
├── anthropic.messages.create
├── scene.validate
└── db.persist
```

`ai_request_completed` carries `endpoint`, `cache_hit`, `latency_ms`, `tokens_in`, `tokens_out`,
`cache_read_tokens`, `fallback_used`, `validation_failures`, `repair_attempted`, `refusal`. No free
text, ever — the allowlist drops anything not declared.

---

## 4 · AI integration — Anthropic (`AI-01`…`AI-05`)

### 4.1 Sequencing insight: authoring lands before runtime

`AI-02` (enrichment) is **v1**; `AI-01` (roleplay) and `AI-03` (translation) are **v1.1**. The
600-phrase catalog M2 needs cannot be authored by hand in the time available, so the _first_
Anthropic integration to build is the offline authoring pipeline — not the runtime proxy. It is also
the one carrying most of the value, and it runs with a human gate, so a bad output costs an editor's
time rather than a learner's trust.

### 4.2 Module layout

```
apps/api/src/ai/
├── ai.module.ts
├── ai.controller.ts          # POST /ai/{scene,coach,translate}
├── provider/
│   ├── provider.ts           # interface AiProvider — the seam the stub and Anthropic both implement
│   ├── anthropic.provider.ts # the only place @anthropic-ai/sdk is imported
│   └── stub.provider.ts      # bundled fallbacks; the local + test default
├── prompts/
│   ├── scene.ts              # versioned: SCENE_PROMPT_V1, and the model id it was evaluated against
│   ├── coach.ts
│   └── translate.ts
├── scene.service.ts
├── coach.service.ts
├── translate.service.ts
├── cache.service.ts          # Redis 30 d + Postgres permanent
├── budget.service.ts         # per-user monthly, global daily, from measured usage
├── guard.service.ts          # input sanitisation + output validation + injection detection
├── pricing.ts               # the $/MTok table, versioned with an effective-from date
└── fallbacks/                # 24 hand-authored scenes, 3 per theme × 2 levels
```

`AI_PROVIDER=stub` stays the local and CI default, so the fallback path is exercised on every test
run and cannot rot.

### 4.3 Models, and the per-model constraints that actually bite

Model ids are configuration (`AI_MODEL_*`, already in `.env.example`), versioned alongside the
prompt.

**Settle on the undated aliases and fix `.env.example` in the same change.** It currently mixes
forms — `AI_MODEL_SCENE=claude-sonnet-5` and `AI_MODEL_ENRICH=claude-opus-5` are aliases, while
`AI_MODEL_COACH` and `AI_MODEL_TRANSLATE` are pinned to `claude-haiku-4-5-20251001`. Both resolve,
so nothing breaks today, but the mismatch means the cache key's `model_id` (§4.4) and `pricing.ts`'s
lookup key differ by path for no reason, and a `PRICE_PER_MTOK` table keyed on aliases would miss
the dated Haiku entirely and fall through to whatever the default branch does. Use the alias
everywhere and have `pricing.ts` reject an unknown key loudly rather than defaulting.

| Use       | Model              | In $/MTok | Out $/MTok | Constraints that change the code                                                                                                                                                                                               |
| --------- | ------------------ | --------: | ---------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Scene     | `claude-sonnet-5`  |      3.00 |      15.00 | Sampling params **400**. Cache floor **1024 tok** → no prompt caching (D1). `effort` supported: `low`…`max`. Adaptive thinking is the default when `thinking` is omitted                                                       |
| Coach     | `claude-haiku-4-5` |      1.00 |       5.00 | `effort` **errors** — do not send it (D8). Cache floor 4096 tok → no caching                                                                                                                                                   |
| Translate | `claude-haiku-4-5` |      1.00 |       5.00 | Same                                                                                                                                                                                                                           |
| Enrich    | `claude-opus-5`    |      5.00 |      25.00 | Sampling params **400**. Thinking **on by default** — size `max_tokens` for thinking + output, or truncation. `{type:'disabled'}` only at `effort ≤ high`. Cache floor **512 tok** — the one path where prompt caching applies |

Note: `claude-sonnet-5` has introductory pricing of $2/$10 through **2026-08-31**. Budget models use
the standard $3/$15 so the caps don't need revisiting in September.

**The cache floors are not uniform, and D1 only rules caching out for the two runtime paths.** They
run 512 (`claude-opus-5`) / 1024 (`claude-sonnet-5`) / 4096 (`claude-haiku-4-5`) — not monotonic by
tier, so it has to be checked per model rather than inferred. The consequence for this plan: the
**enrich** prompt clears its 512-token floor comfortably, so the authoring pipeline in §4.10
_should_ set `cache_control` on the shared system prompt. It is the one place caching pays here —
enrichment runs the same instructions across 600 phrases in one session, which is the ideal
repeated-prefix shape, and cache reads bill at ~0.1× against Opus input. Verify it with
`usage.cache_read_input_tokens` on the second batch rather than assuming: a per-phrase field
interpolated ahead of the breakpoint would silently defeat it.

### 4.4 Scene generation — the request path

```
POST /ai/scene
 → JwtGuard                                          401 UNAUTHENTICATED
 → Throttler                 20/h, 60/day per user   429 RATE_LIMITED + Retry-After
 → guard.sanitizeInput()      caps + delimiter strip
 → budget.check()             countTokens pre-flight  → over? bundled fallback, SILENTLY
 → cache.get(key)             hit (~200 ms) → return
 → provider.scene()           Anthropic, structured output
 → stop_reason triage         refusal → fallback · max_tokens → 1 retry, bigger cap → fallback
 → guard.validateScene()      fail → 1 repair → fail → bundled fallback
 → budget.debit(usage)        MEASURED tokens × pricing.ts (debit refusals/truncations too)
 → cache.put(redis 30d, pg ∞)
 → respond                    JSON, or SSE reveal of the VALIDATED scene (D3)
```

**Cache key** —
`sha256(theme, level, tag_profile_bucket, sorted(phrase_ids), city, content_version, prompt_version, model_id)`.
Two additions to what `ai-services.md` documents: `prompt_version` and `model_id`, without which a
prompt or model change silently keeps serving output from the old one. `tag_profile` is bucketed
into 4 buckets (the doc's lever 1, taken up front — it roughly doubles the hit rate and the hit rate
is what makes the cost model work).

**The call** (shape, not final code):

```ts
const res = await this.client.messages.parse({
  model: this.cfg.sceneModel, // claude-sonnet-5
  max_tokens: 4096,
  system: SCENE_PROMPT_V1, // no cache_control — below the 1024-tok floor (D1)
  messages: [{ role: 'user', content: buildUserTurn(req) }], // learner text is DATA, delimited
  output_config: {
    effort: this.cfg.sceneEffort, // start at the 'high' default, sweep down in §4.9 — not 'low'
    format: zodOutputFormat(SceneSchemaStrict), // §3.1: strips unsupported keywords
  },
})
```

`max_tokens: 4096` against a ~900-token scene is deliberate headroom: Sonnet 5 is verbose by default
and `max_tokens` caps thinking **plus** output. A tight cap truncates mid-JSON, which reads as a
validation failure and burns a repair attempt for no reason.

**Thinking is on unless you turn it off, and that changes how the response is read.** Sonnet 5 runs
**adaptive thinking when `thinking` is omitted** — so the call above thinks, spends part of the 4096
against it, and returns a `thinking` block. `display` defaults to `"omitted"`, so that block's text
is empty but **it still occupies `content[0]`**: any code reaching for `res.content[0].text` gets an
empty string rather than the scene, and does so silently. Two rules follow:

- **Never index `content` positionally.** `messages.parse()` returns the validated object on
  `parsed_output` (`null` if parsing failed) — use it. In the fallback path, select the block with
  `type === 'text'`.
- **Effort is not the only latency lever.** Sonnet 5 accepts `thinking: { type: 'disabled' }` at
  _any_ effort, which is the honest way to chase the ≤ 3 s p95 gate in §4.9 if adaptive thinking
  proves too slow. (Contrast the enrich path: on `claude-opus-5`, `disabled` is accepted only at
  `effort ≤ high` and 400s at `xhigh`/`max`.) Decide it on the eval harness's measured numbers, not
  here.

**Truncation is its own branch, not a validation failure.** With thinking sharing the budget,
`stop_reason: 'max_tokens'` is a live outcome, and a truncated scene is unrepairable — feeding the
error back produces another truncation and burns the one repair attempt guaranteed to fail. Branch
before validation: retry once with a larger cap or thinking disabled, then the bundled fallback,
with `truncated: true` on the telemetry event so the cap can be tuned against real data.

**Refusal handling.** Sonnet 5 runs safety classifiers and can return HTTP 200 with
`stop_reason: 'refusal'` and an empty or partial `content`. Learner-authored phrase text reaches
this prompt, so this is a live path, not a theoretical one. Treat it exactly like a provider
failure: bundled fallback, `refusal: true` on the telemetry event, never surfaced. Do **not** reach
for the server-side `fallbacks` parameter — we already have a designed, good fallback on the device,
and rule 9 says AI is a garnish.

```ts
if (res.stop_reason === 'refusal') return this.fallback(req, { reason: 'refusal' })
```

**Check `stop_reason` before reading `content` at all** — on a refusal the array can be empty, so
even a type-guarded read has nothing to find. Note the billing asymmetry: a refusal raised _before_
any output is not billed, but one raised _mid-output_ bills the partial, and a truncated response
bills in full. Both still debit the ledger (D10) — measured usage means measured, including the
requests that produced nothing usable.

### 4.5 Output validation — unchanged in substance, stronger in mechanism

Structured outputs guarantee the _shape_. They cannot express the pedagogy, so
`guard.validateScene()` stays exactly as `ai-services.md` specifies: 3–4 turns · exactly 3 options ·
**exactly one `best: true`** · every `tip` ≥ 10 chars · no option over 12 words · no duplicate
options · Spanish · no instruction-like text in tips. One repair attempt with the error fed back,
then the bundled scene.

A validation-failure spike (>5%) is the canary for a prompt or model regression, and because scenes
are cached it **purges the affected key prefix** — a bad batch must not persist for 30 days.

### 4.6 Prompt injection — the concrete controls

Learner text reaches prompts through `/ai/translate` (pasted or captured text) and through
`phrase_ids` for owned learner-authored phrases. Controls, all in `guard.service.ts`:

| Control                 | Implementation                                                                                 |
| ----------------------- | ---------------------------------------------------------------------------------------------- |
| Structural separation   | Learner text is a field in the user turn. Never concatenated into `system`                     |
| Delimiting + escaping   | Wrapped in explicit delimiters; delimiter sequences stripped from the content first            |
| Length caps             | 200 chars/phrase, 12 phrases/request, enforced by the Zod schema before the service is reached |
| Structured output       | A successful injection still has to produce a schema-valid Spanish scene                       |
| `containsInstruction()` | Imperative-English patterns in tips (`ignore previous`, `system:`, `you are now`) → invalid    |
| No tools, no retrieval  | The provider call declares no `tools`. There is nothing to call                                |
| No privileged context   | Phrases, level, tags. No email, no ids, no other learner's data                                |
| Rate limits             | Bound iterative probing                                                                        |

Worst realistic case stays "the learner gets a strange café scene for themselves".

### 4.7 Budgets and cost accounting

Two layers, both from **measured** usage (D10):

```ts
// pricing.ts — versioned, effective-dated, unit-tested against the published table
// cacheWrite is TTL-dependent: 1.25× input at the 5-minute default, 2× at ttl: '1h'.
// One cacheWrite constant per model would mis-bill the enrich path (§4.3) the moment it
// switched TTL, so the ledger takes the TTL it actually sent.
const PRICE_PER_MTOK = {
  'claude-sonnet-5': { in: 3.0, out: 15.0, cacheRead: 0.3, write5m: 3.75, write1h: 6.0 },
  'claude-haiku-4-5': { in: 1.0, out: 5.0, cacheRead: 0.1, write5m: 1.25, write1h: 2.0 },
  'claude-opus-5': { in: 5.0, out: 25.0, cacheRead: 0.5, write5m: 6.25, write1h: 10.0 },
} as const

function costUsd(model: string, u: Usage): number {
  /* exact, from u.input_tokens etc. */
}
```

| Cap                  | Breach behaviour                                              |
| -------------------- | ------------------------------------------------------------- |
| Per-user monthly USD | **Silently** serve the bundled fallback. No error, no paywall |
| Global daily USD     | Same, plus a P2 alert at 80% of the cap                       |
| Per-user rate limit  | 429 + `Retry-After`; the client falls back                    |

Pre-flight uses `client.messages.countTokens()` to refuse admission when the _input_ alone would
exceed the remaining budget. Post-flight debits `response.usage`. A request that starts inside
budget can therefore exceed it slightly; `max_tokens` bounds the overshoot, and that is accepted.

**`countTokens` must be called with the model that will serve the request.** Token counts are
model-specific, and the three models here do not agree — a count taken against Haiku and spent
against Sonnet 5 is wrong in the direction that lets requests through. Never estimate client-side
(`tiktoken` and friends are a different tokenizer entirely and under-count Claude badly); the
endpoint is the only real number, which is what D10 requires.

The provider call is **non-streaming** (§4.4): 4096 `max_tokens` is far below the ~16k threshold
where HTTP timeouts start to matter, and D3 means we validate the whole scene before any of it
reaches the learner, so there is nothing to gain from a streamed provider call. The SSE in the
contract is _our_ progressive reveal of an already-validated scene, over our own response. If a
future path does stream from the provider, usage arrives only with the final message — debit after
`stream.finalMessage()`, not per-chunk.

**Recomputed cost model.** `ai-services.md` estimates $0.10–0.30/engaged learner/month. At current
pricing, with the doc's own volume assumptions (1.8 billed scenes, ~1200 in / ~900 out; 2 coach
notes at ~200 tok; 1 translation at ~300 tok):

| Line        | Calculation                 | USD/learner/mo |
| ----------- | --------------------------- | -------------: |
| Scenes      | 1.8 × (1200×3 + 900×15)/1e6 |         0.0308 |
| Coach notes | 2 × (200×1 + 100×5)/1e6     |         0.0014 |
| Translation | 1 × (300×1 + 150×5)/1e6     |         0.0011 |
| **Total**   |                             |    **~$0.033** |

Roughly **3–9× under** the documented $0.10–0.30 range, and far under the $0.50 per-user monthly
cap. Two caveats before anyone banks it: Sonnet 5 uses a newer tokenizer (~30% more tokens than the
Sonnet 4.6 generation these estimates likely came from) and is verbose by default, so both token
counts need re-baselining with `countTokens` against real prompts. Do that in §4.9 and update
`ai-services.md` and `monetization.md` with the measured figure.

**Catalog enrichment**, for comparison: 600 phrases × (~800 in + ~400 out) on `claude-opus-5` ≈ **$9
for the whole catalog**. There is no cost argument for economising on the authoring model.

### 4.8 Coach notes and translation

- `POST /ai/coach` (`P3A-05`, `P3A-06`) — one sentence about a chosen line. Haiku 4.5, no `effort`,
  no `thinking`, structured output `{ tip: string }`, `max_tokens: 256`. Fallback: the scene's
  pre-authored tip. 60/h per user.
- `POST /ai/translate` (`AI-03`, `P2-09`, `P2-15`) — Haiku 4.5, structured output
  `{ results: [{ es, en, confidence }] }`. `confidence < 0.7` surfaces "check this translation" to
  the learner rather than being silently accepted. Fallback: **leave untranslated** with an inline
  "add the meaning" affordance — never an error. Offline this is deferred work: 3 attempts, then the
  phrase stays usable untranslated (`offline.md`).
  - This is the endpoint most exposed to arbitrary learner text, so it is where refusal handling and
    injection detection matter most.

### 4.9 Evaluation harness — the gate on any prompt or model change

`apps/api/src/ai/__eval__/`, run manually and in `nightly.yml`, never on the PR path (it costs
money).

| Gate                                                      | Threshold                          |
| --------------------------------------------------------- | ---------------------------------- |
| 40 fixture scene requests pass every validation invariant | 100%                               |
| Native-speaker naturalness rating, 20-scene sample        | ≥ 4/5 mean                         |
| p95 latency, cache miss                                   | ≤ 3 s                              |
| Measured tokens in/out per endpoint                       | recorded, feeds `pricing.ts` model |
| Injection corpus (~30 crafted payloads)                   | 0 escapes past validation          |

A model that validates but produces stiff Spanish is a regression only a human notices — hence the
rating. Effort level (`low` vs `medium`) is chosen here, on measured quality and latency, not
guessed.

### 4.10 Authoring-time enrichment (`AI-02`, v1) — build this first

`packages/content/src/enrich.ts` — the file `package.json` already points at.

```bash
pnpm content:enrich --ids cafe1,cafe2,cafe3     # or --theme Café, or --missing resp
```

- `claude-opus-5`, structured output over the enrichment schema (`resp`, `resp_ipa`, `words[]`,
  `example`, `hint`, `note`).
- Writes into `packages/content/es-ES/phrases.json` **as a diff for review**, never committed
  directly by the tool. CODEOWNERS on `packages/content/**` already requires a native reviewer.
- Runs with the developer's own `ANTHROPIC_API_KEY` from `.env`, or a CI staff key. No HTTP endpoint
  (D5).
- Idempotent: re-running only fills fields that are `null`, unless `--overwrite`.
- Content lead edits every field before the PR. Unreviewed model output never reaches a learner.
- **Handles `stop_reason` the same way the runtime does, for the same reason.** `claude-opus-5`
  carries elevated safety classifiers and can decline with `stop_reason: 'refusal'` on an HTTP 200,
  and thinking is **on by default** there, so `max_tokens` must cover thinking plus the enrichment
  object or a long phrase truncates. A batch of 600 will hit both. Neither may be written as a
  result: a refused or truncated phrase is left `null`, listed in the run summary, and re-attempted
  on the next invocation — which the `--missing` idempotency already does for free. Writing a
  partial object would be worse than failing, because the human gate reviews what it is shown and a
  field that looks filled does not get looked at.

A `phrase-quality review` mode (flag stiff or unnatural catalog lines) runs the same way in
`content-validate.yml` as an advisory comment, never a merge block.

---

## 5 · Text-to-speech (`AS-01`, `AS-02`)

Three tiers, in preference order, exactly as `audio-speech.md` specifies. Two need a provider; one
doesn't.

| Tier | What                       | Where it runs                       | Credential              |
| ---- | -------------------------- | ----------------------------------- | ----------------------- |
| 1    | Pre-rendered catalog audio | **Build time**, `tts-render` worker | Worker/CI secret        |
| 2    | Server-rendered on demand  | Runtime, `POST /tts/render`         | API request-path secret |
| 3    | On-device TTS              | Device, `loro-speech`               | **None**                |

### 5.1 Provider selection (D7)

Requirements, in the order they eliminate candidates:

1. **A pinnable voice and model version.** "One voice per variant, **forever**" — a silent provider
   model update changes every learner's pronunciation reference mid-learning and invalidates every
   `f0_native` contour. This is the requirement that decides it.
2. **`es-ES` neural quality** good enough for a native speaker to sign off, phrase by phrase.
3. 24 kHz mono output that transcodes cleanly to AAC 64 kbps.
4. SSML, for the handful of phrases where the TTS gets stress wrong.
5. Per-character pricing, no monthly floor.

| Candidate                                                       | Voice pinning                                   | Verdict                                        |
| --------------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------- |
| **Google Cloud TTS** `es-ES-Neural2-*`                          | Named, versioned voices; deprecations announced | **Recommended**                                |
| **Azure AI Speech** `es-ES-ElviraNeural` / `es-ES-AlvaroNeural` | Named, versioned; SSML-rich                     | **Recommended**                                |
| AWS Polly `Lucia` / `Sergio` (neural)                           | Named, versioned                                | Acceptable; slightly behind on `es-ES` prosody |
| ElevenLabs multilingual                                         | Model versions roll; output not reproducible    | **Rejected** — breaks requirement 1            |
| OpenAI TTS                                                      | No `es-ES` variant pinning                      | Rejected                                       |

**Decide by blind listening test** on the existing 31-phrase seed catalog, run by the content lead
(this is step 5 of `content-authoring.md`, brought forward). Cost is not a tiebreaker: 600 phrases ×
~40 chars ≈ 24k chars ≈
**$0.40 to render the entire catalog**, which is why `monetization.md` books
catalog TTS at ~$0.

**Drift detection.** Because a provider can update a model silently, `nightly.yml` re-renders a
10-phrase sample and compares `sha256`. A mismatch is a P2: it means every `f0_native` contour in
that batch may be stale, and the labs' reference data with it.

### 5.2 `tts-render` worker (build time)

`apps/api/src/workers/tts-render/` — invoked by `pnpm content:render` and by `content-validate.yml`.

```
for each phrase needing audio:
  1. synth(es, lang, voice, version)      → PCM 24 kHz mono
  2. transcode                            → AAC 64 kbps mono 24 kHz  (~12 KB)
  3. sha256(bytes)                        → the content address
  4. upload s3://<bucket>/audio/sha256/<hash>.m4a  (immutable, public, max-age=31536000)
  5. extract f0_native                    → 14-point normalised contour  (loro-core)
  6. derive syl[] {t, stress, dur}        → from audio + resp_ipa       (loro-core)
  7. quantise mfcc_ref                    → 2–6 KB → /ref/sha256/<hash>.bin
  8. write audio {uri, sha256, ms} + f0_native + syl back into phrases.json
```

Steps 5–7 call `packages/core-rs` (`dsp/pitch.rs`, `dsp/align.rs` already exist), so the reference
data the labs score against is produced by **the same code that scores** — which is the whole point
of ADR-0002. Idempotent and content-addressed: a rerun is cheap and safe.

Validation, already declared in `content-authoring.md` §6 and enforced by `content-validate.yml`:
every phrase has audio · every checksum resolves · `f0_native` is exactly 14 points · syllable spans
cover the phrase · `resp` CAPS agrees with `resp_ipa`.

### 5.3 `POST /tts/render` (runtime, tier 2)

For learner-authored phrases when online and requested.

- Content-addressed by `(text, lang, voice)` → a phrase a thousand learners typed is rendered once
  globally. This is the whole cost story: ~$0.01/learner/month.
- `Idempotency-Key` required (`api.md`).
- 100/day per user, 500/day per IP.
- Response `{ uri, sha256, ms, cached }`; the client verifies the hash before use and re-fetches on
  mismatch (`threat-model.md` B9).
- Deferred work offline: 3 attempts on wifi, then keep device TTS. Invisible to the learner.

### 5.4 Device TTS (tier 3) — no credential

`loro-speech.speak(text, { locale, rate })` over `AVSpeechSynthesizer` /
`android.speech.tts.TextToSpeech`. Used for learner phrases offline, any cache miss, and **all**
word-by-word chips (rendering 600 phrases × 5 words is not worth the storage). Where the chip text
is a fragment (`¿Dón`), the phrase's `words[].say` supplies the real word (`dónde`).

**Rule that survives all three tiers: the prosody and pronunciation labs are catalog-only.** A
device-synthesised voice is not a trustworthy native reference.

### 5.5 Audio cache and prefetch (client)

Content-addressed by `sha256`, LRU, **150 MB cap, pinned content exempt**: today's Refrain set, the
whole trip set, the current stream queue. Reported separately in Settings so a learner can see why
the app uses space. Trip-set prefetch within 3 days of arrival is **forced on any connection** and
**verified** (every hash present, right size) — discovering a missing file in a taxi rank is the
failure `offline.md` exists to prevent.

### 5.6 Voice cloning (`AI-04`, `P3D-12`, v2) — deferred, but plan the constraint now

`POST /tts/voice-clone` is **the only endpoint in the entire API that accepts learner audio.**

- Requires `voice_clone_consent` recorded in `settings` → 403 without it; 402 if the plan excludes
  it.
- Per-use, 20/day.
- `retained: false` is a **contract**, verified by a test asserting the temp file is gone after the
  request returns.
- Needs a voice-conversion provider (a fourth credential) — not selected, and deliberately not
  selected now.
- Adds a sub-processor to the privacy policy and a row to the Apple Privacy Manifest / Play Data
  Safety form in the same PR.

---

## 6 · Speech-to-text (`AS-03`, `P3-20`…`P3-28`)

**This is a native-module integration, not an API-token integration.** There is no STT credential in
the recommended design.

### 6.1 `modules/loro-speech`

```
modules/loro-speech/
├── src/LoroSpeech.ts        # the single TS surface (see audio-speech.md for the full interface)
├── ios/                     # SFSpeechRecognizer + AVSpeechSynthesizer
└── android/                 # SpeechRecognizer + TextToSpeech
```

| Platform    | Recogniser                                                 | Gate                                                                   |
| ----------- | ---------------------------------------------------------- | ---------------------------------------------------------------------- |
| iOS 16+     | `SFSpeechRecognizer`, `requiresOnDeviceRecognition = true` | `supportsOnDeviceRecognition` must be checked **per device**           |
| Android 10+ | `SpeechRecognizer` + `EXTRA_PREFER_OFFLINE`                | Offline `es-ES` needs a downloaded language pack; we detect and prompt |

`onDeviceOnly: true` is a **hard flag, not a preference**. `interimResults: true` is what drives the
blueprint's word-by-word un-blur (`Loro.dc.html:2667`) — it is the reason platform recognisers beat
a bundled Whisper (ADR-0005 option B), which is utterance-at-a-time.

### 6.2 `modules/loro-audio` — the dependency nobody can skip

STT is useless without capture, and capture is where the privacy promise is made structural.

- `stopRecording()` returns `{ onsetMs, durationMs, bufferId }` — **a handle, never bytes**. There
  is no JS API that yields PCM, so the code to upload it does not exist (ADR-0007, ADR-0011).
- `analyzeBuffer(bufferId, kind)` hands the buffer to `loro-core` on a native thread; released
  within 50 ms.
- `.measurement` / `UNPROCESSED` capture — platform AGC, noise suppression, and EQ would distort the
  pitch contour we are about to measure.
- `onSpeechOnset` in the native tap gives a **real** latency number on a monotonic clock. If onset
  is never detected, `latencyMs` is `null` and the read-out is **hidden** — never estimated (rule
  2).
- **A P0 alert on any network request originating in the audio module.** There should never be one.

### 6.3 Matching lives in `loro-core`, not in the module

`core-rs/src/asr.rs::match_tokens(heard, target, revealed)` already exists. Both platforms therefore
apply identical normalisation and identical forward-walk matching, so recogniser differences surface
as _recognition_ differences and never as _scoring_ differences. Properties, all inherited from the
blueprint: order matters · insertions tolerated · progress monotonic · accent- and
punctuation-insensitive. Fuzzy edit-distance tolerance is a `loro-core` tunable, **off by default**
— turning it on is a pedagogical decision about gate strictness.

Work needed: confirm `match_tokens` is exported through UniFFI and add golden tests over recorded
transcripts including ASR-noise cases (`packages/core-rs/tests/` now contains calendar parity, but
has no ASR golden corpus yet).

### 6.4 The cloud-ASR contradiction (D4)

`ADR-0005` and `offline.md` both put "cloud ASR, explicitly consented" at rung 3 of the degradation
ladder. But:

- `api.md` has **no** ASR endpoint. There is no surface to send audio to.
- `ADR-0011` states that **exactly one** endpoint accepts learner audio (`/tts/voice-clone`), and
  makes that a structurally enforced invariant with a **P0 alert on any egress from the audio
  module**. A cloud-ASR path contradicts both the invariant and its alarm.
- `monetization.md` prices cloud ASR at "~$0 — on-device; cloud fallback is opt-in and rare".

Two coherent paths. **Recommended: cut it.**

| Path                  | Work                                                                                                                                                                                                                                                                                                                       |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A — cut it (rec.)** | Ladder becomes on-device → language-pack prompt → reveal mode. Amend ADR-0005, `offline.md`, `security-privacy.md` (two consents, not three). Instrument reveal-mode rate; if it exceeds 15% on either platform, ADR-0005's own revisit trigger points at an **optional Whisper download**, which keeps the promise intact |
| **B — keep it**       | Add `POST /asr/transcribe` to `api.md`; a third consent surface; a provider + credential; amend ADR-0011's single-audio-endpoint invariant and re-tune the egress canary; add a sub-processor to the policy and both store forms                                                                                           |

Needs an owner's decision. Track as **Q-15** in `open-questions.md`.

### 6.5 Reveal mode is the floor, and it is first-class

Mic tap reveals and speaks the next word; the hint reads _"No mic here — tap to reveal a word"_
(`Loro.dc.html:2661`, `2729`). **Every speaking screen completes without a microphone** — which also
serves anyone who can't speak aloud in the moment. `EXPO_PUBLIC_FORCE_REVEAL_MODE` already exists in
`.env.example` to exercise this path; make it work on day one of the module.

---

## 7 · The remaining integrations

### 7.1 Billing (`Q-12`, blocking M2 start)

| Path                                   | Credentials                                                                                                                                                                                                                                        |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Direct** (StoreKit 2 / Play Billing) | App Store Server API: **issuer ID + key ID + `.p8`**. App Store Server Notifications V2: verify signed JWS against Apple root CAs. Google Play: **service-account JSON** (Android Publisher scope) + Real-time Developer Notifications via Pub/Sub |
| **RevenueCat**                         | Public SDK key (**client, not secret**) + secret server API key + webhook shared secret                                                                                                                                                            |

Whichever is chosen must support **client-side entitlement caching with a grace period**, so a
learner abroad with no network does not lose Plus mid-trip. `ENTITLEMENT_GRACE_DAYS=7` is already in
`.env.example`. `APPLE_SHARED_SECRET` (legacy `verifyReceipt`) is deprecated by Apple — prefer the
App Store Server API and drop the variable if Direct is chosen.

### 7.2 Storage and CDN

- S3-compatible bucket + edge CDN. Immutable, content-addressed paths;
  `Cache-Control: public, max-age=31536000, immutable`.
- **Prefer OIDC federation to long-lived access keys** for the API and workers (`ci-cd.md` already
  mandates this for cloud credentials).
- Public for audio and `mfcc_ref` (D6). Signed URLs only for `/account/export` artefacts, 1 h
  expiry.

### 7.3 Transactional email — a genuinely missing integration

`POST /auth/magic-link` is in the contract; **no doc names a provider and no env var exists for
one.** Needs: a provider (Resend / Postmark / SES), an API key, a verified sending domain, and SPF +
DKIM + DMARC records. Without it, `F-01` ships with Apple and Google only.

Add to `.env.example`: `EMAIL_PROVIDER`, `EMAIL_API_KEY`, `EMAIL_FROM`.

### 7.4 Observability

| Credential                              | Where                | Note                                                           |
| --------------------------------------- | -------------------- | -------------------------------------------------------------- |
| `SENTRY_DSN` / `EXPO_PUBLIC_SENTRY_DSN` | API env / app bundle | **Public by design** — a DSN is not a secret                   |
| `SENTRY_AUTH_TOKEN` + org + project     | CI only              | Source-map and dSYM upload. **Missing from `environments.md`** |
| `OTEL_EXPORTER_OTLP_ENDPOINT`           | API env              | Present                                                        |
| `OTEL_EXPORTER_OTLP_HEADERS`            | API env              | Auth for the collector. **Missing from `environments.md`**     |

Crash reporter is configured with **no attachments**. Analytics is first-party
(`POST /analytics/batch`) — no third-party write key, which is what makes the client-side opt-out
real ("nothing is queued, not merely not sent").

### 7.5 Build and release

| Credential                        | Where                                                    |
| --------------------------------- | -------------------------------------------------------- |
| `EXPO_TOKEN`                      | CI (`mobile-build.yml`, `release.yml`)                   |
| `extra.eas.projectId`             | `app.config.ts` — **`PLACEHOLDER` today**                |
| `updates.url`                     | `app.config.ts` — **`PLACEHOLDER` today**                |
| `submit.production.ios.ascAppId`  | `eas.json` — **`PLACEHOLDER` today**                     |
| App Store Connect API key (`.p8`) | GitHub environment, `release.yml` only                   |
| Play service-account JSON         | GitHub environment, `release.yml` only                   |
| iOS signing certs / provisioning  | EAS, separate GitHub environment with required reviewers |

### 7.6 Not needed, and worth writing down

| Integration               | Why not                                                                                        |
| ------------------------- | ---------------------------------------------------------------------------------------------- |
| **Push (APNs/FCM)**       | Every v1 notification is **local** and computable on-device — works in airplane mode, no token |
| **OCR** (`P2-15`)         | On-device: Vision `VNRecognizeTextRequest` / ML Kit Text Recognition. No credential            |
| **Maps / geocoding**      | Trip city is a text field from a bundled list. No location permission, ever                    |
| **Captcha**               | `/auth/magic-link` returns 202 regardless of existence; rate limits cover the rest             |
| **Attribution / ad SDKs** | Explicitly excluded by `security-privacy.md`                                                   |

---

## 8 · Credential inventory

**No provider key is ever in the app bundle.** Every third-party call is proxied through our API,
which is what makes rate limiting, budget enforcement, and key rotation possible at all. A CI secret
scan runs against the **built artifact**, not just the source.

### 8.1 Server / worker runtime

| Variable                                 | Provider           | Used by                      | New? | Notes                                          |
| ---------------------------------------- | ------------------ | ---------------------------- | :--: | ---------------------------------------------- |
| `ANTHROPIC_API_KEY`                      | Anthropic          | `ai/` , `enrich` worker      |      | Already declared, unused                       |
| `AI_MODEL_SCENE`                         | —                  | `scene.service`              |      | `claude-sonnet-5`                              |
| `AI_MODEL_COACH` / `_TRANSLATE`          | —                  | coach / translate            |      | `claude-haiku-4-5`                             |
| `AI_MODEL_ENRICH`                        | —                  | enrich CLI                   |      | `claude-opus-5`                                |
| `AI_MONTHLY_BUDGET_USD_PER_USER`         | —                  | `budget.service`             |      | 0.50 (≈15× the measured ~$0.033)               |
| `AI_DAILY_BUDGET_USD_GLOBAL`             | —                  | `budget.service`             |      | 200                                            |
| `AI_SCENE_CACHE_TTL_DAYS`                | —                  | `cache.service`              |      | 30                                             |
| `AI_SCENE_PROMPT_VERSION`                | —                  | cache key                    |  ✅  | Without it a prompt change serves stale scenes |
| `TTS_PROVIDER`                           | Google / Azure     | `tts/`, `tts-render`         |      | Provider unnamed in docs — D7                  |
| `TTS_API_KEY`                            | Google / Azure     | `tts/`, `tts-render`         |      | Google: prefer a service account + OIDC        |
| `TTS_VOICE_ES_ES`                        | —                  | `tts/`, `tts-render`         |      | **One voice per variant, forever**             |
| `TTS_VOICE_VERSION`                      | —                  | `tts-render`, drift check    |  ✅  | Pin the model version explicitly               |
| `APPLE_SERVICES_ID`                      | Apple              | `auth/strategies/apple`      |  ✅  | `aud` for identity-token verification          |
| `APPLE_TEAM_ID`                          | Apple              | `auth`, `billing`            |      | Declared                                       |
| `APPLE_KEY_ID` + `APPLE_P8`              | Apple              | App Store Server API         |  ✅  | If Direct billing (`Q-12`)                     |
| `APPLE_ISSUER_ID`                        | Apple              | App Store Server API         |  ✅  | Same                                           |
| `APPLE_SHARED_SECRET`                    | Apple              | legacy `verifyReceipt`       |      | Declared. **Drop if Direct** — deprecated      |
| `GOOGLE_OAUTH_CLIENT_IDS`                | Google             | `auth/strategies/google`     |  ✅  | Comma-separated allowed `aud` set              |
| `GOOGLE_PLAY_SA_JSON`                    | Google             | `billing`                    |      | Declared                                       |
| `REVENUECAT_SECRET_KEY` + webhook secret | RevenueCat         | `billing`                    |  ✅  | Only if RevenueCat (`Q-12`)                    |
| `EMAIL_PROVIDER` / `_API_KEY` / `_FROM`  | Resend/SES         | `auth/strategies/magic-link` |  ✅  | **Whole integration missing from docs**        |
| `DATABASE_URL`, `REDIS_URL`              | managed            | everything                   |      | Private subnet only                            |
| `S3_*`, `CDN_BASE_URL`                   | object store       | `content`, `tts`, `account`  |      | Prefer OIDC over static keys                   |
| `JWT_PRIVATE_KEY` / `_PUBLIC_KEY`        | —                  | `auth`                       |      | ES256                                          |
| `REFRESH_TOKEN_PEPPER`                   | —                  | `auth`                       |      | Argon2id                                       |
| `SENTRY_DSN`, `OTEL_*`                   | Sentry / collector | telemetry                    |      | `OTEL_EXPORTER_OTLP_HEADERS` is missing        |

### 8.2 CI only

`EXPO_TOKEN` · App Store Connect API key (`.p8`) · Play service-account JSON · iOS signing ·
`SENTRY_AUTH_TOKEN` · `ANTHROPIC_API_KEY` (staff, for `nightly.yml` evals and enrichment) ·
`TURBO_TOKEN` if remote caching is enabled.

No secret is available to a PR-triggered workflow from a fork. A production deploy requires an
environment approval.

### 8.3 In the app bundle — none of these is a secret

`EXPO_PUBLIC_API_URL` · `EXPO_PUBLIC_CDN_URL` · `EXPO_PUBLIC_ENV` · `EXPO_PUBLIC_SENTRY_DSN` ·
`EXPO_PUBLIC_FORCE_REVEAL_MODE` · `EXPO_PUBLIC_DEBUG_ENGINES` · `EXPO_PUBLIC_SHOW_FPS`.

Plus, if RevenueCat is chosen, its **public** SDK key.

### 8.4 Local development stays free and offline

`AI_PROVIDER=stub`, `TTS_PROVIDER=stub`. A new developer needs **no credentials on day one**, and
the fallback paths are exercised on every run so they cannot silently rot. Hitting a real provider
takes an explicit env change and your own key — nobody does it by accident.

Every new variable ships with a line in the relevant `.env.example`, with a comment. CI fails
otherwise (already a documented rule).

---

## 9 · Components touched

| Area                                | Paths                                                                                                                                                                  |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Shared contract**                 | `packages/core/src/api/**` (new) · `packages/core/src/index.ts`                                                                                                        |
| **API — foundation**                | `apps/api/src/{auth,common/{db,redis,queue,ratelimit,telemetry}}/**` (new) · `app.module.ts` · `main.ts` · `health.controller.ts`                                      |
| **API — AI**                        | `apps/api/src/ai/**` (rewrite; keep `validate()` and the fallback scenes)                                                                                              |
| **API — TTS**                       | `apps/api/src/tts/**` (new)                                                                                                                                            |
| **API — billing/account/analytics** | `apps/api/src/{billing,account,analytics}/**` (new)                                                                                                                    |
| **Workers**                         | `apps/api/src/workers/{tts-render,enrich,content-build,reconcile,analytics-etl}/**` (new) · a second Dockerfile entrypoint                                             |
| **Content pipeline**                | `packages/content/src/{enrich,render,publish}.ts` (new — scripts already declared) · `src/checks.ts` (audio, contour, syllable, stress checks)                         |
| **Rust core**                       | `core-rs/src/dsp/**` (f0/syl/mfcc extraction reachable from the render worker) · `src/asr.rs` (UniFFI export) · `tests/golden/**` (new)                                |
| **Native modules**                  | `apps/mobile/modules/loro-audio/{ios,android}` (new) · `modules/loro-speech/{ios,android}` (new) · `modules/loro-core` wrapper                                         |
| **App — data layer**                | `apps/mobile/src/data/{api,db,sync,outbox}/**` (new)                                                                                                                   |
| **App — platform**                  | `apps/mobile/src/platform/{audio,speech,core,notifications,ocr,purchases,widgets}/**` (new)                                                                            |
| **App — domain/features**           | `src/domain/{phrases,content,settings,analytics}` · `src/features/{roleplay,speak,prosody,pronunciation,add-phrases}`                                                  |
| **App — config**                    | `app.config.ts` (add `expo-notifications`, `expo-secure-store`, the local modules; real `projectId` and `updates.url`) · `eas.json` (real `ascAppId`) · `.env.example` |
| **CI**                              | `ci.yml` (contract drift check) · `content-validate.yml` (audio + contour) · `nightly.yml` (AI evals, TTS drift, injection corpus) · `api-deploy.yml`                  |
| **Docs**                            | See §12                                                                                                                                                                |

---

## 10 · Sequencing

Each phase ends in something verifiable. Phase 0 gates everything.

| Phase  | Milestone | Delivers                                                                                                             | Verified by                                                                              |
| ------ | --------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **0**  | M1        | `packages/core/src/api/` · typed client · auth · Drizzle + migrations + seed · Redis · throttler · real readiness    | A device signs in, syncs a rating, and `/health/ready` reports every dependency honestly |
| **1**  | M1        | **TTS provider chosen** (D7) · `tts-render` worker · 150 phrases with audio + `f0_native` + `syl` · `AS-01`, `AS-02` | Content lead has listened to every clip; `pnpm content:validate` green                   |
| **1b** | M1        | **Enrichment CLI** (`AI-02`) — the v1 AI requirement                                                                 | 150 phrases enriched, every field human-edited, native reviewer approved                 |
| **2**  | M1→M2     | `loro-audio` — playback, slots, rate, interruptions, lock screen (`AS-02`, `AS-04`, `P3-11`)                         | The interruption matrix on real devices; a 40-minute soak, screen locked                 |
| **3**  | M2        | `loro-speech` — on-device ASR, reveal mode, device TTS (`AS-03`, `P3-20`…`P3-28`)                                    | Speak-to-progress works on both platforms **and** with the mic denied                    |
| **4**  | M2        | `POST /tts/render` + client audio cache + prefetch                                                                   | Airplane-mode acceptance test: survival mode usable in < 2 s from a cold launch          |
| **5**  | M2        | Billing (`Q-12`) · account export/delete (`F-07`) · analytics ingest                                                 | A real purchase restores; an export round-trips; an unknown event name is rejected       |
| **6**  | M3        | Anthropic runtime: scene, coach, translate (`AI-01`, `AI-03`, `AI-05`, `P3A-*`)                                      | Eval harness gates in §4.9 all pass; cache hit ≥ 70%; measured cost recorded             |
| **7**  | M3        | DSP wired end-to-end for the labs (`AS-05`, `AS-06`, `P3C-*`, `P3D-*`)                                               | The `prosody-dsp.md` release gate: native-speaker agreement ≥ 80%                        |
| **8**  | M5 (v2)   | Voice clone (`AI-04`, `P3D-12`)                                                                                      | `retained: false` proven by a test that the temp file is gone                            |

**Two things worth stating about the order.** The AI _authoring_ integration (1b) comes before the
AI _runtime_ one (6), because `AI-02` is v1 and `AI-01` is v1.1 — and because 600 reviewed phrases
is the long pole for M2. And speech (3) cannot precede audio (2): one native module owns the audio
session, and two owners is how interruption bugs happen (ADR-0007 option B).

---

## 11 · Verification

| Integration        | How it's checked                                                                                                                                                                                                                               |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contract drift     | CI regenerates the derived JSON Schemas from the Zod source and fails on any diff — same mechanism as the tokens and UniFFI bindings                                                                                                           |
| AI — correctness   | Unit tests on `validate()`; 40-fixture eval suite; ~30-payload injection corpus with zero escapes                                                                                                                                              |
| AI — cost          | `pricing.ts` unit-tested against the published table; measured `usage` asserted against a per-endpoint ceiling                                                                                                                                 |
| AI — degradation   | `AI_PROVIDER=stub` in CI; a forced 500, a forced timeout, a **forced `stop_reason: 'refusal'`**, and a **forced `max_tokens` truncation** each land on the bundled scene silently — and the truncation must **not** consume the repair attempt |
| AI — schema        | A unit test asserts the derived structured-output schema contains none of the unsupported keywords (§3.1) and `additionalProperties: false` on every object — the failure mode is a 400 in production, not a test failure                      |
| AI — response read | A fixture response whose `content[0]` is a `thinking` block still yields the scene — guards the silent-empty-string path in §4.4                                                                                                               |
| AI — cache         | Key-stability tests; a `content_version` bump invalidates; a `prompt_version` bump invalidates                                                                                                                                                 |
| TTS — build        | Every phrase has audio; checksums resolve; `f0_native` is 14 points; syllable spans cover the phrase                                                                                                                                           |
| TTS — drift        | Nightly 10-phrase re-render, `sha256` compared → P2 on mismatch                                                                                                                                                                                |
| TTS — runtime      | Idempotency-key replay returns the same `sha256`; the rate limit returns 429 with `Retry-After`                                                                                                                                                |
| ASR — matching     | Golden tests in `core-rs` over recorded transcripts including ASR noise; cross-language parity test                                                                                                                                            |
| ASR — availability | Reveal mode forced via `EXPO_PUBLIC_FORCE_REVEAL_MODE`; permission revoked mid-session → reveal mode, no crash, no modal                                                                                                                       |
| Audio — latency    | Onset detection validated against 200 hand-labelled recordings, ±60 ms                                                                                                                                                                         |
| Audio — privacy    | **CI asserts no network call originates in the audio module**; a P0 alert watches for one in production                                                                                                                                        |
| Offline            | Maestro airplane-mode flow; captive-portal proxy; 30% packet loss; 30-day clock advance then converge                                                                                                                                          |
| Secrets            | Secret scan of the **built artifact**; a new env var without an `.env.example` line fails CI                                                                                                                                                   |
| Privacy forms      | Any data-flow change updates the Apple Privacy Manifest and Play Data Safety form **in the same PR**                                                                                                                                           |

---

## 12 · Doc corrections this plan implies

`CLAUDE.md` requires docs be fixed in the change that makes them wrong. These are already wrong.

| Doc                                | Correction                                                                                                                                                                                                            |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `architecture/ai-services.md`      | Cost lever 2 (prompt caching) does not apply at the 1024-token floor — remove or replace with "grow the system prompt past the floor with few-shot examples". Update the $0.10–0.30 estimate with the measured figure |
| `architecture/ai-services.md`      | Record that output is constrained by structured outputs, not by a prompt instruction; add refusal handling to the pipeline                                                                                            |
| `architecture/api.md`              | `/ai/scene` SSE streams the _validated_ scene. Add `GET /ai/themes` or remove it from the code. `push_token` on `/auth/*` is unused in v1                                                                             |
| `architecture/api.md`              | Drop `POST /ai/enrich` if D5 is accepted; note the CLI instead                                                                                                                                                        |
| `architecture/backend.md`          | `content/audio.service.ts # signed CDN URLs` → audio is public and immutable (D6)                                                                                                                                     |
| `architecture/adr/0005`            | Amend the ladder if cloud ASR is cut (D4)                                                                                                                                                                             |
| `architecture/adr/0011`            | Consent surfaces: three → two, if D4 is accepted                                                                                                                                                                      |
| `architecture/security-privacy.md` | Same; and add the transactional-email sub-processor                                                                                                                                                                   |
| `process/environments.md`          | Add `OTEL_EXPORTER_OTLP_HEADERS`, `SENTRY_AUTH_TOKEN`, `EMAIL_*`, `APPLE_SERVICES_ID`, `GOOGLE_OAUTH_CLIENT_IDS`, `AI_SCENE_PROMPT_VERSION`, `TTS_VOICE_VERSION`. Name the TTS provider once chosen                   |
| `process/onboarding.md` §3         | `db:migrate` / `db:seed` become real in Phase 0 — the doc stops running ahead of the code                                                                                                                             |
| `apps/api/.env.example`            | Normalise `AI_MODEL_COACH` / `AI_MODEL_TRANSLATE` from `claude-haiku-4-5-20251001` to the `claude-haiku-4-5` alias so all four `AI_MODEL_*` use one form (§4.3)                                                       |
| `product/monetization.md`          | Re-derive the cost table from measured `usage`                                                                                                                                                                        |
| `decisions/open-questions.md`      | Add **Q-15 · cloud ASR: cut or build?** (owner: tech lead, blocks M2 speech work) and **Q-16 · TTS provider and voice** (owner: content lead, blocks M1)                                                              |
| `CLAUDE.md`                        | Update "What exists" as each phase lands                                                                                                                                                                              |

---

## 13 · Risks

| Risk                                                                              | Mitigation                                                                                                                                                                                                                                                                            |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Phase 0 is bigger than any single integration** and everything queues behind it | Sequence it first and resist starting §4–§7 in parallel. The contract package alone unblocks the most downstream work                                                                                                                                                                 |
| A TTS provider silently updates the voice model                                   | Pin voice + version; nightly `sha256` drift check; treat a mismatch as invalidating that batch's `f0_native`                                                                                                                                                                          |
| Sonnet 5's tokenizer and verbosity blow the token assumptions                     | Re-baseline with `countTokens` in Phase 6 before setting caps; `max_tokens: 4096` with real headroom                                                                                                                                                                                  |
| **Provider API surface drifts under us** — a default flips, a constraint is added | Every per-model constraint in §4.3 is a code-shaping fact with a shelf life (adaptive-thinking defaults and the effort/thinking interlocks have already moved once). Assert them: the eval harness in §4.9 is the tripwire, and a nightly failure there is a spec change, not a flake |
| Learner text triggers a safety refusal on a benign phrase                         | Handle `stop_reason: 'refusal'` as a provider failure → bundled fallback, silently. Alert on any sustained non-zero rate                                                                                                                                                              |
| On-device `es-ES` ASR is unavailable on too many devices                          | Reveal mode is a first-class floor. Instrument the rate; >15% triggers ADR-0005's optional-Whisper-download path                                                                                                                                                                      |
| Audio egress added by a future change                                             | It's structurally hard (no PCM in JS), CI-checked, and P0-alerted. Keep all three                                                                                                                                                                                                     |
| AI cost runs away via roleplay                                                    | Cache hit ≥70% target, coarse tag buckets from day one, silent budget fallback, and pre-generation of the top 200 combos as the big lever                                                                                                                                             |
| `Q-08` (pricing) and `Q-12` (store mechanics) are unresolved and block billing    | Billing is Phase 5; the plan sequences it after the paths that don't depend on a pricing decision                                                                                                                                                                                     |
| Two docs already run ahead of the code                                            | §12 fixes them as the code lands, not after                                                                                                                                                                                                                                           |
