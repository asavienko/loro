# Authentication runtime

F-01/F-02/F-07: optional sign-in, real identity proof and durable session revocation. The
composition root supplies `DATABASE`, `SERVER_CLOCK`, `AuthService` and `AuthGuard`.
`AUTH_MIGRATION_SQL` is installed with the database migration.

- Apple/Google use fixed HTTPS JWKS endpoints, RS256 signatures, required subject/expiry/issued-at,
  issuer/audience checks and a 30-second clock tolerance. An `azp` claim must name a configured
  client. Provider subjects remain separate: matching email strings never automatically link
  accounts.
- Access tokens prefer ES256, with a strict >=32-byte HS256 compatibility fallback, a 900-second
  lifetime, issuer/audience/version checks and a durable session/account/device check on every
  authenticated request. Sign-out or refresh replay revokes existing access tokens immediately.
  Refresh families have a fixed 90-day expiry.
- Refresh tokens contain 256 random bits and are stored only as SHA-256 digests. This deliberately
  differs from the earlier password-style Argon2id plan: these are unguessable generated secrets,
  never learner passwords. SHA-256 preserves replay lookup without retaining a bearer credential.
- Six-digit email codes live for ten minutes and permit five verification attempts. HMAC-SHA256
  binds each code to a fresh random nonce, email hash and server secret. Guesses are counted in a
  committed transaction; concurrent verification cannot consume a code twice. Delivery permits five
  requests per email and thirty authentication requests per actual transport-peer address per
  fifteen-minute window. Limits persist across application restarts; forwarded IP headers are
  ignored.
- Only the configured delivery service receives the email/code. Delivery uses HTTPS, a bearer
  credential, a five-second timeout and rejects redirects; response text is neither read nor logged.
  Valid requests return the same accepted response for new and existing accounts. Email addresses
  are stored as keyed hashes, not plaintext. The email hash key is an identity key and must be
  backed up; replacing it without migrating identities would create new email accounts.
- An anonymous ID only correlates the device's pending local upload. Claim requests are idempotent,
  scoped to the verified account/device and report `upload_required: true`; they never transfer
  server rows from another account or claim that local progress has already uploaded.

Configuration is read only by `common/config.ts`:

| Variable               | Meaning                                                                 |
| ---------------------- | ----------------------------------------------------------------------- |
| `AUTH_PRIVATE_KEY_PEM` | Preferred PKCS8 PEM P-256 private key for ES256                         |
| `AUTH_SIGNING_KEY`     | Random >=32-byte HS256 fallback when PEM is absent                      |
| `AUTH_ENABLED`         | Explicit false disables all auth; true enables configured browser OAuth |
| `AUTH_ISSUER`          | Default `AUTH_PUBLIC_URL`, otherwise `https://api.loro.app`             |

| `AUTH_KEY_ID` | JWT key ID, default `primary` | | `GOOGLE_CLIENT_IDS` | Comma-separated allowed
Google client IDs; defaults to `GOOGLE_CLIENT_ID` | | `APPLE_CLIENT_IDS` | Comma-separated allowed
Apple client IDs; defaults to `APPLE_CLIENT_ID` | | `AUTH_EMAIL_HASH_KEY` | Stable secret, at least
32 characters, for email identity/code HMAC | | `AUTH_MAGIC_DELIVERY_URL` | HTTPS delivery webhook |
| `AUTH_MAGIC_DELIVERY_TOKEN` | Bearer credential for the delivery webhook |

The delivery webhook accepts JSON `{ "email": "...", "code": "123456", "expires_in": 600 }` and must
return a successful HTTP status after accepting delivery. Configure an actual email sender; the API
never emits a development code to logs or responses. Disabled providers are reported by
`GET /auth/capabilities`; the mobile app can present only configured choices.

`POST /auth/magic-link/verify`, `/auth/google` and `/auth/apple` return the shared sign-in contract.
`POST /auth/refresh` returns the shared token contract. Legacy OAuth credentials require paired
device/anonymous registration for a one-time upgrade and return the shared sign-in contract while
preserving the account ID and remaining legacy expiry. `/auth/logout` accepts a refresh token body
or verified bearer token and returns 204; `GET /me` returns `{user,device_id}`. `/auth/claim`
additionally requires matching `X-Loro-Device` and `Idempotency-Key` headers.

See [Google/Apple OAuth setup](../../../../docs/architecture/google-apple-auth.md) for browser
provider configuration, PKCE handoffs, deployment compatibility and legacy account/session
migration. The audience is fixed at `loro-mobile`; legacy device-less access tokens do not grant
sync access.

Run `bash scripts/ci-auth-postgres.sh` for the real PostgreSQL transaction suite. It creates and
drops a random temporary schema; the connected database user must have permission to create schemas.
Unit signature tests run without a database or network.

Production release still needs actual provider registration/delivery credentials, TLS termination
and transport controls, signing-key rotation overlap, account linking, deletion/export jobs,
provider revocation notifications, auth audit retention and support procedures. None is inferred
from successful local sign-in tests.
