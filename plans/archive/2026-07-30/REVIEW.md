# Review of archived plans 01–52

Reviewed on **2026-07-30** against the worktree at `c9b4e4d` plus protected plan 53. This archive is
the historical record; the active roadmap is [`../../README.md`](../../README.md).

## Classification

- **Implemented, no replacement scope:** 01, 02, 04, 07, 51, 52.
- **Partly implemented; only the remainder was replanned:** 06, 10, 20, 23, 34, 35, 37, 43, 48.
- **Superseded as an execution shape:** 08 (folded into fidelity and release gates), 16/41
  (delivery/image overlap), 29/33 (one settings/flag owner), 31/22 (one Survival owner), and 45
  (provider programme split into focused delivery plans).
- **Not started and still required:** every other archived plan, subject to the consolidation and
  gates below.

Plan 53 was not archived. It completed concurrently during this reset and remains at its protected
original path. Replacement plans consume its presentation-copy ownership, generated tokens,
canonical collections, injectable engine context, and API/content cleanup without duplicating them.
Plans 79–83 were added after this legacy review to reconcile and deliver the new v1.1 design-system,
navigation, and chat artifacts; they do not revive completed 01–52 scope.

## Legacy-to-active scope map

| Archived       | Disposition or replacement                                                     |
| -------------- | ------------------------------------------------------------------------------ |
| 01, 02, 04, 07 | Implemented; archive only                                                      |
| 03             | 55 for current truthful formatting; 63 for speech-onset latency                |
| 05, 17, 18     | 60 authoritative Rust maths and bindings                                       |
| 06             | 66 server repository contract; 68 cursor/scoping/convergence                   |
| 08             | 55 current fidelity; 57 reusable visual system; 72 release fixture coverage    |
| 09             | 58 native workspace and device CI                                              |
| 10             | 54 local correctness; 59 device driver/hydration/resume                        |
| 11             | 61 content audio assets; 62 playback; 64 existing-screen integration           |
| 12, 21         | 63 native speech, Speak, and latency                                           |
| 13, 39, 41     | 66 backend contracts, data, baseline security and image                        |
| 14             | 67 auth and account lifecycle                                                  |
| 15             | 68 sync and offline convergence                                                |
| 16             | 73 delivery, rollout and rollback                                              |
| 19, 27         | 77 gated DSP and labs                                                          |
| 20             | 64 remaining Today/Refrain behavior only                                       |
| 22             | 69 trip domain and screens; 70 native survival surfaces                        |
| 23             | 65 remaining Import/Capture surfaces only                                      |
| 24, 25         | 75 Review and Memory                                                           |
| 26             | 76 Roleplay and live AI                                                        |
| 28             | 78 conditional Run/Phrasebook                                                  |
| 29, 32, 33     | 71 settings, telemetry, flags and experiment; service signals also 73          |
| 30, 31         | 70 survival, widgets and notifications; sync durability remains 68             |
| 34, 47         | 57 runtime visual system after plan 53's generated-token work                  |
| 35             | 72 remaining native/manual accessibility gates                                 |
| 36             | 61 content and audio asset pipeline                                            |
| 37, 38         | Tests and budgets move into owning plans; shared release matrix is 72          |
| 40             | 74 monetization and entitlements                                               |
| 42             | 73 SLOs, alerts and runbooks                                                   |
| 43             | 72 i18n runtime/pseudo-locale remainder; plan 52's copy extraction is complete |
| 44             | Reconciled during this reset; drift checks remain a definition-of-done rule    |
| 45             | Research archive only; provider work split across 61–76                        |
| 46, 48         | 56 navigation, errors, input and scalable lists                                |
| 50             | 55 immediate truth defects; dependency-backed loop defects in 64               |
| 51, 52         | Implemented; archive only                                                      |

## Architecture conclusions used by the replacement set

1. Driver-agnostic SQLite schema, migrations, repositories and outbox exist and are tested; the
   device driver and app integration do not. New plans wire this seam instead of redesigning it.
2. The mobile durable source of truth is still Zustand memory. Target-state docs describing live
   SQLite, native bridges, feature/domain/platform folders, and many routes are not current state.
3. Rust already owns calendar, rank, ASR matching, notification policy, HLC and merge, but FSRS,
   cloze/set selection and DSP are unfinished. The temporary TypeScript facade still fabricates or
   duplicates learner-visible numbers.
4. The API has stable Nest seams and the shared WASM merge, but still uses an in-memory global sync
   repository and bundled AI provider. Auth, Postgres, rate limits, validation and deployment are
   absent.
5. Seven of the blueprint's 21 learner screens exist, plus the app shell. Existing browser E2E is
   strong for those web states but proves none of the missing native behavior.
6. The content catalog contains 31 phrases and no production audio. Content independence remains a
   target until the mobile updater, artifact manifest, storage and prefetch path exist.

## Scope deliberately removed

The replacement roadmap does not repeat completed day/streak/identity/store-invariant fixes,
current-web E2E expansion, the plan-52 whole-tree refactor, or plan-53's active cleanup. It also
removes standalone catch-all testing and documentation plans: each delivery plan owns its tests and
docs, while plans 72–73 own only shared release gates and operational infrastructure.
