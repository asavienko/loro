# Google and Apple accounts

**F-01 / F-02 / F-07 — plan 88.** Implemented optional identity flow, not a production release of
plan 67. Account is accessible from the shared switcher. First sign-in creates an account; returning
sign-in reuses `(provider, subject)`. Email is not an account key and is not persisted. Different
Google/Apple identities remain separate accounts. There is no automatic account linking.

## What runs

The API performs Google's or Apple's authorization-code exchange and verifies the signed ID token
against the provider's fixed JWKS endpoint. Issuer, audience, expiry, issued-at presence, subject,
nonce and authorized-party claims are checked. Apple uses a short-lived ES256 client secret signed
by the configured Apple key. Google additionally uses S256 PKCE at the provider exchange.

The app generates its own verifier. `/auth/{provider}/start` stores a five-minute state/nonce and
that verifier's SHA-256 challenge. Google returns a GET callback; Apple returns a form-encoded POST.
Both consume state once. The API sends the app an opaque, 60-second, one-use ticket, bound to its
verifier, plus the original state. Provider tokens and Loro session tokens never appear in redirect
URLs. Cancellation/provider errors return only `sign_in_failed`. Unrecognized state never redirects.
The app checks the callback origin/path and state before exchanging the ticket.

PostgreSQL owns accounts, attempts, tickets, sessions, refresh hashes and rate buckets. The module
creates its version-one `auth_*` tables idempotently on startup; deployment credentials currently
need CREATE TABLE privilege. Refresh transactions lock the session row across workers. Refresh reuse
commits family revocation before returning 401. Access JWTs last 15 minutes; refresh families have
an absolute 30-day lifetime. `GET /auth/me` checks session revocation as well as the JWT. Expired
transient rows and sessions are purged each minute; consumed refresh hashes remain until their
family expires so replay remains detectable. Account identity persists until a future deletion
workflow removes it; no automated account retention/deletion job is claimed here.

Native refresh credentials use Expo SecureStore, with device-only after-first-unlock Keychain
accessibility on iOS. Access credentials stay in memory. Browser credentials stay in memory, so a
page reload requires sign-in again. Browser authorization uses an isolated popup, preserving the
in-memory learning store in the original tab; the popup opens synchronously before the start request
so slower networks do not trigger popup blocking. Expo's browser helper transiently stores callback
state/ticket metadata in localStorage; it never receives Loro access/refresh tokens. Native
callbacks use `loro://account`; an intercepted callback ticket cannot be redeemed without the app
verifier. The native app must remain alive during authorization; interrupted attempts restart
sign-in.

The client clears a refresh credential **before** attempting rotation. An uncertain network outcome
requires fresh provider sign-in, never retrying a possibly consumed refresh token. Sign-out removes
local credentials and attempts server revocation. If revocation cannot be confirmed, the UI says so;
the remote family remains until expiration and local learning data is retained. Account operations
never read, reset, claim, upload or merge the learning store.

## Configuration

Set server variables through deployment secrets, not app configuration:

| Variable                                             | Value                                                                                                                 |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `AUTH_ENABLED`                                       | `true`; omitted/false keeps optional account infrastructure disabled                                                  |
| `DATABASE_URL`                                       | Dedicated PostgreSQL database URL; TLS configured by the deployment                                                   |
| `AUTH_PUBLIC_URL`                                    | HTTPS API origin, without `/v1` or trailing slash                                                                     |
| `AUTH_SIGNING_KEY`                                   | Random secret of at least 32 bytes; e.g. generate 48 random bytes in your secret manager                              |
| `AUTH_REDIRECT_URIS`                                 | Comma-separated exact app return URLs: `loro://account,https://your-web-host/account`; no wildcard, query or fragment |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`           | Google **Web application** OAuth client; used by the backend, including native browser flows                          |
| `APPLE_CLIENT_ID`                                    | Apple Services ID for the browser flow                                                                                |
| `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` | Team, Sign in with Apple key ID and PEM `.p8` key; escaped newlines supported                                         |

Configure either or both providers; incomplete provider credentials keep that provider unavailable.
Invalid required auth settings or unavailable PostgreSQL fail startup. The app embeds only
`EXPO_PUBLIC_API_URL=https://your-api-host/v1`. Rebuild/restart Expo after changing public env
values. CORS permits only HTTPS origins derived from the exact return allowlist. Do not enable
wildcard credentialed CORS. The API uses no authentication cookies.

In Google's console, register `https://your-api-host/v1/auth/google/callback` as the authorized
redirect URI. Configure consent-screen branding, test users and publishing status as appropriate. In
Apple's developer console, associate the Services ID with a Sign in with Apple primary App ID,
verify the domain, and register `https://your-api-host/v1/auth/apple/callback` as a return URL.
Apple browser setup requires the associated Apple developer app configuration; credentials are not
created by this repository. Native builds need the installed `expo-web-browser` and
`expo-secure-store` config plugins. This is a browser OAuth flow on both native platforms, not the
Google native SDK or Apple's native button API.

Terminate TLS at the deployment proxy. Strip query strings on auth callback access logs and redact
request/response bodies and Authorization headers throughout proxy/APM infrastructure. Application
errors redact the entire auth request URL and unexpected error details. Auth JSON responses and
callbacks are no-store; callbacks also send `Referrer-Policy: no-referrer`. Start/exchange/refresh
share a persistent 30 requests/IP/15-minute budget. Proxy trust is deliberately not enabled: a proxy
deployment must explicitly review trusted hops before using forwarded IPs, otherwise users share the
proxy's budget. Key rotation invalidates access tokens; remove/revoke affected session rows for
incident response. Do not enable accounts on a publicly reachable HTTP endpoint.

## Contracts and remaining boundaries

`@loro/core/api/oauth` contains runtime validators used by the controller and app. The current
OpenAPI includes these eight method/path operations. Planned `/auth/google` and `/auth/apple`
identity-token/anonymous-claim endpoints remain **unimplemented target contracts**, separate from
this browser-code transport. No fabricated `claim.performed` result is returned.

When auth is enabled, legacy `/sync/*` and `/ai/*` routes fail closed with 503: their shared store
and budgets are not account-scoped. Public catalog and health routes remain available. With auth
disabled, their existing development behavior remains. The app's local practice needs neither auth
nor these endpoints. Plans 59/66/68 must implement safe durable learning-state ownership before
networked sync is enabled. Plan 67 still owns device registration/reconciliation, account linking,
magic links, account deletion/export and audit records. Native lifecycle tests, production
transport, store privacy disclosures and account-deletion requirements remain release work. No App
Store or Play submission artifact is produced by this change.

## Verification

`pnpm check` runs signed-JWT adversarial verification, HTTP Google GET/Apple POST callback tests,
client credential failure/cancellation tests and database semantics using pg-mem. The CI auth job
also runs the repository suite on PostgreSQL 16, including concurrent refresh rotation and restart
persistence. Locally, against an **expendable test database only**:

```bash
AUTH_TEST_DATABASE_URL=postgres://user:password@localhost/loro_auth_test \
  pnpm --filter @loro/api exec vitest run src/auth/auth.test.ts
```

That suite drops its six `auth_*` tables before each test. Never point it at a real account
database. `pnpm test:e2e` covers optional/unavailable, ready, pending, cancellation, failure,
signed-in and unconfirmed sign-out states, accessibility and large text, and retention of the
learning session. Provider transport is explicitly simulated in browser tests; production contains
no fake provider, identity or bypass. Live consent, Apple domain registration and real-device
browser/Keychain behavior still require configured accounts and device verification.

Provider references:
[Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect),
[Apple browser configuration](https://developer.apple.com/documentation/signinwithapple/configuring-your-webpage-for-sign-in-with-apple),
[Expo WebBrowser](https://docs.expo.dev/versions/v54.0.0/sdk/webbrowser/),
[Expo SecureStore](https://docs.expo.dev/versions/v54.0.0/sdk/securestore/).
