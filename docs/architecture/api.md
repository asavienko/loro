# API

Base: `/v1` (`http://localhost:3000/v1` locally). The model behind the library routes — visibility,
sharing, limits, generation — is in [library.md](library.md); the server's structure in
[backend.md](backend.md).

## Contracts

The wire contract is Zod in `packages/core/src/api/`. The library's request schemas are in
`library.ts` there.

Two OpenAPI documents are generated from the typed operation registries by `pnpm contracts:generate`
and drift-checked by `pnpm contracts:check` (part of `pnpm check`). Never hand-edit them:

- [openapi.current.json](openapi.current.json) — auth, health, content, sync and AI scenes;
- [openapi.target.json](openapi.target.json) — routes the earlier app planned (export, billing,
  analytics and others), most of them never built.

Neither document describes the `/library` routes.

## Library

What the app calls. Reading routes take an optional bearer: none reads as a stranger, a bad one is
`401` so the app refreshes it. The learner's own routes require a bearer.

**Reading**

| Method | Route                                       | Success     | What it returns                                                   |
| ------ | ------------------------------------------- | ----------- | ----------------------------------------------------------------- |
| GET    | `/library/languages`                        | 200         | The languages offered and the courses taught (no database needed) |
| GET    | `/library/pack?target=`                     | 200         | A course: topics, sets, phrases with clips, bank, albums          |
| GET    | `/library/community?kind=&target=&q=&sort=` | 200         | Public `sets` or `albums`, `new` (default) or `popular` first     |
| GET    | `/library/sets/:id`, `/library/albums/:id`  | 200         | One set with its phrases; one album with its songs                |
| GET    | `/library/sets/:id/songs`                   | 200         | The songs sung from a set                                         |
| GET    | `/library/{sets,albums}/:id/more`           | 200         | The maker's other public sets or albums in the course             |
| GET    | `/library/shared/:code`                     | 200         | What a share code opens                                           |
| GET    | `/library/songs/:id`                        | 200         | A song                                                            |
| GET    | `/library/songs/:id/audio`                  | 200/206/416 | Its sound, with byte ranges; a signed URL or a reader who may     |
| GET    | `/library/covers/:id.svg`                   | 200         | A ready cover (immutable)                                         |
| GET    | `/library/covers/:id.json`                  | 200         | Where a cover being drawn stands; polled by the app (plan 111)    |
| GET    | `/library/speech/:utterance.mp3`            | 200         | A phrase clip, rendered on first request; needs no bearer         |

**The learner's own**

| Method      | Route                                          | Success     | What it does                                               |
| ----------- | ---------------------------------------------- | ----------- | ---------------------------------------------------------- |
| GET         | `/library/usage`                               | 200         | Today's allowances and which writer each kind uses         |
| GET, POST   | `/library/profile`                             | 200         | Read or set the display name                               |
| POST        | `/library/sets`, `/library/sets/:id`           | 201, 200    | Create a set; change it (title, visibility, cover, items)  |
| POST        | `/library/sets/:id/phrases/:phraseId`          | 200         | New words for a phrase in the learner's set                |
| DELETE      | `/library/sets/:id`                            | 204         | Delete one's own set                                       |
| POST        | `/library/phrases`                             | 201         | Add a phrase on its own, to a set or "My phrases"          |
| DELETE      | `/library/phrases/:id`                         | 204         | Remove such a phrase                                       |
| POST        | `/library/albums`, `/library/albums/:id`       | 201, 200    | Create an album; change it                                 |
| DELETE      | `/library/albums/:id`                          | 204         | Delete one's own album                                     |
| POST/DELETE | `/library/saves`, `/library/saves/:kind/:id`   | 200, 204    | Save or unsave someone else's readable set or album        |
| POST        | `/library/reports`                             | 200         | Report someone else's shared item                          |
| POST        | `/library/decks`                               | 202         | A deck of suggestions written in the background (plan 111) |
| GET         | `/library/decks/:id`                           | 200         | Where the learner's deck stands; ready with its phrases    |
| POST        | `/library/generate/{phrases,notes,cover,song}` | 200/201/202 | Generate within the day's allowance                        |
| POST        | `/library/songs/:id/retry`                     | 202         | Make a failed song again (another of the day's songs)      |
| DELETE      | `/library/songs/:id`                           | 204         | Take a song out of the learner's album                     |
| GET, POST   | `/library/progress`                            | 200         | The learner's progress; a write on a stale revision is 409 |
| POST        | `/library/me/delete`                           | 200         | Delete everything the learner keeps in the library         |
| POST        | `/library/me/delete-account`                   | 200         | Delete the account with everything in it                   |

A spent allowance or a full account is `429 LIMIT_REACHED` with `resets_at` (`null` for a full
account).

## Auth and health

| Route                                              | What it does                                                            |
| -------------------------------------------------- | ----------------------------------------------------------------------- |
| `GET /auth/capabilities`                           | Which of email, Google and Apple this server can sign in with           |
| `POST /auth/magic-link`, `/auth/magic-link/verify` | Send an email code (202); exchange it for a session                     |
| `POST /auth/:provider/start`                       | Start a Google or Apple sign-in page with PKCE                          |
| `GET`/`POST /auth/:provider/callback`              | The provider's return (Google by query, Apple by form); redirects       |
| `POST /auth/exchange`                              | Trade the one-use ticket and PKCE verifier for a session                |
| `POST /auth/refresh`                               | Rotate the refresh token; reusing one revokes its family                |
| `POST /auth/logout`                                | Revoke the session by refresh token or bearer (204)                     |
| `GET /auth/providers`                              | The browser sign-in providers configured                                |
| `POST /auth/google`, `/auth/apple`                 | Sign in with a provider ID token from a native SDK                      |
| `POST /auth/claim`                                 | Correlate an anonymous device's pending upload with the account         |
| `GET /me`, `/auth/me`                              | The account and device; the account alone                               |
| `GET /health`, `/health/ready`                     | Liveness; readiness checks the database and the WASM merge (503 if not) |

The app's sign-in uses the first seven rows. A presented `X-Loro-Device` must match the session's
device or the request is `403`. Token lifetimes and storage:
[security-privacy.md](security-privacy.md#authentication); the mechanics:
[`apps/api/src/auth/README.md`](../../apps/api/src/auth/README.md).

## Older routes

The earlier app's routes are still served and tested; the current app doesn't call them.

- `/sync/push`, `/sync/pull`, `/sync/status` — HLC sync ([backend.md](backend.md#sync)).
- `/ai/scene`, `/ai/themes`, `/phrases/suggest` — bundled roleplay scenes and phrase suggestions.
  `503 PROVIDER_UNAVAILABLE` whenever sign-in is configured.
- `/tts/status`, `/tts/render`, `/tts/assets/:sha256` — text-to-speech renders by checksum.
- `/music/status`, `/music/lyrics`, `/music/renders`, `/music/tracks/:id[/content]` — music jobs.

### Content

`/content/{manifest,diff,pack}` serve the bundled Spanish catalog in the original es/en wire shape,
and `/content/v2/{manifest,diff,pack}` the bundled catalogs of every language pair. The app's
content comes from `/library/pack` instead.

## Error shape

Every error is RFC 9457 `application/problem+json`, built in `apps/api/src/common/errors.ts`: `type`
(`https://loro.app/errors/<code>`), `title`, `status`, `code`, then any extras such as `retry_after`
or `resets_at`. Clients switch on `code`; `title` and `detail` are for logs, never learner-facing
copy.

| Code                 | Status | Meaning and what the client does                                    |
| -------------------- | ------ | ------------------------------------------------------------------- |
| UNAUTHENTICATED      | 401    | Refresh once, then sign in again; progress on the device stays      |
| FORBIDDEN            | 403    | Not allowed (for example a mismatched device); don't retry          |
| NOT_FOUND            | 404    | Missing, or someone else's private item                             |
| VALIDATION_FAILED    | 422    | The request doesn't match the schema                                |
| CURSOR_EXPIRED       | 409    | Written on an older revision: merge again and retry                 |
| LIMIT_REACHED        | 429    | Daily allowance spent or account full; wait for `resets_at`         |
| RATE_LIMITED         | 429    | Too many requests; respect `Retry-After`                            |
| BUDGET_EXCEEDED      | 429    | Older `/tts` and `/music` routes only: use the bundled fallback     |
| PROVIDER_UNAVAILABLE | 503    | Not configured, or a provider failed (e.g. the day's clips used up) |
| INTERNAL             | 500    | Back off; no internal details are returned                          |

`PLAN_REQUIRED` (402) and `SCHEMA_TOO_OLD` (409) are in the catalog, but no route returns them. The
rate limits are `RATE_LIMITS` in the same file
([security-privacy.md](security-privacy.md#server-hardening) says which are enforced).

## Versioning

`/v1` is the only version. A breaking change needs a compatibility migration or a `/v2` served
alongside. Content versions (a pack's `version`) are independent of the API version.
