# Google and Apple sign-in/sign-up

- **Requirement IDs:** `F-01`, `F-02`, `F-07`
- **Status:** 🟡 In progress — provider flows, durable sessions, Account utility and verification.
- **Parent:** 67; intentionally implements identity separately from unfinished plans 59/66/68.

## Scope

Optional Account utility, shared validated contracts, server-side OAuth authorization-code flows for
Google and Apple, nonce/state validation, PKCE-bound one-use app handoff, PostgreSQL identity and
refresh-family persistence, short-lived access JWTs, refresh rotation and revocation. Native refresh
credentials use SecureStore; browser credentials stay in memory. First sign-in creates an account;
subsequent sign-ins use provider issuer/subject, never email-based automatic linking. Local learning
data is untouched. No claim, sync, export, deletion or magic-link implementation is implied.
Provider consoles, deployment secrets and real-device verification are external setup.

## Sequence and verification

1. Shared transport contracts and plan; run the fast gate.
2. Server implementation and adversarial token/session/HTTP tests.
3. Account utility and client lifecycle tests, learner states and browser E2E.
4. Update current inventories, configuration/runbook, run pnpm check and pnpm test:e2e.

## Design extension

The authored artifacts do not specify sign-in. Account is an optional utility in the existing
spine/switcher, composing existing primitives. English/Bulgarian/Russian copy explains account
creation and the current lack of cloud sync. Sign-out retains local learning data.
