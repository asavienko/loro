# CI / CD

## Local-only policy

Run checks locally. Do not enable, dispatch or rerun GitHub Actions unless the user explicitly
changes this policy. Actions is disabled in the GitHub repository settings. All eight former
workflows are preserved in [`.github/workflows-disabled/`](../../.github/workflows-disabled/),
outside GitHub's workflow discovery directory. No push, PR, schedule or tag runs them.

## Setup and full gate

Use Node 22, pnpm 9.12.0, Rust stable with rustfmt/clippy, wasm-pack, and a running local Docker
engine (for the disposable PostgreSQL 16 auth transaction gate):

```bash
nvm use 22
export PATH="$HOME/.cargo/bin:$PATH"
rustup component add clippy rustfmt
rustup target add wasm32-unknown-unknown
cargo install wasm-pack --locked
pnpm ci:local
```

Alternatively `bash scripts/ci-local.sh` selects Node 22 through nvm when available, including when
pnpm is initially off PATH. The runner exits on failure and refuses to run in GitHub Actions. It
sets `CI=1` so Playwright starts fresh servers and uses its strict CI behavior, and forces Turbo
checks to execute instead of accepting cached task results. Workspace concurrency defaults to two
tasks to limit local CPU/memory contention; override with `LORO_CI_CONCURRENCY` if needed.

The full gate runs, in order:

1. Frozen-lockfile dependency installation; host/WASM/UniFFI, design-token and Expo route-type
   generation. Route types are refreshed with the installed Expo SDK before typechecking to avoid
   stale declarations after switching branches.
2. `pnpm check`: contracts, lint, typecheck, JS/TS/Rust tests, content and accessibility checks. The
   auth transaction tests also run against a disposable PostgreSQL 16 container on a free localhost
   port, removed after success or failure. Existing database URLs are ignored because these tests
   drop tables. The golden DSP target also runs if implemented; no missing harness is reported as
   passing.
3. Formatting; optional commit-range lint; generated-output drift (including untracked output).
4. Chromium installation; learner, workbench and production-export browser suites.
5. Mobile Metro/Hermes export; API build, boot and readiness with the actual WASM merge engine. The
   API smoke check selects a free port and cleans up its child process on success or failure.
6. Criterion benchmarks with short warm-up and measurement windows.

To validate branch commits, provide a locally available base ref:

```bash
CI_BASE_REF=origin/main pnpm ci:local
```

Without `CI_BASE_REF`, commit lint is explicitly omitted; no network fetch or push is performed.
`pnpm check` remains the fast development command. Full CI installs dependencies/browsers when
needed but never publishes, deploys, queues EAS, or calls GitHub. Do not run concurrent full gates
in the same checkout: generated files and build output are shared. Each browser suite selects a free
local port through `LORO_E2E_PORT`, leaving existing development servers alone.

Record the checked commit, commands and results in the PR. No GitHub status check is required by
this policy. If a repository rule later requires an old Actions check, remove that obsolete check
requirement while retaining review/branch protections; do not re-enable CI to satisfy it.

## Additional local gates

- `pnpm ci:local:native`: the former six-target Rust matrix (two iOS, three Android, WASM), then
  calendar parity. Requires macOS with full Xcode, the Android SDK/NDK configured for cargo-ndk,
  `cargo install cargo-ndk --locked`, and all six Rust targets installed with `rustup target add`.
  Missing toolchains fail this explicit gate; they are not silently skipped.
- `pnpm ci:local:audit`: `pnpm audit --audit-level=high` and `cargo audit`. Install the latter with
  `cargo install cargo-audit --locked`. Advisory lookups require network access.
- Content checks also remain available through `pnpm content:validate`.

Run the native gate for native/Rust target changes and audits for dependency changes. These are
separate from the default host/browser gate so routine checks need neither mobile SDKs nor advisory
services. The historical nightly scheduler simulation has no test target, and device/offline/load
and content-quality jobs were placeholders; they are not pretend local successes.

## Reports and limits

Playwright keeps reports in `playwright-report/` and diagnostics in `test-results/`. Criterion keeps
results in `packages/core-rs/target/criterion/`. Results remain local; nothing uploads them.
Generated tokens and bindings must match Git: regenerate from source and review/commit changes.
Browser baselines are platform-specific; do not overwrite another platform's baseline to pass.

A green local gate does not prove native audio, microphone, lifecycle, device persistence, offline
resume, notifications or widgets. Calendar parity is a Rust fixture test, not Swift/Kotlin parity.
Criterion measures performance but does not enforce a durable 10% regression baseline. No golden DSP
corpus exists yet. Tests do not generate coverage percentages by default.

## Deployment and release

<a id="backend-deploys"></a> <a id="ota-updates"></a>

Deployment, EAS, content publishing and release workflows remain inactive historical scaffolds.
Authentication, migrations, deployment/rollback, device-farm validation and store submission need
real implementations and separate authorization. The archived release workflow references missing
commands; it must not be treated as a working release procedure. Tags do not start store builds.

### Future EC2 testing deployment

[Plan 88](../../plans/88-low-cost-backend-infrastructure.md) owns one EC2 testing deployment. The
`dev`/`staging`/`production` chain and traffic-shift echoes in the archived workflows are
scaffolding to replace, not a required test topology.

The implemented path must:

1. Select the exact commit whose local CI passed and serialize testing deployments locally.
2. Build real WASM before the `linux/amd64` API image. Scan/test the image, publish to private ECR
   and deploy by digest with approved short-lived AWS credentials and SSM, without permanent AWS
   keys.
3. Pull the release before downtime, close traffic, stop API writes and verify a pre-migration S3
   backup before running a separate compatible migration.
4. Start the image and verify real readiness and authenticated synthetic sync/content checks before
   reopening traffic. Repeat an external HTTPS smoke check.
5. Restore the previous image only if schema compatibility is established; otherwise stay in
   maintenance. Never automatically downgrade schema or restore over newer data.

An `echo TODO`, missing credential or skipped job cannot satisfy these gates. Infrastructure
verification can precede auth, but unfinished API routes stay closed until plans 66/67 provide
durable tenant-scoped access. Device sync is a separate feature gate. Deployment and recovery
evidence is recorded in [the testing runbook](../runbooks/backend-testing.md).

Cloud infrastructure itself is applied from the separate Terraform roots and must not be replaced by
an ordinary application deployment. Production rollout policy remains with plan 73; the testing host
does not require blue-green replicas or staged traffic percentages.
