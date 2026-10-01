# Backend

The `api` service. Rationale: [ADR-0008](adr/0008-backend-nestjs-postgres.md). Routes:
[api.md](api.md). What the current app uses: [library.md](library.md).

The backend serves content packs, accounts, sharing, AI generation and a copy of each learner's
progress. It does not run a practice session: a learner with a downloaded pack practises with the
API unreachable.

## Modules

```
apps/api/src/
├── main.ts           # /v1 prefix, problem-details filter, production WASM startup gate
├── app.module.ts     # imports the feature modules
├── platform.module.ts# chooses repositories, providers and the clock (global)
├── library/          # what the app uses: packs, sets, albums, sharing, limits,
│                     # generation, phrase clips, songs, progress
├── auth/             # email code, Google, Apple; sessions and refresh tokens
├── common/           # clock, config, problem details, HTTP helpers
├── database/         # PostgreSQL client and additive schema
├── health/           # liveness and readiness (database, WASM)
├── integrations/     # Anthropic and ElevenLabs transports
├── sync/             # HLC push/pull with the Rust merge (not used by the current app)
├── content/ ai/ tts/ music/   # earlier routes, kept; the app uses library/ instead
└── testing/
```

`platform.module.ts` is the one place adapters are chosen (Postgres repositories, stub or live
providers, the clock). Configuration is read through `common/config.ts`, one accessor per variable;
don't read `process.env` elsewhere.

## Storage

PostgreSQL through `pg` with handwritten, additive SQL. On first use the API installs its schema in
one transaction (`database/schema.ts`, `auth/auth.schema.ts`, `library/library.schema.ts`); there is
no migration runner. The library seeds Loro's content from `packages/content/v2/` when the content
version changes. Song audio and phrase clips are stored in PostgreSQL (`library_audio`,
`library_speech`). There is no Redis, queue or worker tier.

## Providers

| Variable                                  | Without it                                                     |
| ----------------------------------------- | -------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`                       | Phrase bank, drawn cover patterns, the set's phrases as lyrics |
| `MUSIC_PROVIDER=elevenlabs` + key         | A synthesized "Demo sound" instrumental                        |
| `TTS_PROVIDER=elevenlabs` + pinned voices | No server clips; the app uses the device voice                 |

Every fallback is labelled where the learner sees it.

## Security

- Every learner query is scoped by the authenticated `user_id`.
- Errors are RFC 9457 problem details, without stack traces or internal text.
- Inputs are validated with Zod schemas from `packages/core`.
- Generation is counted per learner per UTC day before any provider is called
  ([library.md](library.md#generation-and-limits)).
- No route accepts recorded learner audio.

More in [security-privacy.md](security-privacy.md).

## Running it

Locally: [local-development.md](../process/local-development.md) and
[library.md](library.md#running-it-locally). The development deployment is one EC2 host with
PostgreSQL, reached through an SSH tunnel: [ec2-deployment.md](../process/ec2-deployment.md).
