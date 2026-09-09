# Archived planning records — 2026-09-08

- **Requirement IDs:** F-04, F-08, F-09
- **Status:** Archival and current-plan reconciliation completed; unfinished feature/release work
  remains active.
- **Baseline:** `e013141` (integrated runtime and repository skill).

## Completed plans

These bounded deliveries are complete within their recorded scope. References link directly to this
archive; compatibility symlinks were removed on 2026-09-09. Historical verification is preserved; it
does not establish current live provider, production or physical-device acceptance.

| Plan                               | Completed scope                                             | Remaining owners                                                                 |
| ---------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------- |
| [89](89-google-apple-sign-in.md)   | Google/Apple identity and Account integration               | 67 provider/device/lifecycle acceptance; 68 convergence; 94 integration evidence |
| [91](91-ec2-backend-deployment.md) | Restricted EC2 deployment and rollback rehearsal            | 66/67/68 durable service acceptance; 88 shared testing; 73 production            |
| [92](92-android-ec2-readiness.md)  | HTTPS preview, Android connection and dated readiness audit | 58/62/63 hardware/audio; 67/68 accounts/sync; 72/73 release                      |

## Superseded snapshots, not completed scope

The old versions below contained obsolete starting points or instructions. They are retained as
historical snapshots with relative links rebased. Their existing plan IDs and active paths continue
to own unfinished work; no feature was marked done merely to archive old wording.

| Snapshot                                      | Reason and remaining work                                                                                                 | Current owner                                                      |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [64](64-today-and-refrain-production-loop.md) | Durable checkpoints/resume now exist; production loop and device acceptance remain.                                       | [Active 64](../2026-09-09/64-today-and-refrain-production-loop.md) |
| [72](72-release-quality-gates.md)             | Local CI and Rust simulations exist; native/content/performance release gates remain.                                     | [Active 72](../../72-release-quality-gates.md)                     |
| [75](75-review-and-memory.md)                 | Canonical Rust FSRS exists; Review/Memory screens and session behavior remain.                                            | [Active 75](../../75-review-and-memory.md)                         |
| [88](88-low-cost-backend-infrastructure.md)   | Restricted EC2/HTTPS deployment exists; shared-service recovery/load acceptance and infrastructure reconciliation remain. | [Active 88](../../88-low-cost-backend-infrastructure.md)           |
| [90](90-default-english-content-language.md)  | English learning-target/default semantics are confirmed; implementation, dialect and reviewed content remain.             | [Active 90](../../90-default-english-content-language.md)          |

The [old roadmap baseline](roadmap-baseline.md) is also retained. The
[current roadmap](../../../docs/product/roadmap.md) now points to integrated scope and the current
plan numbering. The separate dated deployment review in `docs/reviews/` remains historical evidence.

## Preserved boundaries

The boundaries and verification below record the 2026-09-08 archival operation. The subsequent
2026-09-09 cleanup removed compatibility symlinks and archived plan 53; see the
[archive index](../README.md).

- No plan was renumbered and no new plan ID was allocated. The next new ID remains 95.
- All 33 plans with remaining work remain in the [active index](../../README.md).
- Protected plan 53, earlier archives and authored design artifacts are unchanged.
- Plans 64/75 reuse implemented persistence and Rust rather than duplicate them.
- Plan 72 retains native/content/performance acceptance with local CI; GitHub Actions stays
  disabled.
- Plan 88 retains backup, restore, load, cost and security acceptance. Its earlier Terraform/Caddy/
  ECR/SSM proposal is historical; implementation must reconcile ownership with the existing
  CloudFormation/local-deployment setup before migration. No infrastructure is changed by this edit.
- Plan 90 retains the confirmed English-target decision and all implementation/acceptance work.

## Verification

Verified all 21 changed/new Markdown files have existing local link targets; all three
completed-plan compatibility symlinks resolve. Protected plan 53, earlier archives and authored
designs are unchanged. Scoped formatting and `git diff --check` pass. `pnpm check --concurrency=2`
passed all 23 tasks from cache. No runtime code changes; browser/native builds and live deployment
are outside this archive change.
