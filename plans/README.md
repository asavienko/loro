# Active plans

Reviewed **2026-09-07** against merged baseline `2d9e8c3`: **30 plans with remaining work**, five
completed plans moved to [the dated archive](archive/2026-09-07/README.md), and completed
[plan 53](53-post-refactor-solid-kiss-dry-audit.md) retained at its protected original path. The
[review](archive/2026-09-07/REVIEW.md) records evidence, scope transfers and verification.

Plans 01–52 remain historical in [the previous archive](archive/2026-07-30/REVIEW.md); 49 is an
existing gap, not a free number. No plan was renumbered. The highest assigned ID is **90** and the
next new plan is **91**. Original paths of newly archived plans remain compatibility symlinks.

## Current scope

- Seven of 23 authored learner screens plus Languages, the shared shell and the dev workbench are
  built. The other 16 learner screens are still future work.
- UI/native languages are en/bg/ru; targets are es-ES/bg-BG/ru-RU excluding matching pairs: seven
  pairs and three 31-phrase starter catalogs. Course progress/resume is separate; the streak is
  global.
- Schema-2 persistence primitives, shared API schemas/OpenAPI, an in-memory 13-route API and a
  tested unregistered Anthropic transport exist. The app and API still use in-memory runtime stores.
- No native playback, microphone/ASR, device SQLite, widgets, durable backend/auth or client sync is
  implemented. Bilingual review and all speech capabilities remain gated. Manual confirmation is not
  speech measurement. Rust FSRS/cloze stand-ins remain urgent plan-60 debt.

## Status

| Mark | Meaning                                                                                       |
| ---- | --------------------------------------------------------------------------------------------- |
| 🟡   | Implemented foundation or partial delivery; remaining tasks and blocking slices are explicit. |
| —    | Remaining implementation can proceed when its listed technical prerequisites pass.            |
| ⛔   | A named decision/evidence gate blocks that product slice, not unrelated preparation.          |
| ✅   | Implemented within the recorded scope; archived except for protected plan 53.                 |

## Start here

1. **Correctness and reusable foundations:** prioritize [60](60-authoritative-core-maths.md)'s
   fabricated maths/Unicode boundary and missing simulations; correct the course upsert in
   [59](59-device-persistence-and-resume.md). Extend the existing route model in
   [56](56-navigation-failure-and-input-shell.md), native substrate in
   [58](58-native-workspace-and-device-ci.md), and backend foundation in
   [66](66-backend-contract-data-and-security.md). These tracks do not wait for a product decision.
2. **Available UI/content work:** [57](57-runtime-design-system.md) supplies real state APIs to
   [80](80-dev-design-system-workbench.md); [81](81-navigation-spine-switcher-and-more.md) adds More
   on the route contract. Begin [87](87-multilingual-app-and-language-selection.md)'s bilingual
   review and [61](61-content-and-audio-assets.md)'s update/asset contracts. Prepare
   [77](77-dsp-and-speech-labs.md)'s evidence spike and [82](82-guided-chat-domain-and-service.md)'s
   offline schemas/topic/eval work without activating gated production features.
3. **Device/service integration:** 58→59; 58 + approved 61 assets→62→63; 66 + 59→67→68, with 60's
   merge-binding slice only required by sync. [86](86-provider-integrations.md) supplies adapters to
   each owner; the old plan-85 handoff/worktree block is closed.
4. **Production v1:** 59/60/62/63→64; 56/59→Import in 65; resolve Q-07→69→70. General settings in 71
   can precede account sync. Develop release harnesses in 72 as features land, then verify delivery
   in 73 and approved billing in 74.
5. **Later surfaces:** 59/60→75; bundled/guarded provider foundations→76 and 82→83. Voice, Review
   handoff and live release gates apply to their specific slices. Labs follow the recorded DSP
   decision; Run/ladder Phrasebook follows Q-05 and comparative evidence.

## Remaining roadmap

Dependencies refer to the named deliverable slice, not automatically the whole plan. In particular,
72 supplies shared harnesses to features and consumes their release evidence; it must not create a
feature↔release-completion cycle. See each plan's checkboxes for executable tasks and acceptance.

| Plan                                                | Remaining outcome                                                           | Milestone   | Status / blocker                                                | Prerequisites                                                              |
| --------------------------------------------------- | --------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------- | -------------------------------------------------------------------------- |
| [56](56-navigation-failure-and-input-shell.md)      | Route laws, recovery, keyboard and scalable lists                           | M1          | 🟡 Built hubs/escapes done; full shell remains                  | 53/55/79/84 ✅; 58 for device proof                                        |
| [57](57-runtime-design-system.md)                   | Fonts, motion, haptics, dark theme and production state APIs                | M1/M2       | 🟡 Provider exists; fonts/state APIs remain                     | 53/55 ✅; font provenance; 58 device proof                                 |
| [58](58-native-workspace-and-device-ci.md)          | Native workspace, Rust/SQLite bridges and device harness                    | M1          | 🟡 Local APK runner exists; bridges/device proof remain         | 53 ✅; local SDK for preview; production signing remains                   |
| [59](59-device-persistence-and-resume.md)           | Safe course writes, device SQLite, hydration and resume                     | M1          | 🟡 Schema 2 exists; device wiring remains                       | 54 ✅; 58 driver; implemented 87 contracts                                 |
| [60](60-authoritative-core-maths.md)                | Canonical FSRS, Unicode matching, selection and bindings                    | M1/M2       | 🟡 Rust helpers exist; algorithms/adapters remain               | 53 ✅; 58 for native adapter only                                          |
| [61](61-content-and-audio-assets.md)                | Versioned content delivery, reviewed expansion and audio                    | M1–M3       | 🟡 Starters/contracts exist; Q-15 gates audio                   | 85 ✅; 59 activation; 86 adapters; 87 review                               |
| [62](62-native-audio-playback.md)                   | Real native playback, cache and background transport                        | M1/M2       | — Needs native substrate and approved seed assets               | 58; 61 approved seed; 86 remote adapters                                   |
| [63](63-native-speech-speak-and-latency.md)         | On-device ASR, Speak and measured latency per target                        | M2          | — Needs audio/recognition integration and evidence              | 58; 60 matching; 62; per-target validation                                 |
| [64](64-today-and-refrain-production-loop.md)       | Durable timed waves, real Refrain audio and tag drills                      | M2          | 🟡 Manual loop exists; production behavior remains              | 59/60/62/63; Q-14 peak only; 81 presentation                               |
| [65](65-import-and-capture.md)                      | Offline reviewed Import, then on-device OCR Capture                         | M2/M3       | 🟡 Own-phrase seam exists; input surfaces remain                | 56/59; OCR 58; optional assistance 76/86                                   |
| [66](66-backend-contract-data-and-security.md)      | Nest validation, Postgres, tenant cursors and exact image                   | M2          | 🟡 Contracts exist; service/data/security remain                | 54/85 ✅; 67 principal integration; 86 adapters                            |
| [67](67-anonymous-auth-and-account-lifecycle.md)    | Anonymous identity, sign-in merge, export and erasure                       | M2          | — Runtime needs durable backend/device identity                 | 85 ✅; 66; 59; 86 identity/email adapters                                  |
| [68](68-sync-and-offline-convergence.md)            | Mobile outbox transport and course-aware convergence                        | M2          | 🟡 Outbox/merge exist; client/convergence remain                | 59; 60 merge only; 66 cursor API; 67                                       |
| [69](69-trip-domain-and-arc.md)                     | Course-bound trip lifecycle and six-screen arc                              | M2          | ⛔ Q-07 trip/relocation semantics                               | 56/59/60/61; Q-07                                                          |
| [70](70-survival-widgets-and-notifications.md)      | Airplane-mode Survival, widgets and notifications                           | M2          | — Native integration remains; Rust policy exists                | 58/61/62/69; 56 deep links                                                 |
| [71](71-settings-telemetry-and-experiments.md)      | General Settings, consent, telemetry and flags                              | M2/M3       | 🟡 Language/engine seams exist; Q-05 experiment only            | 59; 56/81; 67/68 account sync only; 86                                     |
| [72](72-release-quality-gates.md)                   | Native release matrix, pseudo-locale and measured budgets                   | M2          | 🟡 Web/i18n gates exist; native proof remains                   | 58/57; feature slices; Q-14 peak; 87 review                                |
| [73](73-delivery-observability-and-slos.md)         | Production/store delivery, diagnostics and objectives from testing evidence | M2/M4       | 🟡 Scaffolds exist; production/native evidence remains          | 58/66/72 applicable artifacts; 86 adapters; 88 testing evidence            |
| [74](74-monetization-and-entitlements.md)           | Approved purchases and offline-safe entitlements                            | M2          | ⛔ Q-08 package/pricing; Q-12 billing                           | 59/67/73; 86 selected adapter                                              |
| [75](75-review-and-memory.md)                       | Course-scoped Review and real Memory curves                                 | M3          | — No routes/engine; needs durable canonical FSRS                | 59/60; 56/57/81; 72 shared harness only                                    |
| [76](76-roleplay-and-live-ai.md)                    | Locale-aware bundled Roleplay and guarded live service                      | M3          | 🟡 Bundled/provider seams exist; runtime/evals remain           | 59/62/63/66/67/71; 86 controls                                             |
| [77](77-dsp-and-speech-labs.md)                     | DSP evidence spike, then calibrated labs                                    | M1 spike/M3 | 🟡 Helpers exist; production ⛔ quality gate                    | Spike prep now; device/reference slices 58/60–63/72                        |
| [78](78-conditional-run-and-phrasebook.md)          | Conditional Run and ladder Phrasebook                                       | M5          | ⛔ Q-05 plus comparative M3 evidence                            | 59/60/71; applicable 72 gates                                              |
| [80](80-dev-design-system-workbench.md)             | Finish production-state and multilingual specimens                          | M1/M2       | 🟡 Workbench exists; register new components now                | 57 state APIs; 81 future chrome; 87 language UI                            |
| [81](81-navigation-spine-switcher-and-more.md)      | More, ongoing work, exits, resume and travelling audio                      | M1/M2       | 🟡 Shared menu exists; Q-17 final rail priorities               | 56/57; 59/64 checkpoints; 62 audio                                         |
| [82](82-guided-chat-domain-and-service.md)          | Offline chat domain/graphs and guarded service                              | M3          | 🟡 Drafts exist; offline work can start; scoped Q gates         | 79/85 ✅; 59/61; live 66/67/86; Q-19 retention                             |
| [83](83-open-chat-and-message-inspector.md)         | Open chat and Message inspector                                             | M3          | — Text first; Q-16 release enablement                           | 56/57/59/81/82; voice 62/63; Review handoff 75                             |
| [86](86-provider-integrations.md)                   | Shared provider controls and approved vendor adapters                       | M2/M3       | 🟡 Anthropic transport merged; controls/adapters/runtime remain | 85 ✅; 66; owning feature/decision slices; 88 testing resources            |
| [87](87-multilingual-app-and-language-selection.md) | Bilingual sign-off and multilingual device/release proof                    | M1/M2       | 🟡 Seven-pair foundation done; review/durability gates          | Human review; 59 device proof; 61/72 release integration                   |
| [88](88-low-cost-backend-infrastructure.md)         | Frankfurt EC2/Postgres/S3 testing environment and recovery                  | M2 testing  | — Planned; infrastructure preparation can start now             | 66 image/data/security; 67 shared access; 59/68 mobile sync; 61/86 content |

| [90](90-default-english-content-language.md) | English default learning content and course
selection | M1/M2 | — Planned; English target confirmed; review/device gates remain | 87/85; 59
persistence; 61/62 audio |

Plan 88 owns the selected AWS testing profile and
[operations runbook](../docs/runbooks/backend-testing.md); plan 73 retains production operations.
The testing stages depend on the relevant feature slices, not whole plan completion. The previous
Render testing recommendation in 86 is superseded by 88.

## Completed records

| Plan                                                              | Implemented scope                                              |
| ----------------------------------------------------------------- | -------------------------------------------------------------- |
| [53](53-post-refactor-solid-kiss-dry-audit.md)                    | Protected SOLID/KISS/DRY audit; unchanged at the original path |
| [54](archive/2026-09-07/54-local-persistence-correctness.md)      | Local phrase/settings correctness, waves and outbox histories  |
| [55](archive/2026-09-07/55-current-surface-truth-and-fidelity.md) | Current-screen truth, fidelity and geometry                    |
| [79](archive/2026-09-07/79-v1-1-design-contract.md)               | v1.1 design and requirement contract                           |
| [84](archive/2026-09-07/84-visual-ui-ux-audit.md)                 | Web visual/navigation/enlarged-layout audit                    |
| [85](archive/2026-09-07/85-backend-integration-contracts.md)      | Backend integration inventory and shared API/OpenAPI contracts |

| [89](89-google-apple-sign-in.md) | Google/Apple identity and optional Account utility; provider
setup and native verification remain deployment prerequisites |

## Working rules

- Begin from verified existing code; do not rebuild completed contracts, localization, menus or
  tests.
- Keep one owner per behavior: 56 route policy, 81 chrome; 59 durable checkpoints, 64 wave
  transitions; 66 server cursors, 68 client convergence; 86 vendor controls, 76/82 product AI.
- Future surfaces consume the selected language pair and real capability states. Preserve personal
  meaning language, course isolation and global streak semantics; never silently substitute Spanish.
- Every new learner state lands with its manifest row and E2E checks. Native behavior requires
  device evidence. Numbers must come from real events or canonical maths; recorded PCM never leaves
  device.
- Release decisions remain in `docs/decisions/open-questions.md`: Q-15 audio; Q-07 trips; Q-05
  experiment/Run; Q-14 peak; Q-08/Q-12 billing; Q-17 rail priority; Q-16 chat launch, Q-18 budget,
  Q-19 local retention and Q-20 provider retention. No decision is silently resolved by this reset.
- Keep each plan/status row current and commit coherent requirement-tagged chunks with `pnpm check`
  green. Archive completed scope; never delete historical records or reuse numbers.

| [88](88-ec2-backend-deployment.md) | Restricted EC2 API and deployment scripts | M0 | 🟡 Implemented; live rehearsal awaits AWS region/network/key inputs | Existing image; 66–68 for public service |
