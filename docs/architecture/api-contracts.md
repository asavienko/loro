# Executable API contracts

**F-04 / plan 85.** Runtime schemas and generated specifications now exist. Most remain planned. The
[plan 88 OAuth slice](google-apple-auth.md) now validates requests in Nest and responses in the
mobile account client. The [integration inventory](backend-integration-inventory.md) accounts for
all 23 authored screens and supporting functionality.

## Sources and entry points

| Surface      | Import                   | Specification                                  | Meaning                                                                    |
| ------------ | ------------------------ | ---------------------------------------------- | -------------------------------------------------------------------------- |
| Current      | `@loro/core/api/current` | [openapi.current.json](openapi.current.json)   | Ten original development operations plus eight configured OAuth operations |
| Target       | `@loro/core/api/target`  | [openapi.target.json](openapi.target.json)     | Planned contracts for settled capabilities; not deployed                   |
| Draft        | `@loro/core/api/draft`   | Target document, marked `x-loro-status: draft` | Product/transport review still required; no release authorization          |
| Catalog wire | `@loro/core/api/catalog` | Referenced content schemas                     | Unbranded snake-case catalog transport, separate from domain views         |

`@loro/core/api/oauth` exports the implemented identity-only transport; planned anonymous-claim
contracts remain separate.

Every named request/response schema has a corresponding inferred TypeScript type. Types are inferred
from Zod, not maintained as independent DTO interfaces. `Operation` metadata owns methods, paths,
parameters, headers, response media, examples, recovery behavior, owners and gates. Examples are
**illustrative wire fixtures**, not observations, measured learner state, production assets,
provider results or usable purchase proofs. They are never used as application fallback data.

```ts
import { PushResponseSchema, type PushResponse } from '@loro/core/api/target'
const response: PushResponse = PushResponseSchema.parse(untrustedJson)
```

This illustrates future boundary consumption; existing controllers intentionally keep their current
implementation until plan 66 wires the schemas into Nest.

```bash
nvm use 22
pnpm contracts:generate   # regenerate both committed OpenAPI 3.1 documents
pnpm contracts:check      # fails if either generated file differs
pnpm check               # includes the uncached contracts:check before Turbo
```

Tooling lives in `packages/core/src/api-tooling/` and is not exported from runtime package entry
points. Adding Zod to core does not make the core root import the API schemas. The content package
re-exports catalog wire types without a runtime import of the generator or a core-to-content cycle.
The existing JSON authoring schema remains in place, with compatibility tests, including `variants`.

## Migration map

| Concern                     | Current                                                | Target and owner                                                                                       |
| --------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Successful POST status      | Nest default **201**                                   | Explicit 200/202 per operation; 66 + owning route plan                                                 |
| Validation                  | Local interfaces and partial checks                    | Strict requests, typed per-field payloads and shared problems; 66                                      |
| Field HLC                   | `{physical, logical, node_id}`                         | Encoded string; safe integer physical, padded u32 logical, bounded node ID; 66/68                      |
| Pull row identity           | `id`                                                   | `entity_id`; 68                                                                                        |
| Live row tombstone          | WASM can serialize missing `deleted_at`                | Explicit `deleted_at: null`; deleted rows have timestamp + empty fields; 68                            |
| Pull cursor                 | Ignored `since`/`limit`, placeholder HLC               | Null bootstrap cursor; opaque tenant-bound durable change position; limit 1–500; 68                    |
| Sync rejection              | `schema_unknown` or `VALIDATION_FAILED`, sequence only | Input `index`, nullable `seq`, machine code; invalid envelope is a whole-request 422; 68               |
| Sync replay                 | Re-merge current memory state                          | Principal/device/seq idempotency; reject same seq with different payload; 66/68                        |
| Local outbox representation | Some values are serialized strings, HLC strings        | Explicit value codecs before request validation; never send double-encoded tags/waves; 59/68           |
| Field policy                | Wildcard append-only fields                            | Explicit log payload allowlists; merge policy never grants arbitrary field access; 54/68               |
| Settings legacy fields      | `cloudAsrConsent`, `voiceCloneConsent` declared        | Excluded; no audio-upload permission exists. Review old rows before sync migration; 54/71              |
| Pack route                  | `/content/pack?id=...`; unknown → 422                  | `/content/pack/{id}`; unknown → 404; explicit transition needed; 61                                    |
| Content history             | Whole bundled catalog for older version                | Checksummed full resource, historical diffs, richer resource descriptors, atomic cache replacement; 61 |
| Future catalog version      | Treated as up-to-date                                  | Reject `from > current` with 422; 61                                                                   |
| Auth                        | None                                                   | Server-derived principal/device; no arbitrary account ID in payloads; 67                               |
| Claim                       | No route                                               | Authenticated even though under `/auth`; device header/body must agree and belong to caller; 67        |
| Sign-in result              | Only a documentation sketch                            | Tokens/identity/claim; entitlement shape stays in draft billing, not a hardcoded Plus enum; 67/74      |
| v1 notifications            | Docs previously sketched push tokens                   | Device registration omits push token; all v1 notifications local; 67/70                                |
| Scene                       | Stub JSON; level ignored; >=1 turn accepted            | 3–4 turns, strict options, provenance, negotiated validated SSE; 76                                    |
| Translation confidence      | Documentation example always numeric                   | Evidence-derived number or null; null/<0.7 requires review; 65/76                                      |
| Account export              | Documented GET job creation, no implementation         | Retain GET, no-store, reuse pending job; poll queued/running/ready/failed/expired; 67                  |
| Analytics                   | No ingestion                                           | Typed event names/props, partial rejects, server-injected identity/time; 71                            |

The current document describes **well-formed caller intent and observed responses**, not every
malformed input the incomplete server accidentally accepts. It records those weaknesses rather than
turning accidental acceptance into a production compatibility promise. Current `sync/status` is a
development diagnostic and has no target learner route.

Stable row keys are UUIDv7 for learner rows/logs, `settings` for the singleton, and real
`YYYY-MM-DD` keys for Refrain/streak days. Device identity remains separately authenticated. Plan 68
must resolve the existing one-live-row-per-catalog-phrase invariant transactionally before enabling
multi-device sync; these schemas do not implement canonicalization or merge rules. Trip
parent/composite-key semantics remain explicitly draft under Q-07.

## Recovery and security semantics

- **Sync:** 500 operations/512 KiB. OpenAPI describes well-formed client payloads. Do not install
  full-batch validation as middleware: validate the envelope, then use `validatePushBatch` to
  classify independent operations. Rejection indexes are zero-based; malformed/missing sequences are
  null. A duplicate sequence after its first occurrence is rejected. Only accepted sequences are
  acked; permanent rejects are retained for review, not blindly retried. An empty upsert is a no-op.
- **Paging:** persist each applied page and its cursor atomically. An expired/invalidated cursor
  returns target-only `CURSOR_EXPIRED` (409): retain local data/outbox and bootstrap from null.
  `SCHEMA_TOO_OLD` (409) instead carries `min_app_version`, pauses sync and prompts an update.
  Server change ordering must include an entity/unique change tie-break, not `(hlc,id)` alone.
- **Auth:** refresh once, single-flight, then re-authenticate. Rotation replay revokes the family;
  never blindly repeat a consumed refresh. Never discard the outbox on an authentication failure. An
  anonymous installation ID is a correlation value, not authorization to any server rows.
- **General errors:** RFC 9457 `application/problem+json`; status must match code. 429 includes
  Retry-After/rate headers. 5xx backs off or selects the relevant bundled fallback. Readiness 503
  intentionally uses its checks JSON. Machine code drives recovery, not display of provider detail.
- **Content:** ETags and cache metadata on versioned data; 304 has no body. Full catalog and
  resource assets are fetched from the manifest's resource base without bearer tokens. Verify
  checksum/byte length before atomic install; retain the old usable cache on failure. No recording
  asset descriptor is accepted in learner sync. Model audio/reference assets are downloads only.
- **AI:** Spanish/text bounds are wire limits, not quality evaluation. Provider quality, budget,
  safety, ownership and privacy checks remain mandatory in the future service. A schema-valid output
  is not necessarily a correct translation or safe provider response.
- **Streaming:** `Accept: text/event-stream` negotiates SSE; frame `event: started|completed|error`
  and JSON `data:`. Optional started, then exactly one terminal event. Completed contains the entire
  validated scene; no partial provider tokens. An interrupted stream selects bundled continuation.
  No replay/resume via Last-Event-ID is promised.
- **Chat:** draft authoring bounds are 20 recent turns, 2,000 trimmed characters per text field, 128
  KiB transport body. They are not approved rate/cost limits. Normalize before retaining the
  submitted text used by feedback. Corrections reference ordered non-overlapping UTF-16 offsets;
  `validateChatExchange` binds request ID, fresh reply ID and feedback to submitted learner turns.
  No private text enters ordinary sync, logs, analytics or shared personalized caches.
- **Analytics:** validate batch envelope separately from event items. Unknown events/props are
  rejected by index. IDs identify records, never contain learner text; own phrases use `own_` plus a
  salted SHA-256 hash. Documented display labels (e.g. theme) become registered machine slugs;
  destination is a hash, not raw city text. Server adds principal and server timestamp; context's
  app version includes build. Plan 71 still owns consent, hashing salts, registered property values,
  retention, upload budget and exposure events. Shape validity does not authorize collection.
- **Account export:** the stable artifact covers server-owned identity and stable sync records.
  Draft trip/device/billing data need their approved export extension before those features ship.
  Private local chat data must be assembled into a complete export locally. Export must not become a
  backdoor for uploading threads. Erasure repeats return the original scheduled time; signing in
  within the documented 24h window cancels it. Plan 67 must prevent stale-device resurrection.

## Drafts and unavailable contracts

| Draft                                              | Gate / remaining decision                                                                                                                        |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Trip ops and drop resources                        | Q-07: relocation/return/end behavior; parent keys, identity and cascading deletion                                                               |
| Live chat + bundled topic resource shape           | Q-16/Q-18–Q-20: release, budget, local retention and provider text retention                                                                     |
| TTS rendering                                      | Q-15: licensed voice/provenance/versioned cache identity and budget                                                                              |
| Billing verify/read/restore + entitlement snapshot | Q-08/Q-12: products, provider, proof formats, signing protocol, grace/revocation                                                                 |
| Billing webhook                                    | Q-12: actual provider wire format, signature headers and acknowledgement. Request schema is `never`; no fabricated signature scheme is published |
| Account read/devices/revoke/logout                 | Plan 67 transport/UX review; no numbered product gate invented                                                                                   |
| Remote configuration                               | Q-05 and plan 71: registered flags, stable assignment/exposure and experiment authorization                                                      |

Draft operations carry `x-loro-gates`, `x-loro-unresolved`, and `x-loro-auth-boundary`. An empty
gate array means an identified roadmap review, **not** an implemented route. The webhook's
unresolved auth boundary is recorded as metadata, not disguised as a chosen HTTP signature protocol.
No payload is valid until the provider contract replaces `never`. Draft trip components are
published separately and intentionally not admitted by stable sync push/pull. Stable entry points do
not export drafts.

## Validation beyond JSON Schema

Generated JSON Schema describes structure, enums, lengths, ranges and required members. Zod
refinements also check invariants that are not expressible in portable JSON Schema:

- HLC safe-integer/u32 bounds; complete latest-review FSRS groups; daily count/day pairing;
- pack count equals membership; target problem status agrees with code/minimum-version requirement;
- exactly one best scene option, distinct option text, Spanish option word cap;
- unique translation indexes and unknown/low-confidence review;
- chat turn identity, correction spans/text reconstruction, graph references and request-response
  binding;
- entitlement grace ordering.

Server-state checks (ownership, content membership, deduplication, account claims, cursor expiry,
real measured scores, provider safety and signatures), byte limits, rate limits, SSE event ordering,
and other stateful cross-request checks are service/client responsibilities. Translation consumers
use `validateTranslationExchange` to check exact input coverage and order. They are not claimed as
enforced by a single payload schema. Tests exercise the pure contracts; integration plans must
install these checks before release.

### Multilingual integration (F-08)

The runtime also serves three `/v1/content/v2/*` endpoints for learning catalogs. These are
documented in `apps/api/README.md`; their schemas have not yet been added to `openapi.current.json`,
which covers the ten legacy endpoints. Target sync schemas include course identity, personal-meaning
language, and the validated native/target language pair. Course-aware runtime sync remains future
work.
