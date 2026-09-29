# Loro

**Learn languages by the phrase.** A mobile app (iOS + Android, plus the web) that teaches Spanish,
Bulgarian and Russian as a listening-first phrase player: hear a phrase in your language, say it in
the pause, hear it in the language you're learning, then rate how it went. The rating schedules the
phrase with FSRS.

This repository is the **project root**: architecture, product documentation, development process,
and every buildable artifact — the app and the API.

---

## Status

**The app is the v2.0 design, as an Expo app.** It replaced the earlier v1.1-based app on
2026-09-30; that app, its design packages and the web prototype remain in Git history (last present
at commit `52a0e3b`). Onboarding, Home, the player, Explore, Library and Settings are built; the set
page, the queue, Make a set and the other sheets are still stand-ins. Progress is stored on the
device (AsyncStorage on native, browser storage on the web); FSRS runs in the Rust core through the
`LoroCore` native module or WASM. See [`apps/mobile/README.md`](apps/mobile/README.md) and
[plan 104](plans/104-prototype-react-native.md).

The API (accounts, sync, content, reference TTS, music, phrase suggestions) is unchanged and not yet
called by the new app.

```bash
pnpm ci:local                       # full local CI; GitHub Actions stays disabled
pnpm check                          # fast lint/type/test/content/drift gate
pnpm --filter @loro/mobile web      # the app in a browser
pnpm --filter @loro/mobile android  # Android development build
pnpm --filter @loro/mobile bundle   # proves the iOS bundle compiles
pnpm --filter @loro/api start       # configured PostgreSQL/auth API on :3000/v1
```

**Live connectivity:** the [AWS HTTPS gateway](docs/process/public-api.md) reaches the restricted
EC2 API. See the [current deployment](docs/process/ec2-deployment.md) and the
[testing operations runbook](docs/runbooks/backend-testing.md).

For Docker: `pnpm local:up` starts the API and the web app with a SOPS-encrypted environment. See
[local containers and secrets](docs/process/local-development.md).

---

## Reading order

1. [`docs/product/vision.md`](docs/product/vision.md) — what Loro is and the bet it makes
2. [`docs/product/learning-model.md`](docs/product/learning-model.md) — the pedagogy the app serves
3. [`docs/architecture/overview.md`](docs/architecture/overview.md) — the system, end to end
4. [`docs/design/v2-prototype-decisions.md`](docs/design/v2-prototype-decisions.md) — the v2.0
   design's decisions
5. [`docs/process/onboarding.md`](docs/process/onboarding.md) — get a device running

Everything else is indexed in [`docs/README.md`](docs/README.md).

---

## Repository layout

| Path                | What it is                                                                  |
| ------------------- | --------------------------------------------------------------------------- |
| `docs/`             | All documentation — product, architecture, design, process, decisions       |
| `apps/mobile/`      | The Expo / React Native app (iOS, Android, web)                             |
| `apps/api/`         | NestJS backend — accounts, sync, content, gated TTS/music/suggest           |
| `packages/core/`    | Shared TypeScript domain model and API contracts                            |
| `packages/core-rs/` | Rust core — FSRS, ranking, merge (UniFFI for native, WASM for web and Node) |
| `packages/content/` | Server phrase catalogs, review and validation gates                         |
| `scripts/`          | Repo automation                                                             |

---

## Key architectural decisions

| Decision                                                                                      | Why                                                                  |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| [React Native + Expo](docs/architecture/adr/0001-cross-platform-react-native-expo.md)         | One TS codebase; Expo Modules where we need native code              |
| [A Rust core](docs/architecture/adr/0002-shared-rust-core.md)                                 | Scheduling must be identical on iOS, Android, the web and the server |
| [FSRS for scheduling](docs/architecture/adr/0004-fsrs-scheduler.md)                           | A rating is a memory model's input, not a score                      |
| [NestJS + Postgres](docs/architecture/adr/0008-backend-nestjs-postgres.md)                    | We own the sync protocol and the content pipeline                    |
| [Recorded audio never leaves the device](docs/architecture/adr/0011-analytics-and-privacy.md) | A promise to the learner, so a technical requirement                 |

---

## Local CI

Run `pnpm ci:local` before merging. GitHub Actions is disabled; checks run on your machine. See
[local CI setup and gates](docs/process/ci-cd.md).

Build an Android testing APK with `pnpm apk:local`, or upload a verified draft GitHub prerelease
with `pnpm apk:github`. See [APK prerequisites and signing boundaries](docs/process/local-apk.md).

## Contributing

- Process: [`docs/process/ways-of-working.md`](docs/process/ways-of-working.md)
- Branching and commits: [`docs/process/git-workflow.md`](docs/process/git-workflow.md)
- Definition of done: [`docs/process/definition-of-done.md`](docs/process/definition-of-done.md)

Open questions that still need an owner:
[`docs/decisions/open-questions.md`](docs/decisions/open-questions.md).
