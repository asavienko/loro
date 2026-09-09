# Anonymous-first authentication and account lifecycle

- **Requirement IDs:** `F-01`, `F-02`, `F-07`
- **Milestone:** M2
- **Status:** 🟡 Optional Google/Apple/email sign-in, durable session/device identity and
  installation-bound progress sync are implemented. Account linking, restore/loss policy,
  export/erasure and physical-device/provider acceptance remain; provider setup and lifecycle policy
  gate those slices.
- **Depends on:** 85 completed; 66 durable principal-aware backend; 59 device identity/state; 86
  provider verification/email adapters.
- **Reviewed:** 2026-09-09 against checkout `42f4d57`; source/plan review only, no new device or
  deployment acceptance.

## Implemented scope

First use and local practice require no account. Optional Google/Apple and email/code sign-in use
PostgreSQL accounts and rotating refresh families, replay detection and revocation. Native refresh
credentials use SecureStore; browser credentials have page lifetime and never enter local storage or
SQLite. Existing OAuth provider verification and authorization-code protections are retained.

Durable installation/device identity is separate from account identity. The installation binds to
its verified account before uploading local progress, blocking cross-account data mixing. Sign-out
clears credentials and attempts server revocation while retaining learner data. Offline practice
continues, and known offline state preserves refresh credentials; ambiguous rotation requires
sign-in. Tenant-scoped sync and catalog identity reconciliation live in 66/68.

Email code delivery and verification now use the same in-flight admission guard as OAuth: repeated
actions cannot supersede an active sign-in, credential restore or refresh rotation. Focused client
tests cover repeated verification/resend, delivery, restoration and rotation; they establish local
race behavior only, not real provider or multi-device acceptance. Existing Account working states
and disabled controls are unchanged.

## Outcome

A learner starts offline without an account, later signs in without losing or duplicating progress,
and can export/delete data. Every server row and rate budget is scoped to an authenticated
principal.

## Remaining work

[Plan 96](96-account-sign-in-screens.md) owns the new method chooser, email/code screens, provider
feedback and confirmation. It consumes this plan's runtime and preserves its lifecycle ownership;
the visual redesign does not close the acceptance gates below.

1. [ ] Complete loss/reinstall/backup-restore/device-rotation and recovery policy with
       learner-facing management. Browser reload requiring sign-in is intentional credential policy.
2. [ ] Retain the recorded Google development configuration; complete its consent-to-device
       verification, then configure unavailable Apple/email providers and verify supported devices.
       Never link providers automatically by matching email.
3. [ ] Add deliberate account-linking and cross-account migration/recovery flows with reviewed
       conflict handling; current binding protects existing data by rejecting another account.
4. [ ] Implement account/device management, export, deletion/tombstone propagation, consent/version
       records and support procedures across device, server and backups.
5. [ ] Expand interrupted/repeated sign-in and multi-device acceptance with real provider/device
       evidence. Preserve tenant isolation and offline-first behavior in each lifecycle state.

## Acceptance criteria

- First use and all local practice work offline with no account.
- Interrupted or repeated upgrade cannot lose/duplicate local or server progress.
- Cross-tenant read/write attempts fail at controller, service, and repository tests.
- Export/deletion completes across device, server, content metadata, analytics, and backups per
  policy.

## Delivery order and gates

1. Record recovery/linking/deletion policy against current shared contracts before wiring new
   lifecycle states. Reuse the existing account IDs, installation binding, refresh families and
   OAuth exchange; email equality must never link identities automatically.
2. Deliver management/export/erasure with local data ownership explicit. Coordinate stale-device
   deletion enforcement with 68, backend records with 66 and backup retention/recovery with 88.
   Restoring a backup must not silently revive an erased account.
3. Reuse the recorded Google development setup for end-to-end device acceptance; Apple/email
   availability remains separate. Preserve local practice and outbox data through interrupted flows.

## Out of scope

Paid entitlements, social profiles, enterprise identity, and sync scheduling details.
