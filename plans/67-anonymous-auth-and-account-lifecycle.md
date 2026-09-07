# Anonymous-first authentication and account lifecycle

- **Requirement IDs:** `F-01`, `F-02`, `F-07`
- **Milestone:** M2
- **Status:** 🟡 Google/Apple identity implemented in plan 89. Remaining reconciliation, sync,
  export/deletion and magic links depend on 59/66 and live provider configuration.
- **Depends on:** 85 completed; 66 durable principal-aware backend; 59 device identity/state; 86
  provider verification/email adapters.
- **Reviewed:** 2026-09-07 against merged baseline `2d9e8c3`.

## Verified starting point

Shared account schemas and the optional Google/Apple authentication service now exist. Plan 89 adds
PostgreSQL sessions and SecureStore. Account-enabled deployments disable legacy unscoped sync/AI;
account linking and durable learning reconciliation remain to do.

## Outcome

A learner starts offline without an account, later signs in without losing or duplicating progress,
and can export/delete data. Every server row and rate budget is scoped to an authenticated
principal.

## Remaining work

1. [ ] Model local installation/device identity separately from account identity and define
       rotation, loss, reinstall, restore, and multi-device semantics.
2. [ ] Implement short-lived access/rotating refresh tokens with secure native storage, replay
       detection, revocation, clock-skew policy, and redacted logs.
3. [ ] Add the approved Apple/Google/magic-link providers behind one account-link contract; do not
       make sign-in a first-run requirement.
4. [ ] Specify and implement course-aware anonymous→signed-in reconciliation using the shared merge
       policy, idempotency, duplicate-device handling, conflict visibility, and retry after
       interruption.
5. [ ] Scope every endpoint/repository/cache/rate bucket by principal and test horizontal/vertical
       access controls.
6. [ ] Implement account/device management, export, deletion/tombstone propagation, consent/version
       records, and recovery/support procedures.

## Acceptance criteria

- First use and all local practice work offline with no account.
- Interrupted or repeated upgrade cannot lose/duplicate local or server progress.
- Cross-tenant read/write attempts fail at controller, service, and repository tests.
- Export/deletion completes across device, server, content metadata, analytics, and backups per
  policy.

## Out of scope

Paid entitlements, social profiles, enterprise identity, and sync scheduling details.
