# Stack and Android readiness — 2026-09-08

**Verdict: development preview; not ready for production learning.** Standalone HTTPS access is
implemented, EC2 is healthy, and the new APK passed Android emulator connection checks. Essential
durable learning, audio/speech and account/sync features remain incomplete. A green health response
does not establish these capabilities.

## Scope and baseline

Reviewed remote main `f3ee30a34802` rather than the stale initial checkout `442d434`. The previously
published APK `6891fe5316a4` had `apiUrl: null` in its downloaded release metadata. Its checksum
matched, and it launched in the Android 36 emulator, but it had no configured backend.

Current stack: Expo SDK 54, React Native 0.81.5, React 19.1, TypeScript, Expo Router, Zustand and
bundled i18next/ICU content. NestJS 11 runs on Node 22 in a distroless Docker image on Frankfurt
EC2. Rust provides WASM sync merge on the server; the native mobile Rust bridge is still absent.
PostgreSQL account support exists in source and has database tests, but is not configured on EC2.
Learning storage uses an in-memory repository on the server and an in-memory Zustand store on
device.

## Deployment evidence

- AWS profile `loro`; CloudFormation `loro-api-dev`; EC2 `i-0ce58e049c8fe0f7b` is running with both
  AWS status checks OK.
- Public API: `https://aisjfy5d74.execute-api.eu-central-1.amazonaws.com/v1`.
- Gateway stack: `loro-api-gateway`, CREATE_COMPLETE. HTTPS terminates at API Gateway; a
  VPC-attached Lambda reaches the EC2 proxy using private networking.
- EC2 security group allows SSH from the existing operator /32 and port 8080 from only the Lambda
  security group. Port 3000 remains bound to loopback. No public EC2 HTTP ingress was opened.
- Running API image: `loro-api:26dc09e2a27a-20260908114912`. The source commit was subsequently
  reworded as `86d1f8e` without changing its tree. The previous image remains available for
  rollback.
- `/health/ready` returns HTTP 200 with content and merge both OK. `/auth/providers` returns an
  empty provider list, accurately reporting that sign-in is disabled.
- `scripts/check-public-api.mjs` passed health, provider discovery and manifest/diff/pack reads for
  all seven language pairs. POST requests and legacy sync/AI/sign-in write paths return 404.

The initial redeployment exposed a missing runtime `zod` dependency. Its candidate failed before
cutover, preserving the old service. The dependency is now declared explicitly and both local CI and
deployment run `scripts/ci-api-image.sh` against the actual production image. The corrected image
passed readiness and multilingual content checks before deployment.

A CloudFront distribution attempt was rejected by AWS pending account verification. The replacement
uses API Gateway; it does not depend on CloudFront. The failed CloudFront stack and its VPC origin
were deleted; the pre-existing unrelated CloudFront resources were retained.

React Native 0.81 uses an AbortSignal polyfill without static `timeout`. The account request and
readiness client now use a timed AbortController, tested with the static method unavailable.

## Essential feature audit

| Capability                                                      | Verified state                                         | Remaining implementation / gate                                                                        |
| --------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Onboarding, Add, phrase detail, manual Stream/Refrain, Progress | Implemented with browser coverage                      | Native device matrix and durable state                                                                 |
| Seven language pairs, three 31-phrase starter catalogs          | Bundled and served by the live API                     | Bilingual sign-off; content expansion                                                                  |
| Standalone Android installation                                 | Local release APK pipeline exists; development signing | Connected APK verified below; physical device matrix and store signing remain                          |
| Internet API connection                                         | Real HTTPS readiness and read-only content access      | Does not activate account or sync                                                                      |
| Device persistence and crash resume                             | **Missing**                                            | Plan 59: wire SQLite driver, hydration and transactional writes; current store resets on process death |
| Durable server learning data                                    | **Missing**                                            | Plan 66: Postgres learning repository, migrations, tenant cursors and backups                          |
| Sign-in                                                         | Partial source implementation; **disabled live**       | Provider setup, database, redirects and native provider verification; plan 67/89                       |
| Cross-device sync                                               | **Missing**                                            | Plans 59/66–68: identity, tenant isolation and client outbox transport                                 |
| Real audio playback / offline audio                             | **Missing**                                            | Plans 58/61/62; Q-15 approved audio assets                                                             |
| Microphone, on-device ASR, measured speech latency              | **Missing**                                            | Plan 63 and device evidence; audio must stay on device                                                 |
| Canonical scheduling and native Rust maths                      | **Incomplete**                                         | Plan 60; Rust FSRS `review` and selection have `todo!()`, mobile uses a temporary JS facade            |
| Pronunciation/prosody scoring                                   | **Missing**                                            | Plan 77 DSP implementation and quality gate; do not report fabricated scores                           |
| Remaining 16 authored learner screens, widgets, chat            | **Missing / later roadmap**                            | Feature-specific plans and decision gates                                                              |
| Production delivery                                             | **Not ready**                                          | Persistence, auth/isolation, recovery, native feature proof, signing and store setup                   |

Source evidence: `apps/mobile/src/store/store.ts`, `apps/mobile/src/store/coreFacade.ts`,
`apps/api/src/app.module.ts`, `packages/core/src/domain/languages.ts`,
`packages/core-rs/src/fsrs/mod.rs`, and the active plans 58–77. Existing green unit/browser tests
cover implemented behavior; they cannot prove missing native functionality.

## Android and validation evidence

Pending final connected-APK build, emulator online/offline checks and completion of local
validation.

## Dependency review

A fresh `pnpm audit --prod --json` reported 16 high and eight moderate findings, with no critical
findings. The report includes transitive Expo/build dependencies; it is not proof that every finding
is exploitable in the APK or API. No broad dependency upgrade was included in this connection fix.
Dependency remediation and reachability review remain release work. The raw audit is retained under
`.local-builds/readiness/dependency-audit.json`.

## Next essential delivery slices

1. Complete plan 59 device persistence and force-stop/relaunch tests before using real learning
   data.
2. Complete canonical maths/native bridge work (58/60), then approved audio and on-device speech
   (61–63). Q-15 and the DSP quality gate require evidence rather than substitute implementations.
3. Implement durable tenant-isolated learning storage and anonymous/account lifecycle (66/67), then
   wire and test client sync/convergence (68). Keep legacy endpoints private until this passes.
4. Verify the supported Android device/OS matrix, recovery and store signing before release.

The [public gateway runbook](../process/public-api.md) records deployment and probe commands.
