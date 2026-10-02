# Security and privacy

Rationale: [ADR-0011](adr/0011-analytics-and-privacy.md).

## The audio promise

**Recorded audio never leaves the device.** No consent exception, no cloud ASR, no "anonymous
sampling". The current app records nothing at all: it asks for no microphone permission, and
`app.config.ts` blocks the one expo-audio would add. If recording is added, PCM stays in native
memory, no JavaScript API returns audio bytes, and no API route accepts it. Licensed model audio
(server phrase clips, songs) is a different thing and may be cached. The one transcription the
server does is of the songs it generated itself, in the API process, to show their lyrics as sung
([ADR-0019](adr/0019-transcribing-generated-songs.md)); no device audio is involved.

## What the server holds

| Data                                                                | Where                              |
| ------------------------------------------------------------------- | ---------------------------------- |
| Account: a keyed hash of the email, or the provider subject         | PostgreSQL (`auth_*`)              |
| Devices, sessions and refresh tokens (hashed)                       | PostgreSQL (`auth_*`)              |
| Pending email codes (hashed, ten minutes)                           | PostgreSQL (`auth_magic_codes`)    |
| Display name                                                        | PostgreSQL (`library_profiles`)    |
| The learner's sets, phrases, albums, songs, covers and saves        | PostgreSQL (`library_*`)           |
| Reports the learner made                                            | PostgreSQL (`library_reports`)     |
| A copy of the learner's progress                                    | PostgreSQL (`library_progress`)    |
| Daily generation and clip counts                                    | PostgreSQL (`library_usage`)       |
| The Expo push tokens of the learner's devices, with the UI language | PostgreSQL (`library_push_tokens`) |
| Rows from the earlier app's sync and music routes                   | PostgreSQL (`sync_*`, `music_*`)   |

Email addresses are never stored in plaintext, and rate-limit buckets key on hashes, never raw
addresses or emails. To send a sign-in code, the address and the code go to Amazon SES in the API's
AWS region ([ADR-0021](adr/0021-email-codes-through-amazon-ses.md)); the API never logs either.

Product analytics and session replay go to PostHog US Cloud
([ADR-0020](adr/0020-posthog-us-cloud.md)), on by default with an opt-out in Settings; replay is
unmasked except the sign-in code, and never includes sound
([ADR-0011](adr/0011-analytics-and-privacy.md#product-analytics-and-session-replay-amended-2026-09-30)).
A learner can delete their library (`POST /library/me/delete`) or their whole account
(`POST /library/me/delete-account`) from the app ([library.md](library.md#accounts)). There is no
data export.

## Authentication

- Email code, Google or Apple; **no passwords**. Provider sign-in pages use PKCE. Accounts are never
  linked by matching email addresses.
- Access token: a JWT (ES256, or HS256 with a key of at least 32 bytes), 15 minutes. Every request
  also checks that its session is live, so signing out takes effect at once.
- Refresh token: 256 random bits, stored as a SHA-256 hash, rotated on every use; its family expires
  90 days after sign-in. Reusing a consumed token revokes the whole family.
- Email codes: six digits, ten minutes, five tries, bound by HMAC to the email and a fresh nonce.
- On iOS and Android the refresh token is in the Keychain/Keystore (`expo-secure-store`); on the web
  in `localStorage`.
- Signing out revokes the refresh token; progress on the device stays.

Details: [`apps/api/src/auth/README.md`](../../apps/api/src/auth/README.md).

## Server hardening

- Every learner query is scoped by the authenticated `user_id`; someone else's private item is
  `404`. A presented `X-Loro-Device` must match the session's device.
- Inputs are validated with Zod schemas from `packages/core`. Errors are RFC 9457 problem details
  without stack traces, SQL or provider text; an unexpected error is logged as its route and class
  only.
- Rate limits: auth 30 requests per 15 minutes per address and 5 code requests per 15 minutes per
  email; sync 120 requests a minute per account; generation by per-learner daily allowances
  ([library.md](library.md#generation-and-limits)); new phrase clips 500 a day for the server and
  100 a day per learner (`LIMIT_SPEECH_*`). Behind the EC2 gateway the address is the `X-Real-IP`
  its nginx sets, trusted only with `TRUST_PROXY=1` and from a loopback or private peer.
- Covers are SVG written only by `covers.ts`: a validated shape spec, or an illustration carried as
  base64 bytes whose signature says PNG, JPEG or WebP; never model markup. They are served with
  `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; img-src data:`. Titles,
  descriptions and display names refuse links.
- Song audio URLs carry an HMAC signature (`LIBRARY_URL_SECRET`, random per process when unset) that
  expires after about 12 hours. Phrase clip URLs are hashes of language and text, and the route
  speaks only text the library holds.
- CORS allows exact configured origins only, without cookies.
- The container runs on a distroless Node 22 image as a non-root user.
- On the EC2 host the API listens on loopback. The public path is an HTTPS gateway (API Gateway, a
  Lambda, nginx) that passes only listed routes; administration goes through an SSH tunnel
  ([ec2-deployment.md](../process/ec2-deployment.md)).

## Secrets

- The app bundle holds no provider keys; every Fireworks, OpenRouter and ElevenLabs call goes
  through the API. `EXPO_PUBLIC_*` values are public.
- What the learner types to have phrases, notes, lyrics or a cover written (a topic, keywords, a
  pasted text, a phrase, a title) is sent to Fireworks, which keeps no prompts for open models, or
  to OpenRouter with `provider.data_collection: "deny"`, which routes only to providers that neither
  keep nor train on prompts ([ADR-0015](adr/0015-open-model-providers.md)). Nothing else of the
  learner's, and never audio.
- Real `.env` files stay local and gitignored. Only SOPS-encrypted `secrets/*.enc.env` are committed
  (`pnpm env:encrypt`).
