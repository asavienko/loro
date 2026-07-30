# Active plans

This roadmap was rebuilt on **2026-07-30** from the current code, architecture documents, product
specification, blueprint, open decisions, and every plan in the previous 01–52 set. The previous set
is preserved under [`archive/2026-07-30/`](archive/2026-07-30/README.md); its review and scope
mapping are in [`REVIEW.md`](archive/2026-07-30/REVIEW.md).

Plan numbers are never reused. Plans 01–52 remain historical IDs. **Plan 53 completed concurrently
during this reset and remains in place as a protected record; this reset did not edit or move it.**
Replacement plans begin at 54.

## Status

| Mark | Meaning                                                                             |
| ---- | ----------------------------------------------------------------------------------- |
| 🟡   | In progress or partly implemented; the plan states what remains and what blocks it. |
| ⛔   | Blocked by a named external decision or evidence gate.                              |
| —    | Ready when its dependencies pass.                                                   |
| ✅   | Implemented; move it to the next dated archive during the next roadmap reset.       |

The active set deliberately contains no replacement for completed plans 01, 02, 04, 07, 51, 52,
or 53. It does not repeat their behavior-preserving or correctness work.

## Execution order

The plans are ordered by dependency, not by department:

1. Begin with the correctness work in [54](54-local-persistence-correctness.md) and
   [55](55-current-surface-truth-and-fidelity.md), consuming the completed plan-53 seams.
2. Establish contracts and foundations: [56](56-navigation-failure-and-input-shell.md),
   [57](57-runtime-design-system.md), [58](58-native-workspace-and-device-ci.md),
   [60](60-authoritative-core-maths.md), [61](61-content-and-audio-assets.md), and
   [66](66-backend-contract-data-and-security.md).
3. Wire the device and service spine: [59](59-device-persistence-and-resume.md),
   [62](62-native-audio-playback.md), [63](63-native-speech-speak-and-latency.md),
   [67](67-anonymous-auth-and-account-lifecycle.md), and [68](68-sync-and-offline-convergence.md).
4. Complete v1 product behavior: [64](64-today-and-refrain-production-loop.md),
   [65](65-import-and-capture.md), [69](69-trip-domain-and-arc.md),
   [70](70-survival-widgets-and-notifications.md), [71](71-settings-telemetry-and-experiments.md),
   [72](72-release-quality-gates.md), [73](73-delivery-observability-and-slos.md), and
   [74](74-monetization-and-entitlements.md).
5. Build later surfaces only after their evidence gates: [75](75-review-and-memory.md),
   [76](76-roleplay-and-live-ai.md), [77](77-dsp-and-speech-labs.md), and
   [78](78-conditional-run-and-phrasebook.md).
6. Reconcile and implement the v1.1 additions: [79](79-v1-1-design-contract.md) records the new
   source/requirement contract first; [80](80-dev-design-system-workbench.md) adds the dev-only
   token surface; [81](81-navigation-spine-switcher-and-more.md) implements the new menu on plan
   56's route model; and [82](82-guided-chat-domain-and-service.md) then
   [83](83-open-chat-and-message-inspector.md) deliver the guarded conversation loop.

## Protected retained record

[Plan 53](53-post-refactor-solid-kiss-dry-audit.md) is ✅ implemented and intentionally left at its
original path at the user's request. It is not part of the replacement queue.

## Active roadmap

| Plan                                             | Outcome                                                                      | Milestone | Status                 | Depends on                     |
| ------------------------------------------------ | ---------------------------------------------------------------------------- | --------- | ---------------------- | ------------------------------ |
| [54](54-local-persistence-correctness.md)        | Tombstone/HLC-safe local writes and complete wave persistence                | M1        | —                      | 53 ✅                          |
| [55](55-current-surface-truth-and-fidelity.md)   | Existing screens stop making false claims and match the blueprint contract   | M1        | —                      | 53 ✅                          |
| [56](56-navigation-failure-and-input-shell.md)   | One route model, honest failure states, keyboard-safe input, scalable lists  | M1        | —                      | 53                             |
| [57](57-runtime-design-system.md)                | Fonts, runtime motion, haptics, themes, remaining reusable inventory         | M1/M2     | —                      | 53, 55                         |
| [58](58-native-workspace-and-device-ci.md)       | Reproducible iOS/Android projects, dev clients, native CI and device harness | M1        | —                      | 53                             |
| [59](59-device-persistence-and-resume.md)        | SQLite becomes the device source of truth; sessions survive relaunch         | M1        | —                      | 54, 58                         |
| [60](60-authoritative-core-maths.md)             | Rust owns ranking, FSRS, cloze/set selection and parity-backed bindings      | M1/M2     | —                      | 53, 58 for native integration  |
| [61](61-content-and-audio-assets.md)             | Versioned content delivery, licensed audio, references, 150→600 phrases      | M1/M2     | ⛔ Q-15                | 53                             |
| [62](62-native-audio-playback.md)                | Offline/background playback, rates, cache and hands-free stream              | M1/M2     | —                      | 58, 61 seed batch              |
| [63](63-native-speech-speak-and-latency.md)      | Handle-only capture, on-device ASR, Speak screen, real onset latency         | M2        | —                      | 58, 60, 62                     |
| [64](64-today-and-refrain-production-loop.md)    | Persisted timed waves and truthful, audible Refrain completion               | M2        | —                      | 55, 59, 60, 62, 63             |
| [65](65-import-and-capture.md)                   | Local Import in v1; reviewed OCR Capture in v1.1                             | M2/M3     | —                      | 56, 59; Capture also 63/76     |
| [66](66-backend-contract-data-and-security.md)   | Shared wire schemas, Postgres, safe sync repository, deployable image        | M2        | —                      | 54 for policy parity           |
| [67](67-anonymous-auth-and-account-lifecycle.md) | Anonymous-first identity, sign-in merge, export and erasure                  | M2        | —                      | 59, 66                         |
| [68](68-sync-and-offline-convergence.md)         | User-scoped cursor sync, outbox replay and two-device convergence            | M2        | —                      | 59, 60 merge binding, 66, 67   |
| [69](69-trip-domain-and-arc.md)                  | Trip state machine and arrival/countdown/drop/survival/souvenir routes       | M2        | ⛔ Q-07                | 56, 59, 60, 61                 |
| [70](70-survival-widgets-and-notifications.md)   | Airplane-mode survival, widgets, Live Activity and no-shame scheduling       | M2        | —                      | 58, 62, 69                     |
| [71](71-settings-telemetry-and-experiments.md)   | Durable settings, privacy-safe measures, flags and loop experiment           | M2/M3     | ⛔ Q-05 for experiment | 59, 68                         |
| [72](72-release-quality-gates.md)                | Native accessibility, localization, performance and complete test gates      | M2        | ⛔ Q-14 for peak state | 57–71 as applicable            |
| [73](73-delivery-observability-and-slos.md)      | Dev→store delivery, crash/API observability, rollback and runbooks           | M2/M4     | —                      | 58, 66, 72                     |
| [74](74-monetization-and-entitlements.md)        | Offline-safe entitlements and an evidence-backed paywall                     | M2        | ⛔ Q-08, Q-12          | 59, 67, 73                     |
| [75](75-review-and-memory.md)                    | Real FSRS Review and Memory surfaces                                         | M3        | —                      | 60, 59, 72                     |
| [76](76-roleplay-and-live-ai.md)                 | Guarded live provider and offline-degradable Roleplay                        | M3        | —                      | 63, 66, 67, 71                 |
| [77](77-dsp-and-speech-labs.md)                  | Evidence-gated DSP followed by truthful Pronunciation/Prosody labs           | M3        | ⛔ spike quality gate  | 60–63, 72                      |
| [78](78-conditional-run-and-phrasebook.md)       | Run and Phrasebook only if loop evidence supports them                       | M5        | ⛔ Q-05 + M3 data      | 59, 60, 71, 72                 |
| [79](79-v1-1-design-contract.md)                 | Stable requirements and architecture for all v1.1 design artifacts           | M1/M3     | —                      | —                              |
| [80](80-dev-design-system-workbench.md)          | Dev-only generated token and production component inspection page            | M1        | —                      | 53; coordinates with 57        |
| [81](81-navigation-spine-switcher-and-more.md)   | Spine, switcher, state-driven More menu, resume and travelling transport     | M1/M2     | —                      | 56, 57; then 59, 62, 64        |
| [82](82-guided-chat-domain-and-service.md)       | Typed private chat domain, bundled offline floor and guarded text provider   | M3        | ⛔ plan-79 decisions   | 59, 61, 66–68, 79              |
| [83](83-open-chat-and-message-inspector.md)      | Voice/text chat and inspector with explicit phrase/Review handoff            | M3        | —                      | 57, 59, 62, 63, 75, 79, 81, 82 |

## Rules for this set

- Every plan begins from what is implemented now; no plan may rebuild a completed seam.
- Learner-visible behavior and each new state land with its E2E manifest entry and tests.
- Native plans add real-device coverage; browser E2E is not accepted as proof of audio, speech,
  persistence, widgets, permissions, or offline operation.
- Cross-cutting testing, accessibility, performance, security, observability, and documentation are
  acceptance work inside the plan that creates the behavior. Plans 72 and 73 own only release-level
  matrices and shared infrastructure.
- When a blocked decision is resolved, record it in `docs/decisions/`, update the owning plan, and
  remove the blocker here. Do not invent a product answer inside implementation.
