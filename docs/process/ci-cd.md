# CI / CD

Workflows live in [`.github/workflows/`](../../.github/workflows/). Some are executable gates and
some are roadmap scaffolds. This page makes that boundary explicit so a green check cannot be read
as deployment, device or release evidence that does not exist.

---

## Current workflow status

| Workflow                         | Trigger                            | Status today                                                                                                                                        |
| -------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ci.yml`                         | every PR; push to `main`           | Real required validation/build/browser gate                                                                                                         |
| `content-validate.yml`           | content PR; manual                 | Validation is real; render and publish steps are `TODO` scaffolds                                                                                   |
| `core-rs.yml`                    | Rust PR/push                       | Unit/clippy/build/parity are real; the golden step is conditional on its test target existing; benchmark comparison is not an enforced 10% baseline |
| `mobile-build.yml`               | mobile/packages PR; `main`; manual | EAS needs a real project ID and credentials; unconfigured automatic runs skip and explicit requests fail; device-farm steps remain TODO             |
| `api-deploy.yml` / `_deploy.yml` | relevant `main` push; manual       | Image build is defined; authentication, migrations, deploy, health gate, traffic shift, rollback and smoke test are placeholder echoes              |
| `nightly.yml`                    | nightly; manual                    | Dependency audit is real; device/offline/load/content jobs are placeholders and scheduler job references missing `tests/sim.rs`                     |
| `release.yml`                    | `v*` tag                           | Scaffold, not a usable release gate: it references a missing mobile `check:bundle-size` script and has no real native/device gate                   |

Do not push a release tag or rely on deploy/release workflows until their placeholders and missing
commands are implemented and exercised in a non-production environment.

## `ci.yml`: the current PR gate

The aggregate `ci` job requires:

1. `core-rs (host + wasm)` — builds host/WASM/bindings once and uploads them.
2. `lint` — workspace lint, Prettier and PR commitlint.
3. `typecheck` — all workspace packages.
4. `test` — `pnpm test`, including Rust through Turbo.
5. `mobile web E2E` — the learner and workbench suites plus production-export `@smoke` flows.
6. `content validation` — catalog checks.
7. `app bundles / api builds` — mobile Metro/Hermes export; API esbuild, boot and readiness.
8. `generated output drift` — regenerated design tokens and UniFFI bindings must match Git.
9. `accessibility gates` — contrast, source language, chart summaries and tap targets.
10. `performance budgets` — Criterion runs for `core-rs`.

`pnpm check` reproduces the fast lint/typecheck/test/content/a11y/contrast portion locally. It does
not run formatting/commitlint, browser E2E, production-export smoke, bundles/API readiness, drift or
Criterion. Use this local pre-PR sequence when relevant:

```bash
nvm use 22
export PATH="$HOME/.cargo/bin:$PATH"
pnpm check
pnpm test:e2e
pnpm test:e2e:bundle
pnpm --filter @loro/mobile bundle
pnpm --filter @loro/api build
```

The E2E config enforces an eight-minute global timeout. CI reports elapsed time and always uploads
Playwright reports/traces so retries remain visible.

## What current CI does not prove

- The app runs on iOS or Android; EAS queueing is not a device test.
- Audio, microphone, native lifecycle, on-device SQLite, offline resume, notifications or widgets.
- Full Swift/Kotlin/WASM numerical parity; current `parity.rs` is a Rust fixture test.
- DSP stability against recorded utterances; no golden corpus/test exists.
- A benchmark stayed within 10%; Criterion runs, but no durable comparison baseline is enforced.
- API persistence, migrations, cloud deployment, health-gated traffic shifting or rollback.
- Store submission readiness, OTA rollback or built-artifact secret scanning.
- Coverage percentage; Vitest does not generate coverage by default.

## Generated-output drift

Design-token output and UniFFI bindings are committed. CI rebuilds and diffs
`packages/design-tokens/out` and `packages/core-rs/bindings`. Change the generator/source,
regenerate, and commit the result; never hand-edit generated files.

## Activation gates for future pipelines

### Native modules and device farm

The change that introduces the first custom native module must also:

- generate/build both native projects reproducibly;
- add contract tests and a real both-platform device flow;
- replace the device-farm `TODO` with an executable job;
- cover permissions, interruption/background cleanup and force-quit resume as applicable;
- publish useful artifacts/results and make the job required before the feature is called done.

<a id="backend-deploys"></a>

### API persistence and deployment

[Plan 88](../../plans/88-low-cost-backend-infrastructure.md) owns one EC2 testing deployment. The
`dev`/`staging`/`production` chain and traffic-shift echoes in the current workflows are scaffolding
to replace, not a required test topology.

The implemented path must:

1. Select the exact commit whose required CI passed and serialize deployments to GitHub `testing`.
2. Build real WASM before the `linux/amd64` API image. Scan/test the image, publish to private ECR
   and deploy by digest with AWS OIDC and SSM, without permanent AWS keys.
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

### Content publishing

Before content ships independently, replace render/publish placeholders, protect the content
environment, verify catalog versioning and artifact integrity, and retain native-review and human
audio-listening approvals.

<a id="ota-updates"></a>

### Release and store submission

Before the first `v*` tag:

- remove every missing command and placeholder from `release.yml`;
- make native builds and both-platform device tests real;
- add measured startup/bundle/data/accessibility gates appropriate to shipped features;
- scan built artifacts for secrets;
- require a signed manual release checklist;
- exercise submission and rollback in staging/internal tracks.

Only then document EAS profiles, OTA channels and staged rollout as operating procedures rather than
intended architecture.

## Caching and failure policy

The setup action installs Node/pnpm dependencies and restores a local `.turbo` cache; Rust jobs use
`Swatinem/rust-cache`, and Playwright caches Chromium. Cache keys must follow all meaningful inputs.
A flaky E2E retry remains visible in the always-uploaded report and should be fixed or explicitly
quarantined with an owner; retries are diagnostic, not proof of stability.

Nightly placeholder failures are development signals. Once deployment or release jobs become real,
their required status, environment approvals, owners and alert route must be documented here in the
same change.
