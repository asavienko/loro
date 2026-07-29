# CI / CD

Pipelines, builds, OTA updates, and store submission.

Workflows live in [`.github/workflows/`](../../.github/workflows/).

---

## Pipelines

| Workflow               | Trigger                           | Does                                                               |
| ---------------------- | --------------------------------- | ------------------------------------------------------------------ |
| `ci.yml`               | PR, push to `main`                | lint · typecheck · test · content validate · budgets · a11y        |
| `core-rs.yml`          | PR touching `packages/core-rs/**` | Rust tests · golden tests · Criterion benches · cross-target build |
| `mobile-build.yml`     | PR, `main`, tags                  | EAS build; device-farm run on `main`                               |
| `api-deploy.yml`       | Push to `main`, tags              | Build, migrate, blue-green deploy                                  |
| `content-validate.yml` | PR touching `packages/content/**` | Schema · pack counts · references · audio presence                 |
| `release.yml`          | Tag `v*`                          | Store builds, submission, release notes                            |
| `nightly.yml`          | Schedule                          | Full E2E on the device matrix · 30-day offline sim · load test     |

### `ci.yml` — the gate on every PR

```
setup (node, pnpm, turbo cache, prebuilt core-rs)
  ├── lint          eslint (incl. the layer-boundary rule) + prettier + commitlint
  ├── typecheck     tsc --noEmit, all packages
  ├── test          vitest: core, engines, features, api
  ├── content        schema, pack counts, references, audio
  ├── budgets        bundle size vs baseline · core-rs benches · data-layer benches
  └── a11y           contrast (4 accents) · lang attribution · tap targets
                     · Dynamic Type snapshots · chart summaries
```

Target: **under 8 minutes** for a typical PR, via Turborepo caching — a docs-only PR runs almost
nothing, a `core-rs` change runs everything downstream
([ADR-0014](../architecture/adr/0014-monorepo-tooling.md)).

**All of these block merge.** A flaky test is fixed or quarantined with an issue, never retried into
submission.

### The drift check

CI regenerates `packages/design-tokens/out/**` and the UniFFI bindings, and **fails if they differ
from the commit**. Both are committed because the native widget targets and Xcode/Gradle builds need
them without running the JS toolchain. The drift check is what makes committing generated code safe.

### `core-rs.yml`

Only on Rust changes, because it's the slowest job:

```
├── cargo test           unit + integration
├── golden               ~50 recordings vs expected output — a moved score fails
├── cargo bench          Criterion; >10% regression fails
├── cargo clippy -D warnings
└── build matrix         ios · ios-sim · android(arm64,armv7,x86_64) · wasm32
```

Artifacts are cached and published so UI-only contributors can `pnpm bootstrap --no-rust`.

---

## Mobile builds — EAS

| Profile       | Purpose                           | Distribution                   |
| ------------- | --------------------------------- | ------------------------------ |
| `development` | Local dev client                  | Internal                       |
| `preview`     | Per-PR build for review           | Internal / TestFlight internal |
| `staging`     | Release-candidate against staging | TestFlight / internal track    |
| `production`  | Store release                     | App Store / Play               |

```bash
eas build --profile preview   --platform all
eas build --profile production --platform all
```

**Preview builds are posted to the PR** as a QR code. For anything visual, audio, or animated, a
reviewer is expected to install it — a screenshot cannot show whether the warming card stutters.

### Native vs JS changes

| Change                                                         | Needs                                                                                                      |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| JS / TS only                                                   | **OTA update** — minutes                                                                                   |
| Native module, widget, permission, dependency with native code | A new binary + store review                                                                                |
| `loro-core`                                                    | A new binary (it's a native library)                                                                       |
| Content                                                        | Nothing — content ships independently ([ADR-0009](../architecture/adr/0009-content-pipeline-and-packs.md)) |

Knowing which bucket a fix falls into is the difference between a two-hour turnaround and a
three-day one.

---

## OTA updates

EAS Update, on release-branch channels.

| Channel       | Source          | Audience         |
| ------------- | --------------- | ---------------- |
| `development` | `main`          | The team         |
| `staging`     | `release/x.y`   | Internal testers |
| `production`  | tagged releases | Everyone         |

### Policy

- **OTA is for fixes, not features.** A feature ships in a binary with the flag it needs.
- **Staged rollout:** 5% → 25% → 100%, with at least an hour between steps and crash-rate watched at
  each.
- **Runtime-version gated.** An OTA cannot target a binary whose native surface differs
  (`runtimeVersion: appVersion` policy).
- **Rollback is one command** — republish the previous update. This is why OTA is worth the
  complexity.
- **The DB schema version is checked on launch.** A DB newer than the binary refuses to open and
  prompts for an app update, which is the case that can happen after an OTA rollback
  ([`../architecture/data-model.md`](../architecture/data-model.md#client-rules)).
- Every OTA is tagged in crash reporting so an OTA regression is distinguishable from a binary one.

The last two points are the ones people get wrong. An OTA rollback that leaves a migrated database
behind a downgraded binary is a data-corruption bug, and the schema-floor check is the only thing
preventing it.

---

## Backend deploys

```
push to main
  → build image, tag with the sha
  → deploy to dev, smoke test
  → deploy to staging, integration tests
  → (manual approval) → production
```

Production deploy:

```
1. Migrations run as a SEPARATE step, before cutover  (expand → migrate → contract)
2. Deploy green alongside blue
3. Health-gate: /health/ready + a synthetic sync round-trip
4. Shift traffic 10% → 50% → 100%, watching error rate and p95
5. Auto-rollback on regression
6. Retire blue after 30 minutes
```

**Migrations are never coupled to a client release** — expand/migrate/contract means an old client
and a new schema always coexist safely
([`../architecture/data-model.md`](../architecture/data-model.md#server-rules)).

---

## Store submission

`release.yml`, triggered by a `v*` tag on a release branch.

```
1. Production EAS build, both platforms
2. Run the automated release gates (budgets, a11y, E2E)
3. Upload to App Store Connect / Play Console
4. Attach release notes from the tag annotation
5. Submit for review — iOS phased release ON, Play staged rollout at 10%
6. Post the submission status to #eng
```

**Manual gates before the tag**
([definition-of-done.md](definition-of-done.md#manual-gates--the-release-checklist)): the
airplane-mode test, the interruption matrix, the warming-card frame check, battery, screen readers,
widgets, and the copy audit. None are automatable, and all of them have caught real regressions.

### Staged rollout

| Step                             | Wait | Abort if                      |
| -------------------------------- | ---- | ----------------------------- |
| iOS phased day 1 (1%) / Play 10% | 24 h | Crash-free < 99.3%, or any P0 |
| Play 25%                         | 24 h | Same                          |
| Play 50%                         | 24 h | Same                          |
| Play 100% / iOS complete         | —    | —                             |

Halting a rollout is free and expected. Shipping to 100% on day one to save two days is not worth
it.

---

## Secrets

| Secret                             | Where                                                           |
| ---------------------------------- | --------------------------------------------------------------- |
| EAS credentials, signing keys      | EAS + a separate GitHub environment with required reviewers     |
| Provider API keys (Anthropic, TTS) | Managed secret store, injected at runtime. **Never in the app** |
| Cloud credentials                  | OIDC federation, least-privilege, no long-lived keys            |
| Store API keys                     | GitHub environment secrets, `release.yml` only                  |

**Rules**

- No secret is available to a PR-triggered workflow from a fork.
- A production deploy requires an environment approval.
- Every artifact is scanned for secrets before publication — of the **built output**, not just the
  source.

---

## Caching

| Cache                   | Key                      | Saves                                   |
| ----------------------- | ------------------------ | --------------------------------------- |
| Turborepo remote cache  | Task inputs hash         | Most of `ci.yml` on unaffected packages |
| pnpm store              | lockfile hash            | ~90 s                                   |
| Cargo registry + target | `Cargo.lock` + toolchain | ~4 min                                  |
| EAS build cache         | Native deps              | Several minutes on iOS                  |
| Gradle                  | Wrapper + deps           | ~2 min                                  |

**Cache correctness matters more than cache hit rate.** A wrong `inputs` declaration in `turbo.json`
gives a stale build, which is a genuinely confusing failure. `turbo.json` changes get careful
review.

---

## Nightly

| Job                             | Purpose                                     |
| ------------------------------- | ------------------------------------------- |
| Full E2E on the device matrix   | Broader coverage than the PR gate           |
| 30-day offline simulation       | Sync convergence over a long partition      |
| Load test at 10× projected peak | The M4 gate, run continuously afterwards    |
| Dependency audit                | Advisories, licence changes                 |
| 365-day scheduler simulation    | Catches review-wall regressions in `sim.rs` |
| Content-quality report          | Feeds the content lead's weekly review      |

Nightly failures go to `#eng`, not to a pager. They're signals, not incidents.
