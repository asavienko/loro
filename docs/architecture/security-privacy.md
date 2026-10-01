# Security and privacy

Rationale: [ADR-0011](adr/0011-analytics-and-privacy.md).

## The audio promise

**Recorded audio never leaves the device.** No consent exception, no cloud ASR, no "anonymous
sampling". The current app records nothing at all; if recording is added, PCM stays in native
memory, no JavaScript API returns audio bytes, and no API route accepts it. Licensed model audio
(server phrase clips, songs) is a different thing and may be cached.

## What the server holds

| Data                                             | Where                                     |
| ------------------------------------------------ | ----------------------------------------- |
| Account: email or provider subject, display name | PostgreSQL (`auth_*`, `library_profiles`) |
| Sessions and refresh tokens (hashed)             | PostgreSQL                                |
| The learner's sets, albums, songs, covers, saves | PostgreSQL (`library_*`)                  |
| A copy of the learner's progress log             | PostgreSQL (`library_progress`)           |
| Daily generation counts                          | PostgreSQL (`library_usage`)              |

Product analytics and session replay go to PostHog EU Cloud, on by default with an opt-out in
Settings; replay is unmasked except the sign-in code, and never includes sound
([ADR-0011](adr/0011-analytics-and-privacy.md#product-analytics-and-session-replay-amended-2026-09-30)).
A learner can delete their library (`POST /library/me/delete`) or their whole account
(`POST /library/me/delete-account`) from the app ([library.md](library.md#accounts)).

## Authentication

- Email code, Google or Apple; **no passwords**. OAuth uses PKCE.
- Access token: JWT (ES256 with a configured key), 15 minutes.
- Refresh token: opaque, 90 days, rotated on every use and stored as a SHA-256 hash. Reusing a
  consumed token revokes the whole family.
- On the device the refresh token is in the Keychain/Keystore (`expo-secure-store`); on the web in
  `localStorage`.
- Signing out revokes the refresh token; progress on the device stays.

## Server

- Every learner query is scoped by the authenticated `user_id`; someone else's private item is
  `404`.
- Inputs are validated with Zod; errors are RFC 9457 problem details with no stack traces or
  internal text.
- Auth attempts are rate-limited per IP; generation is capped per learner per day.
- Covers are SVG written only by `covers.ts` from a validated shape spec, never model markup, and
  are served with `Content-Security-Policy: default-src 'none'`. Titles and names refuse links.
- Song audio URLs are signed (`LIBRARY_URL_SECRET`) and expire after about 12 hours.
- The container runs on a distroless Node 22 image.
- The EC2 host exposes no public HTTP port by default; administration goes through an SSH tunnel
  ([ec2-deployment.md](../process/ec2-deployment.md)).

## Secrets

- The app bundle holds no provider keys; every Anthropic and ElevenLabs call goes through the API.
- Real `.env` files stay local and gitignored. Only SOPS-encrypted `secrets/*.enc.env` are committed
  (`pnpm env:encrypt`).
