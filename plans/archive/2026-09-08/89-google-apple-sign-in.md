> Archived on 2026-09-08 (F-04): completed within its recorded scope. Historical validation is
> retained; remaining product and release work stays with the active owners in the archive index.

# Google and Apple sign-in/sign-up

- **Requirement IDs:** `F-01`, `F-02`, `F-07`
- **Status:** ✅ Implemented and verified. Live provider configuration and native device
  verification remain deployment/release prerequisites.
- **Parent:** 67; plan 94 integrates this completed provider identity with durable plans 59/66/68.

## Scope

Optional Account utility, shared validated contracts, server-side OAuth authorization-code flows for
Google and Apple, nonce/state validation, PKCE-bound one-use app handoff, PostgreSQL identity and
refresh-family persistence, short-lived access JWTs, refresh rotation and revocation. Native refresh
credentials use SecureStore; browser credentials stay in memory. First sign-in creates an account;
subsequent sign-ins use provider issuer/subject, never email-based automatic linking. Local learning
data is retained on sign-out. This plan's original identity delivery is now integrated with plan
94's installation binding, email/code sign-in and tenant-scoped progress sync. Export/deletion and
deliberate account linking remain in plan 67. Provider consoles, deployment secrets and real-device
verification are external setup.

## Sequence and verification

1. Shared transport contracts and plan; run the fast gate.
2. Server implementation and adversarial token/session/HTTP tests.
3. Account utility and client lifecycle tests, learner states and browser E2E.
4. Update current inventories, configuration/runbook, run pnpm check and pnpm test:e2e.

## Design extension

The authored artifacts do not specify sign-in. Account is an optional utility in the existing
spine/switcher, composing existing primitives. English/Bulgarian/Russian copy explains account
creation and real connection/sync status. Sign-out retains local learning data.

## Original verification record (2026-09-07)

- `pnpm check`: 23/23 tasks pass; 601 JS/TS tests pass by default, with the PostgreSQL-only
  concurrency test also passing in its dedicated run (602 total).
- `AUTH_TEST_DATABASE_URL=... pnpm --filter @loro/api exec vitest run src/auth/auth.test.ts`: 9/9
  pass on PostgreSQL 16, including concurrent refresh-family revocation.
- `LORO_E2E_PORT=8198 pnpm test:e2e`: 128/128 pass, including touch targets and 200%/310% text.
- `pnpm --filter @loro/mobile bundle`: iOS Hermes export succeeds.
- Provider JWT fixtures and browser transport are test-only. No real Google/Apple credentials,
  production deployment, account merge, or physical-device sign-in is claimed.

## Integration record (plan 94)

The Google/Apple authorization-code flow, nonce/state validation, PKCE one-use handoff and
provider-subject identity are preserved while session issuance and learning sync share the durable
authenticated account. Legacy credentials require a safe upgrade/re-authentication path; they are
not copied into a new identity by email. Merged-suite validation is recorded in
[plan 94](../../94-persistent-practice-and-account-integration.md). Historical counts above describe
the original plan-89 delivery, not the merged runtime.
