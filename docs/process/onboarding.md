# Developer onboarding

This page describes the repository that exists today. The app in `apps/mobile` is the v2.0
listening-first player (Expo; iOS, Android and the web). Onboarding, Home and the player are real;
Explore, Library, the set page, the queue, Make a set and the sheets are still stand-ins. The API,
the shared TypeScript domain, the Rust core and the content catalogs sit beside it. The first app,
its browser E2E suites and the design packages were removed on 2026-09-30 (Git history at
`52a0e3b`).

---

## 1 · Understand the product

Run the app on the web and use it:

```bash
pnpm --filter @loro/mobile web
```

Then read [`apps/mobile/README.md`](../../apps/mobile/README.md) and
[`../design/v2-prototype-decisions.md`](../design/v2-prototype-decisions.md). The product docs in
[`../product/`](../product/) describe the wider intent, including screens the app does not have.

## 2 · Install the tools used today

| Tool      | Requirement | Used for                                        |
| --------- | ----------- | ----------------------------------------------- |
| Node      | 22          | Every JS/TS command; pinned by `.nvmrc`         |
| pnpm      | 9.12        | Workspace commands; pinned by `packageManager`  |
| Rust      | stable      | `packages/core-rs` tests and host/WASM builds   |
| wasm-pack | current     | Building the API's WASM merge engine            |
| Gitleaks  | current     | Pre-commit secret scan; `brew install gitleaks` |

Start every shell with Node 22 and make Cargo visible:

```bash
nvm use 22
export PATH="$HOME/.cargo/bin:$PATH"
rustup target add wasm32-unknown-unknown
cargo install wasm-pack --locked
```

Xcode, the Android SDK, Docker and `cargo-ndk` are not needed for the current local web/API loop.
They are required to exercise native modules, an APK, or a deployed API. EAS is not the pipeline.

## 3 · Bootstrap and verify

```bash
pnpm bootstrap
pnpm check
```

`pnpm bootstrap` installs dependencies, builds the Rust host library/WASM and bindings, validates
content, and creates the API's `.env` file. It warns when Gitleaks is missing — the same class as
the watchman warning — because `.husky/pre-commit` hard-fails without it, then runs lint-staged. Its
final printed API database commands are legacy roadmap text: `db:migrate` and `db:seed` do not
exist. Native `ios/` and `android/` projects are generated and gitignored; the Rust core's native
module lives under `apps/mobile/modules/loro-core`.

`pnpm check` is the fast local gate: workspace lint (the app has its own ESLint config), type
checking, unit tests, Rust tests, contract drift and content validation. It is not the entire CI
pipeline: `pnpm ci:local` separately builds the API and the app's iOS bundle, checks generated drift
and runs Rust benchmarks. GitHub Actions is disabled.

## 4 · Run what exists

### API

```bash
pnpm core-rs:build
pnpm --filter @loro/api dev
curl localhost:3000/v1/health/ready
```

The API stores accounts, sessions and tenant-scoped sync in PostgreSQL and merges through the shared
Rust/WASM engine. Configure the encrypted environment and `DATABASE_URL` before starting it — follow
[`local-development.md`](local-development.md). `/v1/health/ready` checks actual database/WASM
availability; there is no production in-memory fallback. `InMemorySyncRepository` is a test adapter
under `apps/api/src/sync/testing/`. AI scenes are bundled stubs; live providers are not registered.
See [`apps/api/README.md`](../../apps/api/README.md).

### The app in a browser

```bash
pnpm --filter @loro/mobile web
```

For a compile proof without opening a browser:

```bash
pnpm --filter @loro/mobile bundle
```

The Rust core's native module requires a development build; Expo Go is unsupported. Native Android
and iOS projects are generated and gitignored. `pnpm --filter @loro/mobile android` runs a
development build and `pnpm apk:local` builds the local Android preview; iOS needs full Xcode. See
[`apps/mobile/README.md`](../../apps/mobile/README.md).

## 5 · Verify a learner-visible change

1. Keep the logic in `apps/mobile/src/shared/` and cover it with unit tests
   (`pnpm --filter @loro/mobile test`).
2. Run `pnpm check` and `pnpm --filter @loro/mobile bundle`.
3. Use it on the web (`pnpm --filter @loro/mobile web`) and, for audio or native behaviour, on a
   device or emulator.
4. Record in the PR anything you could not verify: there is no browser E2E suite today, and native
   speech, lifecycle/resume and iOS need a device.

## 6 · Where the current code lives

```text
apps/mobile/app/            Expo Router routes
apps/mobile/src/shared/     platform-neutral content, state machine, copy, notes, generator (@shared/*)
apps/mobile/src/platform/   native stand-ins for storage, speech, cues and the Rust core
apps/mobile/src/screens/    screens; src/sheets/ sheets; src/ui/ primitives and theme
apps/mobile/modules/        the LoroCore Expo module (Rust core over UniFFI)
apps/api/                   NestJS API with PostgreSQL accounts/sync; memory repo is test-only
packages/core/              shared TS domain and API contracts
packages/core-rs/           Rust maths, DSP and merge (WASM/UniFFI)
packages/content/           Spanish/Bulgarian/Russian catalogs and review gates
```

## 7 · First PR

Use a requirement ID and keep learner-visible coverage with the change:

```bash
git switch -c feat/P2-04-association-suggestions
# work; add/update unit coverage
pnpm check
git commit -m "feat(add): re-rank suggestions by theme after adding (P2-04)"
git push -u origin HEAD
gh pr create
```

See [git-workflow.md](git-workflow.md), [code-review.md](code-review.md), and
[definition-of-done.md](definition-of-done.md).

## Common problems

| Symptom                                 | Fix                                                                                                          |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `pnpm` not found                        | `nvm use 22`; pnpm is installed under Node 22                                                                |
| `cargo: command not found` inside Turbo | `export PATH="$HOME/.cargo/bin:$PATH"` before `pnpm check`                                                   |
| API readiness is 503                    | `pnpm core-rs:build`, then restart the API                                                                   |
| Bindings drift                          | Regenerate with `pnpm core-rs:build`; never hand-edit output                                                 |
| Native run command fails                | Use `pnpm apk:local` or Expo prebuild; install Xcode or the Android SDK. Expo Go cannot load the core module |
