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

## Validation at archival

`pnpm check` passed its contract drift gate and 23 cached Turbo tasks; the fresh learner browser
suite passed all 118 tests. Archive file links and five compatibility symlinks resolve. Plan 53, the
previous archive and authored design remain unchanged. Historical visual/provider/native results
above are not new verification claims.

The complete remaining-work review accompanies the next roadmap revision; the implementation
baseline remains `2d9e8c3`.
