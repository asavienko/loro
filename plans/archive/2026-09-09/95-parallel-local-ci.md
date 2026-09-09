# Parallel local CI orchestration

- **Requirement IDs:** M2 release verification, `F-04`
- **Milestone:** M2
- **Status:** 🟡 Scheduler, cancellation, Git inventory and source identity fixes implemented and
  full gate verified; matched serial/cold/warm runtime comparison remains.
- **Depends on:** [72](72-release-quality-gates.md), existing `scripts/ci-local.sh` gates
- **Reviewed:** 2026-09-09

**Archive disposition (2026-09-09):** Archived at user request after implemented slices landed. The
partial status and remaining acceptance criteria are retained; archival does not mark this plan
complete. The roadmap index continues to track its unfinished scope.

## Outcome

The full local gate uses dependency-aware bounded concurrency while preserving every existing check.
Independent browser, bundle and API verification runs in isolated temporary source workspaces so
ports, Expo/Metro caches, locale flags, reports and generated export output cannot interfere.

## Implementation

- `scripts/ci-local.mjs` schedules preparation, post-check and isolated verification jobs with
  `LORO_CI_JOBS` (default 2) and retains `LORO_CI_CONCURRENCY` for Turbo.
- A checkout lock rejects overlapping full runs. Source snapshots use a NUL-delimited Git inventory
  for tracked and non-ignored working-tree paths, plus a narrow allowlist for required generated
  inputs; secrets, dependencies and transient output stay out of snapshots. Safe source symlinks
  retain their original relative targets.
- Per-run logs, events, summaries and Playwright artifacts live under `.ci-local-reports/`. Signal
  handling terminates owned process groups with a bounded SIGTERM/SIGKILL cleanup and awaits it
  before removing workspaces or releasing the lock.
- Authored source and starting commit identities are captured before validation, checked across
  phases, matched against the actual snapshot, and rechecked after benchmarks. Generated input
  identity is recorded separately and checked after isolated verification and benchmarks.
- `scripts/ci-local.test.mjs` covers scheduler ordering, limits, failure propagation, cancellation,
  bounded process cleanup, Git inventory, secret/transient exclusions, symlinks and snapshot drift.
  Native and audit modes remain unchanged.

## Acceptance criteria

- Existing full-gate commands, dependencies and failure semantics remain represented.
- Concurrent browser suites pass with independent ports/caches/reports and no cross-locale state.
- A failed prerequisite prevents dependent jobs and returns a nonzero status; interrupted runs clean
  owned resources.
- Snapshots exclude ignored secrets and transient output, with explicit exceptions for required
  generated inputs. The recorded source identity matches the inputs checked by every phase.
- One cold and three matched warm runs show a lower median wall time than the serial runner without
  skipped checks or added flakiness.

## Verification record

The hardened parallel full gate passed after the fixes on 2026-09-09 with
`CI_BASE_REF=origin/main LORO_CI_JOBS=2`: preparation, `pnpm check`, PostgreSQL/auth, four isolated
browser suites, mobile bundle, API smoke/image checks and Criterion benchmarks. The learner suite
reported 167 passed and one expected skip. The retained report is
[`.ci-local-reports/20260909151451797-47255/`](../../../.ci-local-reports/20260909151451797-47255/),
with matching authored and generated source identities recorded in its summary and source-identity
files. A matched serial baseline and three warm-run measurements remain before marking the plan
complete.

## Review follow-up — 2026-09-09

The implementation review confirmed that the original full-gate commands remain represented and the
retained run shows browser suites overlapping. The runner regression suite now has 13 passing tests.
Focused temporary fixtures reproduced the issues below; these probes did not modify repository
source or rerun the full gate. The earlier successful run does not establish these failure-path
guarantees.

### 1. Stop all command sequences on cancellation and bound cleanup

**Finding:** In [`ci-local.mjs`](../../../scripts/ci-local.mjs), interrupting an offline install
could advance to the online fallback. `runCommand` could also permit launches after cancellation.
Process cleanup sent only SIGTERM, so a child that ignored it could keep the runner waiting
indefinitely.

**Suggested fix:**

- [x] Check cancellation before every child launch, install fallback, command-sequence step and
      phase transition. Cancellation returns a nonzero result and can never become success.
- [x] Send SIGTERM to owned process groups, allow a bounded grace period, then use SIGKILL for
      survivors. Retain process-group ownership long enough to clean descendants if their parent
      exits, and await that cleanup before removing workspaces.
- [x] Await process cleanup before deleting workspaces and releasing the checkout lock. Preserve
      failure diagnostics and remove resources created by the run, including its Docker resources.

**Acceptance checks:** Focused tests interrupt a running process with a SIGTERM-ignoring descendant
and verify bounded termination, a nonzero result, blocked later launches and workspace deletion only
after descendant cleanup. Parent-owned Docker container, network and image cleanup is exercised by a
separate regression test.

### 2. Build snapshots from an explicit source inventory

**Finding:** The manual filter did not implement the promised non-ignored source selection. A
synthetic fixture confirmed that ignored `local.env`, `private.pem`, `identity.agekey` and generated
Android files were copied into isolated workspaces.

**Suggested fix:**

- [x] Derive the inventory from Git's tracked paths and non-ignored untracked paths, using
      NUL-delimited output. Copy current working-tree contents so edits, additions and deletions are
      represented; never restore deleted files from HEAD.
- [x] Add a narrow, documented allowlist for required ignored generated inputs, including prepared
      WASM output and Expo environment declarations where needed. Keep secret exclusions explicit,
      including when an unexpected secret path is tracked. Never log secret contents.
- [x] Preserve required source symlinks within the isolated workspace and reject links that would
      read mutable source or excluded private files outside it. Absolute links are rejected so the
      copied workspace cannot resolve back to the live checkout.

**Acceptance checks:** Include tracked edits, tracked deletions, non-ignored new files and required
generated inputs in fixtures. Verify that ignored environment files, private keys, age identities,
learner databases and generated native/build directories are absent. Verify symlink isolation and
run the isolated browser, bundle and API checks against the selected inventory.

### 3. Tie every phase and the final result to consistent source inputs

**Finding:** The runner copied a snapshot before fingerprinting the live checkout. A fixture showed
that an edit between those operations let the final comparison pass while the snapshot differed from
the recorded fingerprint. The baseline was also captured after the early checks, and the final
comparison preceded benchmarks, leaving additional unchecked edit windows.

**Suggested fix:**

- [x] Capture the authored source identity and starting Git commit before validation begins, using
      the same source inventory as snapshot creation. Separate expected generated-output changes
      from authored inputs so preparation does not hide concurrent source edits.
- [x] Verify source identity across preparation and validation, and immediately before and after
      copying. Fingerprint the actual snapshot and compare it with the intended inputs; abort on
      mismatch. Record required generated-input identity separately where appropriate.
- [x] Recheck source and commit identity after benchmarks and all other gates, before reporting
      success. A changed checkout cannot inherit a green result from a different set of inputs.

**Acceptance checks:** Deterministically inject edits during early validation, snapshot creation,
isolated verification and benchmarks. Each must invalidate the run. Verify that an unchanged run
passes, expected generation is handled explicitly, and its recorded identities match the actual
snapshot and authored source. Cover a branch/commit change during the run as well.

### 4. Complete the performance acceptance evidence after the fixes

- [x] Add regression tests for fixes 1–3, then run the required fast and full local gates on the
      stabilized implementation. Retain logs, exit status and source/commit identity.
- [ ] Record a matched serial baseline and the required cold and three warm parallel runs using
      identical source, check coverage, hardware, concurrency settings and documented cache state.
      Measure total wall time, including snapshot copying and isolated dependency installation.
- [ ] State which serial baseline is used. `LORO_CI_JOBS=1` measures serial scheduling with the new
      isolation overhead; a comparison with the former runner must also account for that overhead.
- [ ] Record durations, medians, failures, retries and expected omissions. Mark the plan complete
      only when the parallel median is lower without omitted required checks or added flakiness;
      otherwise tune the implementation and repeat the affected comparison.
