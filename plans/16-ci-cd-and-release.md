# CI/CD and release: deploy the API, ship the app, and make rollback real

- **Requirement IDs:** the M0 leftovers and the M2 store submission
- **Milestone:** M1 (dev deploy) → M2 (store submission)
- **Spec:** `docs/process/ci-cd.md`, `docs/process/release-versioning.md`,
  `docs/process/environments.md`
- **Size:** M–L

## Current state

CI is genuinely strong. `.github/workflows/ci.yml` has nine jobs: a shared `core-rs` build, lint +
format + commitlint, typecheck, test, content validation, a bundle job that **boots the built API
and checks readiness** (not just compiles), a generated-output drift check, four accessibility
gates, and Criterion performance budgets — behind one required `ci` check for branch protection.
Workflows exist for `api-deploy`, `_deploy`, `mobile-build`, `release`, `nightly`, and
`content-validate`.

The gaps are on the delivery side:

- **The API is not deployed anywhere.** `docs/product/roadmap.md` lists this as one of two unmet M0
  deliverables: "the API is not deployed to a `dev` environment", and M0's exit criterion was
  "Deployed to `dev`, reachable from a device". A device cannot talk to an API that does not exist,
  so sync, auth, and AI cannot be tested end to end.
- **Crash reporting is not wired to a dashboard** — the other unmet M0 item, covered by
  [observability-and-analytics.md](32-observability-and-analytics.md).
- **No native build in CI.** The `bundle` job proves Metro resolves and Hermes accepts the JS. It
  cannot catch a broken config plugin, a missing Android ABI, or a linker error
  ([native-toolchain-and-dev-client.md](09-native-toolchain-and-dev-client.md) §5) — the failures
  that block a release day.
- **No store submission path exercised.** Certificates, provisioning, signing, and review metadata
  are all ahead of us, and none of it is fast.

## The work

### 1. Deploy the API to `dev`, then staging and prod

`apps/api/Dockerfile` and `docker-compose.yml` exist and `api-deploy.yml` + `_deploy.yml` are
already written — check what they assume and close the gap to a running environment.
`docs/process/environments.md` defines the four environments and their secrets.

Requirements that matter here more than usual:

- **Readiness gates the cutover.** The health controller already returns 503 when the WASM merge is
  missing (`apps/api/src/health/health.controller.ts:32`), and the comment explains why: the WASM is
  a build artifact copied into the image, so "the file didn't make it" is a real, quiet failure.
  Wire the deploy to respect readiness — a build that fails readiness must not take traffic.
- **Migrations in the deploy**, forward-only, with a documented rollback that does not lose learner
  data ([api-postgres-persistence.md](13-api-postgres-persistence.md)).
- **Reachable from a device** — that is the actual M0 criterion, so verify it with a device, not
  with curl from a runner.

### 2. Native builds in CI

`expo prebuild --clean` plus a compile for both platforms, path-filtered to native config, plugins,
and `core-rs`. iOS needs a macOS runner; note the cost in `docs/process/ci-cd.md`.

### 3. EAS profiles and internal distribution

`development` (dev client), `preview` (internal), `production`. Dogfooding "starts at M1 and never
stops" (M1 exit criteria), which requires a build that testers can install without a cable.

### 4. Versioning and release trains

`docs/process/release-versioning.md` has SemVer, build numbers, release trains, staged rollout, and
rollback. Implement the mechanics: automatic build-number increment, a changelog generated from
Conventional Commits (commitlint already enforces the format, and `commitlint.config.cjs` has the
scope list), and tags.

### 5. OTA update policy

`ci-cd.md` covers it. The policy question that needs an explicit answer: **what may ship over the
air and what may not.** Anything touching the Rust core, native modules, or the database schema
cannot — a JS bundle that expects a schema the installed binary does not have is a corrupted
install. Write the rule down and, better, enforce it: fail an OTA publish if the diff touches
`core-rs`, `modules/`, or a migration.

### 6. Staged rollout and rollback

A rollout percentage, a monitoring window, and an actual tested rollback for both the API
(blue/green with the readiness gate) and the app (OTA revert, and a store rollback which is much
slower — know the difference before you need it). Rehearse the rollback once; an untested rollback
is a plan, not a capability.

### 7. Store submission

Listings, screenshots (the blueprint's screenshots are design artefacts, not store assets — real
device captures are needed), privacy manifests that match what the app actually collects
([observability-and-analytics.md](32-observability-and-analytics.md)), age rating, export
compliance, and a test account that works. Start early: this is the step most likely to add a week
nobody planned for.

### 8. Nightly

`nightly.yml` exists. Give it the slow things that should not gate a PR: the 90-day simulation
([testing-gaps.md](37-testing-gaps.md)), the DSP golden corpus, E2E flows, the load test, and a
dependency audit.

## Acceptance criteria

- The API runs in `dev`, reachable from a physical device — the M0 criterion, closed.
- Staging and production deploy through the same pipeline with readiness gating the cutover.
- Migrations run in the deploy with a documented, tested rollback.
- CI compiles both native platforms when native inputs change.
- Internal builds are installable by testers without a cable.
- Build numbers increment automatically; the changelog generates from commits.
- The OTA policy is written down **and enforced** — a bundle touching native or schema cannot be
  published OTA.
- A staged rollout can be halted, and a rollback has been rehearsed at least once for both API and
  app.
- Store submission assets complete; a review-ready build submitted.
- Nightly runs the slow suites and reports failures somewhere people see.

## Tests

- A deploy smoke test that hits `/v1/health/ready` and fails the deploy on 503.
- A test that the OTA enforcement rule fires on a native-touching diff.
- The rollback rehearsal, documented in `docs/process/incident-response.md` as a runbook.

## Risks

- **Secrets sprawl** across EAS, GitHub, and the deploy target. `environments.md` should be the
  single index of what lives where, and rotation should be documented before the first incident.
- **Store review timing** is outside your control. Submit a skeleton early to get the account,
  certificates, and metadata approved while the app is still being built.

## Out of scope

Infrastructure provisioning (Terraform and the like) and multi-region deployment.
