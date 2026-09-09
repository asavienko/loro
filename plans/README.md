# Active plans

This index lists only the **34 plans with remaining work**. Completed records and historical
snapshots are kept in [the archive](archive/README.md), without compatibility symlinks or redirect
files in this directory. Links point directly to each plan's actual location.

The highest assigned ID is **96** and the next new plan is **97**. Numbers are never reused; 49
remains an existing gap. Keep completed records in the archive index when a plan finishes.

Plans 56–65 are stored in [the 2026-09-09 archive](archive/2026-09-09/README.md) at user request.
Their partial statuses and outstanding scope remain indexed below; archiving does not imply
completion.

The [post-main review](../docs/reviews/2026-09-09-post-main-plan-review.md) records the six runtime
and validation findings as fixed, including the follow-up Refrain completion and touch-target
repairs. No additional whole plan meets its acceptance criteria. Delivered implementation slices are
recorded in the [dated archive](archive/2026-09-09/IMPLEMENTED-SLICES.md); the previous 33
remaining-work owners are retained, and [96](96-phrase-music-generation.md) adds a later
lyrics-plus-music garnish. Continue with device/provider acceptance, then integrate the remaining
daily-loop, Review, content and lifecycle slices.

The [2026-09-09 implementation review](../docs/reviews/2026-09-09-twenty-plan-implementation.md)
records changes requested after the next twenty bounded slices. Each selected plan remains partial;
the review includes import validation fixes, commit-check failures and per-plan follow-up work.

The [33-plan implementation review](../docs/reviews/2026-09-09-thirty-three-plan-implementation.md)
records the earlier Refrain checkpoint/navigation, draft-storage and generated-binding repairs. The
post-main review records the follow-up import, content, graph, deterministic-test and format fixes;
platform/device acceptance remains separate.

The [refactoring-strategies review](../docs/reviews/2026-09-09-refactoring-strategies.md)
inventories structural debt in existing code and separates it from unfinished plan work. It does not
open a new plan.

## Current scope

- Eight of 23 authored learner screens, Languages/Account, the shared shell and the dev workbench
  are built. Fifteen learner screens remain. Main's pull gestures and Android text-scale/readiness
  fixes are retained.
- UI/native languages are en/bg/ru; targets are es-ES/bg-BG/ru-RU excluding matching pairs: seven
  pairs and three 31-phrase starter catalogs. Durable course progress/resume is separate; the streak
  is global. Bilingual review remains outstanding.
- Native OP-SQLite and browser SQLite commit progress, checkpoints and outbox atomically before
  publishing state. Canonical Rust FSRS, selection, matching, ranking, clocks and merge run through
  generated native/browser boundaries.
- Foreground device TTS, strict on-device ASR and Speak reveal fallback are implemented. Recorded
  assets/cache, background transport, measured onset/DSP, widgets and physical-device speech
  acceptance remain. ElevenLabs is selected; Q-15 still gates licensed, reviewed production assets.
- PostgreSQL accounts and tenant-scoped sync connect optional Google/Apple/email sign-in to durable
  progress. Account linking/export/erasure, OS background sync and production provider/service
  configuration remain. EC2 now exposes Google development sign-in and guarded sync backed by
  private PostgreSQL. Public-boundary and restore checks passed; live consent-to-device verification
  remains.

## Status

| Mark | Meaning                                                                                       |
| ---- | --------------------------------------------------------------------------------------------- |
| 🟡   | Implemented foundation or partial delivery; remaining tasks and blocking slices are explicit. |
| —    | Remaining implementation can proceed when its listed technical prerequisites pass.            |
| ⛔   | A named decision/evidence gate blocks that product slice, not unrelated preparation.          |
| ✅   | Implemented within the recorded scope; listed only in the archive index.                      |

## Start here

1. **Complete foundation acceptance:** [94](94-persistent-practice-and-account-integration.md)
   records the integrated runtime across 58–60/62–63/66–68. Expand physical-device and iOS evidence,
   lifecycle/recovery flows and load/operational acceptance on these implemented foundations. Extend
   the existing route model in [56](archive/2026-09-09/56-navigation-failure-and-input-shell.md); do
   not rebuild the store, canonical maths or account stacks.
2. **Available UI/content work:** [57](archive/2026-09-09/57-runtime-design-system.md) supplies real
   state APIs to [80](80-dev-design-system-workbench.md);
   [81](81-navigation-spine-switcher-and-more.md) extends the implemented More and Refrain exits.
   Begin [87](87-multilingual-app-and-language-selection.md)'s bilingual review and
   [61](archive/2026-09-09/61-content-and-audio-assets.md)'s real updater/asset adapters. Prepare
   [77](77-dsp-and-speech-labs.md)'s evidence spike and [82](82-guided-chat-domain-and-service.md)'s
   offline schemas/topic/eval work without activating gated production features.
3. **Remaining device/service integration:** approved 61 assets→recorded/background 62; 62
   clock/buffer substrate→63 onset latency; 66 operational acceptance + 67 account lifecycle→68
   lifecycle convergence. Existing native SQLite, foreground speech and authenticated sync are
   implemented slices, while 60's core remains the only merge/scheduling boundary.
   [86](86-provider-integrations.md) supplies adapters to each owner; the old plan-85
   handoff/worktree block is closed.
4. **Production v1:** 59/60/62/63→64; 56/59→Import in 65; resolve Q-07→69→70. General settings in 71
   can precede account sync. Develop release harnesses in 72 as features land, then verify delivery
   in 73 and approved billing in 74.
5. **Later surfaces:** 59/60→75; bundled/guarded provider foundations→76 and 82→83. Voice, Review
   handoff and live release gates apply to their specific slices. Labs follow the recorded DSP
   decision; Run/ladder Phrasebook follows Q-05 and comparative evidence.
   [96](96-phrase-music-generation.md) plans optional phrase-selected lyrics and multi-style
   ElevenLabs Music; it is garnish, not daily-loop work, and live spend waits on proposed Q-21.

## Next implementation priorities — reviewed 2026-09-09

The historical source/plan review against `42f4d57` recommended the following order for the
remaining slices: **58, 56, 57, 72, 66, 88, 86, 87, 90, 81, 71, 67, 68, 61, 62, 63, 64, 75, 65,
80**. Each selected plan now records its delivery order and scoped gates. This is a priority queue,
not a requirement to complete each whole plan before starting the next. Native harnesses (58/72),
bilingual review coordination (87), and independent backend/UI work can progress together.

- Extend existing foundations: surface inventory/basic home resolution, durable onboarding/course
  settings, control-state APIs, account identity and sync already exist. Finish their missing
  slices.
- Archived 56–65 remain archived with direct links to their actual files; these priorities refer to
  their recorded unfinished scope, not a repeat of the integrated ten implementation slices.
- Seven language pairs remain the current baseline. Plan 90 extends the contract after English
  dialect confirmation; 87/72 then consume the expanded review/test matrix. Existing-pair sign-off
  does not block contract implementation, while unreviewed content remains release-gated.
- Plans 66/88 preserve the recorded Google development deployment and isolated restore evidence.
  Refresh deployed-state evidence before operations; full device consent, off-host recovery,
  monitoring and load acceptance remain open. This review performed no new deployment/device tests.
- Plans 59/60/93/94 retain their acceptance ownership; their existing runtime is an input, not a
  separate rebuild. Q-07, Q-15, Q-14, Q-17 and account lifecycle policies still gate their named
  slices.

## Remaining roadmap

Dependencies refer to the named deliverable slice, not automatically the whole plan. In particular,
72 supplies shared harnesses to features and consumes their release evidence; it must not create a
feature↔release-completion cycle. See each plan's checkboxes for executable tasks and acceptance.

| Plan                                                              | Remaining outcome                                                           | Milestone   | Status / blocker                                                                                             | Prerequisites                                                   |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| [56](archive/2026-09-09/56-navigation-failure-and-input-shell.md) | Route laws, recovery, keyboard and scalable lists                           | M1          | 🟡 Registry, escapes and route/state drift gate done; shell remains                                          | 53/55/79/84 ✅; 58 for device proof                             |
| [57](archive/2026-09-09/57-runtime-design-system.md)              | Fonts, motion, haptics, dark theme and production state APIs                | M1/M2       | 🟡 Control states, tabular numerals and Settings theme wiring done; fonts/motion/dark remain                 | 53/55 ✅; font provenance; 58 device proof                      |
| [58](archive/2026-09-09/58-native-workspace-and-device-ci.md)     | Native workspace and device harness                                         | M1          | 🟡 Bridges, local APK and simulator collector exist; iOS/device/signing proof remains                        | 53 ✅; SDK/device/signing evidence                              |
| [59](archive/2026-09-09/59-device-persistence-and-resume.md)      | Durable SQLite and crash/session acceptance                                 | M1          | 🟡 Runtime done; wider device/upgrade/lifecycle evidence remains                                             | 54 ✅; 58 device harness; 67 erasure UI                         |
| [60](archive/2026-09-09/60-authoritative-core-maths.md)           | Canonical core policy and binding acceptance                                | M1/M2       | 🟡 Rust/runtime/parity done; device and linguistic acceptance remain                                         | 53 ✅; 58 devices; 87 bilingual review                          |
| [61](archive/2026-09-09/61-content-and-audio-assets.md)           | Versioned content delivery, reviewed expansion and audio                    | M1–M3       | 🟡 Starters, contracts and verifier hardening done; Q-15 gates audio                                         | 85 ✅; 59 activation; 86 adapters; 87 review                    |
| [62](archive/2026-09-09/62-native-audio-playback.md)              | Recorded playback, cache and background transport                           | M1/M2       | 🟡 TTS and queued-session cancellation done; Q-15/hardware remain                                            | 58; 61 approved seed; 86 remote adapters                        |
| [63](archive/2026-09-09/63-native-speech-speak-and-latency.md)    | Per-target ASR acceptance and measured onset                                | M2          | 🟡 ASR/Speak/reveal and event validation done; hardware/onset remain                                         | 58; 60 matching; 62 clock/buffers; target models                |
| [64](archive/2026-09-09/64-today-and-refrain-production-loop.md)  | Durable timed waves, real Refrain audio and tag drills                      | M2          | 🟡 Wave-aware resume/timed entry done; test-clock, drills/audio and peak acceptance remain                   | 59/60/62/63; Q-14 peak only; 81 presentation                    |
| [65](archive/2026-09-09/65-import-and-capture.md)                 | Offline reviewed Import, then on-device OCR Capture                         | M2/M3       | 🟡 Paste/draft and browser picker/request isolation done; native proof and OCR remain                        | 56/59; OCR 58; optional assistance 76/86                        |
| [66](66-backend-contract-data-and-security.md)                    | Durable backend and operational/security acceptance                         | M2          | 🟡 Postgres/auth/sync/content-v2 done; image/load proof remains                                              | 54/85 ✅; 67 lifecycle; 86 providers                            |
| [67](67-anonymous-auth-and-account-lifecycle.md)                  | Account linking, recovery, export and erasure                               | M2          | 🟡 Identity/binding/sync and email race guard done; lifecycle gates remain                                   | 59/66 runtime; 86 providers; lifecycle policy                   |
| [68](68-sync-and-offline-convergence.md)                          | Background, rescue and device/load convergence proof                        | M2          | 🟡 Durable sync and bounded cursor recovery done; acceptance remains                                         | 59/60/66/67 runtime; device/load environment                    |
| [69](69-trip-domain-and-arc.md)                                   | Course-bound trip lifecycle and six-screen arc                              | M2          | ⛔ Q-07 trip/relocation semantics                                                                            | 56/59/60/61; Q-07                                               |
| [70](70-survival-widgets-and-notifications.md)                    | Airplane-mode Survival, widgets and notifications                           | M2          | 🟡 Rust candidate planner and bindings exist; native scheduler/widgets remain                                | 58/61/62/69; 56 deep links                                      |
| [71](71-settings-telemetry-and-experiments.md)                    | General Settings, consent, telemetry and flags                              | M2/M3       | 🟡 Settings UI and durable accent/motion/consent done; telemetry/flags remain                                | 59; 56/81; 67/68 account sync only; 86                          |
| [72](72-release-quality-gates.md)                                 | Native release matrix, pseudo-locale and measured budgets                   | M2          | 🟡 Harnesses exist; full CI and device proof remain; format and deterministic navigation gates pass          | 58/57; feature slices; Q-14 peak; 87 review                     |
| [73](73-delivery-observability-and-slos.md)                       | Production/store delivery, diagnostics and objectives from testing evidence | M2/M4       | 🟡 Scaffolds exist; production/native evidence remains                                                       | 58/66/72 applicable artifacts; 86 adapters; 88 testing evidence |
| [74](74-monetization-and-entitlements.md)                         | Approved purchases and offline-safe entitlements                            | M2          | ⛔ Q-08 package/pricing; Q-12 billing                                                                        | 59/67/73; 86 selected adapter                                   |
| [75](75-review-and-memory.md)                                     | Course-scoped Review and real Memory curves                                 | M3          | 🟡 Pure Review engine exists; canonical order/daily budget, route and Memory remain                          | 59/60; 56/57/81; 72 shared harness only                         |
| [76](76-roleplay-and-live-ai.md)                                  | Locale-aware bundled Roleplay and guarded live service                      | M3          | 🟡 Bundled/provider seams exist; runtime/evals remain                                                        | 59/62/63/66/67/71; 86 controls                                  |
| [77](77-dsp-and-speech-labs.md)                                   | DSP evidence spike, then calibrated labs                                    | M1 spike/M3 | 🟡 Helpers exist; production ⛔ quality gate                                                                 | Spike prep now; device/reference slices 58/60–63/72             |
| [78](78-conditional-run-and-phrasebook.md)                        | Conditional Run and ladder Phrasebook                                       | M5          | ⛔ Q-05 plus comparative M3 evidence                                                                         | 59/60/71; applicable 72 gates                                   |
| [80](80-dev-design-system-workbench.md)                           | Finish production-state and multilingual specimens                          | M1/M2       | 🟡 All 33 exports registered; state/long-copy coverage remains                                               | 57 state APIs; 81 future chrome; 87 language UI                 |
| [81](81-navigation-spine-switcher-and-more.md)                    | More, ongoing work, exits, resume and travelling audio                      | M1/M2       | 🟡 Refrain exit/resume done; full session laws, search/counts/transport and Q-17 remain                      | 56/57; 59/64 checkpoints; 62 audio                              |
| [82](82-guided-chat-domain-and-service.md)                        | Offline chat domain/graphs and guarded service                              | M3          | 🟡 Graph foundation exists; duplicate choice IDs are rejected; content/persistence and scoped Q gates remain | 79/85 ✅; 59/61; live 66/67/86; Q-19 retention                  |
| [83](83-open-chat-and-message-inspector.md)                       | Open chat and Message inspector                                             | M3          | — Text first; Q-16 release enablement                                                                        | 56/57/59/81/82; voice 62/63; Review handoff 75                  |
| [86](86-provider-integrations.md)                                 | Shared provider controls and approved vendor adapters                       | M2/M3       | 🟡 Anthropic process-local admission done; other controls/adapters remain                                    | 85 ✅; 66; owning feature/decision slices; 88 testing resources |
| [87](87-multilingual-app-and-language-selection.md)               | Bilingual sign-off and all-pair device/release proof                        | M1/M2       | 🟡 Seven-pair runtime/review packet done; review/device acceptance remains                                   | Human review; 59/58 device harness; 61/72                       |
| [88](88-low-cost-backend-infrastructure.md)                       | Shared EC2/Postgres/S3 testing and recovery                                 | M2 testing  | 🟡 Host/backup tools recorded; off-host recovery/load/operations acceptance remains                          | 66/67 deployed runtime; 59/68 devices; 61/86 content            |
| [90](90-default-english-content-language.md)                      | English default learning content and course selection                       | M1/M2       | 🟡 Shared registry integration done; dialect/review/device gates remain                                      | 87/85; 59 persistence; 61/62 audio                              |
| [93](93-mobile-shell-gestures.md)                                 | Pull-down switcher and sheet dismissal                                      | M1/M2       | 🟡 Implemented; physical-device touch verification remains                                                   | Shared shell; device evidence                                   |
| [94](94-persistent-practice-and-account-integration.md)           | Integrated persistence, canonical core, speech and account sync             | M1/M2       | 🟡 Runtime/fast/format gates pass; full/device CI remains                                                    | 54/85 ✅; coordinated 58–60/62–63/66–68 slices                  |
| [95](95-parallel-local-ci.md)                                     | Dependency-aware parallel full local CI                                     | M2          | 🟡 Scheduler, cancellation, Git inventory and source identity fixes implemented; runtime comparison remains  | 72; no external blocker for measurements                        |
| [96](96-phrase-music-generation.md)                               | Lyrics from selected phrases, then multi-style ElevenLabs Music             | later       | 🟡 Stub/fixture `/music` stack landed; live LLM/Music spend gated by proposed Q-21 and 86/61/62              | 86/76/82 patterns; 61/62 storage/playback; 56/81 route; Q-21    |

Plan 88 owns the selected AWS testing profile and
[operations runbook](../docs/runbooks/backend-testing.md); plan 73 retains production operations.
The testing stages depend on the relevant feature slices, not whole plan completion. The previous
Render testing recommendation in 86 is superseded by 88.

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
