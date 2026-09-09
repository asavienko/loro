# Roadmap review — 2026-09-07

- **Requirement IDs:** `F-04`, `F-08`, `NAV-01`
- **Status:** ✅ Documentation audit completed; product gates below remain open.
- **Implementation baseline:** merged `2d9e8c3`
  (`feat(mobile): integrate courses, contracts and pending fixes`).
- **Scope:** all 35 retained/current plans 53–87, plus the prior archive's status/index and
  legacy-to-active mapping. There are 51 historical files for 01–52 because 49 is an existing gap.

## Disposition

Five plans are implemented within their original bounded scope and moved into this archive:

| Plan                                           | Evidence inspected                                                                                       | Remaining behavior stays with                                  |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| [54](54-local-persistence-correctness.md)      | Phrase/settings owned-column SQL, wave round trips, eligibility, adversarial SQLite/outbox tests         | 59 device/course writes; 66/68 sync identity and field policy  |
| [55](55-current-surface-truth-and-fidelity.md) | Screen divergence table, render geometry, undo/onboarding, null manual latency and browser assertions    | 56/60/62/63/64 production behavior                             |
| [79](79-v1-1-design-contract.md)               | Four-artifact precedence, PRD NAV/P3E requirements, screen catalog and guarded chat docs                 | 57/80–83 runtime implementation                                |
| [84](84-visual-ui-ux-audit.md)                 | Responsive UI, shared NavigationMenu, reflow/geometry/navigation E2E and historical visual review record | 81 full navigation; 87 later multilingual acceptance           |
| [85](85-backend-integration-contracts.md)      | core API schemas/operation registry, OpenAPI drift, HTTP/WASM conformance and integration inventory      | 66 runtime validation/data; each feature's service integration |

Plan 53 remains ✅ and byte-identical at its protected original path. Archived plans 01–52 are
historical/superseded, not retroactively relabeled as fully implemented. Their completed and partial
classifications remain in [the prior review](../2026-07-30/REVIEW.md). Compatibility symlinks retain
old citations; archive-local links are rebased to valid destinations.

## Every remaining plan

Each linked plan records a source-backed starting point, the remaining task list, dependency slices
and acceptance criteria. No remaining plan was archived merely because its foundational code exists.

| Plan                                                              | Review disposition                                                                    |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| [56](../2026-09-09/56-navigation-failure-and-input-shell.md)      | 🟡 Built hubs/escapes done; full shell remains                                        |
| [57](../2026-09-09/57-runtime-design-system.md)                   | 🟡 Provider exists; fonts/state APIs remain                                           |
| [58](../2026-09-09/58-native-workspace-and-device-ci.md)          | 🟡 CI scaffolds exist; app/bridge proof remains                                       |
| [59](../2026-09-09/59-device-persistence-and-resume.md)           | 🟡 Schema 2 exists; device wiring remains                                             |
| [60](../2026-09-09/60-authoritative-core-maths.md)                | 🟡 Rust helpers exist; algorithms/adapters remain                                     |
| [61](../2026-09-09/61-content-and-audio-assets.md)                | 🟡 Starters/contracts exist; Q-15 gates audio                                         |
| [62](../2026-09-09/62-native-audio-playback.md)                   | — Needs native substrate and approved seed assets                                     |
| [63](../2026-09-09/63-native-speech-speak-and-latency.md)         | — Needs audio/recognition integration and evidence                                    |
| [64](../2026-09-09/64-today-and-refrain-production-loop.md)       | 🟡 Manual loop exists; production behavior remains                                    |
| [65](../2026-09-09/65-import-and-capture.md)                      | 🟡 Own-phrase seam exists; input surfaces remain                                      |
| [66](../2026-09-09/66-backend-contract-data-and-security.md)      | 🟡 Contracts exist; service/data/security remain                                      |
| [67](../2026-09-09/67-anonymous-auth-and-account-lifecycle.md)    | — Runtime needs durable backend/device identity                                       |
| [68](../2026-09-09/68-sync-and-offline-convergence.md)            | 🟡 Outbox/merge exist; client/convergence remain                                      |
| [69](../../69-trip-domain-and-arc.md)                             | ⛔ Q-07 trip/relocation semantics                                                     |
| [70](../2026-09-09/70-survival-widgets-and-notifications.md)      | — Native integration remains; Rust policy exists                                      |
| [71](../2026-09-09/71-settings-telemetry-and-experiments.md)      | 🟡 Language/engine seams exist; Q-05 experiment only                                  |
| [72](../2026-09-09/72-release-quality-gates.md)                   | 🟡 Web/i18n gates exist; native proof remains                                         |
| [73](../2026-09-09/73-delivery-observability-and-slos.md)         | 🟡 Workflow scaffolds exist; operational proof remains                                |
| [74](../../74-monetization-and-entitlements.md)                   | ⛔ Q-08 package/pricing; Q-12 billing                                                 |
| [75](../2026-09-09/75-review-and-memory.md)                       | — No routes/engine; needs durable canonical FSRS                                      |
| [76](../2026-09-09/76-roleplay-and-live-ai.md)                    | 🟡 Bundled/provider seams exist; runtime/evals remain                                 |
| [77](../2026-09-09/77-dsp-and-speech-labs.md)                     | 🟡 Helpers exist; production ⛔ quality gate                                          |
| [78](../../78-conditional-run-and-phrasebook.md)                  | ⛔ Q-05 plus comparative M3 evidence                                                  |
| [80](../2026-09-09/80-dev-design-system-workbench.md)             | 🟡 Workbench exists; register new components now                                      |
| [81](../2026-09-09/81-navigation-spine-switcher-and-more.md)      | 🟡 Shared menu exists; Q-17 final rail priorities                                     |
| [82](../2026-09-09/82-guided-chat-domain-and-service.md)          | 🟡 Drafts exist; offline work can start; scoped Q gates                               |
| [83](../../83-open-chat-and-message-inspector.md)                 | — Text first; Q-16 release enablement                                                 |
| [86](../2026-09-09/86-provider-integrations.md)                   | 🟡 Anthropic transport merged; registration remains                                   |
| [87](../2026-09-09/87-multilingual-app-and-language-selection.md) | 🟡 Seven-pair foundation done; review/durability gates                                |
| [88](../2026-09-09/88-low-cost-backend-infrastructure.md)         | — Preserved from current main; AWS testing infrastructure is planned, not provisioned |

## Scope corrections and newly recorded debt

- **87 is multilingual; 85 is API contracts.** Schema-2 repositories, language selection and ICU
  resources are delivered inputs. Bilingual sign-off and device proof remain in 87, implementation
  of durable writes in 59, expanded content in 61 and release harness wiring in 72.
- **59:** `packages/core/src/persistence/sqlite/course.ts` still uses `INSERT OR REPLACE`. Record
  owned-column upsert and preservation tests before wiring the device; do not reopen completed 54's
  phrase/settings work or claim the new course table was part of that earlier audit.
- **60:** `apps/mobile/src/store/coreFacade.ts` still fabricates FSRS intervals/fixed cloze masks
  and strips Cyrillic in matching. Canonical Rust/Unicode parity must cover current target
  languages. `.github/workflows/nightly.yml` calls a nonexistent Rust `tests/sim`; 60 owns the
  harness and 72/73 own truthful release/operations wiring. This audit records the defects; it does
  not fix runtime code.
- **56/81:** retain the built translated hub/menu and cold-entry work. The exhaustive route model,
  conditional home, work-at-stake predicate and full exit/resume/More systems are still missing.
  Q-17 gates final rail priority. Owned-phrase search must not bypass the gated Loop-C Phrasebook.
- **57/80:** runtime theme inspection and the workbench are present. Missing fonts/state APIs stay
  in 57; current NavigationMenu/LanguageChoices and future navigation specimen coverage stay in 80.
- **58/72/73:** Rust target CI and EAS setup gates exist; echo/TODO/device-farm scaffolds do not
  prove device builds, accessibility, performance, deployment or recovery.
- **66/68/86:** server cursors/security belong to 66, client convergence to 68 and vendor execution
  controls to 86. Shared contracts and Anthropic transport are merged; the old isolated-task handoff
  and worktree restrictions are obsolete. Registration, identity, budgets and fallbacks remain.
- **65:** OCR needs the native camera substrate in 58, not the speech plan. Import is offline and
  never waits for optional AI translation.
- **61–63/69–70/75–77/82–83:** future assets, matching, content, charts and sessions use explicit
  target/native pairs. Existing seven-pair text support does not enable ASR, audio or scoring. The
  historical 150→600 content goal is Spanish; no full-course target is invented for
  Bulgarian/Russian.
- **82/83:** offline domain/content/evaluation can start while Q-16/Q-18–Q-20 remain open.
  Retention, live traffic, release enablement, voice and Review handoff have separate gates.
- **72/75/77:** depend on shared harness slices rather than whole-release completion to avoid a
  cycle. Q-05 blocks experiment activation and Run, not all Settings or v1.1 work; DSP production
  waits for the spike, while spike preparation is actionable now.

## Integration with current main

Before publication, the roadmap commits were rebased onto `1fc2bdc`, preserving plan 88 and its
approved AWS testing scope. There are now 30 active plans; the next new number is 89. Plans 73/86
retain production operations/provider ownership while 88 owns testing infrastructure and its staged
access gates. The local environment task's unpushed `5f4fb76` commit and working files are excluded
from this publication. Product implementation verification remains anchored to `2d9e8c3`; the
upstream addition and this integration change documentation only.

## Verification

- `pnpm check` passed: contract generation drift plus 23/23 Turbo tasks. Turbo reused cached
  implementation checks (570 JS/TS and 131 Rust tests); this documentation audit changes no runtime.
- `LORO_E2E_PORT=8197 pnpm test:e2e` passed all **118** learner tests in **4.4 minutes**, including
  language, navigation, accessibility, text-scale and geometry suites.
- Fresh visual captures, native tests, provider traffic and production deployment were not run. Plan
  84's original visual evidence is retained as historical evidence, not claimed as a new audit.
- Scoped Prettier and whitespace checks pass; 241 local file links, all 30 active status/index rows
  and five archive symlinks were verified. Protected plan 53, the prior archive and authored design
  files are unchanged. Runtime defects remain explicit todos.

The active source of execution order is [plans/README.md](../../README.md). No new plan number or
product decision was needed for this reset.
