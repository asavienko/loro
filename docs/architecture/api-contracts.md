# Executable API contracts

**F-04 / plans 85 and 88.** Auth and sync now consume the shared runtime schemas. The API registers
verified identities, rotates sessions and persists account-scoped sync through PostgreSQL and
canonical Rust merge. The remaining target contracts still describe planned capabilities; a
generated schema alone does not implement a service. The
[integration inventory](backend-integration-inventory.md) accounts for all 23 authored screens and
supporting functionality.

## Sources and entry points

| Surface      | Import                   | Specification                                  | Meaning                                                                                         |
| ------------ | ------------------------ | ---------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Current      | `@loro/core/api/current` | [openapi.current.json](openapi.current.json)   | Twenty-eight documented operations; OAuth, auth, durable sync and multilingual content included |
| Target       | `@loro/core/api/target`  | [openapi.target.json](openapi.target.json)     | Settled contract roadmap; auth/sync payloads also used by current runtime                       |
| Draft        | `@loro/core/api/draft`   | Target document, marked `x-loro-status: draft` | Product/transport review still required; no release authorization                               |
| Catalog wire | `@loro/core/api/catalog` | Referenced content schemas                     | Unbranded snake-case catalog transport, separate from domain views                              |

Every named request/response schema has a corresponding inferred TypeScript type. Types are inferred
from Zod, not maintained as independent DTO interfaces. `Operation` metadata owns methods, paths,
parameters, headers, response media, examples, recovery behavior, owners and gates. Examples are
**illustrative wire fixtures**, not observations, measured learner state, production assets,
provider results or usable purchase proofs. They are never used as application fallback data.

```ts
import { PushResponseSchema, type PushResponse } from '@loro/core/api/target'
const response: PushResponse = PushResponseSchema.parse(untrustedJson)
```

OAuth controllers validate start and device-bound exchange against `@loro/core/api/oauth`. Other
auth controllers validate requests against the shared account schemas. Sync validates the envelope
and classifies each operation independently against the shared sync schemas. Multilingual content
queries consume the shared current schemas. Legacy content and AI retain their current behavior;
their target contracts are not installed as middleware.

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

| Concern                | Current                                                                                                                                                                        | Remaining target / owner                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Successful POST status | Auth/sync explicitly use 200/202; logout is 204. AI scene still returns 201.                                                                                                   | AI migration to explicit 200; 66/76                                                                                |
| Validation             | Auth uses strict shared requests; sync validates envelope plus independent operations. Multilingual content queries use shared schemas; legacy content/AI retain local checks. | Remaining route validation; 66                                                                                     |
| Field HLC              | Encoded string, safe integer physical time and Rust-compatible logical bounds                                                                                                  | Shared implementation complete; 68                                                                                 |
| Pull rows              | `entity_id`, explicit `deleted_at: null` for live rows; tombstones carry empty fields                                                                                          | Shared implementation complete; 68                                                                                 |
| Pull cursor            | Opaque account-bound durable change position; `since: null` bootstrap; limit 1–500                                                                                             | Operational retention policy; 68                                                                                   |
| Sync rejection         | Input `index`, nullable `seq`, machine code; invalid envelope rejects the whole request                                                                                        | Keep permanent rejects available for review; 59/68                                                                 |
| Sync replay            | Durable principal/device/sequence idempotency; changed payload for a reused sequence is rejected                                                                               | Operational retention policy; 68                                                                                   |
| Phrase identity        | Transactional per-account/per-target catalog identity; push and pull return optional `{from,to}` aliases                                                                       | Clients must apply aliases with rows/cursor and remap local references; 59/68                                      |
| Local outbox           | Device persistence serializes typed sync values and retains unacknowledged work                                                                                                | Continued device/restart verification; 59/68                                                                       |
| Field policy           | Explicit sync payload allowlists; Rust remains authoritative for merge                                                                                                         | Draft trip entities remain excluded; 54/68                                                                         |
| Settings legacy fields | `cloudAsrConsent` and `voiceCloneConsent` are excluded from sync                                                                                                               | No audio-upload permission exists; 54/71                                                                           |
| Pack route             | `/content/pack?id=...`; unknown returns 422                                                                                                                                    | `/content/pack/{id}`; unknown returns 404; 61                                                                      |
| Content history        | Whole bundled catalog for older versions; future version treated as up-to-date                                                                                                 | Checksummed resources, historical diffs, atomic cache replacement and future-version rejection; 61                 |
| Auth                   | Google/Apple PKCE callback, direct provider proof or one-time email code; server-derived principal/device; rotating refresh sessions                                           | Deployment needs real provider audiences, signing keys and email delivery configuration; 67                        |
| Claim                  | Authenticated, durable and idempotent; device header/body and request/idempotency IDs must agree                                                                               | Runtime reports upload required; client treats the claim as pending until full local upload is acknowledged; 67/68 |
| Account read/logout    | `GET /me` returns `{user, device_id}`; `POST /auth/logout` revokes the session and returns 204                                                                                 | Rich account/device management remains draft; 67                                                                   |
| Sign-in result         | Tokens, identity and pending upload claim                                                                                                                                      | Entitlements remain draft billing; 67/74                                                                           |
| v1 notifications       | Device registration omits push token                                                                                                                                           | All v1 notifications remain local; 67/70                                                                           |
| Scene                  | Stub JSON when accounts disabled; account deployments return 503 pending ownership review                                                                                      | 3–4 turns, strict options, provenance, validated SSE; 76                                                           |
| Translation confidence | No runtime translation endpoint                                                                                                                                                | Evidence-derived number or null; null/below 0.7 requires review; 65/76                                             |
| Account export         | No runtime route                                                                                                                                                               | Server export job plus local private-data assembly; 67                                                             |
| Analytics              | No ingestion                                                                                                                                                                   | Typed events and partial rejection with server-derived identity/time; 71                                           |

The current document describes implemented request boundaries and responses. Legacy content/AI
schemas describe well-formed caller intent; they do not promise compatibility with every malformed
input those routes may accidentally accept. `sync/status` is an authenticated account diagnostic,
not a learner progress total. The current registry omits the three learning-catalog v2 routes listed
in the multilingual section below.

Stable learner row/log keys are UUIDv7. New `user_phrase` rows require `targetLocale`, `phraseId`,
`source` and `addedAt` so another device can materialize them; updates may be partial. Settings uses
`settings`, while Refrain/streak day keys follow their shared sync schemas. The database serializes
catalog phrase identity creation within an account and target course, and returns aliases when
another device uses a different row ID for that same phrase. Private local audio is never included
in these rows. Trip parent/composite-key semantics remain draft under Q-07.

Deliberate catalog re-adds carry `replaces: {id, deleted_at}` naming an observed retained tombstone.
The server verifies ownership, matching catalog/target identity and deletion time, then chooses a
new canonical generation; concurrent re-adds based on the same proof converge. Prior row IDs stay
tombstoned. Catalog tombstone pulls include optional `catalog_identity` with only catalog ID and
target locale, allowing a fresh device to retain proof without recovering learner text.

OAuth callbacks support Google GET and Apple form POST, exact stored redirect matching, nonce
verification and app/provider PKCE. Exchange returns the shared registered-device sign-in result.
Refresh/logout have one implementation: refresh-body logout is a revocation-only alternative to
bearer logout. Legacy native refresh credentials upgrade with paired installation registration,
retaining their original account UUID and remaining expiry. Imported accounts expose
`created_at: null` when the old schema recorded no creation time. See
[provider setup](google-apple-auth.md).

Latest-review FSRS groups include `srsAlgorithm`; complete historical groups lacking it retain the
known preview policy. Review-log algorithm-only historical payloads remain accepted; complete new
journal metadata includes target, last review, lapses and state. Runtime legacy normalization
happens after original wire receipt hashing. Same-review-time state updates compare the common group
HLC.

Accepted skewed field clocks have receipt-scoped `clock_corrections: [{seq,field,from,to}]`. Retries
return the exact original correction even when their response `server_time` advances.

## Recovery and security semantics

- **Sync:** 500 operations/512 KiB. OpenAPI describes well-formed client payloads. Do not install
  full-batch validation as middleware: validate the envelope, then use `validatePushBatch` to
  classify independent operations. Rejection indexes are zero-based; malformed/missing sequences are
  null. A duplicate sequence after its first occurrence is rejected. Only accepted sequences are
  acked; permanent rejects are retained for review, not blindly retried. An empty update to an
  existing mutable row is a no-op; new phrase rows require their materialization fields.
- **Paging:** persist each applied page and its cursor atomically. An expired/invalidated cursor
  returns `CURSOR_EXPIRED` (409): retain local data/outbox and bootstrap from null. `SCHEMA_TOO_OLD`
  (409) instead carries `min_app_version`, pauses sync and prompts an update. The server cursor uses
  a durable unique change position rather than an HLC-only offset.
- **Auth:** refresh once, single-flight, then re-authenticate. Rotation replay revokes the family;
  never blindly repeat a consumed refresh. Never discard the outbox on an authentication failure. An
  anonymous installation ID is a correlation value, not authorization to any server rows.
- **General errors:** RFC 9457 `application/problem+json`; machine codes drive recovery. Auth/sync
  rate limits return 429 with `Retry-After`; the wider rate-header set remains a target. Sync
  permits 120 requests per account per minute across devices, retained across server restarts. 5xx
  backs off or selects the relevant bundled fallback. Readiness 503 intentionally uses its checks
  JSON. Machine code drives recovery, not display of provider detail.
- **Target content:** ETags and cache metadata on versioned data; 304 has no body. Full catalog and
  resource assets are fetched from the manifest's resource base without bearer tokens. Verify
  checksum/byte length before atomic install; retain the old usable cache on failure. No recording
  asset descriptor is accepted in learner sync. Model audio/reference assets are downloads only.
- **AI:** Spanish/text bounds are wire limits, not quality evaluation. Provider quality, budget,
  safety, ownership and privacy checks remain mandatory in the future service. A schema-valid output
  is not necessarily a correct translation or safe provider response.
- **Target streaming:** `Accept: text/event-stream` negotiates SSE; frame
  `event: started|completed|error` and JSON `data:`. Optional started, then exactly one terminal
  event. Completed contains the entire validated scene; no partial provider tokens. An interrupted
  stream selects bundled continuation. No replay/resume via Last-Event-ID is promised.
- **Chat:** draft authoring bounds are 20 recent turns, 2,000 trimmed characters per text field, 128
  KiB transport body. They are not approved rate/cost limits. Normalize before retaining the
  submitted text used by feedback. Corrections reference ordered non-overlapping UTF-16 offsets;
  `validateChatExchange` binds request ID, fresh reply ID and feedback to submitted learner turns.
  No private text enters ordinary sync, logs, analytics or shared personalized caches.
- **Target analytics:** validate batch envelope separately from event items. Unknown events/props
  are rejected by index. IDs identify records, never contain learner text; own phrases use `own_`
  plus a salted SHA-256 hash. Documented display labels (e.g. theme) become registered machine
  slugs; destination is a hash, not raw city text. Server adds principal and server timestamp;
  context's app version includes build. Plan 71 still owns consent, hashing salts, registered
  property values, retention, upload budget and exposure events. Shape validity does not authorize
  collection.
- **Target account export:** the stable artifact covers server-owned identity and stable sync
  records. Draft trip/device/billing data need their approved export extension before those features
  ship. Private local chat data must be assembled into a complete export locally. Export must not
  become a backdoor for uploading threads. Erasure repeats return the original scheduled time;
  signing in within the documented 24h window cancels it. Plan 67 must prevent stale-device
  resurrection.

## Drafts and unavailable contracts

| Draft                                              | Gate / remaining decision                                                                                                                        |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Trip ops and drop resources                        | Q-07: relocation/return/end behavior; parent keys, identity and cascading deletion                                                               |
| Live chat + bundled topic resource shape           | Q-16/Q-18–Q-20: release, budget, local retention and provider text retention                                                                     |
| TTS rendering                                      | Q-15: licensed voice/provenance/versioned cache identity and budget                                                                              |
| Billing verify/read/restore + entitlement snapshot | Q-08/Q-12: products, provider, proof formats, signing protocol, grace/revocation                                                                 |
| Billing webhook                                    | Q-12: actual provider wire format, signature headers and acknowledgement. Request schema is `never`; no fabricated signature scheme is published |
| Extended account read/devices/revoke/logout        | Plan 67 richer transport/UX review; current `/me` and 204 logout are implemented                                                                 |
| Remote configuration                               | Q-05 and plan 71: registered flags, stable assignment/exposure and experiment authorization                                                      |
| Discover `POST /v1/phrases/suggest`                | Q-21: live garnish, spend caps, provider retention. Draft schema already backs the stub; live dispatch stays off. Auth/rate/body caps stay with the Q-21 enablement. |

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
enforced by a single payload schema. Auth and sync integration tests exercise implemented ownership,
replay, cursor and database behavior. Other planned services still need their own runtime checks
before release.

### Multilingual integration (F-08)

The runtime also serves three `/v1/content/v2/*` endpoints for learning catalogs. These are
registered in `openapi.current.json` alongside health, legacy content/AI, auth, OAuth and sync: 28
operations total. Shared current schemas validate language pairs, scalar query values and decimal
safe-integer catalog versions. Repeated query parameters and unsupported pairs return a 422
validation problem. Defaults remain es-ES/en and version 0; equal versions return no changes, other
versions return the bundled snapshot, and unknown packs remain 422. Tests validate all seven
supported pairs against response schemas and exercise the registered HTTP routes. Implemented shared
sync schemas include course identity, personal-meaning language and validated native/target pairs.
The server canonicalizes catalog phrases separately by target locale, preserving independent course
progress.
