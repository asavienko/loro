# API

The wire contract lives in `packages/core/src/api/` (Zod schemas and typed operation registries).
The generated OpenAPI documents, drift-checked by `pnpm check`, are
[openapi.current.json](openapi.current.json) (the running surface) and
[openapi.target.json](openapi.target.json) (planned routes and gated drafts). Never hand-edit them.

Base: `http://localhost:3000/v1` locally. The model behind the library routes — visibility, sharing,
limits — is in [library.md](library.md).

## Library

What the app calls. Reading routes take an optional bearer (a bad one is 401); the rest require one.
A spent allowance or a full account is `429 LIMIT_REACHED` (`resets_at` is null for a full account).

| Method   | Route                                                       | Success     | What it does                                                 |
| -------- | ----------------------------------------------------------- | ----------- | ------------------------------------------------------------ |
| GET      | `/library/pack?target=`                                     | 200         | Topics, sets, phrases (with clips), bank, albums of a course |
| GET      | `/library/community?kind=&target=&q=&sort=`                 | 200         | Public sets or albums, newest or most saved first            |
| GET      | `/library/sets/:id`, `/library/albums/:id`                  | 200         | One set with phrases; one album with songs                   |
| GET      | `/library/shared/:code`                                     | 200         | What a share code opens                                      |
| GET      | `/library/songs/:id`, `…/audio`                             | 200/206     | A song; its sound (ranges; signed URL or a reader who may)   |
| GET      | `/library/covers/:id.svg`, `/library/speech/:utterance.mp3` | 200         | A cover; a phrase clip (rendered on first request)           |
| GET/POST | `/library/usage`, `/library/profile`                        | 200         | Today's allowances and writers; the display name             |
| POST     | `/library/sets`, `/library/sets/:id`                        | 201/200     | Create a set; change it (title, visibility, cover, phrases)  |
| DELETE   | `/library/sets/:id`                                         | 204         | Delete one's own set                                         |
| POST     | `/library/albums`, `/library/albums/:id`                    | 201/200     | Create an album; change it                                   |
| DELETE   | `/library/albums/:id`                                       | 204         | Delete one's own album                                       |
| POST     | `/library/saves`, DELETE `/library/saves/:kind/:id`         | 200/204     | Save or unsave another's readable item                       |
| POST     | `/library/reports`                                          | 200         | Report another's shared item                                 |
| POST     | `/library/generate/{phrases,notes,cover,song}`              | 200/201/202 | Generate within the day's allowance                          |
| POST     | `/library/decks`                                            | 202         | A deck written in the background (plan 111)                  |
| GET      | `/library/decks/:id`, `/library/covers/:id.json`            | 200         | Where a deck or a cover being made stands; polled by the app |
| GET/POST | `/library/progress`                                         | 200         | The learner's progress; a stale revision is 409              |
| GET      | `/library/{sets,albums}/{id}/more`                          | 200         | The maker's other public sets or albums in the course        |
| POST     | `/library/songs/{id}/retry`                                 | 202         | Make a failed song again (another of the day's songs)        |
| DELETE   | `/library/songs/{id}`                                       | 204         | Take a song out of the learner's album                       |
| POST     | `/library/me/delete`                                        | 200         | Delete everything the learner keeps in the library           |
| POST     | `/library/me/delete-account`                                | 200         | Delete the account with everything in it                     |

## Auth and health

| Route                                              | What it does                                             |
| -------------------------------------------------- | -------------------------------------------------------- |
| `GET /auth/capabilities`                           | Which sign-in methods this server has credentials for    |
| `POST /auth/magic-link`, `/auth/magic-link/verify` | Email code sign-in                                       |
| `POST /auth/google`, `/auth/apple`                 | Verify a provider token                                  |
| `/auth/:provider/start`, `…/callback`, `/exchange` | Browser/auth-session OAuth with PKCE                     |
| `POST /auth/refresh`, `/auth/logout`               | Rotate the refresh token (reuse revokes the family); end |
| `GET /me`                                          | The signed-in account                                    |
| `GET /health`, `/health/ready`                     | Liveness; readiness checks the database and WASM merge   |

Access tokens are JWTs valid for 15 minutes; refresh tokens last 90 days, rotate on use and are
stored hashed.

## Older routes

`/sync/*` (HLC push/pull, see [sync-protocol.md](sync-protocol.md)), `/content/*`, `/ai/*`,
`/phrases/suggest`, `/tts/*` and `/music/*` are still served and tested, but the current app doesn't
call them; it uses `/library/*`.

## Errors

Errors are RFC 9457 `application/problem+json` with a machine-readable `code` (`ProblemSchema`).
`title`/`detail` are not learner-facing copy.

| Code              | Status | Meaning                                                        |
| ----------------- | ------ | -------------------------------------------------------------- |
| UNAUTHENTICATED   | 401    | Refresh once, then sign in again; progress on the device stays |
| FORBIDDEN         | 403    | Not allowed; don't retry                                       |
| NOT_FOUND         | 404    | Missing, or someone else's private item                        |
| VALIDATION_FAILED | 422    | The request doesn't match the schema                           |
| CURSOR_EXPIRED    | 409    | Progress written on an older revision: merge again and retry   |
| LIMIT_REACHED     | 429    | Daily allowance spent or account full (`resets_at`)            |
| RATE_LIMITED      | 429    | Too many requests; respect `Retry-After`                       |
| INTERNAL          | 500    | Back off; no internal details are returned                     |

`RATE_LIMITS` and the full code list are in `apps/api/src/common/errors.ts`.

## Versioning

`/v1` is the only version. A breaking change needs a compatibility migration or a `/v2` served
alongside. Content versions (the pack's `version`) are independent of the API version.
