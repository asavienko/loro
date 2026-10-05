# Authentication

F-01 (email code, Google, Apple) and F-07 (account deletion): sign-in, sessions and their
revocation. Routes: [api.md](../../../../docs/architecture/api.md#auth-and-health); the policy in
brief: [security-privacy.md](../../../../docs/architecture/security-privacy.md#authentication).

## Where things are

- `auth.module.ts`: `AuthModule`, which owns the controllers, `AuthService`, the `AUTH_STORE`, the
  access-token signer (`ACCESS_TOKENS`) and, when provider pages are configured, the OAuth flow that
  `module.ts` builds (with a cleanup of expired attempts every minute).
- `auth.controller.ts`: capabilities, email codes, native ID tokens, refresh, logout, claim, `/me`.
  `oauth.controller.ts` with `oauth-flow.service.ts`: the provider sign-in pages.
- `auth.session.ts` and `auth.claim.ts`: the sign-in and claim SQL behind `PostgresAuthStore`;
  `repository.ts`: OAuth attempts and grants.
- `auth.tokens.ts`: access tokens, hashing and the lifetimes. `jwks.ts`: Google's and Apple's
  signing keys, shared by ID-token and code-exchange verification.
- `auth.guard.ts`: the bearer guard every signed-in route uses. `auth-boundary.guard.ts`: the global
  guard that closes the AI routes while sign-in is configured
  ([backend.md](../../../../docs/architecture/backend.md#modules)).
- `auth.schema.ts`: migration `001_auth`.

## Identity

- Google and Apple ID tokens are verified against fixed HTTPS JWKS endpoints: RS256, issuer and
  audience checks, required subject, expiry and issued-at, 30 seconds of clock tolerance. An `azp`
  claim must name a configured client. Each provider subject is its own identity: accounts are never
  linked by matching email addresses.
- Provider sign-in pages (web, and iOS/Android auth sessions) use PKCE. `POST /auth/:provider/start`
  records an attempt for five minutes; the provider's callback redirects to the app with a one-use
  ticket valid for one minute, which `POST /auth/exchange` trades, with the verifier, for a session.
- Email codes are six digits, live ten minutes and allow five tries. Each is an HMAC of the email
  hash, a fresh nonce and the code under `AUTH_EMAIL_HASH_KEY`; guesses are counted in a committed
  transaction, so concurrent verifications can't spend one code twice. The email itself is stored
  only as a keyed hash: the key is an identity key — back it up, since replacing it without
  migrating identities turns every email account into a new one. A request returns the same
  `202 accepted` for new and existing addresses.

## Sessions

- Access tokens: ES256 from `AUTH_PRIVATE_KEY_PEM`, or HS256 from an `AUTH_SIGNING_KEY` of at least
  32 bytes when no PEM is set; 900 seconds; issuer, audience (`loro-mobile`) and version checks. One
  key signs and verifies, so changing it ends every session. Every request also loads the session,
  so sign-out and refresh reuse revoke access tokens at once.
- Refresh tokens: 256 random bits, stored only as SHA-256 digests (unguessable generated secrets,
  not passwords, so a fast hash is enough to look them up). Each use rotates the token; reusing a
  consumed one revokes the family. A family expires 90 days after sign-in.
- `POST /auth/logout` takes a refresh token or a verified bearer and returns 204. `GET /me` returns
  `{user, device_id}`; `GET /auth/me` the user alone.
- Credentials from before device registration upgrade once, on refresh with the device and anonymous
  ID, keeping the account ID and the remaining expiry.
- `POST /auth/claim` correlates an anonymous device's pending upload with the account. It needs a
  matching `X-Loro-Device` and `Idempotency-Key`, is idempotent, and only ever reports
  `upload_required: true`: it never moves another account's rows.

## Limits

Every auth route counts 30 requests per 15 minutes per address; email-code requests also count 5 per
15 minutes per email. The counters are in PostgreSQL and survive restarts. The address is the
transport peer; with `TRUST_PROXY=1` (the EC2 host, behind the gateway's nginx) it is the
`X-Real-IP` nginx sets, taken only from a loopback or private-network peer.

## Email delivery

With `AUTH_MAGIC_DELIVERY_URL=resend` the API emails the code itself through Resend, from
`AUTH_EMAIL_FROM`, with Resend's API key in `AUTH_MAGIC_DELIVERY_TOKEN`
([ADR-0022](../../../../docs/architecture/adr/0022-email-codes-through-resend.md)); a refused send
is logged as `Resend<status>`, never with Resend's error text. This is how deployed hosts send
codes. `ses` does the same through Amazon SES with the host's AWS credentials and `AWS_REGION`
([ADR-0021](../../../../docs/architecture/adr/0021-email-codes-through-amazon-ses.md), superseded:
the account was refused production access, so SES sends only to verified addresses).

Otherwise the API posts `{ "email": "...", "code": "123456", "expires_in": 600 }` to
`AUTH_MAGIC_DELIVERY_URL` with `Authorization: Bearer <AUTH_MAGIC_DELIVERY_TOKEN>`, a five-second
timeout and redirects refused; any 2xx is accepted, and the response body is never read or logged.
The URL must be HTTPS, loopback HTTP outside production, or `inbox:local`, which writes the latest
code to `/tmp/loro-magic-delivery.json` on the API's host. Locally,
`node scripts/local-magic-delivery.mjs` is a loopback receiver. The API never puts a code in a log
or a response. Only the delivery service receives the email and code.

## Configuration

Read through `config.sessionAuthSettings()` (sessions, tokens, email, ID-token clients) and
`oauthDeploymentSettings()` in `settings.ts` (provider sign-in pages); the two are not
interchangeable. `GET /auth/capabilities` reports email, Google and Apple only when their settings
are complete, and the app offers only those. Every variable, with its default:
[environments.md](../../../../docs/process/environments.md#api-sign-in).

Redirects must be exact HTTPS URLs, loopback HTTP, `loro://account` or `loro-dev://account`, with no
query or fragment. `.env.example` shows a local setup, including how to make an ES256 key.

## Tests

`pnpm --filter @loro/api test` runs the signature, flow and HTTP tests without a database or
network. `bash scripts/ci-auth-postgres.sh` runs the PostgreSQL suites (sessions, refresh reuse,
one-use codes, guess limits, concurrent refresh, restarts) against a disposable database.
