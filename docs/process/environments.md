# Environments

| Concern  | Local                                                                                       | Development host (EC2)                                        |
| -------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| API      | NestJS on :3000 (host or `pnpm local:up`)                                                   | The same image on one restricted EC2 instance                 |
| Database | PostgreSQL 16 in Docker                                                                     | PostgreSQL 16 on the host's encrypted disk, private network   |
| Access   | Loopback only                                                                               | Public HTTPS gateway for the app; admin through an SSH tunnel |
| Deploy   | Host commands or root Docker Compose                                                        | `scripts/deploy-ec2.sh`, health-gated with rollback           |
| Data     | Local; Loro's content seeded from `packages/content/v2/` the first time the library is used | Synthetic test users only; never import real learner data     |

<a id="local"></a>Local setup: [local-development.md](local-development.md). The host:
[ec2-deployment.md](ec2-deployment.md) and [the runbook](../runbooks/backend-testing.md). There is
no staging or production environment.

## Configuration

`apps/api/src/common/config.ts` reads every API variable and owns its default (two limits are read
in `library/speech.ts` and `library/library.service.ts`). The API loads `apps/api/.env` itself when
run on the host; Compose passes the same file; the EC2 host uses `/opt/loro/runtime/api.env`.
`apps/api/.env.example` gives local values. Variables in it that are not listed below are read by
nothing.

### The app (build time)

| Variable                   | Default                    | Effect                                                                                                                                           |
| -------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `EXPO_PUBLIC_API_URL`      | `http://localhost:3000/v1` | The API the app loads courses, sign-in and generation from                                                                                       |
| `EXPO_PUBLIC_WEB_URL`      | —                          | HTTPS web origin for links shared from a phone; unset, they are `loro://` links                                                                  |
| `EXPO_PUBLIC_POSTHOG_KEY`  | —                          | PostHog project key; unset, no analytics, session replay, logs or error tracking ([ADR-0011](../architecture/adr/0011-analytics-and-privacy.md)) |
| `EXPO_PUBLIC_POSTHOG_HOST` | `https://eu.i.posthog.com` | PostHog host                                                                                                                                     |

`EXPO_PUBLIC_*` values are public and baked into a build: never put secrets there, and rebuild after
changing one. Expo reads them from the environment or `apps/mobile/.env`; the APK runner ignores
dotenv files and validates the URLs ([local-apk.md](local-apk.md#api-url)). `LORO_LOCAL_APK` and
`LORO_ANDROID_DEV_CLIENT` choose the Android identity in `apps/mobile/app.config.ts`; the build
scripts set them.

### API: core

| Variable               | Default | Effect                                                                                                                 |
| ---------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------- |
| `PORT`                 | `3000`  | Listen port                                                                                                            |
| `DATABASE_URL`         | —       | PostgreSQL for accounts, the library and sync; nothing the app does works without it                                   |
| `NODE_ENV`             | —       | `production`: a missing WASM merge or an unreachable database stops startup; loopback HTTP is refused for sign-in URLs |
| `CORS_ALLOWED_ORIGINS` | —       | Comma-separated browser origins; the origins of `AUTH_REDIRECT_URIS` are added                                         |
| `TRUST_PROXY`          | —       | `1` only behind the EC2 gateway's nginx: sign-in limits key on its `X-Real-IP`, from a private peer only               |

### API: sign-in

| Variable                                                                | Default                                        | Effect                                                                                                                                                                         |
| ----------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `AUTH_ENABLED`                                                          | —                                              | `false` turns all sign-in off; `true` adds browser Google/Apple sign-in and then requires `AUTH_PUBLIC_URL`, `AUTH_REDIRECT_URIS`, `DATABASE_URL` and a signing key at startup |
| `AUTH_PRIVATE_KEY_PEM`                                                  | —                                              | P-256 PKCS8 key: tokens are signed ES256                                                                                                                                       |
| `AUTH_SIGNING_KEY`                                                      | —                                              | HS256 key of 32+ bytes, used when there is no PEM                                                                                                                              |
| `AUTH_KEY_ID`                                                           | `primary`                                      | Token key ID                                                                                                                                                                   |
| `AUTH_ISSUER`                                                           | `AUTH_PUBLIC_URL`, else `https://api.loro.app` | Token issuer                                                                                                                                                                   |
| `AUTH_PUBLIC_URL`                                                       | —                                              | The API's public origin: HTTPS, or loopback HTTP outside production                                                                                                            |
| `AUTH_REDIRECT_URIS`                                                    | —                                              | Comma-separated return URLs: HTTPS, loopback HTTP, `loro://account`, `loro-dev://account`                                                                                      |
| `AUTH_EMAIL_HASH_KEY`                                                   | —                                              | 32+ characters; keys email identities and codes. Changing it creates new email accounts                                                                                        |
| `AUTH_MAGIC_DELIVERY_URL`                                               | —                                              | Where email codes go: an HTTPS webhook, loopback HTTP outside production, or `inbox:local`                                                                                     |
| `AUTH_MAGIC_DELIVERY_TOKEN`                                             | —                                              | The webhook's bearer; email sign-in needs it even with `inbox:local`                                                                                                           |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`                              | —                                              | Google sign-in in the browser                                                                                                                                                  |
| `GOOGLE_CLIENT_IDS`                                                     | `GOOGLE_CLIENT_ID`                             | Comma-separated client IDs accepted in Google ID tokens                                                                                                                        |
| `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` | —                                              | Apple sign-in in the browser                                                                                                                                                   |
| `APPLE_CLIENT_IDS`                                                      | `APPLE_CLIENT_ID`                              | Comma-separated client IDs accepted in Apple ID tokens                                                                                                                         |

Email codes are offered when a signing key, `AUTH_EMAIL_HASH_KEY`, a valid delivery URL and its
token are all set; `GET /v1/auth/capabilities` reports which sign-in methods are available. How the
tokens, codes and limits work: [`apps/api/src/auth/README.md`](../../apps/api/src/auth/README.md).

### API: the library

| Variable                                                       | Default                                           | Effect                                                                                                                                                                                                    |
| -------------------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FIREWORKS_API_KEY`                                            | —                                                 | DeepSeek V4.1 Flash on Fireworks writes phrase sets, notes, lyrics and cover shapes ([ADR-0015](../architecture/adr/0015-open-model-providers.md)); with neither model key, the labelled fallbacks answer |
| `FIREWORKS_MODEL`                                              | `accounts/fireworks/models/deepseek-v4p1-flash`   | The Fireworks model                                                                                                                                                                                       |
| `OPENROUTER_API_KEY`                                           | —                                                 | The same model through OpenRouter when Fireworks fails, and Muse Image drawing covers                                                                                                                     |
| `OPENROUTER_TEXT_MODEL`, `OPENROUTER_IMAGE_MODEL`              | `deepseek/deepseek-v4.1-flash`, `meta/muse-image` | The OpenRouter models                                                                                                                                                                                     |
| `LIMIT_PHRASES_DAILY`, `LIMIT_COVER_DAILY`, `LIMIT_SONG_DAILY` | `30`, `10`, `5`                                   | Each learner's generations per UTC day; `0` turns that kind off                                                                                                                                           |
| `LIMIT_SETS_KEPT`, `LIMIT_ALBUMS_KEPT`, `LIMIT_SONGS_KEPT`     | `100`, `30`, `120`                                | What one account keeps                                                                                                                                                                                    |
| `LIBRARY_URL_SECRET`                                           | random per process                                | Signs song audio URLs; set it so they survive a restart or work across processes                                                                                                                          |
| `LIBRARY_VOICE_LORO_SONGS`                                     | on                                                | `0` leaves Loro's album songs instrumental instead of voicing them once in the background                                                                                                                 |
| `MUSIC_PROVIDER`, `MUSIC_API_KEY`                              | `stub`, —                                         | `elevenlabs` with a key sings songs; otherwise they get the labelled "Demo sound" instrumental                                                                                                            |
| `MUSIC_BASE_URL`                                               | `https://api.elevenlabs.io`                       | ElevenLabs Music endpoint                                                                                                                                                                                 |

Where the keys go: locally, `apps/api/.env` (host commands) or, for `pnpm local:up`, which decrypts
`secrets/api.enc.env` over `apps/api/.env`, that encrypted file (`pnpm env:edit`). For the
development host, `secrets/ec2-api.enc.env`:
[Turning on the AI writers and ElevenLabs Music](ec2-deployment.md#turning-on-the-ai-writers-and-elevenlabs-music).

### API: voices

Every phrase the app plays is a clip rendered by the server's voices; the app has no device voice.

| Variable                                                | Default         | Effect                                                                                                                                               |
| ------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TTS_PROVIDER`                                          | `stub`          | `elevenlabs` renders phrase clips; `stub` renders none, so phrases have no sound                                                                     |
| `TTS_API_KEY`, `TTS_MODEL`, `TTS_VOICE_ES_ES`           | —               | Required with `elevenlabs` (`.env.example` has the model `eleven_multilingual_v2`)                                                                   |
| `TTS_OUTPUT_FORMAT`                                     | `mp3_44100_128` | Clip format                                                                                                                                          |
| `TTS_VOICE_BG_BG`, `TTS_VOICE_RU_RU`, `TTS_VOICE_EN_GB` | —               | One pinned voice per language (Q-15); a language without one gets no clips. `EN_GB` speaks English-speaking learners' prompts and the English course |
| `TTS_VOICE_EN_US`, `TTS_VOICE_PL_PL`, `TTS_VOICE_CS_CZ` | —               | The same for American English, Polish and Czech (2026-10-02); not yet chosen, so those languages are silent                                          |
| `LIMIT_SPEECH_RENDERS_DAILY`                            | `500`           | New clips rendered per UTC day, server-wide                                                                                                          |
| `LIMIT_SPEECH_OWNER_DAILY`                              | `100`           | New clips per UTC day for one learner's own phrases                                                                                                  |

`pnpm content:render` reads the same `TTS_*` variables from its environment.

### API: older routes the app doesn't call

| Variable                                                             | Default                                | Effect                                                   |
| -------------------------------------------------------------------- | -------------------------------------- | -------------------------------------------------------- |
| `AI_PROVIDER`                                                        | `stub`                                 | `/v1/ai`: only `stub`, the bundled scenes, is registered |
| `TTS_STUB_RENDER`                                                    | `0`                                    | `1`: `/v1/tts` renders labelled silence                  |
| `TTS_CACHE_DIR`                                                      | `loro-tts-cache` in the OS temp folder | `/v1/tts` file cache                                     |
| `CDN_BASE_URL`                                                       | `http://localhost:9000/loro-content`   | Audio base in `/v1/content` manifests                    |
| `MUSIC_MONTHLY_BUDGET_USD_PER_USER`, `MUSIC_DAILY_BUDGET_USD_GLOBAL` | `0`                                    | `/v1/music` budgets                                      |

### Tests

`LORO_TEST_DATABASE_URL` points the API's `*.postgres.test.ts` suites at a PostgreSQL database;
without it they are skipped. `scripts/ci-auth-postgres.sh` sets it to a disposable container.
Variables of the build and deploy scripts are documented with them ([ci-cd.md](ci-cd.md),
[local-apk.md](local-apk.md), [ec2-deployment.md](ec2-deployment.md)).

## Secrets and data

- Local: plaintext `.env` stays gitignored; commit only `secrets/*.enc.env` (SOPS).
- EC2: secrets are copied into root-owned mode-600 runtime files, never into images, user data or
  logs.
- Never log phrase text, tokens or signed URLs. Recorded learner audio never reaches the backend.
