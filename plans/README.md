# Active plans

The **2026-09-07** review of baseline `2d9e8c3` recorded **30 plans with remaining work**, five
completed plans moved to [the dated archive](archive/2026-09-07/README.md), and completed
[plan 53](53-post-refactor-solid-kiss-dry-audit.md) retained at its protected original path. The
[review](archive/2026-09-07/REVIEW.md) records evidence, scope transfers and verification.

Plans 01–52 remain historical in [the previous archive](archive/2026-07-30/REVIEW.md); 49 is an
existing gap, not a free number. No plan was renumbered. The highest assigned ID is **94** and the
next new plan is **95**. Statuses below include the 2026-09-08 runtime integration. Completed
89/91/92 are now in [the 2026-09-08 archive](archive/2026-09-08/README.md), with compatibility
symlinks at their original paths. That archive also retains superseded snapshots of 64/72/75/88/90
and the earlier roadmap; refreshed active owners keep all unfinished scope. There are **33 plans
with remaining work**.

Plans 56–65 are stored in [the 2026-09-09 archive](archive/2026-09-09/README.md) at user request.
Their partial statuses and outstanding scope remain indexed below; archiving does not imply
completion.

The [2026-09-09 implementation review](../docs/reviews/2026-09-09-twenty-plan-implementation.md) and
[follow-up review](../docs/reviews/2026-09-09-twenty-plan-follow-up-code-review.md) retain the
findings and remediation chronology. Locally actionable fixes are present at `aafa61f`; their
historical findings must not be requeued as current defects. Whole-plan acceptance remains partial.

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
| ✅   | Implemented within the recorded scope; archived except for protected plan 53.                 |

## Next implementation priorities — reviewed 2026-09-09

The user-selected nine priorities below replace the earlier twenty-plan queue. Source review against
`aafa61f` confirms that the earlier deliveries and review fixes are inputs to this work, not new
tasks. The 18 owning plans record current evidence, next slices and acceptance gates. This is a
dependency-aware sequence of deliverables, not a requirement to complete whole plans in order.

| Priority | Plans                                                                                                                                                                           | Next delivery                                                                                                                     |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1        | [56](56-navigation-failure-and-input-shell.md), [81](81-navigation-spine-switcher-and-more.md)                                                                                  | Route laws and consumer integration; explicit exits, ongoing work and course-preserving resume                                    |
| 2        | [64](64-today-and-refrain-production-loop.md)                                                                                                                                   | Enforced timed waves, banked/yesterday tails, all-graduated states and tag-filtered drills                                        |
| 3        | [75](75-review-and-memory.md)                                                                                                                                                   | Review contracts, engine and durable grade/session route; Memory afterward; Undo awaits 68 compensation                           |
| 4        | [61](61-content-and-audio-assets.md), [66](66-backend-contract-data-and-security.md), [86](86-provider-integrations.md)                                                         | Compatible signed text-content publication and atomic client activation, with only the required backend/storage adapters          |
| 5        | [71](71-settings-telemetry-and-experiments.md), [57](57-runtime-design-system.md)                                                                                               | Durable general Settings and privacy controls, using supported runtime visuals; telemetry/flags are separate                      |
| 6        | [67](67-anonymous-auth-and-account-lifecycle.md), [68](68-sync-and-offline-convergence.md)                                                                                      | Reviewed lifecycle policy, management/export/erasure, repair and stale-device enforcement; background execution follows           |
| 7        | [62](62-native-audio-playback.md), [63](63-native-speech-speak-and-latency.md) → [64](64-today-and-refrain-production-loop.md), [81](81-navigation-spine-switcher-and-more.md)  | Shared native session/cache/background transport, measured onset, audible loop and travelling presentation                        |
| 8        | [65](65-import-and-capture.md)                                                                                                                                                  | Bounded offline file input and durable draft/retry recovery; OCR later                                                            |
| 9        | [58](58-native-workspace-and-device-ci.md), [72](72-release-quality-gates.md), [87](87-multilingual-app-and-language-selection.md), [88](88-low-cost-backend-infrastructure.md) | Start alongside priority 1: native builds/device evidence, release matrix, real bilingual review and off-host recovery/operations |

### Existing delivery to preserve

- `check:routes`, built-hub navigation metadata and More's static groups already exist. The missing
  work is exhaustive authored surface policy, consumer integration, counts/search and exits/resume.
- Paste import already revalidates field/batch limits at edit/save and retains rejected/write-failed
  rows through in-session storage recovery. File input and durable draft relaunch are still missing.
- The local fast gate runs native collector fixtures; full local CI runs a separate pseudo-locale
  suite. Full state/native evidence remains open. Review-record validation recomputes actual
  material digests and checks declared reviewer languages; real approvals and release-path wiring
  remain.
- Plans 59/60/93/94 supply persistence, canonical algorithms, gestures and integration. Do not
  rebuild them. Plan 80 consumes production components/states as they land, outside this selected
  queue.

### Dependency and acceptance boundaries

- Priority 9 is concurrent acceptance work. Missing hardware or reviewers blocks only the affected
  acceptance claim; code and fixture work on independent slices continues.
- Priority 1/2 exits, scheduling and tag drills do not wait for priority 7 audio. Plan 75 can ship a
  scoped Review delivery without Undo; its compensation contract may be prepared with 68 during
  priority 3. Plan 57's specific visual prerequisites may precede priority 5 as features need them.
- Text delivery and storage adapters proceed before Q-15. Production audio still needs licensed,
  reviewed voice/model assets; 62's session/clock contract precedes 63 onset integration. Current
  on-device ASR/reveal acceptance can run immediately, independently of recorded assets.
- Seven language pairs remain the baseline. Plan 90's English-default requirement remains owned by
  that plan; confirm the English dialect before freezing new identities. It is outside this selected
  batch and does not block current-pair work. Q-07 trips, Q-08/Q-12 billing, Q-05 experiment/Run,
  Q-14 peak presentation, Q-17 final rail ordering and chat launch/budget/retention stay scoped
  gates.
- Reverify the deployed image before operational work. The recorded Google development deployment
  and isolated restore are dated evidence, not current off-host recovery or device-convergence
  proof. Plan 88 owns testing infrastructure; 73 retains production/store delivery. GitHub Actions
  stays disabled.
- Plans 56–65 retain their archive locations and compatibility symlinks. Archive placement does not
  mean completion. No plan is renumbered, newly created or marked complete by this review.

## Remaining roadmap

Dependencies refer to the named deliverable slice, not automatically the whole plan. In particular,
72 supplies shared harnesses to features and consumes their release evidence; it must not create a
feature↔release-completion cycle. See each plan's checkboxes for executable tasks and acceptance.

| Plan                                                    | Remaining outcome                                                           | Milestone   | Status / blocker                                                                      | Prerequisites                                                   |
| ------------------------------------------------------- | --------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| [56](56-navigation-failure-and-input-shell.md)          | Route laws, recovery, keyboard and scalable lists                           | M1          | 🟡 Registry/group metadata and drift gate done; route laws/recovery remain            | 53/55/79/84 ✅; 58 for device proof                             |
| [57](57-runtime-design-system.md)                       | Fonts, motion, haptics, dark theme and production state APIs                | M1/M2       | 🟡 Control states and tabular numerals done; fonts/motion/themes remain               | 53/55 ✅; font provenance; 58 device proof                      |
| [58](58-native-workspace-and-device-ci.md)              | Native workspace and device harness                                         | M1          | 🟡 Bridges/APK and evidence collectors done; full iOS/device/signing proof open       | 53 ✅; SDK/device/signing evidence                              |
| [59](59-device-persistence-and-resume.md)               | Durable SQLite and crash/session acceptance                                 | M1          | 🟡 Runtime done; wider device/upgrade/lifecycle evidence remains                      | 54 ✅; 58 device harness; 67 erasure UI                         |
| [60](60-authoritative-core-maths.md)                    | Canonical core policy and binding acceptance                                | M1/M2       | 🟡 Rust/runtime/parity done; device and linguistic acceptance remain                  | 53 ✅; 58 devices; 87 bilingual review                          |
| [61](61-content-and-audio-assets.md)                    | Versioned content delivery, reviewed expansion and audio                    | M1–M3       | 🟡 Starters, contracts and verifier hardening done; Q-15 gates audio                  | 85 ✅; 59 activation; 86 adapters; 87 review                    |
| [62](62-native-audio-playback.md)                       | Recorded playback, cache and background transport                           | M1/M2       | 🟡 TTS and queued-session cancellation done; Q-15/hardware remain                     | 58; 61 approved seed; 86 remote adapters                        |
| [63](63-native-speech-speak-and-latency.md)             | Per-target ASR acceptance and measured onset                                | M2          | 🟡 ASR/Speak/reveal and event validation done; hardware/onset remain                  | 58; 60 matching; 62 clock/buffers; target models                |
| [64](64-today-and-refrain-production-loop.md)           | Durable timed waves, real Refrain audio and tag drills                      | M2          | 🟡 Manual loop and focused clock refresh done; production behavior remains            | 59/60/62/63; Q-14 peak only; 81 presentation                    |
| [65](65-import-and-capture.md)                          | Offline reviewed Import, then on-device OCR Capture                         | M2/M3       | 🟡 Paste limits/partial-save recovery done; files/durable drafts/OCR remain           | 56/59; OCR 58; optional assistance 76/86                        |
| [66](66-backend-contract-data-and-security.md)          | Durable backend and operational/security acceptance                         | M2          | 🟡 Postgres/auth/sync/content-v2 done; image/load proof remains                       | 54/85 ✅; 67 lifecycle; 86 providers                            |
| [67](67-anonymous-auth-and-account-lifecycle.md)        | Account linking, recovery, export and erasure                               | M2          | 🟡 Identity/binding/sync and email race guard done; lifecycle gates remain            | 59/66 runtime; 86 providers; lifecycle policy                   |
| [68](68-sync-and-offline-convergence.md)                | Background, rescue and device/load convergence proof                        | M2          | 🟡 Durable sync and bounded cursor recovery done; acceptance remains                  | 59/60/66/67 runtime; device/load environment                    |
| [69](69-trip-domain-and-arc.md)                         | Course-bound trip lifecycle and six-screen arc                              | M2          | ⛔ Q-07 trip/relocation semantics                                                     | 56/59/60/61; Q-07                                               |
| [70](70-survival-widgets-and-notifications.md)          | Airplane-mode Survival, widgets and notifications                           | M2          | — Native integration remains; Rust policy exists                                      | 58/61/62/69; 56 deep links                                      |
| [71](71-settings-telemetry-and-experiments.md)          | General Settings, consent, telemetry and flags                              | M2/M3       | 🟡 Local analytics consent persists safely; UI/telemetry/flags remain                 | 59; 56/81; 67/68 account sync only; 86                          |
| [72](72-release-quality-gates.md)                       | Native release matrix, pseudo-locale and measured budgets                   | M2          | 🟡 Pseudo-locale/fixture gate done; native/layout proof remains                       | 58/57; feature slices; Q-14 peak; 87 review                     |
| [73](73-delivery-observability-and-slos.md)             | Production/store delivery, diagnostics and objectives from testing evidence | M2/M4       | 🟡 Scaffolds exist; production/native evidence remains                                | 58/66/72 applicable artifacts; 86 adapters; 88 testing evidence |
| [74](74-monetization-and-entitlements.md)               | Approved purchases and offline-safe entitlements                            | M2          | ⛔ Q-08 package/pricing; Q-12 billing                                                 | 59/67/73; 86 selected adapter                                   |
| [75](75-review-and-memory.md)                           | Course-scoped Review and real Memory curves                                 | M3          | 🟡 Candidate boundary/tag priority done; engine/routes/Memory remain                  | 59/60; 56/57/81; 72 shared harness only                         |
| [76](76-roleplay-and-live-ai.md)                        | Locale-aware bundled Roleplay and guarded live service                      | M3          | 🟡 Bundled/provider seams exist; runtime/evals remain                                 | 59/62/63/66/67/71; 86 controls                                  |
| [77](77-dsp-and-speech-labs.md)                         | DSP evidence spike, then calibrated labs                                    | M1 spike/M3 | 🟡 Helpers exist; production ⛔ quality gate                                          | Spike prep now; device/reference slices 58/60–63/72             |
| [78](78-conditional-run-and-phrasebook.md)              | Conditional Run and ladder Phrasebook                                       | M5          | ⛔ Q-05 plus comparative M3 evidence                                                  | 59/60/71; applicable 72 gates                                   |
| [80](80-dev-design-system-workbench.md)                 | Finish production-state and multilingual specimens                          | M1/M2       | 🟡 All 33 exports registered; state/long-copy coverage remains                        | 57 state APIs; 81 future chrome; 87 language UI                 |
| [81](81-navigation-spine-switcher-and-more.md)          | More, ongoing work, exits, resume and travelling audio                      | M1/M2       | 🟡 Shared menu/grouped More done; exits/resume/search and Q-17 remain                 | 56/57; 59/64 checkpoints; 62 audio                              |
| [82](82-guided-chat-domain-and-service.md)              | Offline chat domain/graphs and guarded service                              | M3          | 🟡 Drafts exist; offline work can start; scoped Q gates                               | 79/85 ✅; 59/61; live 66/67/86; Q-19 retention                  |
| [83](83-open-chat-and-message-inspector.md)             | Open chat and Message inspector                                             | M3          | — Text first; Q-16 release enablement                                                 | 56/57/59/81/82; voice 62/63; Review handoff 75                  |
| [86](86-provider-integrations.md)                       | Shared provider controls and approved vendor adapters                       | M2/M3       | 🟡 Anthropic process-local admission done; other controls/adapters remain             | 85 ✅; 66; owning feature/decision slices; 88 testing resources |
| [87](87-multilingual-app-and-language-selection.md)     | Bilingual sign-off and all-pair device/release proof                        | M1/M2       | 🟡 Seven-pair runtime and exact-material review gate done; human/device evidence open | Human review; 59/58 device harness; 61/72                       |
| [88](88-low-cost-backend-infrastructure.md)             | Shared EC2/Postgres/S3 testing and recovery                                 | M2 testing  | 🟡 Restricted host/backup collector done; recovery acceptance remains                 | 66/67 deployed runtime; 59/68 devices; 61/86 content            |
| [90](90-default-english-content-language.md)            | English default learning content and course selection                       | M1/M2       | 🟡 Shared registry integration done; dialect/review/device gates remain               | 87/85; 59 persistence; 61/62 audio                              |
| [93](93-mobile-shell-gestures.md)                       | Pull-down switcher and sheet dismissal                                      | M1/M2       | 🟡 Implemented; physical-device touch verification remains                            | Shared shell; device evidence                                   |
| [94](94-persistent-practice-and-account-integration.md) | Integrated persistence, canonical core, speech and account sync             | M1/M2       | 🟡 Runtime and aggregate CI passed; hardware and service acceptance remain            | 54/85 ✅; coordinated 58–60/62–63/66–68 slices                  |

Plan 88 owns the selected AWS testing profile and
[operations runbook](../docs/runbooks/backend-testing.md); plan 73 retains production operations.
The testing stages depend on the relevant feature slices, not whole plan completion. The previous
Render testing recommendation in 86 is superseded by 88.

## Completed records

| Plan                                                              | Implemented scope                                                                                                   |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| [53](53-post-refactor-solid-kiss-dry-audit.md)                    | Protected SOLID/KISS/DRY audit; unchanged at the original path                                                      |
| [54](archive/2026-09-07/54-local-persistence-correctness.md)      | Local phrase/settings correctness, waves and outbox histories                                                       |
| [55](archive/2026-09-07/55-current-surface-truth-and-fidelity.md) | Current-screen truth, fidelity and geometry                                                                         |
| [79](archive/2026-09-07/79-v1-1-design-contract.md)               | v1.1 design and requirement contract                                                                                |
| [84](archive/2026-09-07/84-visual-ui-ux-audit.md)                 | Web visual/navigation/enlarged-layout audit                                                                         |
| [85](archive/2026-09-07/85-backend-integration-contracts.md)      | Backend integration inventory and shared API/OpenAPI contracts                                                      |
| [89](archive/2026-09-08/89-google-apple-sign-in.md)               | Google/Apple identity and Account; integrated with 94, provider/device setup remains a release prerequisite         |
| [91](archive/2026-09-08/91-ec2-backend-deployment.md)             | Restricted EC2 deployment, readiness and manual rollback verified; shared durable runtime needs separate deployment |
| [92](archive/2026-09-08/92-android-ec2-readiness.md)              | Standalone HTTPS/APK/readiness checks verified; dated preview evidence does not validate later native/sync features |

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
