# Environments

| Concern  | Local                                                  | Development host (EC2)                                        |
| -------- | ------------------------------------------------------ | ------------------------------------------------------------- |
| API      | NestJS on :3000 (host or `pnpm local:up`)              | The same image on one restricted EC2 instance                 |
| Database | PostgreSQL 16 in Docker                                | PostgreSQL 16 on the host's encrypted storage, private        |
| Access   | Loopback only                                          | Public HTTPS gateway for the app; admin through an SSH tunnel |
| Deploy   | Host commands or root Docker Compose                   | `scripts/deploy-ec2.sh`, health-gated with rollback           |
| Data     | Local; seeded from `packages/content/v2/` at API start | Synthetic test users only; never import real learner data     |

Local setup: [local-development.md](local-development.md). The host:
[ec2-deployment.md](ec2-deployment.md) and [the runbook](../runbooks/backend-testing.md). There is
no staging or production environment yet.

## Configuration

`apps/api/.env.example` lists every variable with its default and comment;
`apps/api/src/common/config.ts` is the runtime source of truth. The ones that change behaviour most:

| Variable                                     | Effect                                                                                     |
| -------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `DATABASE_URL`                               | PostgreSQL for accounts, the library and sync                                              |
| `AUTH_*`, `GOOGLE_*`, `APPLE_*`              | Sign-in: signing keys, email-code delivery, provider client IDs                            |
| `CORS_ALLOWED_ORIGINS`                       | Browser origins; local Compose includes 8081 and 8082                                      |
| `ANTHROPIC_API_KEY`, `AI_MODEL_GENERATE`     | Claude writes phrase decks, lyrics and covers; empty uses the labelled fallbacks           |
| `MUSIC_PROVIDER`, `MUSIC_API_KEY`            | `elevenlabs` sings songs; `stub` (default) gives the labelled "Demo sound" instrumental    |
| `TTS_PROVIDER`, `TTS_API_KEY`, `TTS_VOICE_*` | `elevenlabs` renders phrase audio with the Q-15 voices; `stub` (default) spends nothing    |
| `LIMIT_*`                                    | Per-user daily generation allowances and kept-item caps; `LIMIT_SPEECH_*` bounds TTS spend |
| `LIBRARY_URL_SECRET`                         | Signs song audio URLs; set it when several processes share a database                      |
| `NODE_ENV=production`                        | Missing WASM becomes fatal at startup                                                      |

All `EXPO_PUBLIC_*` values are public and baked into a build: never put secrets there. Rebuild the
APK after changing `EXPO_PUBLIC_API_URL`.

## Secrets and data

- Local: plaintext `.env` stays gitignored; commit only `secrets/*.enc.env` (SOPS).
- EC2: secrets are fetched into restricted runtime files; never into images, user data or logs.
- Never log phrase text, tokens or signed URLs. Recorded learner audio never reaches the backend.
