# Developer onboarding

This page describes the repository that exists today. Loro is still an early web-runnable Expo
implementation: seven learner screens and the shell exist, but native audio, speech, ASR, widgets
and the on-device SQLite driver do not. Do not treat a successful web run as proof of those systems.

---

## 1 · Understand the product

Open the executable blueprint before changing a learner screen:

```bash
open "design/Language Learning by Phrases - V1.1/Loro.dc.html"
```

Then read [`../design/screen-catalog.md`](../design/screen-catalog.md). The blueprint owns intended
screen behaviour; the app and this document must say honestly which parts are implemented.

## 2 · Install the tools used today

| Tool      | Requirement        | Used for                                            |
| --------- | ------------------ | --------------------------------------------------- |
| Node      | 22                 | Every JS/TS command; pinned by `.nvmrc`             |
| pnpm      | 9.12               | Workspace commands; pinned by `packageManager`      |
| Rust      | stable             | `packages/core-rs` tests and host/WASM builds       |
| wasm-pack | current            | Building the API's WASM merge engine                |
| Chromium  | Playwright-managed | Browser E2E; installed with `pnpm test:e2e:install` |

Start every shell with Node 22 and make Cargo visible:

```bash
nvm use 22
export PATH="$HOME/.cargo/bin:$PATH"
rustup target add wasm32-unknown-unknown
cargo install wasm-pack --locked
```

Xcode, the Android SDK, EAS, Docker and `cargo-ndk` are not needed for the current local web/API
loop. They become required only when work actually adds and exercises native or deployed surfaces.

## 3 · Bootstrap and verify

```bash
pnpm bootstrap
pnpm check
pnpm test:e2e:install   # once per machine
pnpm test:e2e
```

`pnpm bootstrap` installs dependencies, regenerates tokens, builds the Rust host library/WASM and
bindings, validates content, and creates app `.env` files. Its final printed API database and native
device commands are legacy roadmap text: `db:migrate` and `db:seed` do not exist, and no generated
`ios/` or `android/` project or custom native module exists yet.

`pnpm check` is the fast local gate: workspace lint, type checking, 432 JS/TS tests, 131 Rust tests,
content validation, source accessibility checks, copy ownership and token contrast. It is not the
entire CI pipeline: CI separately builds the API and mobile bundle, checks generated drift, runs
browser E2E and the production-export smoke subset, and runs Rust benchmarks.

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

### Mobile app in a browser

```bash
cd apps/mobile
npx expo start --web
```

For a compile proof without opening a browser:

```bash
pnpm --filter @loro/mobile bundle
```

Custom core/audio/SQLite modules require a native build; Expo Go is unsupported. Native Android and
iOS projects are generated and gitignored. `pnpm apk:local` is the local Android preview; iOS still
needs full Xcode. See [`apps/mobile/README.md`](../../apps/mobile/README.md).

## 5 · Verify a learner-visible change

For every learner-visible route or state:

1. Compare it with the relevant blueprint state and functional spec.
2. Add or update its row in `apps/mobile/e2e/states.ts`; the route, accessibility and text-scale
   suites share that manifest.
3. Run `pnpm check` and `pnpm test:e2e`.
4. Run `pnpm test:e2e:bundle` when changing imports, assets, routing or build behaviour.
5. Record anything the browser cannot prove in the PR. Today that includes native audio/mic,
   lifecycle/resume, real offline persistence, widgets, `accessibilityLanguage` and
   `accessibilityHint`.

The old five-device hand-checks (audio, mic, warming card, offline relaunch and sync) remain future
acceptance gates. There is no implementation behind them today, so claiming they passed would be
misleading.

## 6 · Where the current code lives

```text
apps/mobile/app/          Expo Router routes: eight learner screens plus Languages/Account/More/Settings, shell and workbench
apps/mobile/src/lib/      copy, clock, account session and formatting
apps/mobile/src/store/    Zustand slices; local SQLite commits before publication
apps/mobile/src/ui/       primitives, components and UI tokens
apps/mobile/src/data/     native/browser SQLite drivers, learner load/commit and sync
apps/mobile/e2e/          Playwright web behaviour, accessibility and text-scale gate
apps/api/                 NestJS API with PostgreSQL accounts/sync; memory repo is test-only
packages/core/            shared TS domain, engines, contracts and persistence
packages/core-rs/         Rust maths, DSP and merge (WASM/UniFFI)
packages/design-tokens/   token source, generator and committed output
packages/content/         Spanish/Bulgarian/Russian catalogs and review gates
```

Directories described in older architecture plans (`features/`, `platform/`, native `modules/`,
widget `targets/`) are intended extension points, not current code.

## 7 · First PR

Use a requirement ID and keep learner-visible coverage with the change:

```bash
git switch -c feat/P2-04-association-suggestions
# work; add/update unit and E2E coverage
pnpm check
pnpm test:e2e
git commit -m "feat(add): re-rank suggestions by theme after adding (P2-04)"
git push -u origin HEAD
gh pr create
```

See [git-workflow.md](git-workflow.md), [code-review.md](code-review.md), and
[definition-of-done.md](definition-of-done.md).

## Common problems

| Symptom                                 | Fix                                                                                |
| --------------------------------------- | ---------------------------------------------------------------------------------- |
| `pnpm` not found                        | `nvm use 22`; pnpm is installed under Node 22                                      |
| `cargo: command not found` inside Turbo | `export PATH="$HOME/.cargo/bin:$PATH"` before `pnpm check`                         |
| API readiness is 503                    | `pnpm core-rs:build`, then restart the API                                         |
| Playwright has no browser               | `pnpm test:e2e:install`                                                            |
| Tokens or bindings drift                | Regenerate with `pnpm tokens:build` / `pnpm core-rs:build`; never hand-edit output |
| Native run command fails                | Expected until native projects/modules and the platform toolchain are added        |
