# Persistent practice and account sync

> **App swap, 2026-09-30.** The first app in `apps/mobile` was replaced by the v2.0 listening-first
> player, and `packages/core` lost the client engines and SQLite persistence it used; both remain in
> Git history at `52a0e3b`. This page records the removed app's persistence, sign-in and sync
> evidence. The current app keeps progress on the device and has no sign-in.

The runtime implements SQLite-backed learner progress, canonical Rust scheduling, native foreground
speech, required email/Google/Apple sign-in and tenant-scoped Postgres sync. These capabilities are
implemented in plan 94 alongside feature plans 59/60/62/63/66/67/68/89. Native/device acceptance and
production service setup remain separate from passing source and browser tests.

## Local practice

On native, OP-SQLite commits repositories and outbox in one transaction before publishing a new
render snapshot. On web, SQL.js uses an atomic local-storage database snapshot with transaction
rollback and an exclusive tab lock. Reopening preserves phrase identities, tags, difficulty,
practice dates, settings, course state and the next Refrain rep. A corrupt database or failed commit
shows recovery and preserves the original data; the app never silently resets it.

Removing a phrase has the same 2.6-second Undo window as its toast. Pending deletion is durable.
Expired deletion enters sync as a tombstone. Undo cannot restore a deletion already sent to the
server. Sync identities and pending deletions are reconciled together.

## Sign-in and sync setup

1. Use Node 22 and put `$HOME/.cargo/bin` on PATH. Install with `pnpm install --frozen-lockfile`,
   then run `pnpm core-rs:build` to generate native/server/browser artifacts.
2. Configure Postgres through the API's `DATABASE_URL`. The API initializes its auth and sync tables
   idempotently and reports real database/WASM health at `/v1/health/ready`.
3. Configure `AUTH_PRIVATE_KEY_PEM` with an ES256 PKCS8 private key and a stable
   `AUTH_EMAIL_HASH_KEY` of at least 32 characters. Store credentials in the encrypted environment,
   following [local development](local-development.md).
4. For the email screen, configure the delivery webhook with `AUTH_MAGIC_DELIVERY_URL` and
   `AUTH_MAGIC_DELIVERY_TOKEN`. The webhook accepts `{email, code, expires_in: 600}`. There is no
   console-code fallback. Production mail senders require HTTPS. Local development may use loopback
   HTTP with `node scripts/local-magic-delivery.mjs`. The development EC2 host may use
   `inbox:local`, which writes `/tmp/loro-magic-delivery.json` inside the API container.
   Google/Apple browser sign-in also requires the provider credentials, callback URL and exact
   redirect allowlist described in [API setup](../../apps/api/README.md). Its one-use exchange
   registers the installation in the same account/session system as email.
5. Set `EXPO_PUBLIC_API_URL` to the API base including `/v1`. HTTPS is required except for loopback
   development. Allow the browser's exact origin in `CORS_ALLOWED_ORIGINS`.
6. The app opens on **Sign in & sync**. Email/code verification or a configured provider connects
   the account before onboarding or practice. The durable outbox then uploads and server changes
   merge locally. Foreground events, connectivity recovery, local writes and bounded retries trigger
   sync. Practice never waits for it. Sign-out returns the learner to this screen.

Native refresh credentials use
[Expo SecureStore](https://docs.expo.dev/versions/v54.0.0/sdk/securestore/). Web credentials have
page lifetime and never enter Web Storage or SQLite, so a browser reload requires a new sign-in
while practice progress remains saved. Native connectivity is checked using
[Expo Network](https://docs.expo.dev/versions/v54.0.0/sdk/network/) before attempting refresh. Known
offline state retains credentials; an ambiguous refresh response requires sign-in because replaying
a consumed refresh token revokes its family.

An installation is durably bound to its verified account. Signing into a different account is
rejected before its token can upload the existing account's local data. Sign-out clears local
credentials and attempts server session revocation; offline revocation needs connectivity. Rejected
sync operations remain as durable dead letters and keep the account's error state visible. A
rescue/export UI and full account deletion lifecycle remain future work.

## Canonical core and speech

FSRS-6 uses the pinned default parameter set and the authored 50% requested retention policy. The
canonical scheduler retains learning/relearning state and records algorithm provenance; existing
preview evidence is preserved when the next real review adopts the current policy. See
[scheduling](../architecture/scheduling.md) for the exact learning steps and compatibility rules.
Rust also owns ranking, cloze, set selection, token matching, clocks and sync merge. The browser's
embedded WASM and the native UniFFI bridge call the same implementation. Run
`pnpm --filter @loro/core-rs check:browser` to check committed source/output fingerprints;
`node packages/core-rs/scripts/embed-wasm.mjs --verify-build` compares an actual regenerated build.

Build the native app with Expo prebuild. Native projects are generated from `app.config.ts` and
local modules; custom modules do not run inside Expo Go. Phrase Detail and Stream use installed
device TTS voices. Speak uses strictly on-device recognition when the platform and selected language
support it; otherwise its reveal/skip flow works offline. Recognition transcripts stay local and
microphone buffers never cross into JavaScript. Revealing words never claims successful speech.

Foreground device TTS and recognition are the implemented slice. Approved recorded clips/cache,
background queue/lock-screen transport, retained native-buffer DSP and validated onset latency are
not implemented. Latency stays `null` rather than showing an estimate. Speech accuracy and
availability for each language still need physical-device and bilingual acceptance.

## Validation evidence

The following native evidence was captured before the aggregate merge. Final integrated source,
browser and API validation is recorded in
[plan 94](../../plans/archive/2026-09-09/94-persistent-practice-and-account-integration.md);
emulator evidence does not establish physical microphone or speaker acceptance.

- Rust: 145 unit tests and 7 integration tests, including 42 FSRS reference vectors.
- Shipped WASM: reference scheduling vectors plus multilingual matching, cloze, HLC and merge.
- Android: full debug and release APK compilation, module AAR packaging and lint. The release
  includes embedded production JavaScript and the native Rust library. In an isolated emulator in
  airplane mode, onboarding saved ten phrases; a completed rep survived force-stop/cold launch and
  resumed at the next Refrain step. Speak reveal/Next worked without claiming speech or adding reps.
  Missing installed ASR/voice data produced the expected unavailable states; microphone permission
  remained unrequested. Local screenshots/logs are in `test-results/native-smoke/`.
- Android listen companion (plan 99 / AS-07): debug APK on AVD `loro_listen` (API 36) with airplane
  mode (`cmd connectivity airplane-mode enable`; Wi-Fi off; ping unreachable). Generate seeded a
  labeled development fixture (copy: not licensed neural audio). Listen from cache played via native
  `playFile`. Force-stop and cold start still showed ready-to-listen. This is emulator fixture
  evidence, not physical-device 58/72 and not Q-15 licensed voices.
- Hermes plural formatting is covered by bundled native EN/BG/RU
  [PluralRules](https://formatjs.github.io/docs/polyfills/intl-pluralrules/) and a regression that
  removes the platform API before loading the native entry point.
- iOS: Swift parsing/podspec syntax and host Swift-to-UniFFI runtime smoke. Full iOS build/device
  verification requires a full Xcode SDK, unavailable on the implementation machine.
- Aggregate local CI passed at `85a0057`: all 23 fast-gate tasks, 171 real-PostgreSQL API tests, 169
  Rust tests, 155 learner browser tests, three workbench tests and four production smoke tests, plus
  production exports and built-process/exact-image API checks. See plan 94 for the counts and
  platform boundaries.
- Real Postgres auth/sync suites use isolated test databases; see
  [API testing](../../apps/api/README.md).

No production endpoint, account provider or email sender is configured by checking in this code.
