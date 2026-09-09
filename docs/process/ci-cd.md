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
checks to execute instead of accepting cached task results. The full runner schedules independent
jobs with a bounded default of two (`LORO_CI_JOBS`); Turbo's internal task limit remains separately
configurable with `LORO_CI_CONCURRENCY`.

The full gate runs in dependency-aware phases:

1. Frozen-lockfile dependency installation, then host/WASM/UniFFI, design-token, Expo route-type and
   Chromium preparation jobs run concurrently. Route types are refreshed with the installed Expo SDK
   before typechecking.
2. `pnpm check`: contracts, lint, typecheck, JS/TS/Rust tests, content and accessibility checks.
   This phase stays exclusive because Turbo and generated artifacts share the checkout.
3. Auth/PostgreSQL, optional golden tests, formatting, optional commit-range lint and generated
   drift checks run concurrently. The auth transaction tests use a disposable PostgreSQL 16
   container; missing golden targets are reported as omitted.
4. Learner, pseudo-locale, workbench and production-export browser suites, mobile export, and API
   build/smoke/image verification run concurrently in separate temporary source workspaces. Each
   workspace has its own Expo/Metro cache, temporary directory, port, export output and reports;
   Playwright remains single-worker inside each suite.
5. Criterion benchmarks run exclusively with short warm-up and measurement windows.

`LORO_CI_JOBS=1` restores serial top-level scheduling. A lock prevents two full runs from sharing a
checkout. Each run writes logs, an event stream and `summary.json` under `.ci-local-reports/<run>`;
temporary workspaces and owned child processes are cleaned up on failure or interruption.
Cancellation stops install fallbacks and queued commands, then escalates owned process groups from
SIGTERM to SIGKILL after a bounded grace period. Cleanup waits for those groups before removing
workspaces and removes the run-owned API containers, network and image even when shell traps were
skipped. The workspace snapshot comes from Git's NUL-delimited tracked and non-ignored inventory,
plus the required generated WASM, bindings, token output and Expo declarations. It preserves
working-tree edits and deletions, omits secrets, dependencies and native build output, and rejects
symlinks that escape the source tree. Authored source and commit identity are captured before
validation, matched against the snapshot, checked between phases and rechecked after benchmarks;
generated input identity is recorded separately.

To validate branch commits, provide a locally available base ref:

```bash
CI_BASE_REF=origin/main pnpm ci:local
```

Without `CI_BASE_REF`, commit lint is explicitly omitted; no network fetch or push is performed.
`pnpm check` remains the fast development command. Full CI installs dependencies/browsers when
needed but never publishes, deploys, queues EAS, or calls GitHub. The full runner's checkout lock
prevents unsafe concurrent runs; isolated suites select their own free local ports and leave
existing development servers alone.

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

## Local APK distribution

[The local APK workflow](local-apk.md) builds an installable Android preview with Gradle and uploads
it to a draft GitHub prerelease. Run `pnpm apk:local` or `pnpm apk:github`; GitHub Actions and EAS
remain disabled. This testing distribution uses development signing, not store credentials.
