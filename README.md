# Loro

**Learn languages by the phrase.** A listening-first phrase player for iOS, Android and the web:
hear a phrase in your language, say it in the pause, hear it in the language you're learning, say it
again, then rate how it went. The rating schedules the phrase with FSRS. Courses teach Spanish,
Bulgarian, British and American English, Russian, Polish and Czech; the app speaks English (British
or American), Bulgarian, Russian, Polish and Czech.

This repository holds the app, the API, the shared packages and their documentation.

## Status

The app is the v2.0 design as an Expo app, connected to the API. Four tabs: Home, Explore, Create
and Library; songs live in their sets and play in the one player. The app ships no phrase content:
it downloads each course from the API and keeps it for offline use. A learner signs in by email
code, or with Google or Apple where the server has them configured. Signed in, they make phrase
sets, covers and songs with AI within daily limits, keep them private or share them by link or
publicly (Community), and their progress follows them between devices. Progress lives on the device
first; FSRS runs in the Rust core. See [`apps/mobile/README.md`](apps/mobile/README.md) and
[the library](docs/architecture/library.md).

The earlier v1.1-based app, its design packages and the web prototype were removed on 2026-09-30;
they remain in Git history (last present at `52a0e3b`).

```bash
pnpm check                          # fast lint/type/test/content/drift gate
pnpm ci:local                       # full local CI; GitHub Actions stays disabled
pnpm --filter @loro/mobile web      # the app in a browser
pnpm --filter @loro/mobile android  # Android development build
pnpm --filter @loro/mobile bundle   # proves the iOS bundle compiles
pnpm --filter @loro/api dev         # the API on :3000/v1 (needs PostgreSQL and auth settings)
pnpm local:up                       # the API and the web app in Docker, SOPS-decrypted
```

The API runs on a restricted EC2 development host: see
[EC2 deployment](docs/process/ec2-deployment.md) and
[EC2 backups and recovery](docs/runbooks/backend-testing.md). For containers and secrets, see
[local development](docs/process/local-development.md).

## Reading order

1. [`docs/product/vision.md`](docs/product/vision.md) — what Loro is and the bet it makes
2. [`docs/architecture/overview.md`](docs/architecture/overview.md) — the system, end to end
3. [`docs/design/v2-prototype-decisions.md`](docs/design/v2-prototype-decisions.md) — the v2.0
   design's decisions
4. [`apps/mobile/README.md`](apps/mobile/README.md) — build and run the app

Everything under `docs/` is indexed in [`docs/README.md`](docs/README.md).

## Repository layout

| Path                                              | What it is                                                                                                        |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| [`apps/mobile/`](apps/mobile/README.md)           | The Expo / React Native app (iOS, Android, web)                                                                   |
| [`apps/api/`](apps/api/README.md)                 | NestJS + PostgreSQL: sign-in and the library the app uses, plus the older sync, content, music, TTS and AI routes |
| [`apps/landing/`](apps/landing/README.md)         | The one-page site, with the Android builds read from GitHub releases on each visit                                |
| [`packages/core/`](packages/core/README.md)       | Shared TypeScript domain model, API contracts and sync field policy (API and content only)                        |
| [`packages/core-rs/`](packages/core-rs/README.md) | Rust core: FSRS for the app, the `/v1/sync` merge for the API (UniFFI native, WASM web/Node)                      |
| [`packages/content/`](packages/content/README.md) | The app's seed content (`v2/`) and the first app's Spanish catalog, with their checks                             |
| `docs/`                                           | All documentation — product, architecture, design, process, decisions                                             |
| [`plans/`](plans/README.md)                       | Active plans and the archive of finished ones                                                                     |
| `infra/`, `secrets/`                              | The EC2 and landing-page templates and proxy configuration; the SOPS-encrypted environment files                  |
| `scripts/`                                        | Local CI, Android builds, secrets, and EC2 provisioning, deployment and backups                                   |

## Key architectural decisions

| Decision                                                                                      | Why                                                                  |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| [A Rust core](docs/architecture/adr/0002-shared-rust-core.md)                                 | Scheduling must be identical on iOS, Android, the web and the server |
| [FSRS for scheduling](docs/architecture/adr/0004-fsrs-scheduler.md)                           | A rating is a memory model's input, not a score                      |
| [NestJS + Postgres](docs/architecture/adr/0008-backend-nestjs-postgres.md)                    | We own the sync protocol and the content pipeline                    |
| [Recorded audio never leaves the device](docs/architecture/adr/0011-analytics-and-privacy.md) | A promise to the learner, so a technical requirement                 |

## Licence

Source-available, all rights reserved ([`LICENSE`](LICENSE),
[ADR-0018](docs/architecture/adr/0018-public-source-available-repository.md)): read it, run it
locally, propose changes here; no reuse elsewhere. Security reports go through
[`SECURITY.md`](SECURITY.md).

## Contributing

- Start with [`CONTRIBUTING.md`](CONTRIBUTING.md): what is welcome and how a change lands.
- Run `pnpm ci:local` before merging; checks run on your machine, not in GitHub Actions
  ([CI](docs/process/ci-cd.md)).
- Branches, commits and requirement IDs: [git workflow](docs/process/git-workflow.md).
- Plans: [`plans/README.md`](plans/README.md). Open questions:
  [`docs/decisions/open-questions.md`](docs/decisions/open-questions.md).
- Android testing APKs: `pnpm apk:local`, or `pnpm apk:github` for a draft GitHub prerelease
  ([local APK](docs/process/local-apk.md)).
