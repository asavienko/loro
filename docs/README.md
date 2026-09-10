# Loro documentation

[Whole-project improvement assessment — 2026-09-09](reviews/2026-09-09-project-improvement-assessment.md)
answers what to refactor, which tools and libraries to keep or avoid, and which practices are
enforced versus stale, across mobile, core, Rust, API, content, tokens and CI. It is not a numbered
plan and does not claim product acceptance. The two companions below remain authoritative in their
narrower scopes.

[Refactoring strategies — 2026-09-09](reviews/2026-09-09-refactoring-strategies.md) inventories
structural cleanup of **shipped** code: dual TS/Rust numbers, contract schema forks, practice-route
store holes, and docs that lag `AppModule`. It is not an implementation plan and does not claim
whole-plan acceptance.

[Native libraries and approaches — 2026-09-09](reviews/2026-09-09-native-libraries-and-approaches.md)
is a companion to that sequence: Expo/RN keep-vs-adopt-vs-avoid for touches, switches, haptics,
speech, persistence, notifications and widgets. It does not replace A–G and does not install
packages.

[Screen capture plan review — 2026-09-09](reviews/2026-09-09-screen-capture-plan-review.md) compares
the screenshot command with its strengthened plan and records suggested fixes.

[Post-main 33-plan review — 2026-09-09](reviews/2026-09-09-post-main-plan-review.md) is the current
review of `de81744`: six resolved findings, all 33 plan dispositions and the implemented-slice
archive. The earlier review below records history; its blanket import-remediation claim is
superseded.

[33-plan implementation review — 2026-09-09](reviews/2026-09-09-thirty-three-plan-implementation.md)
records the review of `828d296`, its resolved implementation defects, and remaining work options for
every requested plan. It distinguishes passing fast/browser checks from still-required device and
release acceptance.

[Twenty-plan implementation review — 2026-09-09](reviews/2026-09-09-twenty-plan-implementation.md)
records required fixes, verification gaps and next work for the twenty selected plans.

[Stack and Android readiness — 2026-09-08](reviews/2026-09-08-readiness.md) records the live AWS
endpoint and APK evidence at that date. Later persistent-practice implementation and remaining
release gates are recorded in
[plan 94](../plans/archive/2026-09-09/94-persistent-practice-and-account-integration.md).

Everything written down, indexed. Four sections plus decisions.

[Persistent practice and account sync](process/persistent-practice.md) — runtime setup, native
limits and validation.

[Android emulator script-loading bug — 2026-09-09](reviews/2026-09-09-android-script-load.md) —
reproduced debug-APK startup failure, missing bundle evidence and verified Preview workaround.

[Local containers and encrypted environment](process/local-development.md) — Docker Compose, SOPS
and age.

| Section                       | For                                        |
| ----------------------------- | ------------------------------------------ |
| [Product](#product)           | What we're building and why                |
| [Architecture](#architecture) | How it's built                             |
| [Design](#design)             | How it looks, moves, and reads             |
| [Process](#process)           | How we work                                |
| [Decisions](#decisions)       | What's still open, and what could go wrong |

**The four-artifact v1.1 design package under `design/Language Learning by Phrases - V1.1/` outranks
these docs within each artifact's scope.** `Loro.dc.html` owns learner screens 1–21,
`Loro Chat.dc.html` owns screens 22–23, `Navigation.dc.html` owns shared shell/navigation behaviour,
and `Design System.dc.html` is the authored visual reference. The navigation shell applies to Chat
despite Chat's earlier “no chrome” description. These docs interpret and extend the package; they do
not replace or modify it.

---

## How to use these docs to extend the app

These documents describe both the implemented product and its intended architecture. Start with the
current inventory in the root [`README.md`](../README.md), then read the status callout in the
relevant architecture or product document before treating a diagram, route, or service as live.

For implementation work, follow the dependency-ordered [`plans/README.md`](../plans/README.md), use
the applicable authored artifact and screen catalog for learner-visible behaviour, and use the
architecture docs for the contracts that let later screens reuse the same persistence, engine,
native, and service foundations. When a change makes a current-state statement true or false, update
that statement and the owning plan in the same change.

---

## Product

| Doc                                              | Contents                                                                                   |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| [vision.md](product/vision.md)                   | The thesis, positioning, what Loro is not, success conditions                              |
| [personas.md](product/personas.md)               | Four learners, their jobs-to-be-done, and which loop serves each                           |
| [prd.md](product/prd.md)                         | **Every feature**, phase by phase, with IDs, acceptance criteria, and release targets      |
| [functional-spec.md](product/functional-spec.md) | Screen-by-screen behaviour for all 23 learner screens — states, interactions, edge cases   |
| [learning-model.md](product/learning-model.md)   | The pedagogy: difficulty, tags, the connective thread, mastery states                      |
| [practice-loops.md](product/practice-loops.md)   | Loops A/B/C compared; what ships when; how the engine abstraction keeps all three alive    |
| [content-model.md](product/content-model.md)     | Phrases, themes, scenarios, packs, drops, and the rich fields (respelling, glosses, hooks) |
| [trip-arc.md](product/trip-arc.md)               | The countdown product: 6 steps from setting a date to the souvenir                         |
| [metrics.md](product/metrics.md)                 | North star, funnel, event taxonomy, guardrail metrics                                      |
| [monetization.md](product/monetization.md)       | Free tier, subscription, what stays free forever, and why                                  |
| [roadmap.md](product/roadmap.md)                 | M0–M6 with scope, exit criteria, and rough sizing                                          |

## Architecture

| Doc                                                               | Contents                                                                            |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| [overview.md](architecture/overview.md)                           | C4 context and containers, cross-cutting concerns, the ten rules                    |
| [mobile-app.md](architecture/mobile-app.md)                       | Layers, folder structure, navigation, state, rendering strategy                     |
| [practice-engines.md](architecture/practice-engines.md)           | The contract, current Stream/Refrain engines, and planned engine behavior           |
| [audio-speech.md](architecture/audio-speech.md)                   | Playback graph, TTS, ASR, background audio, the hands-free stream                   |
| [prosody-dsp.md](architecture/prosody-dsp.md)                     | Pitch extraction, alignment, per-syllable scoring, rhythm/stress, the cue ladder    |
| [scheduling.md](architecture/scheduling.md)                       | FSRS, queue ranking, automaticity, the roguelike ladder, drop scheduling            |
| [data-model.md](architecture/data-model.md)                       | Entities, ERD, SQLite DDL, Postgres DDL, migrations                                 |
| [sync-protocol.md](architecture/sync-protocol.md)                 | Delta sync, hybrid logical clocks, per-field LWW, conflict rules, wire format       |
| [backend.md](architecture/backend.md)                             | Implemented NestJS seams, EC2/Postgres/S3 testing topology and feature boundaries   |
| [api.md](architecture/api.md)                                     | The HTTP contract — every endpoint, request, response, and error                    |
| [ai-services.md](architecture/ai-services.md)                     | Claude roleplay, coach notes, phrase generation; prompts, caching, guardrails, cost |
| [offline.md](architecture/offline.md)                             | What works with no network, prefetch policy, survival mode                          |
| [widgets-notifications.md](architecture/widgets-notifications.md) | Lock screen widget, Live Activity, Glance widget, notification policy               |
| [security-privacy.md](architecture/security-privacy.md)           | Auth, tokens, at-rest/in-transit, data classes, retention, GDPR duties              |
| [threat-model.md](architecture/threat-model.md)                   | Assets, actors, attack surface, mitigations, abuse of the AI endpoints              |
| [performance.md](architecture/performance.md)                     | Budgets per screen and per subsystem, with how each is measured                     |
| [accessibility.md](architecture/accessibility.md)                 | WCAG target, screen readers, motion, contrast, the audio-first advantage            |
| [observability.md](architecture/observability.md)                 | Testing health/log baseline; future client, sync and learning telemetry             |
| [adr/](architecture/adr/)                                         | 14 architecture decision records                                                    |

The backend contract package also has an
[all-screen integration inventory](architecture/backend-integration-inventory.md),
[implementation/migration guide](architecture/api-contracts.md), and generated
[current](architecture/openapi.current.json) / [target](architecture/openapi.target.json) OpenAPI
specifications.

## Design

| Doc                                                     | Contents                                                                         |
| ------------------------------------------------------- | -------------------------------------------------------------------------------- |
| [design-system.md](design/design-system.md)             | Authored visual reference, generated runtime tokens, and implementation status. Remaining interaction kit: [plan 100](../plans/100-ui-design-system.md) |
| [component-inventory.md](design/component-inventory.md) | Authored 39-component reference and current React Native component inventory     |
| [motion.md](design/motion.md)                           | All 11 keyframe animations, the easing set, and the touch-feedback layer         |
| [screen-catalog.md](design/screen-catalog.md)           | All 23 learner screens ↔ artifact ranges ↔ screenshots ↔ specs; shell separately |
| [copy-and-tone.md](design/copy-and-tone.md)             | Voice, the Spanish/English rules, microcopy patterns, what we never say          |

## Process

| Doc                                                    | Contents                                                                           |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| [ways-of-working.md](process/ways-of-working.md)       | Cadence, roles, planning, how decisions get made and recorded                      |
| [onboarding.md](process/onboarding.md)                 | Day one: tools, clone, bootstrap, run on a device, first PR                        |
| [git-workflow.md](process/git-workflow.md)             | Trunk-based, branch naming, Conventional Commits, stacking, hotfixes               |
| [code-review.md](process/code-review.md)               | What reviewers look for, SLAs, the review checklist                                |
| [definition-of-done.md](process/definition-of-done.md) | Ready / done gates, including the design-fidelity gate                             |
| [testing-strategy.md](process/testing-strategy.md)     | The pyramid, what we test where, golden tests for the scheduler and DSP            |
| [ci-cd.md](process/ci-cd.md)                           | Pipelines, EAS builds, OTA update policy, store submission                         |
| [release-versioning.md](process/release-versioning.md) | SemVer, build numbers, release trains, staged rollout, rollback                    |
| [environments.md](process/environments.md)             | Local and selected AWS testing environment, runtime configuration and access gates |
| [backend-testing.md](runbooks/backend-testing.md)      | Planned EC2 deployment, backups, restore, alerts, maintenance and teardown         |
| [qa-device-matrix.md](process/qa-device-matrix.md)     | Devices, OS floor, the manual pass, audio-specific QA                              |
| [content-authoring.md](process/content-authoring.md)   | How a phrase gets written, recorded, reviewed, and shipped                         |
| [localization.md](process/localization.md)             | UI localization, and the separate problem of new target languages                  |
| [experimentation.md](process/experimentation.md)       | Flags, A/B on pedagogy, ethics of experimenting on learning                        |
| [incident-response.md](process/incident-response.md)   | Severities, on-call, comms, postmortems                                            |
| [glossary.md](process/glossary.md)                     | Every term the blueprint invents, defined once                                     |

## Decisions

| Doc                                                              | Contents                                                 |
| ---------------------------------------------------------------- | -------------------------------------------------------- |
| [open-questions.md](decisions/open-questions.md)                 | Unresolved, with owner and the date it blocks            |
| [listening-voice-packet.md](decisions/listening-voice-packet.md) | Q-15 listening/catalog pins; leaning, pronunciation open |
| [risks.md](decisions/risks.md)                                   | Risk register — likelihood, impact, mitigation, trigger  |

---

## Conventions in these docs

- **Requirement IDs** (`P2-04`, `AI-03`) are stable. Reference them in issues, commits, and tests.
- **Blueprint anchors** look like `Loro.dc.html:1404–1538` and point at exact line ranges.
- **`⚠️ Decision needed`** marks a real fork with no owner yet — mirrored in `open-questions.md`.
- **`🔒 Promise`** marks something the UI states to the user in writing, which the implementation
  must therefore honour (e.g. "your audio stays on your device").
- Version pins in these docs were chosen at authoring time. Re-verify at kickoff; see
  [`process/onboarding.md`](process/onboarding.md).

Account implementation and provider setup:
[Google and Apple accounts](architecture/google-apple-auth.md).
[EC2 development deployment](process/ec2-deployment.md) — provisioning, SSH access, readiness and
rollback.
