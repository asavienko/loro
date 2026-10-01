# CLAUDE.md

Guidance for Claude Code working in this repository.

## What this is

**Loro** — a mobile app (iOS + Android, plus the web) that teaches Spanish, Bulgarian, British and
American English, Russian, Polish and Czech by the phrase, in an English, Bulgarian, Russian, Polish
or Czech interface (never a course in the learner's own language; en-GB and en-US count as one): a
listening-first player (hear a phrase in your language, say it in the pause, hear it in the target
language, say it again, rate it; FSRS schedules the next time).

**The app is `apps/mobile`: the v2.0 design as an Expo app** (plan
[104](plans/104-prototype-react-native.md)). It replaced the v1.1-based app on 2026-09-30. That app,
the v1.1/v1.2/v1.3 design packages, the v2.0 web prototype, `packages/design-tokens` and the browser
E2E/storybook/workbench suites were removed; they remain in Git history (last present at `52a0e3b`).
Every screen and sheet of the web prototype is ported. Four tabs: Home, Explore, Create and Library
(plan [107](plans/archive/2026-09-30/107-one-player.md)): songs live in their sets (a music-note
icon tells them from phrases) and play in the one player, rated like phrases; albums are in Library;
one light palette.

**The app is connected** (plan [106](plans/106-connected-app.md),
[library.md](docs/architecture/library.md)): it ships no phrase content. It downloads each course's
pack from `GET /v1/library/pack` (seeded from `packages/content/v2/`), keeps it for offline use and
installs it before learner state loads. Product analytics, session replay, logs, error tracking and
metrics go to PostHog EU (`apps/mobile/src/analytics`; shared code reports through
`src/shared/analytics/telemetry.ts`; on by default with an opt-out in Settings, never audio;
[ADR-0011](docs/architecture/adr/0011-analytics-and-privacy.md)). Sign-in (email code, Google,
Apple) goes through the API's `auth` module; sharing (private/link/public, Community), progress sync
and AI generation of phrase sets, covers and songs (within per-user daily limits) go through its
`library` module: DeepSeek on Fireworks writes (the same model through OpenRouter when it fails) and
Muse Image draws covers, decks and covers in the background
([ADR-0015](docs/architecture/adr/0015-open-model-providers.md)); without
`FIREWORKS_API_KEY`/`OPENROUTER_API_KEY` or a music provider the server uses labelled fallbacks
(phrase bank, drawn patterns, the set's phrases as lyrics, a "Demo sound" instrumental). A song's
lyrics are written first, in one of twelve styles, for the learner to read, rewrite and approve; the
sung song is heard back by ElevenLabs Scribe so its lines show as sung, timed and translated
([ADR-0019](docs/architecture/adr/0019-transcribing-generated-songs.md): only audio the server made
is ever transcribed); the phone gets a push when it is ready (plan
[113](plans/113-lyrics-first-songs.md)). Every sound is the server's: phrases play the clips of its
ElevenLabs voices (`TTS_*`, one per language), and the app has no device voice; the list of
languages comes from `GET /v1/library/languages` (plan
[108](plans/archive/2026-10-01/108-backend-only.md)). Progress stays on the device first
(AsyncStorage native, browser storage web) as an append-only learner log with a pure state machine;
FSRS runs in `packages/core-rs` through the `LoroCore` Expo module (`apps/mobile/modules/loro-core`,
UniFFI) on native and the committed WASM browser build on the web. The API (NestJS + PostgreSQL) is
deployed to a restricted EC2 host.

## Keep this file current

This file is loaded into context on every session, so a stale line here misleads every session that
follows. When you find it wrong — or make it wrong — fix it in the same change. Keep it short;
long-form belongs in `docs/`.

## Read these first

- [`README.md`](README.md) — orientation
- [`apps/mobile/README.md`](apps/mobile/README.md) — how the app is built
- [`docs/README.md`](docs/README.md) — the documentation index
- [`docs/design/v2-prototype-decisions.md`](docs/design/v2-prototype-decisions.md) — the v2.0
  design's decisions

## The app is the design reference

There is no separate authored design package any more. The running app in `apps/mobile` and
`docs/design/v2-prototype-decisions.md` are the reference; intended-design changes are recorded in
`docs/`. For how a screen was meant to behave, the web prototype's version in Git history
(`design/design-v2.0/rapid-ui-prototype/src/`) is what it ported.

## The three non-negotiables

A change that violates one of these is reverted, not discussed.

1. **Recorded audio never leaves the device.** PCM stays in native memory; no JS API returns audio
   bytes. Cloud ASR is forbidden. ([ADR-0011](docs/architecture/adr/0011-analytics-and-privacy.md))
2. **Every number shown to a learner is real.** Scores, latencies and recall come from real
   measurement or the real model — never estimated or simulated, not even behind a flag.
   `src/shared/state/selectors.ts` derives every number on screen.
3. **No screen shames a missed day.** ([copy-and-tone.md](docs/design/copy-and-tone.md))

## Conventions

- **`master` means `main`.** Interpret it as `main` for branch operations without asking.
- **The repository is public and source-available**
  ([ADR-0018](docs/architecture/adr/0018-public-source-available-repository.md),
  [public-repository.md](docs/process/public-repository.md)): everything committed, and its history,
  is readable by anyone. No host identifiers, learner data or internal-only notes in the tree;
  `SECURITY.md` and `CONTRIBUTING.md` are the public-facing contracts.
- **Never commit or push unencrypted environment files.** Real `.env`, `.env.*`, and `*.env` values
  stay local and gitignored; `.env.example` is the only plaintext exception. Run `pnpm env:encrypt`
  before committing API configuration; commit only SOPS-encrypted `secrets/*.enc.env`. Never stage
  private age identities, use `git add -f` to bypass this, or put credentials in logs or commits.
- **Requirement IDs** (`P3-01`, `AI-06`, `F-03`) from [`docs/product/prd.md`](docs/product/prd.md)
  go in branches, commits and PRs.
- **Commits**: Conventional Commits with the scope list in `commitlint.config.cjs`
  ([git-workflow.md](docs/process/git-workflow.md)). Commit in meaningful chunks — one coherent
  change each, with its requirement ID, each leaving `pnpm check` green. PRs are squash-merged, so
  the branch's commits are where the reasoning survives. Don't mix a refactor into a fix, and don't
  let generated output ride along in an unrelated commit.
- **Active plans live in `plans/NN-topic.md`.** Completed or superseded plans move to
  `plans/archive/<date>/`, indexed by [`plans/archive/README.md`](plans/archive/README.md); no
  redirect files. Each plan has a `**Status:**` line and a row in
  [`plans/README.md`](plans/README.md) (`🟡` in progress — say what is left and what blocks it, `⛔`
  blocked, `—` ready, `✅` done). **Numbers are never reused**; the README's "next new plan is N"
  line is checked by `pnpm check:plan-index`. Recheck concurrent worktrees before allocating an ID.
  Older plans, the reviews and stale docs were removed on 2026-09-30 (Git history at `e36cc758`);
  keep `docs/` and `plans/` to what is true of the current code.
- **Record every key decision in `docs/`, in the same change that makes it** — whether the user made
  it in conversation or it was settled during the work. Write what was chosen, why, and what was
  rejected. A hard-to-reverse, cross-cutting or contested technical choice gets an ADR in
  [`docs/architecture/adr/`](docs/architecture/adr/README.md) (superseded, never rewritten); how the
  app behaves goes in [`v2-prototype-decisions.md`](docs/design/v2-prototype-decisions.md); a
  decision still open goes in [`open-questions.md`](docs/decisions/open-questions.md), and its
  answer moves to one of the others. A decision that lives only in a chat, a commit or a plan (plans
  get archived) is lost.
- **App code** (`apps/mobile`): shared, platform-neutral behaviour lives in `src/shared/` (imported
  as `@shared/*`); native replacements for storage, the key-value store, the refresh token, phrase
  clips, cues, touch feedback, provider sign-in and the Rust core live in `src/platform/` and are
  swapped in on iOS and Android by resolved path through the `NATIVE` map in `metro.config.js` (a
  new stand-in needs an entry there). `src/shared/state/` is the pure machine; `src/state/` is the
  connected React layer around it (store, account, course content, progress sync). Every
  learner-facing string is in `src/shared/copy/` (en, bg, ru, pl, cs). Controls press through
  `src/ui/Press.tsx` and switches through `src/ui/Toggle.tsx`, which give the haptics
  (lint-enforced). **One clock:** only `src/shared/state/clock.ts` builds a `Date` or reads
  `Date.now()` (lint-enforced). State changes go through `transition(state, event)`; the allowed
  events are in `state/chart.ts`. The app has its own `eslint.config.mjs` and is excluded from the
  root ESLint/Prettier configs.
- **Generated files are committed and drift-checked** — the UniFFI bindings, the core-rs browser
  build, `apps/mobile/src/ui/iconCodepoints.ts` (`pnpm --filter @loro/mobile icons`) and the OpenAPI
  specs. Never hand-edit them; fix the generator.
- **`packages/core-rs` owns FSRS scheduling** — the app calls only `fsrs_initialize` and
  `fsrs_review` ([ADR-0002](docs/architecture/adr/0002-shared-rust-core.md)). There is no JavaScript
  scheduler: `src/shared/core/fsrs.ts` only evaluates the recall curve for display,
  `src/shared/state/memory.ts` brings due dates forward (Q-24), and the queue is ordered in
  TypeScript ([fsrs-model.md](docs/architecture/fsrs-model.md)).
- **Progress sync** merges the whole learner state in `apps/mobile/src/shared/state/merge.ts` and
  saves it through `/v1/library/progress`, which rejects stale revisions with a 409. Every merged
  field needs a declared merge class there ([sync-protocol.md](docs/architecture/sync-protocol.md));
  the older `/v1/sync` path keeps its classes in `packages/core/src/sync/fieldPolicy.ts` and its
  merge in core-rs.

## CI policy

Run CI checks locally. Do not enable, dispatch, or rerun GitHub Actions unless the user explicitly
changes this policy; former workflows are inactive references in `.github/workflows-disabled/`.
`pnpm ci:local` is the full local gate (install, core-rs build, `pnpm check`, auth/PostgreSQL,
format, drift, app bundle, API image, benchmarks); `pnpm check` is the fast gate. See
`docs/process/ci-cd.md`.

## Local Android APK distribution

`pnpm apk:local` builds a standalone, development-key-signed testing APK
(`app.loro.android.preview`) from a clean committed snapshot using local Expo prebuild and Gradle;
`pnpm apk:github` also uploads it to a draft GitHub prerelease. JDK 17 and Android SDK 36 are
required; `apps/mobile/android` is generated, never a source checkout. See
`docs/process/local-apk.md`.

## Running and testing

**Use Node 22** (`nvm use 22` first, every time — `pnpm` exists only under it). `cargo` lives in
`~/.cargo/bin` and is off the PATH `pnpm`/`turbo` see: `export PATH="$HOME/.cargo/bin:$PATH"` before
`pnpm check`, or the `@loro/core-rs` tasks fail once a Rust file changes.

```bash
pnpm ci:local                         # full local CI
pnpm check                            # fast lint/type/test/content/drift gate
pnpm --filter @loro/mobile web        # the app in a browser (Rust core as WASM)
pnpm --filter @loro/mobile android    # Android development build (needs cargo-ndk)
pnpm --filter @loro/mobile test       # the app's unit tests (node:test via tsx)
pnpm --filter @loro/mobile bundle     # proves the iOS bundle compiles
pnpm --filter @loro/api dev           # :3000; requires PostgreSQL/auth configuration
pnpm --filter @loro/landing dev       # the landing page on :4173 (builds live from GitHub)
pnpm landing:deploy                   # the landing page to Amplify Hosting (AWS_PROFILE=loro AWS_REGION=eu-central-1)
pnpm local:up / pnpm local:down       # SOPS-decrypted API + Expo web containers

# One test file (app tests need the content fixture installed first)
cd apps/mobile && pnpm exec tsx --import ./src/shared/content/fixture.install.ts --test src/shared/state/machine.test.ts
pnpm --filter @loro/api exec vitest run src/library/covers.test.ts
cd packages/core-rs && cargo test <name>
```

- API `*.postgres.test.ts` files skip unless `LORO_TEST_DATABASE_URL` is set; `pnpm ci:local` runs
  them against a disposable PostgreSQL container.

- Expo Go can't run the app: it needs the `LoroCore` native module (a development build).
- The API uses PostgreSQL for accounts and sync; `/v1/health/ready` checks database/WASM
  availability. See [`local-development.md`](docs/process/local-development.md).
- iOS builds need full Xcode. Physical-device acceptance remains a release gate.

## Where things live

| Path                                       | What                                                                           |
| ------------------------------------------ | ------------------------------------------------------------------------------ |
| `apps/mobile/app/`                         | expo-router routes                                                             |
| `apps/mobile/src/shared/`                  | Content, state machine, persistence, copy, notes, generator                    |
| `apps/mobile/src/state/`                   | Store, account, course content, progress sync (React)                          |
| `apps/mobile/src/music/`                   | Song rows, albums, the music players                                           |
| `apps/mobile/src/platform/`                | Native storage, speech, cues, Rust core, Intl polyfills                        |
| `apps/mobile/src/{screens,sheets,ui,nav}/` | The UI                                                                         |
| `apps/mobile/modules/loro-core/`           | Expo module over the Rust core (UniFFI)                                        |
| `apps/mobile/modules/loro-media/`          | Expo module: the player on the lock screen and shade (P3-11)                   |
| `apps/api/`                                | NestJS backend                                                                 |
| `apps/landing/`                            | One-page site; lists the Android builds from GitHub (F-09)                     |
| `packages/core/`                           | Shared TS domain and API contracts — used by the API and content               |
| `packages/core-rs/`                        | Rust: FSRS (and the older `/v1/sync` merge and clocks)                         |
| `packages/content/`                        | Server catalogs, review gates; `v2/` is the app's seeded content               |
| `apps/api/src/library/`                    | Packs, sharing, limits, AI phrases/covers/songs, progress sync                 |
| `apps/api/src/authoring/`                  | The offline course writer (`author:run`, plan 112); never in the server bundle |
| `docs/`                                    | All documentation — start at `docs/README.md`                                  |

## Open questions

[`docs/decisions/open-questions.md`](docs/decisions/open-questions.md) lists unresolved decisions
with owners and dates: Q-08/Q-12 (pricing, store billing), Q-13 (es-419), Q-15 (voices), Q-21 (eval
and budget for live AI generation), Q-22 (sharing audio files), Q-23 (native-speaker review), Q-24
(review retention target), Q-25 (syllabus word lists), Q-26 (en-US written or adapted) and Q-27 (the
landing page's domain, and the switch to CloudFront).

## EC2 development deployment

`infra/ec2/template.yaml` and `scripts/provision-ec2.sh` provision a restricted development host;
`scripts/deploy-ec2.sh` builds/transfers the API image and health-gates replacement with rollback.
Administrative access uses an SSH tunnel. See [`ec2-deployment.md`](docs/process/ec2-deployment.md).

## Landing page deployment

`pnpm landing:deploy` (`scripts/deploy-landing.sh`) deploys `infra/landing/template.yaml`, an
Amplify Hosting app in the same account, and uploads `apps/landing` to it as one archive; nothing
deploys on merge. `infra/landing/cloudfront.yaml` is the no-cost S3-behind-CloudFront host, waiting
on AWS verifying the account. See [`landing-deployment.md`](docs/process/landing-deployment.md).

## Python

Per the global instruction: use `uv run python3 ...` (e.g. `apps/mobile/scripts/fix-cmap.py`, run by
the icons script). Bare `python`/`pip` are intentionally blocked.
