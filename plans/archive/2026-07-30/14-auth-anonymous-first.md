# Auth: anonymous-first accounts, upgradeable without data loss

- **Requirement IDs:** `F-01`, `F-02`, `F-07`
- **Milestone:** M2
- **Size:** L
- **Depends on:** [api-postgres-persistence.md](13-api-postgres-persistence.md)

## Current state

There is no auth at all. `apps/api/src/app.module.ts` registers four controllers and one provider,
with no guard, no middleware, and no user context. Every endpoint is anonymous and — worse — the
sync store shares one namespace across all callers
([fix-sync-pull-cursor-and-scoping.md](06-fix-sync-pull-cursor-and-scoping.md)). The AI endpoints
have no identity to rate-limit against either, which `docs/architecture/threat-model.md` flags as
the main abuse surface.

## The requirement that shapes it

`F-02`: _anonymous-first — full app usable with no account, upgradeable without data loss._ So:

1. A local `user_id` exists from first launch, with no network call.
2. Everything works with that id alone. Practice never touches auth.
3. Signing in **reconciles** the local library into the account rather than replacing either side.

The order matters: an app that asks for an account before the first phrase loses the learner. The
blueprint's onboarding (`Loro.dc.html:128–212`, six steps) has no sign-in step at all — that is the
design decision, already made.

## The work

### 1. Device identity, before any account

- A local `user_id` (UUIDv7) and `device_id` generated on first launch, stored in
  `expo-secure-store` (Keychain / Keystore), not AsyncStorage.
- The server accepts an **anonymous registration**: `POST /v1/auth/anonymous` with the device id,
  returning a token bound to a server-side user row. This is the only network call before sign-in,
  it is retried in the background, and its failure does not block anything — the local id is already
  the truth.

### 2. Sign-in methods

`F-01` names three: Apple, Google, email magic link.

- **Apple** is mandatory on iOS if any third-party sign-in ships (App Store rule), so it is not
  optional.
- **Magic link** needs a deep-link handler (`expo-linking` is already a dependency) and a
  single-use, short-TTL, rate-limited token. Never log the link.
- Each provider maps to an `identity` row `(provider, subject, user_id)` — a user can hold several.

### 3. Tokens

Short-lived access JWT (~15 min) + long-lived refresh token in secure storage, rotated on use with
reuse detection. Sign the access token with a key that can be rotated without invalidating every
session. Details belong in `docs/architecture/security-privacy.md` — check the plan against what is
already written there and update it rather than inventing a second scheme.

**The offline constraint:** a learner abroad with no network must not be logged out. So an expired
access token blocks _sync_, never _practice_, and entitlement caching gets a grace period
(`docs/architecture/backend.md#billing`, and Q-12 depends on it).

### 4. Reconciliation on first sign-in

The hard part, and the one `F-02` is actually about. Three shapes, all real:

| Local     | Account   | Behaviour                                                        |
| --------- | --------- | ---------------------------------------------------------------- |
| non-empty | empty     | Upload everything; the account adopts the library                |
| empty     | non-empty | Pull everything; show a real "restoring" state                   |
| non-empty | non-empty | **Merge**, using the same per-field LWW as sync — not "pick one" |

The third case is where data gets lost in most apps. Route it through the shared merge
(`packages/core-rs/src/sync/merge.rs`), which means the local rows need HLCs from the start —
another reason [the outbox](10-sqlite-persistence-and-outbox.md) lands first.

Also handle **sign-in as a different account than last time** on the same device: do not merge the
previous account's library into the new one. That requires the local store to be keyed by `user_id`
and a deliberate "switch account clears local" flow with an explicit confirmation, because it is
destructive.

### 5. Guards and scoping on the server

- A global auth guard, with an explicit `@Public()` decorator for health and content. Fail closed:
  new controllers are protected by default. A guard you have to remember to add is a guard that gets
  forgotten.
- `UserId` on every repository method (see the sync plan) so an unscoped query is a type error.
- Rate limits keyed on user id, with a tighter anonymous bucket
  (`docs/architecture/threat-model.md`).

### 6. Account deletion

GDPR erasure (`docs/architecture/security-privacy.md`): a delete endpoint, cascade on the server,
local database drop on the device, and a receipt. Store-listing requirements now demand an in-app
deletion path, so this is launch-blocking, not later.

## Acceptance criteria

- A fresh install is fully usable — onboarding, add, stream, Refrain, Progress — with the network
  off and no account, forever.
- No practice code path awaits an auth call.
- All three sign-in methods work; Apple is present on iOS.
- The three reconciliation shapes each lose nothing; verified by tests, not by inspection.
- Switching accounts on one device never merges libraries.
- An expired access token does not interrupt practice; sync resumes silently after refresh.
- Every non-public endpoint 401s without a token; `/health` and content do not.
- Account deletion removes server rows and the local database.

## Tests

- Reconciliation table test for all three shapes plus the account-switch case.
- Token lifecycle: refresh rotation, reuse detection, expiry offline.
- Guard coverage test: enumerate every route and assert each is either guarded or explicitly
  `@Public()` — this is the test that keeps fail-closed true as controllers are added.
- Magic-link token single-use and TTL.

## Out of scope

Family sharing, shared phrasebooks (M6), and SSO.
