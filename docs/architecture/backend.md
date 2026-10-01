# Backend

The `api` service in `apps/api`. Rationale: [ADR-0008](adr/0008-backend-nestjs-postgres.md). Routes:
[api.md](api.md). What the current app uses: [library.md](library.md). Running, testing and building
it: [`apps/api/README.md`](../../apps/api/README.md).

The backend serves content packs, accounts, sharing, AI generation, phrase clips, songs and a copy
of each learner's progress. It does not run a practice session: a learner with a downloaded pack
practises with the API unreachable.

## Modules

```
apps/api/src/
├── main.ts             # startup gates, CORS, listen on :3000
├── http-app.ts         # /v1 prefix, body limits, problem-details filter (shared with tests)
├── app.module.ts       # composition root: feature modules + AuthBoundaryGuard
├── platform.module.ts  # adapter choices (global)
├── library/            # what the app uses: packs, sets, albums, sharing, limits, generation,
│                       # phrase clips, songs, progress
├── auth/               # email code, Google, Apple; sessions and refresh tokens
├── health/             # liveness and readiness
├── common/             # config, clock, errors, rate limits, HTTP helpers
├── database/           # PostgreSQL client and the named migrations
├── integrations/       # Fireworks/OpenRouter text, OpenRouter images, ElevenLabs transports
├── sync/ content/ ai/ tts/ music/   # the earlier app's routes: mounted, not called
└── testing/            # PostgreSQL test helpers
```

Every feature module is imported by `app.module.ts`, so every route in [api.md](api.md) is served.
`app.module.ts` also registers `AuthBoundaryGuard` globally: whenever the session engine is
configured (a signing key, sign-in not disabled), it closes the routes marked
`@PendingAccountIsolation()` — `/ai/*` and `/phrases/suggest` — with `503 PROVIDER_UNAVAILABLE`.

`platform.module.ts` is the one place adapters are chosen: the PostgreSQL database, the clock, the
PostgreSQL rate-limit store, the sync repository, the music repository and adapter, the TTS
transport and the AI scene providers. A test overrides one of those tokens rather than reaching past
the seam. Configuration is read through `common/config.ts`, one accessor and one default per
variable; the variables are listed in [environments.md](../process/environments.md).

## HTTP

`main.ts` loads `apps/api/.env` when it exists, then:

- refuses to start in production without the Rust merge's WASM build (`pnpm core-rs:build`); in
  development it warns, `/v1/sync` fails and readiness reports `merge: unavailable`;
- refuses to start when the database is unreachable, in production with `DATABASE_URL` set or
  whenever browser OAuth is enabled (`AUTH_ENABLED=true`);
- allows CORS from the exact origins in `CORS_ALLOWED_ORIGINS` plus the HTTPS and loopback origins
  of `AUTH_REDIRECT_URIS`, for `GET`, `POST` and `DELETE`, without cookies.

`http-app.ts` sets the `/v1` prefix, a 4 MB JSON body limit (room for a learner's progress) and 32
KB for forms, and the filter that turns every error into problem details
([api.md](api.md#error-shape)).

## Storage

PostgreSQL through `pg` with handwritten SQL. Each module owns its schema (`auth/auth.schema.ts`,
`sync/sync.schema.ts`, `music/music.schema.ts`, `library/library.schema.ts`), and
`database/migrations.ts` lists them as named, additive migrations (`001_auth` to `013_set_refs`). On
the first query the API applies the ones missing from `schema_migrations` in one transaction under
an advisory lock; a failure rolls the whole batch back.

The library seeds Loro's content from `packages/content/v2/` on first use after the content version
or the seed revision changes ([library.md](library.md#where-content-lives)). Song audio and phrase
clips are stored in PostgreSQL, content-addressed (`library_audio`). There is no Redis, queue or
worker tier: songs are made in the background inside the API process, and the app polls them.

## Providers

| Configured                                           | Without it (labelled where the learner sees it)                      |
| ---------------------------------------------------- | -------------------------------------------------------------------- |
| `FIREWORKS_API_KEY` / `OPENROUTER_API_KEY`           | Phrase bank, Loro's rules for notes, drawn covers, phrases as lyrics |
| `MUSIC_PROVIDER=elevenlabs` and `MUSIC_API_KEY`      | A synthesized "Demo sound" instrumental                              |
| `TTS_PROVIDER=elevenlabs`, its key, model and voices | No phrase clips: the app can't play a phrase and says so             |

The transports are in `integrations/` (`openai-compatible/` and `openrouter/` for the text and image
models of [ADR-0015](adr/0015-open-model-providers.md),
[ElevenLabs](../../apps/api/src/integrations/elevenlabs/README.md) for voices and music). Generation
and its limits: [library.md](library.md#generation-and-limits).

## Sync

The `/v1/sync` routes are the earlier app's per-field HLC sync
([sync-protocol.md](sync-protocol.md)); the current app syncs progress through `/library/progress`
instead. They need a bearer and a matching `X-Loro-Device`, and merge with the Rust core's WASM
build, the same code the devices run ([ADR-0002](adr/0002-shared-rust-core.md)).

- A push holds at most 500 operations and 512 KiB. Each account's transaction takes a PostgreSQL
  advisory lock; rows, change revisions, receipts and the HLC commit together or not at all.
- `(user_id, device_id, seq)` is the replay key: an exact retry returns its original receipt,
  aliases and clock corrections; different content at the same sequence is rejected.
- Clock stamps more than 24 hours ahead of server time are corrected by the Rust helper, and the
  correction is stored with the receipt.
- Pull cursors are opaque, stored with their account and snapshot; another account's or an unknown
  cursor is `409 CURSOR_EXPIRED`, and the device starts a full pull keeping its local writes.
- When two IDs name the same catalog phrase in a course, the first stored is canonical and the
  others become aliases returned by push and pull.
- Tombstones, receipts, aliases and cursors are kept without garbage collection.
- An account may make 120 sync requests a minute, across its devices (`429` with `Retry-After`).

## Security

Request scoping, validation, rate limits, covers, signed URLs and the host are in
[security-privacy.md](security-privacy.md#server-hardening). No route accepts recorded learner
audio.

## Running it

[`apps/api/README.md`](../../apps/api/README.md), [library.md](library.md#running-it-locally) and
[local-development.md](../process/local-development.md). The development deployment is one EC2 host
with PostgreSQL behind an HTTPS gateway, administered through an SSH tunnel:
[ec2-deployment.md](../process/ec2-deployment.md).
