# CI

## Local-only policy

Checks run on your machine. Do not enable, dispatch or rerun GitHub Actions unless the user
explicitly changes this policy. Actions is disabled in the repository settings; the former workflows
are inactive references in `.github/workflows-disabled/`. `pnpm ci:local` and `pnpm apk:local` both
refuse to run inside GitHub Actions.

## Gates

| Command                | What it runs                                                                                                                                                                            |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check`           | Fast gate: plan index, script tests, OpenAPI spec drift (`pnpm contracts:generate` fixes it), core-rs browser and UniFFI drift, then Turbo lint, typecheck, test and content validation |
| `pnpm ci:local`        | Full gate (below)                                                                                                                                                                       |
| `pnpm ci:local:native` | Release builds of the Rust core for two iOS targets, three Android ABIs and WASM, then the Rust/TypeScript parity test (macOS, Xcode, Android NDK, cargo-ndk)                           |
| `pnpm ci:local:audit`  | `pnpm audit --audit-level=high` and `cargo audit` (needs network)                                                                                                                       |

Setup for the full gate: Node 22, pnpm 9, Rust stable with rustfmt and clippy, the
`wasm32-unknown-unknown` target, `wasm-pack`, and a running Docker engine. The script switches to
Node 22 through nvm and puts `~/.cargo/bin` on the PATH itself.

```bash
pnpm ci:local
CI_BASE_REF=origin/main pnpm ci:local   # also lints the branch's commit messages
```

`pnpm ci:local` runs in phases, stopping at the first failure:

1. A frozen-lockfile install and `pnpm core-rs:build` (host library, WASM, UniFFI bindings).
2. `pnpm check`.
3. In parallel: the API's tests against a disposable PostgreSQL 16 container
   (`scripts/ci-auth-postgres.sh`), `pnpm format:check`, commit lint when `CI_BASE_REF` is set, and
   generated-file drift (the rebuilt `packages/core-rs/bindings` and `browser` must match Git).
4. In separate temporary copies of the source: the app's iOS bundle, and the API build, smoke test,
   linux/amd64 image and image check (`scripts/ci-api-image.sh`).
5. Short Criterion benchmarks (`core_benches`).

It forces Turbo to re-run every task and never publishes or deploys. The source must not change
while it runs: it fingerprints the tree after each phase and fails if it moved. One run at a time
(`.ci-local.lock`). `LORO_CI_JOBS` bounds parallel jobs and `LORO_CI_CONCURRENCY` Turbo's
concurrency (both default 2). Logs and `summary.json` go to `.ci-local-reports/<run>/`.

Record the checked commit, commands and results in the pull request.

## What a green gate doesn't prove

Native audio, lifecycle, device persistence, offline resume and physical-device behaviour need a
device. The parity test checks the Rust core against the fixtures in `packages/core/src/domain/`,
not against Swift or Kotlin.

## Deployment and distribution

- The development API runs on one restricted EC2 host: [ec2-deployment.md](ec2-deployment.md).
- Android testing builds: [local-apk.md](local-apk.md).
- There is no store release, EAS or OTA pipeline.
