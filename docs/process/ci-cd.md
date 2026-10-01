# CI

## Local-only policy

Run checks locally. Do not enable, dispatch or rerun GitHub Actions unless the user explicitly
changes this policy. Actions is disabled in the repository settings; the former workflows are
inactive references in `.github/workflows-disabled/`.

## Gates

| Command                | What it runs                                                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `pnpm check`           | Fast gate: plan index, script tests, contracts, lint, typecheck, tests, content, core-rs browser/UniFFI drift    |
| `pnpm ci:local`        | Full gate (below)                                                                                                |
| `pnpm ci:local:native` | Rust for two iOS, three Android and the WASM target, then calendar parity (macOS, Xcode, Android NDK, cargo-ndk) |
| `pnpm ci:local:audit`  | `pnpm audit --audit-level=high` and `cargo audit` (needs network)                                                |

Setup for the full gate: Node 22, pnpm 9, Rust stable with rustfmt and clippy, the
`wasm32-unknown-unknown` target, `wasm-pack`, and a running Docker engine.

```bash
nvm use 22
export PATH="$HOME/.cargo/bin:$PATH"
pnpm ci:local
CI_BASE_REF=origin/main pnpm ci:local   # also lints the branch's commit messages
```

`pnpm ci:local` runs in phases: frozen-lockfile install and the host/WASM/UniFFI build;
`pnpm check`; then concurrently the auth/PostgreSQL tests (a disposable PostgreSQL 16 container),
formatting, commit lint and generated-file drift; then the app's iOS bundle and the API
build/smoke/image in separate temporary workspaces; then short Criterion benchmarks. It forces Turbo
to re-run tasks, refuses to run inside GitHub Actions, and never publishes or deploys.
`LORO_CI_JOBS` bounds parallel jobs (default 2). Logs and `summary.json` go to
`.ci-local-reports/<run>`.

Record the checked commit, commands and results in the PR.

## What a green gate doesn't prove

Native audio, lifecycle, device persistence, offline resume and physical-device behaviour need a
device. Calendar parity is a Rust fixture test, not a Swift/Kotlin check.

## Deployment and distribution

- The development API runs on one restricted EC2 host: [ec2-deployment.md](ec2-deployment.md).
- Android testing builds: [local-apk.md](local-apk.md).
- There is no store release, EAS or OTA pipeline.
