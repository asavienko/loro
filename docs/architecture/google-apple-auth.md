# Google and Apple accounts

**F-01 / F-02 / F-07 — plans 67, 68, 89 and 94.** Google, Apple and email sign-in use one durable
account/session engine. Account is accessible from the shared switcher. Provider subjects identify
accounts; matching email addresses never automatically link Google, Apple or email identities.
Sign-in registers the installation and starts authenticated local-progress upload. Offline practice
continues without an account or a reachable backend.

## Authorization and credentials

The API exchanges Google/Apple authorization codes and verifies signed ID tokens against fixed
provider JWKS endpoints. It checks issuer, audience, expiry, issued-at, subject, nonce and
authorized party. Apple uses a short-lived ES256 client secret; Google additionally uses S256
provider PKCE. The app generates a separate verifier. `/auth/{provider}/start` stores a five-minute
state/nonce and app challenge. Google returns a GET callback; Apple sends
`application/x-www-form-urlencoded` POST. Both consume state once. The API returns an opaque,
60-second, one-use ticket bound to the app verifier and the original state. Tokens never appear in
redirect URLs. Unknown state never redirects; provider failure returns only `sign_in_failed` to the
exact stored allowlisted application URL.

The app validates callback origin/path and state. `/auth/exchange` requires the ticket, verifier,
`device` registration and `anon_id`, then atomically consumes the ticket and creates the shared
account/device/session. Its `SignInResponse` contains tokens, `user`, `device_id` and a pending
upload claim. An anonymous ID is a correlation value, never authority over server rows. The client
completes that claim only after its durable local outbox is acknowledged. An installation already
bound to a different account refuses to upload its local progress to the new account.

Access JWTs last 15 minutes and carry session, device, issuer, audience (`loro-mobile`) and version.
ES256 is preferred; deployments with an existing random `AUTH_SIGNING_KEY` of at least 32 bytes can
use HS256. A supplied malformed ES256 key never silently falls back. Every authenticated request
also checks the durable session/device/account, so logout and refresh replay revoke access promptly.
New refresh families expire after 90 days; rotation never extends that deadline. Random refresh
credentials contain 256 bits of entropy and are stored only as SHA-256 digests.

Native refresh credentials use Expo SecureStore (`WHEN_UNLOCKED_THIS_DEVICE_ONLY` on iOS), separate
from learner SQLite. Access credentials stay in memory. Browser credentials have page lifetime and
never enter Web Storage or SQLite. Browser authorization uses an isolated popup opened synchronously
before the network request. Expo's browser helper may transiently store callback state/ticket
metadata; it never receives Loro session credentials. Native callbacks use `loro://account`; an
intercepted ticket is unusable without the app verifier. An interrupted authorization restarts.

Refresh is single-flight. The client clears the credential before an online rotation attempt, so an
uncertain result requires sign-in rather than replaying a potentially consumed token. Known offline
state retains it. Logout accepts a refresh credential body or a verified bearer token and returns
204; it never deletes local learner state. If server revocation cannot be confirmed, the UI reports
that outcome. `GET /me` returns `{user,device_id}`; `/auth/me` remains a flat user alias.

## Migration from the original OAuth deployment

The shared PostgreSQL migration runs transactionally under an advisory lock. It detects the original
UUID `auth_sessions` table and renames it to `auth_sessions_legacy`, preserving its refresh foreign
keys. Existing `auth_accounts` UUIDs and provider subjects become the same shared account IDs. Their
unrecorded creation time is `null`. Identity collisions fail migration for explicit reconciliation.
No legacy account or token table is dropped. A durable migration marker imports pending attempts and
tickets once, so later restarts cannot recreate already consumed handoffs.

Old access JWTs have no registered device and cannot access sync. The client upgrades its existing
native refresh credential once through `/auth/refresh` with paired `device` and `anon_id`. The API
locks the old family, consumes it, creates a device-bound session for the same account, and
preserves its remaining original 30-day expiry. Replay or logout through any old credential also
revokes its upgraded session. Failed/expired upgrades require sign-in and retain local progress.
Signing in again creates a normal 90-day family. Consumed refresh hashes and upgrade links are
retained to detect replay; only expired OAuth handoffs and rate buckets are currently cleaned
automatically.

## Configuration

Store server values in the encrypted environment or deployment secret manager:

| Variable                                             | Value                                                                                                                                                                                                          |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AUTH_ENABLED`                                       | `true` enables browser OAuth; `false` disables all sign-in. Omitted keeps browser OAuth disabled but permits explicitly configured direct-ID/email methods.                                                    |
| `DATABASE_URL`                                       | PostgreSQL URL, with transport security configured by the deployment.                                                                                                                                          |
| `AUTH_PUBLIC_URL`                                    | Exact HTTPS API origin without `/v1`.                                                                                                                                                                          |
| `AUTH_PRIVATE_KEY_PEM`                               | Preferred PKCS8 P-256 private key for ES256 Loro access tokens.                                                                                                                                                |
| `AUTH_SIGNING_KEY`                                   | Compatibility HS256 fallback when the PEM is absent; random secret of at least 32 bytes.                                                                                                                       |
| `AUTH_ISSUER`, `AUTH_KEY_ID`                         | Optional issuer override (otherwise `AUTH_PUBLIC_URL`, then `https://api.loro.app`) and key ID (`primary`).                                                                                                    |
| `AUTH_REDIRECT_URIS`                                 | Exact comma-separated return URLs, e.g. `loro://account,https://your-web-host/account`; add `loro-dev://account` only when enabling sign-in in the Android development client. No wildcard, query or fragment. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`           | Google Web application client, including native browser flows.                                                                                                                                                 |
| `APPLE_CLIENT_ID`                                    | Apple Services ID for browser OAuth.                                                                                                                                                                           |
| `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` | Apple team, key ID and PEM `.p8`; escaped newlines supported.                                                                                                                                                  |

Incomplete provider credentials leave that provider unavailable. Invalid required OAuth settings or
unreachable configured PostgreSQL fail startup. An explicitly disabled content-only deployment can
start without a database, serves public content/liveness, and reports readiness 503 with
`database: unavailable`. It never serves in-memory authenticated sync. Production still requires the
packaged canonical WASM core. `/auth/providers` reports browser providers; `/auth/capabilities`
reports configured direct-ID/email methods. See
[API authentication](../../apps/api/src/auth/README.md) for the email delivery adapter and direct
ID-token audiences.

The app embeds only `EXPO_PUBLIC_API_URL=https://your-api-host/v1`; restart/rebuild after changing
it. CORS accepts the HTTPS origins derived from the redirect allowlist plus exact
`CORS_ALLOWED_ORIGINS`. The API uses no authentication cookies. Register
`https://your-api-host/v1/auth/google/callback` in Google's console and
`https://your-api-host/v1/auth/apple/callback` as the Apple Services ID return URL. Configure
consent, Apple domain verification and the associated primary App ID. Native builds include
`expo-web-browser` and `expo-secure-store`; this is browser OAuth on native platforms.

Terminate TLS at the proxy. Strip callback query strings from access logs and redact auth bodies and
Authorization headers in proxy/APM systems. Application errors redact auth paths and never log
provider/SQL messages. Auth responses are no-store; callbacks add `Referrer-Policy: no-referrer`.
Start, exchange and session authentication share a persisted 30 requests per transport-peer address
per 15-minute window. Proxy trust remains disabled; forwarded addresses cannot bypass limits.

## Boundaries and verification

`@loro/core/api/oauth` defines the six OAuth-specific method/path operations; refresh/logout share
the account contracts. Sync is authenticated and account/device scoped. AI remains 503 in account
deployments until its separate budget/ownership boundary is reviewed. Public catalog and health
remain available. Account linking, deletion/export, provider revocation notifications, key rotation
with overlap, backup/restore and production operational verification remain release work.

```bash
bash scripts/ci-auth-postgres.sh
```

This helper creates a disposable loopback PostgreSQL 16 container, runs all API tests serially and
removes the container. Integration suites use isolated schemas via `LORO_TEST_DATABASE_URL`; they
skip explicitly when it is absent. They verify the deployed legacy migration, PKCE/state/nonce,
Google GET/Apple form POST, one-use tickets, transaction rollback, unified bearer sync, refresh
concurrency and family revocation. Unit signature tests and browser E2E simulate provider transport;
no test sends real email or exchanges a live provider credential. Real consent, domain setup and
physical-device browser/Keychain behavior require configured deployment/device verification.

Provider references:
[Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect),
[Apple browser configuration](https://developer.apple.com/documentation/signinwithapple/configuring-your-webpage-for-sign-in-with-apple),
[Expo WebBrowser](https://docs.expo.dev/versions/v54.0.0/sdk/webbrowser/),
[Expo SecureStore](https://docs.expo.dev/versions/v54.0.0/sdk/securestore/).
