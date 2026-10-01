# Security review — 2026-10-01

**Status:** read-only review of the working tree at commit `d5dc27ad` plus the then-uncommitted
edits of that day, since committed as `c8788531`..`b63c0d14`. Nothing was changed, fixed, decrypted,
deployed or executed against a live system. Findings are reported, not resolved; each carries the
file and line it was verified at so a fix can be scoped from here.

**Verdict.** No critical or high-severity finding. The platform's security-relevant design choices
hold up in the code: no passwords, hashed and rotated refresh tokens with family revocation, session
liveness checked on every request, parameterised SQL throughout, strict Zod contracts on every body,
an allow-listing gateway in front of a loopback-only API, SOPS-encrypted secrets, a clean git
history, and no code path that records audio. What remains is a set of medium availability and
privacy items and a longer tail of low hardening gaps, most of them already acknowledged in the
project's own runbook as "still missing".

| Severity      | Count |
| ------------- | ----- |
| Critical      | 0     |
| High          | 0     |
| Medium        | 4     |
| Low           | 30    |
| Informational | 25    |

**The three non-negotiables.** (1) _Recorded audio never leaves the device_ — confirmed by absence
of any recording path: no recorder API is imported anywhere, the only native bridge carries JSON
strings, `app.config.ts` blocks `RECORD_AUDIO` and passes `microphonePermission: false`, and no API
route accepts audio (details in [APP-5](#app-5)). The guarantee is "no code", not a lock; a lint
rule and an APK permission assertion would make it one. (2) _Every number is real_ and (3) _no
shaming copy_ are product rules outside a security review and were not assessed.

## Top items, in the order worth fixing

1. **One client can starve the API** — [M-2](#m-2). The nginx rate zones key on
   `$binary_remote_addr`, which is always the gateway Lambda, so the edge limit is global; the
   unauthenticated `GET /v1/library/pack` and `/community` have no application throttle and rebuild
   a full course per request.
2. **Token refresh shares the 30-per-15-minutes IP bucket with sign-in** — [M-1](#m-1). More than
   thirty active learners behind one carrier or school address get 429s and forced re-auth; anyone
   on the same network can lock sign-in for everyone there.
3. **Analytics and session replay start before any notice and record email, name and typed phrases
   unmasked** — [M-3](#m-3). This is the documented ADR-0011 choice, but it is the largest privacy
   exposure in the product and ADR-0011 itself records the open lawful-basis question.
4. **Link-share codes and content ids reach PostHog** — [M-4](#m-4). A share code is a bearer
   capability; it is sent as a screen name and in iOS network telemetry.
5. **`inbox:local` sign-in delivery is accepted under `NODE_ENV=production`** — [L-1](#l-1). On the
   dev host that is by design; nothing stops the same value shipping to a real deployment, where it
   would let a host administrator sign in as any learner.
6. **`link` visibility is weaker than the documentation says** — [L-6](#l-6). Unlisted albums are
   listed on any set's page, and `link` items are readable by raw server id, not only by share code.
7. **The speech route is an existence oracle and lets anonymous callers trigger billable renders** —
   [L-7](#l-7), despite a comment that claims the opposite.
8. **Supply chain**: floating base-image tags, an unhashed `corepack prepare pnpm@9`, unrestricted
   dependency lifecycle scripts, and `pnpm audit`/`cargo audit` outside `pnpm check` —
   [L-21](#l-21); one npm advisory is reachable at runtime in the app's deep-link parser —
   [L-22](#l-22); and the fast gate's check of the committed browser WASM cannot tell a tampered
   blob from a rebuilt one — [L-30](#l-30).

## Scope and method

Five parallel read-only reviews, each against the real code with every claim pinned to a file and
line, followed by cross-checks of the headline claims by the lead reviewer:

| Area                                              | Files                                                                                                      |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| API authentication and the HTTP surface           | `apps/api/src/{auth,common,health}/**`, `main.ts`, `http-app.ts`, `app.module.ts`                          |
| API business modules and data layer               | `apps/api/src/{library,ai,music,tts,sync,content,integrations,database}/**`, `packages/core/src/api/*`     |
| Mobile app (iOS, Android, web)                    | `apps/mobile/{app,src,modules}/**`, `app.config.ts`, `metro.config.js`, build scripts                      |
| Infrastructure, deployment, secrets, supply chain | `infra/ec2/**`, `scripts/**`, Dockerfiles, Compose, `.sops.yaml`, `secrets/` (metadata only), `.github/**` |
| Shared packages                                   | `packages/core-rs/**`, `packages/core/**`, `packages/content/**`                                           |

Tooling: `gitleaks` over the full history, `pnpm audit`, `cargo audit`. Documentation
(`docs/architecture/security-privacy.md`, `library.md`, `sync-protocol.md`, `api.md`,
`docs/process/ec2-deployment.md`, `environments.md`, `apps/api/src/auth/README.md`) was compared
with the code claim by claim.

Not done: no server was run, no request was sent to the live gateway, no secret was decrypted, no
AWS or GitHub account state was inspected, no device build was produced. Items that need one of
those to settle are marked **Needs runtime check** below and collected in
[Not determined](#not-determined).

Severity means: **Medium** — a real weakness that one unprivileged party can exploit for a
meaningful availability, confidentiality or compliance effect; **Low** — a weakness bounded by a
precondition, cost cap or small blast radius, or a documented-posture gap; **Informational** —
hygiene, defence in depth, or a documented trade-off recorded so the residual risk is explicit.

## Findings

### Consolidated table

| ID   | Severity | Area       | Title                                                                                                    | Location                                                                                           |
| ---- | -------- | ---------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| M-1  | Medium   | Auth       | Per-IP auth bucket also counts every token refresh                                                       | `apps/api/src/auth/auth.service.ts:160`, `auth.rate-limit.ts:5-8`                                  |
| M-2  | Medium   | API+Infra  | No per-client edge limit; expensive anonymous reads have no application throttle                         | `infra/ec2/account-proxy.conf:13-14,52`, `apps/api/src/library/library.service.ts:488-612`         |
| M-3  | Medium   | App        | Analytics and replay run before consent and capture email, name and typed text unmasked                  | `apps/mobile/src/analytics/posthog.ts:15-27,45`, `src/shared/analytics/events.ts:42-46`            |
| M-4  | Medium   | App        | Share codes and content ids leak into analytics                                                          | `apps/mobile/src/analytics/posthog.ts:24,37-39`, `src/shared/analytics/events.ts:49-53`            |
| L-1  | Low      | Auth+Infra | `inbox:local` code delivery accepted in production; plaintext email and code in `/tmp`                   | `apps/api/src/auth/settings.ts:29-31`, `delivery.ts:10-12`, `scripts/ec2-release.sh:47`            |
| L-2  | Low      | Auth       | Re-requesting a code replaces the live one and resets its attempt counter                                | `apps/api/src/auth/auth.store.ts:120-125`, `auth.service.ts:123-152`                               |
| L-3  | Low      | Auth       | Several auth routes have no API rate limit, contrary to the README                                       | `apps/api/src/auth/auth.service.ts:189-199`, `oauth-flow.service.ts:56-85`                         |
| L-4  | Low      | Auth       | Native Google/Apple ID tokens accepted without nonce or replay record                                    | `apps/api/src/auth/auth.providers.ts:28-35`                                                        |
| L-5  | Low      | Auth       | In-memory rate-limit store never evicts                                                                  | `apps/api/src/common/rate-limit.memory.ts:10-11`, `tts/tts.service.ts:92`                          |
| L-6  | Low      | Lib        | `link` visibility weaker than documented; `link` items readable by raw id                                | `apps/api/src/library/library.service.ts:668-672,2083-2092`                                        |
| L-7  | Low      | Lib        | Speech route is an existence oracle and an anonymous billable-render trigger                             | `apps/api/src/library/speech.ts:238-273,318-336`                                                   |
| L-8  | Low      | Lib        | `/tts/render` is anonymous paid TTS keyed on the proxy's address (not routed publicly)                   | `apps/api/src/tts/tts.guard.ts:42-45,84-97`, `tts.controller.ts:43`                                |
| L-9  | Low      | Lib        | Link filter skips phrase text, learner notes and model output                                            | `packages/core/src/api/library.ts:55-66,85-86`, `library/writers.ts:226-241,546-547`               |
| L-10 | Low      | Lib        | Storage caps are count-then-insert                                                                       | `apps/api/src/library/library.service.ts:1519-1539`                                                |
| L-11 | Low      | API        | Unbounded table growth: `library_speech`, `auth_magic_codes`, `auth_refresh_tokens`                      | `library.service.ts:1120-1125,1252-1257`, `auth/auth.session.ts:100-110`, `auth/module.ts:15-22`   |
| L-12 | Low      | Lib        | Three free accounts can remove any public item from Community                                            | `apps/api/src/library/library.service.ts:93,1370-1385`                                             |
| L-13 | Low      | Lib        | Clip allowance is charged to the first registrant of an utterance                                        | `apps/api/src/library/speech.ts:93-97,318-336`                                                     |
| L-14 | Low      | App        | Server packs and shared sets are installed without runtime validation; no error boundary                 | `apps/mobile/src/shared/api/contentCache.ts:40-41,119-129,148-151`, `src/ui/PhraseImage.tsx:11`    |
| L-15 | Low      | App        | Web refresh token in `localStorage`; exported web page has no CSP                                        | `apps/mobile/src/shared/api/secrets.ts:6-20`                                                       |
| L-16 | Low      | App        | Cleartext `localhost` API fallback can ship in a release APK; local `.env` points PostHog at the US host | `apps/mobile/src/shared/api/client.ts:6`, `scripts/apk-local.mjs:60-66`                            |
| L-17 | Low      | App        | Stale generated `android/` tree still declares `RECORD_AUDIO` and other blocked permissions              | `apps/mobile/android/app/src/main/AndroidManifest.xml:2-8` (untracked)                             |
| L-18 | Low      | App+Infra  | Preview APK is signed with the public Android debug key and published on GitHub                          | `scripts/apk-local.mjs:187`, `.gitignore:43`                                                       |
| L-19 | Low      | Infra      | Backups are plaintext, never pruned, and leave the host unencrypted                                      | `scripts/ec2-release.sh:17-22`, `scripts/ec2-backup.sh:49-51`                                      |
| L-20 | Low      | Infra      | API image is built from a possibly dirty tree but tagged with `HEAD`                                     | `scripts/deploy-ec2.sh:21-22`                                                                      |
| L-21 | Low      | Infra      | Supply chain: floating base images, unhashed pnpm, unrestricted lifecycle scripts, audits opt-in         | `apps/api/Dockerfile:5,7,29`, `docker/Dockerfile.local:2,8`, `.npmrc`, `scripts/ci-local.sh:22-26` |
| L-22 | Low      | App        | `decode-uri-component` 0.2.2 advisory reachable through deep-link parsing                                | `pnpm-lock.yaml` (`@react-navigation/core` → `query-string`)                                       |
| L-23 | Low      | Infra      | One age recipient guards every committed secret                                                          | `.sops.yaml:3`                                                                                     |
| L-24 | Low      | Infra      | No host patching, no data-volume retention                                                               | `infra/ec2/template.yaml:15-20,46-52`, `scripts/provision-ec2.sh:11-23`                            |
| L-25 | Low      | Infra      | PostgreSQL container keeps default capabilities; password in `psql` argv                                 | `scripts/ec2-database.sh:17-20,26`                                                                 |
| L-26 | Low      | Infra      | `Dockerfile.local` copies the whole checkout; `.dockerignore` misses `*.agekey`, `.tmp/`                 | `docker/Dockerfile.local:11`, `.dockerignore`                                                      |
| L-27 | Low      | Core       | 24-hour HLC skew tolerance lets a device pre-date writes and pull the server clock forward               | `packages/core-rs/src/sync/hlc.rs:121-144`, `apps/api/src/sync/merge.ts:79-93`                     |
| L-28 | Low      | Core       | `max` counters bounded to 2^53 on the wire but `u32` in Rust; a poisoned counter is irreversible         | `packages/core/src/api/sync.ts:66-67,81`, `packages/core-rs/src/lib.rs:96,98`                      |
| L-29 | Low      | Core       | Unchecked integer arithmetic in UniFFI-exported helpers wraps silently in release                        | `packages/core-rs/src/fsrs/mod.rs:291`, `src/ladder.rs:75,81,177`, `src/calendar.rs:117`           |
| L-30 | Low      | Core       | The fast gate's drift check of the committed browser WASM is self-referential                            | `packages/core-rs/scripts/embed-wasm.mjs:26-37,58-60`, `scripts/ci-local/inventory.mjs:265-273`    |
| I-1  | Info     | Auth       | `AUTH_ENABLED` disables only on the exact string `false`                                                 | `apps/api/src/common/config.ts:124`                                                                |
| I-2  | Info     | Auth       | HS256 permitted in production; length-only key checks; no rotation path; dev host uses HS256             | `apps/api/src/auth/auth.tokens.ts:58-65`, `secrets/ec2-api.enc.env` (variable names)               |
| I-3  | Info     | Auth       | Malformed or oversized bodies likely surface as 500 rather than 4xx                                      | `apps/api/src/common/problem-filter.ts:46-58`                                                      |
| I-4  | Info     | Auth       | No helmet; `X-Powered-By` not disabled; headers depend on the proxy                                      | `apps/api/src/main.ts`, `http-app.ts`                                                              |
| I-5  | Info     | Auth       | Fixed rate windows allow a 2× burst at the boundary                                                      | `apps/api/src/common/rate-limit.postgres.ts:23-26`                                                 |
| I-6  | Info     | Lib        | `composeLive` buffers the whole provider body before the size check                                      | `apps/api/src/library/music-live.ts:56-58`                                                         |
| I-7  | Info     | Lib        | TTS `download_url` echoes `Host` when `AUTH_PUBLIC_URL` is unset                                         | `apps/api/src/tts/download-url.ts:15-31`                                                           |
| I-8  | Info     | Lib        | Legacy `/music`, `/phrases/suggest`, `/ai/scene` anonymous in stub mode; `/ai/scene` body unvalidated    | `apps/api/src/music/music.guard.ts:23-43`, `ai/ai.controller.ts:37-65`                             |
| I-9  | Info     | Lib        | Signed song URL is a 12-hour bearer independent of later visibility changes                              | `apps/api/src/library/library.service.ts:759-760,2235-2262`                                        |
| I-10 | Info     | Lib        | `setId` exposes a private holder set's id on referenced phrases                                          | `apps/api/src/library/library.service.ts:1918-1926,2169`                                           |
| I-11 | Info     | Lib        | `pg.Pool` has no SSL requirement or statement timeout                                                    | `apps/api/src/database/database.ts:41`                                                             |
| I-12 | Info     | Lib        | `canonicalJson` recurses over client-controlled values                                                   | `apps/api/src/sync/canonical-json.ts:2-10`                                                         |
| I-13 | Info     | App        | Account JSON and other users' stashed progress in plaintext app storage                                  | `apps/mobile/src/shared/api/session.ts:173-175`, `src/state/progressSync.ts:33-37`                 |
| I-14 | Info     | App        | `Math.random()` ids for `anon_id`, installation and device ids                                           | `apps/mobile/src/shared/api/session.ts:60-66`, `src/shared/state/persistence.ts:403-405`           |
| I-15 | Info     | Infra      | Lambda to nginx hop is plaintext HTTP inside the VPC                                                     | `infra/ec2/https.yaml:61`                                                                          |
| I-16 | Info     | Infra      | No edge access logs anywhere                                                                             | `infra/ec2/*.conf:6`, `https.yaml:157-161`                                                         |
| I-17 | Info     | Infra      | Parked workflows use floating action tags and no `permissions:` blocks                                   | `.github/workflows-disabled/*.yml`                                                                 |
| I-18 | Info     | Infra      | Stale security-group description ("SSH only")                                                            | `infra/ec2/template.yaml:25`                                                                       |
| I-19 | Info     | Infra      | nginx on `--network host` can reach Docker bridges and IMDS                                              | `scripts/deploy-ec2-proxy.sh:32`                                                                   |
| I-20 | Info     | Infra      | Local Compose stack: fixed dev credentials, `minio/*:latest`                                             | `apps/api/docker-compose.yml:14-18,39-44`                                                          |
| I-21 | Info     | Core       | `todo!()` stubs in `dsp/` would panic if ever exported                                                   | `packages/core-rs/src/dsp/mod.rs:76`, `score.rs:186`, `pitch.rs:41`, `align.rs:56`                 |
| I-22 | Info     | Core       | `check:uniffi` is fail-open without a host library                                                       | `packages/core-rs/scripts/check-uniffi.mjs:96-98,115`                                              |
| I-23 | Info     | Core       | The API image's merge engine is built on the operator's machine, not in the Dockerfile                   | `scripts/deploy-ec2.sh:19`, `apps/api/Dockerfile:24`                                               |
| I-24 | Info     | Core       | `enrich` and `publish` scripts reference files that do not exist                                         | `packages/content/package.json`, `packages/content/src/fs.ts:4`                                    |
| I-25 | Info     | Core       | `mergeClassFor` resolves inherited properties (unreachable today)                                        | `packages/core/src/sync/fieldPolicy.ts:110-113`                                                    |

### Medium

<a id="m-1"></a>

#### M-1 — The per-IP auth bucket also counts every token refresh (Confirmed)

`refresh()` consumes the same `ip:` bucket as sign-in, code request, code verify, OAuth start and
exchange (`apps/api/src/auth/auth.service.ts:154-161`), and the bucket is 30 requests per 15 minutes
(`auth.rate-limit.ts:5-8`). Access tokens live 15 minutes, so every active device refreshes once per
window. Behind one carrier-grade NAT or school address, the thirty-first active learner gets a 429
on refresh; the documented client policy (refresh once, then re-auth) turns that into forced
sign-outs and a sign-in storm that also counts against the bucket. Anyone on the same network can
burn the thirty requests deliberately and block sign-in and refresh for everyone sharing the address
for up to 15 minutes, with no credential.

Fix: give refresh its own budget keyed on the session or token family (it already carries a 256-bit
credential, so per-IP guessing protection buys nothing), keep the IP bucket for the
credential-bearing routes, and consider a sliding window with a higher per-IP cap.

<a id="m-2"></a>

#### M-2 — No per-client limit at the edge, and no application throttle on expensive anonymous reads (Confirmed; cost needs a measurement)

Two independent gaps compound. At the edge, both nginx zones key on `$binary_remote_addr`
(`infra/ec2/account-proxy.conf:13-14`), but the only client that can reach port 8080 is the gateway
Lambda (`infra/ec2/https.yaml:29-37`), so the 20 and 50 requests-per-second zones are one global
bucket, and the API Gateway stage throttle (`https.yaml:189-191`) is global too. In the API,
`GET /library/pack` and `/library/community` (`library.controller.ts:34-44`) need no bearer, are
`Cache-Control: no-store`, and each request runs eight queries including every phrase of every set
in the course, serialises the body and hashes it (`library.service.ts:488-550`); `community` adds an
`ILIKE '%…%'` and, with `sort=popular`, a correlated count per row (`553-612`). The sync routes have
a PostgreSQL-backed per-user limit; these do not. One unauthenticated client can therefore hold the
whole 50 requests-per-second budget against a single Node process on a t3.small, and every other
learner sees 429 or 503.

Fix: key the nginx zones on `$http_x_loro_source_ip` (already regex-validated by the Lambda); cache
the Loro-only part of the pack per `(targetLang, seed version)` and splice the reader's rows in; add
an ETag path (the Lambda already forwards `if-none-match`); or consume a per-address
`RateLimitStore` bucket on the read controller using `requestAddress()`.

<a id="m-3"></a>

#### M-3 — Analytics and replay run before consent and capture email, name and typed text unmasked (Confirmed)

The PostHog client is constructed at module import with `enableSessionReplay: true`,
`maskAllTextInputs: false`, `maskAllImages: false`, `captureLog: true` and
`captureNetworkTelemetry: true` (`apps/mobile/src/analytics/posthog.ts:15-27`), so lifecycle events
and replay begin on first launch; the SDK's own defaults mask inputs and images. Only the six-digit
code is wrapped in `PostHogMaskView` (`src/screens/AccountScreen.tsx:179-200`, the sole use in the
app); the email field, the onboarding name field and the display-name field are not. Signed-in users
are identified with `userId` and `email` (`posthog.ts:45`). Store events are flattened one level
(`src/shared/analytics/events.ts:42-46`), so `SET_PROFILE` sends `profile_name`, and touch
autocapture sends the pressed element's text, which for a phrase row is the phrase. The opt-out is a
Settings switch (`src/sheets/SettingsSheet.tsx:136-163`) that nothing in onboarding mentions.

This is the documented ADR-0011 posture ("on by default with an opt-out in Settings, replay unmasked
except the sign-in code"), and the ADR itself records that default-on replay of EU learners needs a
lawful basis. It is listed as Medium because a third-party processor receives email, name and
everything typed before the learner has seen any notice, and the identify call ties the replay to
the email.

Fix: construct PostHog opted out and call `optIn()` from an explicit onboarding step, or at least
show the switch there; wrap the email, name and display-name inputs in `PostHogMaskView` or flip to
`maskAllTextInputs: true` and unmask only what is harmless; drop `email` from `identify` unless the
privacy policy names PostHog as a processor; add `name` to a per-key drop list in `analyticsEvent`
and `ph-no-capture` on phrase and name rows.

<a id="m-4"></a>

#### M-4 — Share codes and content ids leak into analytics (Likely)

`trackScreen(pathname)` is called for every route (`src/analytics/Analytics.tsx:11-12`,
`posthog.ts:37-39`), so `/shared/<code>` is sent verbatim as a screen name. With
`captureNetworkTelemetry: true` (`posthog.ts:24`) the iOS replay module records request metadata
including `GET /library/shared/<code>` and clip URLs; `captureLog: true` forwards every library's
console output. Event properties carry `phrase_id` and `set_id` (`events.ts:49-53`). A
`link`-visibility share code is a bearer capability (anyone holding it reads the set), so every
project member with PostHog access, and PostHog, can open sets their makers meant for a few people.

Fix: `captureNetworkTelemetry: false` and `captureLog: false`; normalise `trackScreen` to the route
pattern (`/shared/[code]`, `/set/[id]`).

### Low

<a id="l-1"></a>

#### L-1 — `inbox:local` code delivery is accepted in production and writes plaintext email and code to `/tmp` (Confirmed)

`isAllowedMagicDeliveryUrl` returns true for `inbox:local` before the production gate
(`apps/api/src/auth/settings.ts:29-31`); `delivery.ts:11` then writes `{email, code}` to
`/tmp/loro-magic-delivery.json` (mode 0600 applied only on first creation). The EC2 host runs with
`NODE_ENV=production` and this value (`scripts/ec2-release.sh:47`,
`docs/process/ec2-deployment.md:99-100`), which is by design for synthetic test users: an SSH
administrator reads the code and completes sign-in. The gap is that loopback HTTP delivery is
refused in production but `inbox:local` is not, so nothing stops this configuration reaching a real
deployment, where every learner would get a 202, no email, and the operator could sign in as any
address a learner typed. This is also the only place an email is ever stored unhashed.

Fix: gate `inbox:local` behind an explicit opt-in variable set only by the dev-host release script;
have `/auth/capabilities` not advertise email sign-in while the inbox is local.

<a id="l-2"></a>

#### L-2 — Re-requesting a code replaces the live one and resets its attempt counter (Confirmed)

`INSERT … ON CONFLICT(email_hash) DO UPDATE SET code_hash=$2, nonce=$3, expires_at=$4, attempts=0`
(`apps/api/src/auth/auth.store.ts:121-123`), and `verifyCode` applies only the `ip:` limit, not the
`email:` one (`auth.service.ts:127`). The guessing budget is small (5 requests × 5 tries per 15
minutes against a million codes, and the victim sees every email). The practical abuse is login
denial: anyone who knows an address can replace the victim's just-delivered code five times per 15
minutes, so the code the victim reads is already invalid.

Fix: a per-email cooldown between requests; do not replace an unexpired code that still has
attempts; count verify attempts against the `email:` bucket too.

<a id="l-3"></a>

#### L-3 — Several auth routes have no API rate limit, contrary to the README (Confirmed)

`logout()` and `revokeRefresh()` (`apps/api/src/auth/auth.service.ts:189-199`), the OAuth `callback`
(`oauth-flow.service.ts:56`), `me()`, `claim()`, `capabilities()` and `providers()` call no limiter,
while `apps/api/src/auth/README.md:58` and `docs/architecture/security-privacy.md` state 30 per 15
minutes for every auth route. Unauthenticated `POST /auth/logout` with a random token costs a
database `UPDATE` per call, bounded only by the edge (see M-2). Not a bypass; a cheap
unauthenticated write path and a documentation drift.

Fix: add the limiter to `logout`, `revokeRefresh` and `callback`, or list the exceptions in the
README.

<a id="l-4"></a>

#### L-4 — Native ID tokens are accepted without nonce or replay record (Confirmed, design property)

`auth.providers.ts:28-35` requires `sub`, `exp`, `iat` and checks issuer, audience and `azp`, but no
nonce, and nothing remembers a consumed token. Any Google or Apple ID token minted for a configured
audience opens a Loro session until it expires (about an hour for Google). This is the normal
posture for the native-SDK pattern and is mitigated by platform-bound client IDs; it is listed so
the residual risk is explicit.

Fix (optional): have the app embed a nonce the server verifies, and remember `(iss, sub, iat)` for
the token lifetime.

<a id="l-5"></a>

#### L-5 — The in-memory rate-limit store never evicts (Confirmed)

`MemoryRateLimitStore` keeps two plain `Map`s that are only ever written
(`apps/api/src/common/rate-limit.memory.ts:10-11`; the project's `BoundedMap` is not used here). It
backs the per-user and per-address TTS limits (`tts/tts.service.ts:92`). A flood of distinct keys
grows the heap until restart. The `/tts` routes are not routed by the gateway, so exposure is
limited to direct access.

Fix: purge expired entries on consume or on a timer, or back it with `BoundedMap`.

<a id="l-6"></a>

#### L-6 — `link` visibility is weaker than documented; `link` items are readable by raw id (Confirmed)

`songsOfSet` lists songs from every album with `a.visibility <> 'private'`
(`apps/api/src/library/library.service.ts:670-671`) and returns their `shareCode`, so a `link` album
made from a Loro or public set is listed to every reader of the set, while `library.md` describes
`link` as "Listed in Community: No" and `SET_SELECT.song_count` (`2001-2005`) counts only `public`
albums. Separately `canRead` (`2083-2092`) treats `link` as readable by raw id, so a `link` item is
reachable from `GET /library/sets/:id` with the 48-bit server id, not only through the 50-bit share
code. Legacy device-minted `mine-s-*` ids are kept on upload (`791-802`); the current app no longer
mints them and their entropy could not be determined, so if any were uploaded as `link` they may be
enumerable. The PostgreSQL test covers private and public but not `link`
(`library.postgres.test.ts:1140-1162`).

Fix: use `a.visibility = 'public'` in `songsOfSet` to match `SET_SELECT`, or document that `link`
means "not in Community" rather than "unlisted"; consider requiring the share code for non-owner
reads of `link` items.

<a id="l-7"></a>

#### L-7 — The speech route is an existence oracle and an anonymous billable-render trigger (Confirmed)

`speech.ts:243-245` says "Text the library doesn't hold answers as a clip that can't be made, so the
route can't be used to learn which phrases are in someone's private set", but a held utterance
proceeds to render and returns audio (or a 503 only after a provider attempt) while an unknown one
is an immediate 503. An unauthenticated caller who guesses `(lang, normalised text)` and computes
the utterance id learns whether any set, private included, holds that exact phrase, and each probe
of an unrendered utterance spends one of the owner's 100 and the server's 500 daily renders
(`speech.ts:318-336`). Bounded by exact-text guessing and the caps; the comment's guarantee does not
hold.

Fix: require a bearer, or a short HMAC derived from the pack or set the reader was served, for
utterances whose holding sets are all private; make unknown and unrenderable responses identical in
status and latency.

<a id="l-8"></a>

#### L-8 — `/tts/render` is anonymous paid TTS with caller-chosen text, keyed on the proxy's address (Confirmed; not routed publicly)

With `TTS_PROVIDER=elevenlabs`, the guard grants an anonymous principal to any render whose
`asset_class` is reference or listening (`apps/api/src/tts/tts.guard.ts:42-45,92-97`); the text is
the caller's (up to 2000 characters) and `phrase_hash` is only a self-computed integrity check
(`tts.service.ts:123-124`). The limiter is the in-memory store keyed on Express `request.ip`
(`tts.controller.ts:43`, `music.guard.ts:24`); `trust proxy` is never set, so behind nginx every
caller shares one address and one bucket. The module's own header says to keep `/tts` off the public
gateway, and the Lambda allow-list does (`infra/ec2/https.yaml:68-88`). Would be Medium if routed.

Fix: put `/tts` behind `AuthGuard` unconditionally now that the app uses `/library/speech`, or
delete the module; if kept, key limits on `requestAddress()` and persist them in
`PostgresRateLimitStore`.

<a id="l-9"></a>

#### L-9 — The link filter skips phrase text, learner notes and model output (Confirmed)

`shownText` refuses URLs (`packages/core/src/api/library.ts:55-61`) for titles, descriptions and
display names only. Phrase `target`/`native` (`85-86`) and `NoteSchema.title/text` (`63-66`) are
plain bounded strings, and model output passes through `cleanNotes` and `clip(tidy(...))`
(`apps/api/src/library/writers.ts:226-241,546-547`) with no link check. A learner can store a URL in
a phrase or note and share the set publicly. The app renders these as plain text, so this is spam
and phishing surface, not injection.

Fix: apply `hasLink` to the phrase fields and `NoteSchema`, and to model output (drop the line
rather than fail the deck).

<a id="l-10"></a>

#### L-10 — Storage caps are count-then-insert (Confirmed)

`assertKept` reads the count outside the insert transaction (`library.service.ts:1531-1538`) in
`createSet`, `insertAlbum` and `generateSong`, so concurrent requests at `limit − 1` all pass. The
daily allowance (`spend`, `1493-1498`) is an atomic conditional upsert; the kept caps are not.

Fix: an advisory transaction lock per user inside the insert transaction, or re-check after insert
and roll back.

<a id="l-11"></a>

#### L-11 — Unbounded table growth (Confirmed)

`registerSpeech` runs on every phrase create and edit and for every suggestion deck
(`library.service.ts:1120-1125,1252-1257,1584`); rows are never removed, and `deleteLibraryOf` only
nulls `owner_id` (`2071`). `auth_magic_codes` keeps one row per email hash ever requested;
`auth_refresh_tokens` gains a row per refresh (`auth/auth.session.ts:100-110`, about 96 per active
device per day) and consumed rows are never deleted; `AuthLifecycle.onModuleInit` returns early
without browser OAuth (`auth/module.ts:16`), so `repository.cleanup()` never runs on email-only
deployments. Meanwhile `auth_rate_limits` is purged by an unindexed `DELETE … WHERE expires_at < $1`
on every auth request (`common/rate-limit.postgres.ts:32`).

Fix: one always-scheduled purge job for codes, consumed refresh rows past family expiry, rate
buckets and unreferenced utterances; an index on `expires_at`.

<a id="l-12"></a>

#### L-12 — Three free accounts can remove any public item from Community (Confirmed)

`REPORTS_TO_HIDE = 3` (`library.service.ts:93`) and `report()` requires only that the reporter can
read the item and does not own it (`1370-1385`). Accounts are free email codes.

Fix: weight reports by account age or activity, add a review step past the threshold, and rate-limit
reports per account per day.

<a id="l-13"></a>

#### L-13 — The clip allowance is charged to the first registrant of an utterance (Confirmed)

`registerSpeechMany` is `ON CONFLICT (id) DO NOTHING` (`speech.ts:97`) and `render()` charges
`row.owner_id` (`320-327`) whoever requested the clip. A learner pays for other learners' identical
phrases, and public clip URLs in a pack let anyone trigger those renders. Bounded to once per
utterance.

Fix: charge the requesting principal when there is one; fall back to the owner only for anonymous
requests.

<a id="l-14"></a>

#### L-14 — Server packs and shared sets are installed without runtime validation; no error boundary (Likely)

`isPack` checks three fields (`apps/mobile/src/shared/api/contentCache.ts:40-41`); `download()`
installs `fetchPack`'s reply without even that (`119-129`); `keepOpenedSet` installs shared and
Community sets with no check (`148-151`). The Zod schemas in `src/shared/content/schema.ts` run only
in unit tests over the seeded files ("the app ships without zod and trusts content that passed
here", `validate.ts:2-3`). Renderers assume shape: `PhraseImage.tsx:11` destructures `phrase.image`,
`Notes.tsx:28-29` indexes `notes[tab]`. There is no error boundary. A misbehaving server (a bad
deploy, or a MITM against a dev build that allows cleartext) serves a phrase without `image`; every
screen rendering it throws, the pack is persisted and re-installed on every launch, and the app
stays broken until the server changes the pack version. `apiUrl()` also accepts any absolute
`http(s)://` URL from a pack (`client.ts:9-11`), so the app fetches third-party content on the
server's say-so (no token is sent with those fetches). Rated Low because the trust boundary is the
project's own server over HTTPS; there is no injection path (no `dangerouslySetInnerHTML`,
`WebView`, `Linking.openURL`, `eval` or `innerHTML` anywhere in the app).

Fix: a runtime reader for packs and shared sets that rejects rather than installs (the pattern in
`src/shared/generate/remote.ts:76-90`); restrict `apiUrl` to the API origin or a configured CDN
origin; a root error boundary with "re-download content" that clears the saved pack.

<a id="l-15"></a>

#### L-15 — Web refresh token in `localStorage`; exported web page has no CSP (Confirmed)

`src/shared/api/secrets.ts:1-20` keeps the refresh token in `localStorage` on the web ("the only
place a static web app has"); the exported `index.html` carries no `Content-Security-Policy`. Any
XSS on the web origin yields a long-lived session. The surface is small (React Native Web escapes
text, no HTML injection paths) and rotation on every refresh plus family revocation on reuse bound
the damage.

Fix: CSP and HSTS at the web host; longer term an httpOnly cookie session for the web origin.

<a id="l-16"></a>

#### L-16 — Cleartext `localhost` API fallback can ship in a release APK; local `.env` points PostHog at the US host (Confirmed)

`API_URL` falls back to `http://localhost:3000/v1` (`src/shared/api/client.ts:6`). `apk-local.mjs`
enforces HTTPS when the URL is set and requires it only with `--upload`
(`scripts/apk-local.mjs:36-66`), so a plain `pnpm apk:local` produces a release APK aimed at
cleartext localhost; Android release has no `usesCleartextTraffic`, so requests fail silently as
"offline". The gitignored `apps/mobile/.env` sets
`EXPO_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com` under a comment that says "PostHog EU",
contradicting ADR-0011; APK builds set `EXPO_NO_DOTENV=1`, so this affects dev builds and
`expo export:web` only. The same file carries stale keys no code reads.

Fix: fail the release build without an HTTPS API URL; assert the PostHog host is the EU one or unset
in the build script; correct and prune the local `.env`.

<a id="l-17"></a>

#### L-17 — The stale generated `android/` tree still declares `RECORD_AUDIO` (Needs runtime check)

The untracked `apps/mobile/android/app/src/main/AndroidManifest.xml:2-8` declares `RECORD_AUDIO`,
`SYSTEM_ALERT_WINDOW` and the storage permissions and has no `tools:node="remove"` entries; it
predates commit `d0251169` (2026-10-01), which added `blockedPermissions` and the expo-audio plugin
options. `pnpm android` and `apk-local.mjs` both prebuild first, so the next build should self-heal,
but this has not been verified, and the APK badging check asserts only package id and
non-debuggable.

Fix: after the next prebuild, confirm the merged manifest removes the four permissions; extend
`apk-local.mjs` to fail if `aapt dump badging` lists `RECORD_AUDIO`, `SYSTEM_ALERT_WINDOW` or the
storage permissions.

<a id="l-18"></a>

#### L-18 — The preview APK is signed with the public Android debug key and published on GitHub (Confirmed)

`pnpm apk:github` publishes `app.loro.android.preview` signed with the debug keystore Expo prebuild
generates (`scripts/apk-local.mjs:187` "Expo development key"; `android/app/build.gradle:112-115`
`release { signingConfig signingConfigs.debug }`), the same key on every machine. Android accepts an
update from any APK whose package name and signing key match, so anyone can produce an APK that
installs over a tester's copy and inherits its sandbox: the refresh token in the Keystore and the
learner log. The precondition (the tester installs an attacker's APK) is that of any sideload.

Fix: a dedicated upload keystore kept outside the repo, passed to Gradle through the environment;
remove the `!debug.keystore` exception (`.gitignore:43`).

<a id="l-19"></a>

#### L-19 — Backups are plaintext, never pruned, and leave the host unencrypted (Confirmed; documented gap)

Every release leaves a full `pg_dump` under `/opt/loro/backups` (`scripts/ec2-release.sh:19-21`) and
`ec2-backup.sh` leaves a bundle; nothing prunes either. The database now holds audio, the host has
one 30 GiB root volume shared with Docker images and the PostgreSQL volume, and disk exhaustion
stops both PostgreSQL and the API. Dumps hold hashed emails, refresh-token hashes, learner progress
and reports; on the host they are root-only on encrypted EBS, but the runbook's off-host step tars
them over SSH to an operator workstation where they sit unencrypted.

Fix: prune `pre-release-*` to the last N; `age`-encrypt bundles before they leave the host (the
recipient is already in `.sops.yaml`); PostgreSQL on its own EBS volume with
`DeletionPolicy: Snapshot`; a disk-usage alarm.

<a id="l-20"></a>

#### L-20 — The API image is built from a possibly dirty tree but tagged with `HEAD` (Confirmed; documented)

`scripts/deploy-ec2.sh:21-22` tags with `git rev-parse --short=12 HEAD` and builds from the working
tree; `ec2-deployment.md:65-66` acknowledges "uncommitted changes included". The tag names a commit
that may not be what runs, defeating the traceability the backup bundle relies on. The APK script
already enforces a clean tree.

Fix: refuse a dirty tree unless `ALLOW_DIRTY=1`, and append `-dirty` to the tag when overridden.

<a id="l-21"></a>

#### L-21 — Supply chain: floating base images, unhashed pnpm, unrestricted lifecycle scripts, audits opt-in (Confirmed)

`apps/api/Dockerfile:5,7,29` uses `node:22-alpine`, `corepack prepare pnpm@9` and
`gcr.io/distroless/nodejs22-debian12` by tag, while the EC2 nginx and PostgreSQL images are pinned
by digest. `packageManager` pins `pnpm@9.12.0` without an integrity hash. pnpm 9 runs dependency
`postinstall` scripts unrestricted (`.npmrc` has no `ignore-scripts`).
`pnpm audit --audit-level=high` and `cargo audit` run only in `pnpm ci:local:audit`
(`scripts/ci-local.sh:22-26`), not in `pnpm check` or the full `ci:local`. Lockfiles are present and
`--frozen-lockfile` is used everywhere; there is no `curl | sh`; `wasm-pack` is pinned and locked.

Fix: pin `FROM` lines by digest and add Dependabot's `docker` ecosystem; add the sha224 hash to
`packageManager`; `ignore-scripts=true` with an allow-list (or pnpm 10); run the audit mode on a
schedule.

<a id="l-22"></a>

#### L-22 — The `decode-uri-component` 0.2.2 advisory is reachable through deep-link parsing (Confirmed by audit; impact Likely)

`pnpm audit` reports a moderate denial of service (exponential decoding of malformed percent-encoded
input) in `decode-uri-component` < 0.4.3, reached from `@react-navigation/core` through
`query-string`. That path decodes the query string of incoming links, so a crafted `loro://` or web
link can hang the app. Of the 69 advisories in the audit this is the only one on a production code
path; the others are build, lint and test tooling (see [Tooling results](#tooling-results)).

Fix: a `pnpm.overrides` entry for `decode-uri-component` until the navigation stack moves; add the
audit to `pnpm check`.

<a id="l-23"></a>

#### L-23 — One age recipient guards every committed secret (Confirmed)

`.sops.yaml:3` names a single recipient, and all three `secrets/*.enc.env` files carry exactly one
`sops_age__list_0` entry. Losing the identity makes every committed secret unrecoverable from the
repo; conversely the whole set hinges on one identity's hygiene.

Fix: add an offline recovery recipient and `sops updatekeys` the three files; record custody in
`ec2-deployment.md`.

<a id="l-24"></a>

#### L-24 — No host patching, no data-volume retention (Confirmed; documented gap)

`provision-ec2.sh:11-17` deliberately re-passes the current AMI so an update never replaces the
instance (the database lives on its root volume). Nothing runs OS or Docker updates; there is no
`DeletionPolicy`, separate data volume, SSM agent or CloudWatch (there is no instance profile at
all, which also means nothing can be exfiltrated through IMDS).

Fix: `dnf-automatic` security timer in user-data; PostgreSQL on a second EBS volume with
`DeletionPolicy: Snapshot`, after which the AMI can be refreshed on update.

<a id="l-25"></a>

#### L-25 — The PostgreSQL container keeps default capabilities; the role password passes through `psql` argv (Confirmed)

Unlike the API and nginx containers, `scripts/ec2-database.sh:17-20` runs PostgreSQL without
`--cap-drop ALL` or `no-new-privileges`. It is on a private network with no published port, so
exposure requires a compromise of the API container. The role-creation step passes the password as a
`psql -v` variable inside the container (`:26`), visible in that process's argv for the duration.

Fix: drop capabilities to the set PostgreSQL needs and add `no-new-privileges`; read the password
from the environment inside the SQL rather than `-v`.

<a id="l-26"></a>

#### L-26 — `Dockerfile.local` copies the whole checkout and `.dockerignore` misses local secret patterns (Confirmed)

`docker/Dockerfile.local:11` is `COPY . .`. `.dockerignore` excludes env files, keys, `secrets` and
`.sops.yaml`, but not `*.agekey` (a pattern `.gitignore:113` expects locally), `.tmp/` (where
`local-magic-delivery.mjs` writes `{email, code}`) or `.local-builds/`. The image is never pushed by
any script.

Fix: add `**/*.agekey`, `.tmp`, `.local-builds` and `.ci-local-reports` to `.dockerignore`.

<a id="l-27"></a>

#### L-27 — The 24-hour HLC skew tolerance lets a device pre-date writes and pull the server clock forward (Confirmed mechanism)

`MAX_SKEW_HOURS = 24` (`packages/core-rs/src/sync/hlc.rs:121`); the server clamps field clocks
(`apps/api/src/sync/sync.service.ts:214`) and the remote before `receive` (`merge.ts:85`), but
anything up to now plus 24 hours is accepted verbatim. A device, or whoever holds its bearer and
device id, can stamp writes 23 hours 59 minutes ahead and win every last-writer-wins and tombstone
conflict against the account's other devices for a day; `receive` then raises the server's physical
clock to that maximum (`hlc.rs:92`), so server-stamped rows beat honest clients for the same period.
Self-limited to the account's own data. The policy is written nowhere in `docs/`; `hlc.rs:118-120`
is the only statement.

Fix: shrink the window to minutes; let `receive` adopt the remote physical clock only up to wall
plus a small epsilon; document the chosen value in `sync-protocol.md`.

<a id="l-28"></a>

#### L-28 — `max` counters are bounded to 2^53 on the wire but `u32` in Rust (Likely)

`CountSchema = z.int().nonnegative()` (`packages/core/src/api/common.ts:4`) bounds `plays`, `reps`
and `lockInDays` (`api/sync.ts:66-67,81`) to safe integers; they merge as `max` and never decrease,
while the Rust records hold them as `u32` (`packages/core-rs/src/lib.rs:96,98`, `src/rank.rs:91`,
`src/select.rs:245`). One push of `reps: 5000000000` is schema-valid, wins `max` forever, and every
later `order_stream` or `select_refrain_set` call on that row fails to deserialise. The app today
calls only `fsrs_initialize` and `fsrs_review`, so the impact is confined to consumers of the legacy
`/v1/sync` rows.

Fix: cap the counters in the schema at a product-realistic value, and use a saturating conversion in
the Rust records.

<a id="l-29"></a>

#### L-29 — Unchecked integer arithmetic in UniFFI-exported helpers (Confirmed; not reachable through `core_call`)

`src/fsrs/mod.rs:291`, `src/ladder.rs:75,81,177` and `src/calendar.rs:117` use raw `*`, `+` and `-`
and the release profile sets no `overflow-checks`, so they wrap silently in shipped builds: a wrong
number shown to a learner rather than a crash. None is dispatched by `core_call`, the Expo module
exposes only `coreCall`, and no caller exists outside the generated bindings. The HLC and scheduler
code uses `checked_*` and `saturating_*` throughout.

Fix: checked or saturating operations, or `overflow-checks = true` in the release profile (cheap for
this crate).

<a id="l-30"></a>

#### L-30 — The fast gate's drift check of the committed browser WASM is self-referential (Confirmed)

`packages/core-rs/browser/loro_core.js` is a 915 KB generated file that embeds the WASM module as
base64, imported directly by the web app (`apps/mobile/src/shared/core/fsrs.ts:9`). `pnpm check`
runs `embed-wasm.mjs --check` (`packages/core-rs/scripts/embed-wasm.mjs:26-37`), which proves only
that `manifest.json` matches the Rust sources and the committed outputs, not that the outputs were
built from those sources: replacing the blob and regenerating the manifest passes. The script's
`--verify-build` mode (`:58-60`), which rebuilds and compares, is never invoked. `pnpm ci:local`
does rebuild the WASM and then fails on any `git status` drift under `packages/core-rs/browser`
(`scripts/ci-local/inventory.mjs:265-273`), so the full gate catches a tampered or stale blob; but
GitHub Actions is disabled, so that gate runs only when an operator runs it. The API is not
affected: its `pkg/` is gitignored and always built from source. A reviewer cannot read the blob, so
this is the one place where a change to shipped code could pass review and the fast gate unseen.

Fix: run `--verify-build` (or the generated-drift check) in `pnpm check` wherever a toolchain is
present, and require it for any change that touches `browser/`; this depends on `wasm-pack` output
being byte-reproducible across machines (not determined here).

### Informational

- **I-1** `AUTH_ENABLED` disables only on the exact string `false`
  (`apps/api/src/common/config.ts:124`); `0`, `no` or `off` leave sign-in enabled, while browser
  OAuth separately requires exactly `true`. Parse booleans strictly and refuse to start on an
  unrecognised value.
- **I-2** HS256 is permitted in production with a length-only key check (`auth.tokens.ts:58-65`; a
  32-character passphrase passes); one key signs and verifies, so rotation ends every session. The
  dev host's encrypted env names `AUTH_SIGNING_KEY` and no `AUTH_PRIVATE_KEY_PEM`, so it issues
  HS256 today. Refuse HS256 in production; accept a `kid`-keyed list of verification keys.
- **I-3** Body-parser `SyntaxError` and `PayloadTooLargeError` fall into the generic branch of
  `problem-filter.ts:46-58` and likely become `500 INTERNAL` plus an error-log line each; no
  internals leak. Map `entity.*` errors to 400/413. Needs runtime check.
- **I-4** Nothing in `main.ts`/`http-app.ts` disables `X-Powered-By` or sets `nosniff`; those come
  from nginx and the Lambda's response allow-list. Fine behind the gateway; set them in the API so
  hardening does not depend on the proxy. Needs runtime check.
- **I-5** Fixed windows (`rate-limit.postgres.ts:23-26`) allow a 2× burst at the boundary;
  acceptable at these limits.
- **I-6** `composeLive` reads the whole provider body before the 12 MB check
  (`music-live.ts:56-58`); the Anthropic and TTS clients stream with a cap. Reuse `boundedBytes`.
- **I-7** `download-url.ts:21-26` builds the TTS download URL from the caller's `Host` and
  `X-Forwarded-Proto` when `AUTH_PUBLIC_URL` is unset; only on the unrouted `/tts`, and production
  sets the URL. Fail closed in production.
- **I-8** `MusicGuard` grants an anonymous principal whenever `MUSIC_PROVIDER=stub` (the default)
  and the stub repository grows unbounded (`music.guard.ts:39-43`, `repository.ts:51-53`);
  `PhrasesController` has no guard and spends Anthropic whenever the key is set;
  `AiController.scene` takes an unvalidated body (a non-string `theme` reaches `.toLowerCase()` →
  500), and its contract (`packages/core/src/api/current.ts:122-125`) is the one non-strict,
  unbounded request schema in `packages/core`; the `/content/v2/pack` query `id`
  (`api/learning-content.ts:136`) has no maximum length either. None pass the gateway allow-list and
  `AuthBoundaryGuard` closes the AI routes once a signing key exists. Delete the dead routes or
  guard them, and bound the two schemas.
- **I-9** The signed song URL validates only `songId:exp` (`library.service.ts:2252-2262`) and skips
  the album readability check, so it stays valid up to 12 hours after an album goes private.
  Documented in `library.md`; include visibility or `updated_at` in the signed string if desired.
- **I-10** `toPhraseWire` emits the holder set's id as `setId` for referenced phrases
  (`library.service.ts:1918-1926,2169`), which may be a private set; `canRead` prevents reading it,
  so only an identifier leaks.
- **I-11** `new Pool({ connectionString, max: 10, connectionTimeoutMillis: 5000 })`
  (`database.ts:41`) sets no `ssl`, `statement_timeout` or `idleTimeoutMillis`; TLS depends entirely
  on the encrypted `DATABASE_URL`. Set `ssl: { rejectUnauthorized: true }` in production and a
  statement timeout below the gateway's 28 s.
- **I-12** `canonicalJson` recurses over client-controlled `fields.*.v`
  (`sync/canonical-json.ts:2-10`); a deeply nested value becomes a `RangeError` → rollback → 500,
  bounded by the 512 KiB envelope.
- **I-13** `loro.account` (with the email) and other learners' stashed progress on a shared device
  live in plaintext AsyncStorage/localStorage (`session.ts:173-175`, `progressSync.ts:33-37`).
  Acceptable for app-private storage; state in the privacy policy that "delete my data" keeps device
  progress.
- **I-14** `anon_id`, installation id and device id come from `Math.random()` (`session.ts:60-66`,
  `persistence.ts:403-405`); the server only seeds an idempotent claim row from `anon_id`, and PKCE
  uses real CSPRNGs. `Crypto.randomUUID()` is the tidy replacement.
- **I-15** The Lambda calls nginx over `http://<private ip>:8080` (`https.yaml:61`); bearers cross
  the subnet in clear, inside one VPC with security-group isolation.
- **I-16** `access_log off` (a deliberate privacy choice: no `?sig=` in logs), no API Gateway access
  logging, a Lambda that logs nothing: there is no record of who called what at the edge.
- **I-17** The parked workflows use floating action tags, have no `permissions:` blocks and pass
  `secrets: inherit`; if revived, pin by SHA and scope permissions. Actions is disabled and the
  scripts verify that at run time.
- **I-18** `template.yaml:25` still describes the security group as "SSH only" after `https.yaml`
  adds 8080 ingress.
- **I-19** nginx runs with `--network host` and can reach Docker bridge networks and IMDS; mitigated
  by IMDSv2, no instance role and a static read-only config.
- **I-20** The local Compose stack uses fixed dev credentials and `minio/*:latest`, all bound to
  loopback.
- **I-21** `score_take`, `melody_score`, `extract` and `align_dtw` are `pub` `todo!()` stubs
  (`packages/core-rs/src/dsp/mod.rs:76`, `score.rs:186`, `pitch.rs:41`, `align.rs:56`); none is
  exported or dispatched, so they are safe today and a panic path if ever exposed.
- **I-22** `check:uniffi` returns `skipped` when no host library exists
  (`scripts/check-uniffi.mjs:96-98`), so on a fresh clone `pnpm check` passes without checking the
  bindings; `ci-local` builds first. The skip is printed, so this is a note.
- **I-23** `scripts/deploy-ec2.sh:19` builds the WASM merge engine on the operator's machine and
  `apps/api/Dockerfile:24` copies it in, so the deployed engine reflects the operator's toolchain,
  not a build inside the image. Build it in the Dockerfile for provenance.
- **I-24** `packages/content/package.json` (`enrich`, `publish`), the root `content:enrich` and
  `content:publish` scripts and `src/fs.ts:4` reference `src/enrich.ts` and `src/publish.ts`, which
  do not exist (the README says so). Consequence for security: nothing in the repo can write cloud
  URLs into `es-ES/phrases.json`.
- **I-25** `mergeClassFor` reads `map[field]` (`packages/core/src/sync/fieldPolicy.ts:110-113`), so
  a field named `constructor` would resolve to a function and fall back to last-writer-wins in Rust.
  Unreachable because every `fields` object is a strict schema and undeclared fields are rejected;
  `Object.hasOwn` costs nothing.

<a id="app-5"></a>

### Verification of the audio promise

Confirmed by absence of any recording path, with these references:

- No recorder API anywhere: a search for `getUserMedia`, `MediaRecorder`, `useAudioRecorder`,
  `AudioRecorder`, `RecordingPresets`, `requestRecordingPermissions`, `allowsRecording`,
  `AVAudioRecorder`, `AudioRecord`, `RECORD_AUDIO`, `startRecording`, `PCM` over `apps/mobile/src`,
  `app`, `modules` and `packages/core-rs/src` finds only playback (`src/music/MusicPlayer.tsx:80`),
  the `mic` icon, the comment "Not a microphone: nothing is recorded" (`src/shared/ui/phase.ts:11`)
  and an unreachable Rust stub (`packages/core-rs/src/dsp/mod.rs:75-77`, `todo!()`, not dispatched
  by `bridge.rs:147-234`).
- The native bridge carries JSON strings only:
  `modules/loro-core/android/.../LoroCoreModule.kt:12-14` and `ios/LoroCoreModule.swift:9-11` expose
  one `call(method, inputJson) -> String`.
- Permissions: `app.config.ts:28-37` blocks `android.permission.RECORD_AUDIO` and passes
  `['expo-audio', { microphonePermission: false, recordAudioAndroid: false }]`; the plugin writes
  `NSMicrophoneUsageDescription` only when given a string.
- No API route accepts audio from the app; every request body is JSON (`client.ts:63-68`), and the
  only non-API fetch is a HEAD probe of a clip URL.
- Session replay is screenshots, not audio.

Caveats: L-17 (the stale generated Android tree) must be re-verified on the next build, and the
`expo-audio` recorder remains importable. Recommended: an ESLint `no-restricted-imports` /
`no-restricted-syntax` rule for the recorder identifiers (the app already lint-enforces its
one-clock rule) and the APK badging assertion from L-17.

<a id="tooling-results"></a>

## Tooling results

Run read-only on 2026-10-01.

### Secret scan (gitleaks 8.30.1, full history, 1142 commits)

Four hits, all false positives after manual inspection: a Docker image digest and the EC2 host name
in `docs/process/ec2-deployment.md` and the archived plan 91 (commit `f3ee30a3`), and the test-only
signing key fixture in `apps/api/src/auth/auth.test.ts` at two older commits (`24fac884`,
`2785e5da`; the current file generates an ephemeral P-256 key instead). A second pass with
`git log -S` for `sk-ant-`, `AKIA`, `BEGIN PRIVATE KEY`, `ghp_`, `xoxb-`, `SOPS_AGE_KEY` and
`AGE-SECRET-KEY-` found only documentation placeholders, test stubs and a false positive inside the
base64 WASM. No real credential was found in any commit, and no `.env` other than `.env.example`, no
`.pem`, `.p8`, `.p12`, `.keystore` or `.agekey` was ever added. The pre-commit hook
(`.husky/pre-commit`) runs `gitleaks git --pre-commit --staged` and refuses to commit when gitleaks
is not installed. Only `apps/api/.env.example` and the three `secrets/*.enc.env` files are tracked;
every value in those is `ENC[AES256_GCM,…]` except five empty assignments that SOPS leaves as-is.

### Rust dependencies (`cargo audit`, 157 crates, advisory database of 1278 entries)

No vulnerabilities, no warnings. Key versions: `serde` 1.0.229, `serde_json` 1.0.151, `wasm-bindgen`
0.2.126, `uniffi` 0.32.0.

### npm dependencies (`pnpm audit`, workspace root)

| Severity | Count |
| -------- | ----- |
| Critical | 0     |
| High     | 48    |
| Moderate | 19    |
| Low      | 2     |

All 69 advisories are transitive. Grouped by package and by whether the vulnerable code can run in
production:

| Package                                                  | Reached through                                   | Runs in production?                                                                                                                                       |
| -------------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@xmldom/xmldom` (23)                                    | `expo` → `@expo/config-plugins` → `xcode`/`plist` | No: prebuild tooling                                                                                                                                      |
| `brace-expansion` (13)                                   | `eslint`, `typescript-eslint`, `@expo/cli`        | No: lint and CLI                                                                                                                                          |
| `fast-uri` (7)                                           | `@commitlint/cli` → `ajv`                         | No: commit hook                                                                                                                                           |
| `multer` (5)                                             | `@nestjs/platform-express`                        | Shipped in the API image, but no route uses multipart (no `FileInterceptor`), so unreachable                                                              |
| `postcss` (4), `nanoid` (1)                              | `@expo/metro-config`                              | No: bundler                                                                                                                                               |
| `js-yaml` (4)                                            | `react-native` → `babel-jest`, `commitlint`       | No: test and commit tooling                                                                                                                               |
| `undici` (3)                                             | `@expo/cli`                                       | No: CLI                                                                                                                                                   |
| `qs` (2)                                                 | `express` 5 → `body-parser`                       | Shipped in the API image; the API parses forms with `extended: false` and Express 5 defaults to the simple query parser, so `qs` is not on a request path |
| `image-size` (2)                                         | `metro`                                           | No: bundler                                                                                                                                               |
| `vitest`, `@vitest/mocker` (2), `moment` (1), `uuid` (1) | test tooling, `pg-mem`, `xcode`                   | No                                                                                                                                                        |
| `decode-uri-component` (1, moderate)                     | `@react-navigation/core` → `query-string`         | **Yes, in the app**: it decodes deep-link query strings, so a crafted link can trigger the exponential-decoding denial of service (L-22)                  |

Conclusion: one advisory is reachable at runtime. The rest are build, lint and test tooling.
Dependabot is configured (`.github/dependabot.yml`) for npm, cargo and GitHub Actions on a weekly
cadence; GitHub Actions themselves are deliberately disabled, so these audits are the only gate and
they are not part of `pnpm check` (L-21). Resolved runtime versions in the API image are current:
`@nestjs/*` 11.1.28, `jose` 6.2.12, `pg` 8.23.0, `express` 5.2.1, `zod` 4.

## What is done right

Recorded so the posture is judged as a whole, and so a fix for one item does not undo another.

**Authentication** (`apps/api/src/auth`)

- CSPRNG everywhere: `randomInt` for codes, `randomBytes(32)` for refresh tokens, state, nonce, PKCE
  verifier and tickets.
- Refresh tokens hashed at rest (SHA-256 of 256 random bits), format-checked before lookup, rotated
  on every use, reuse of a consumed token revokes the family inside a committed transaction with
  `FOR UPDATE` serialising concurrent refreshes.
- Access tokens: algorithm pinned, `typ`/`iss`/`aud`/required claims checked, 15-minute life, ES256
  key validated as P-256; every request reloads the session row and checks `revoked_at`, so logout
  and account deletion take effect at once.
- Email codes HMAC-bound to email hash and nonce, `timingSafeEqual` compare, attempts counted under
  a row lock, one-use delete, uniform 202 for every address, email stored only as a keyed hash,
  delivery response body discarded unread.
- OAuth: redirects validated at startup and at `start` by exact list membership; the callback
  redirects to the stored redirect, never a request parameter; one-use attempts and grants; grant
  bound to the app's S256 PKCE challenge for 60 s; ID token verified for issuer, audience, nonce and
  `azp` against fixed JWKS URLs with timeouts; provider errors never echoed; `no-store` and
  `no-referrer` on the callback. Accounts are never linked by email, so `email_verified` and Apple
  relay addresses are not trust inputs.
- Proxy trust chain: the Lambda sets `x-loro-source-ip` from `requestContext.http.sourceIp` only;
  nginx drops all inbound headers and maps that one to `X-Real-IP`; the API honours `X-Real-IP` only
  with `TRUST_PROXY=1` and a loopback or private peer; Express `trust proxy` is never enabled;
  `common/http.test.ts` pins this.
- Rate-limit counters in PostgreSQL keyed by SHA-256 of the bucket, so raw addresses and emails are
  never stored.

**Business modules and data** (`apps/api/src/library`, `sync`, `integrations`, `database`)

- Every write route takes the account from `request.principal`, set only by `AuthGuard`; no body or
  parameter carries an account id. `OptionalAuthGuard` rejects a bad bearer rather than downgrading
  to anonymous.
- Ownership helpers return 404 consistently; `canRead` is the single read predicate; phrase
  references may only point at Loro's or the caller's own phrases in the same course.
- Share codes and ids are CSPRNG (50-bit codes, unbiased alphabet); private items are not found by
  code.
- All SQL is parameterised; the only interpolations are compile-time constants and enum-derived
  table names from fixed maps; `ILIKE` input is wildcard-escaped and length-capped.
- Strict, bounded Zod contracts on every body; 4 MB JSON and 32 KB form limits at the API, mirrored
  at nginx and the Lambda.
- Daily allowances are an atomic conditional upsert before any provider call, refunded on provider
  failure and charged to the original day.
- Anthropic client: fixed URL, `redirect: 'error'`, key only in a header, timeouts, 64 KB request
  cap, streamed response with a cap, concurrency 4; learner text enters prompts as JSON data and the
  prompts say so; output is schema-constrained and re-validated before storage.
- Covers are never model markup: numeric ranges, colour and path regexes, one renderer, served with
  `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'`.
- TTS cache paths cannot traverse (SHA-256 regex, server-side digest including the user id, atomic
  rename, hash re-verified on read); the speech route's filename regex rejects traversal.
- Progress: compare-and-set on `revision`, 3.8 MB cap, `ON CONFLICT DO NOTHING` for revision 0.
- Sync: `AuthGuard` plus mandatory matching `X-Loro-Device`, per-user advisory lock,
  PostgreSQL-backed 120/min limit, 512 KiB and 500-op envelope, undeclared fields rejected,
  idempotent receipts, 256-bit cursors scoped by user, merge in Rust/WASM, and production refuses to
  boot without it.
- Migrations are idempotent DDL under `pg_advisory_xact_lock` with a ledger; the seed takes its own
  lock.
- The error filter never returns stack, SQL or provider text and logs only method, path (auth paths
  masked) and exception class.
- Account deletion is one transaction across library, usage, sync, music and `auth_users` with FK
  cascades.

**Mobile app** (`apps/mobile`)

- Refresh token in Keychain/Keystore on native; access token never persisted; a 401 triggers one
  refresh then retry; a refused refresh ends the session and clears storage; Web Locks serialise
  refresh across tabs; sign-out revokes server-side.
- OAuth: PKCE with `expo-crypto` / Web Crypto; `state` compared on return; verifier held in memory
  (native) or `sessionStorage` (web) and taken once; a crafted `loro://account?ticket=…` is ignored
  without a matching pending state; the provider URL comes from the API, never from a link.
- No `dangerouslySetInnerHTML`, `WebView`, `Linking.openURL`, `eval`, `new Function`, `innerHTML` or
  `console.*` in app code; all text through RN `<Text>`; deep-link parameters used only as opaque,
  URL-encoded ids; `routes.ts` whitelists filters, tabs and views.
- Inbound state hardening: `sanitizeLearner` type-checks, clips, validates and dedups every field;
  merge is id-union, last-writer-wins with deterministic tie-break and no recursion; conflict retry
  bounded to 3.
- Build hygiene: `EXPO_PUBLIC_*` allow-list in APK builds, `EXPO_NO_DOTENV=1`, HTTPS and
  no-credentials URL validation, non-debuggable and package-id assertions, SHA-256-verified upload
  from a clean `git archive`; no provider keys in the bundle.
- Only the server's hash-named clip URLs and HMAC-signed song URLs are fetched; `RemoteCover` falls
  back to a drawn cover on error.
- Analytics controls present: sign-in code masked; opt-out persisted across `reset()`; analytics off
  entirely without a key; the event allow-list is pure and unit-tested; timestamps and seeds
  dropped.
- Android release has no `usesCleartextTraffic`; `MainActivity` is the only exported component;
  `expo-updates` disabled; SecureStore excluded from backup.
- Delete-my-data and delete-account from the app; per-account progress isolation on a shared device.

**Infrastructure and operations**

- Network: SSH ingress from a pattern-enforced `/32`; 8080 only from the gateway security group,
  whose egress is limited to 8080 toward the origin; no IAM instance profile; IMDSv2 required with
  hop limit 1; EBS encrypted.
- Gateway Lambda: exact path and method allow-lists, query-key and header allow-lists per route
  class, `Authorization` forwarded only on account routes, the caller's `x-loro-source-ip` never
  forwarded, body caps 1 MiB / 4 MiB, 6 MB response cap, 28 s upstream timeout, minimal role, 7-day
  log retention; `scripts/ec2-gateway.test.mjs` exercises the Lambda source for spoofed addresses,
  oversized bodies, unknown routes and alternate encodings as part of `pnpm check`.
- nginx: `server_tokens off`, `proxy_pass_request_headers off` with an explicit header set,
  `Authorization` and `Cookie` blanked on public routes, 1 KB body cap on the public server, method
  gating per location, regex-anchored locations, `nosniff`; container digest-pinned, uid 101,
  read-only, `cap-drop ALL`, `no-new-privileges`, resource limits, `nginx -t` before install,
  post-deploy deny probes.
- API container: distroless `nonroot`, read-only, `cap-drop ALL`, `no-new-privileges`, tmpfs
  `noexec,nosuid`, published on `127.0.0.1` only, env file validated root:600 non-symlink, candidate
  must pass readiness and a seed before cutover, previous container restored on failure, `flock`,
  pre-release `pg_dump`. Multi-stage Dockerfile with `--frozen-lockfile` and `pnpm deploy --prod`;
  no secrets in the image, `.dockerignore` for env, keys and secrets.
- PostgreSQL: digest-pinned, private network, no host port, non-superuser role created with
  `format(%L)`.
- Secrets: SOPS/age; `.gitignore` and `.dockerignore` block env files, keys and age identities;
  `secrets.sh` uses `umask 077`, `mktemp` and an EXIT trap so a failed encrypt never leaves a
  half-written file; decrypt-to-host is a pipe into `install -m 600 -o root`, so plaintext never
  touches the local disk. The pre-commit hook runs gitleaks and refuses to commit without it.
- Scripts: every shell script is `set -euo pipefail`; every argument reaching a remote shell is
  regex-validated; `ssh`/`scp` use `BatchMode=yes StrictHostKeyChecking=yes`; no `curl | sh`.
- CI and supply chain: Actions disabled with runtime guards; lockfiles committed; `.npmrc` has no
  registry override or tokens; no workspace package has install scripts; Dependabot groups framework
  majors out of bot PRs.

**Shared packages** (`packages/core-rs`, `packages/core`, `packages/content`)

- `#![forbid(unsafe_code)]`, no `build.rs`, no network in the build; `cargo audit` clean.
- A typed JSON boundary: every `core_call` input is deserialised into a concrete struct; unknown
  methods and malformed JSON return `InvalidInput`; the grade is re-validated; `serde_json`'s
  recursion limit bounds nesting.
- The server-reachable methods (`hlc_tick`, `hlc_receive`, `hlc_clamp`, `merge_row`) contain no
  `unwrap`, `expect`, indexing or raw arithmetic; allocation is proportional to input, which the API
  caps at 500 ops and 512 KiB.
- Merge fails safe: an undeclared class becomes last-writer-wins; `Max` coerces non-numbers to
  `f64::MIN` so a corrupt remote cannot lower a counter; tombstones win at any clock; commutativity
  and idempotency are tested.
- FSRS `validate()` rejects non-finite values, out-of-range difficulty and stability, backward time
  and unknown algorithms; lapses and due dates use checked arithmetic; `scheduled_ms` is clamped
  before the cast.
- No `panic = "abort"`, deliberately, so UniFFI's `catch_unwind` turns native panics into typed
  errors.
- `pkg/` is gitignored, so the API never runs a committed binary; the UniFFI bindings are
  regenerate-and-diff checked; the OpenAPI specs are drift-checked.
- `packages/core`: every request schema but one is `z.strictObject` with bounded strings and arrays;
  identifiers are pattern-bound and `LibraryIdSchema` forbids `..`; `FIELD_POLICY` contains no
  account, entitlement or role fields, so the client-driven merge cannot escalate anything; the
  consent fields are device-only and kept off the wire; `z.int()` is safe-integer-only and
  `z.number()` rejects `NaN` and `Infinity`; no `eval`, `new Function`, `vm`, dynamic `require` or
  shell interpolation in any of the three packages.
- `packages/content`: the ElevenLabs key is read once and never logged (output carries counts and
  error codes only); stub or failed renders cannot publish; `.render-cache/` is gitignored and no
  audio or cache file is tracked; `isCloudAudioUri` requires `https:` and rejects userinfo;
  `audioDuration.ts`, which the API also runs on provider bytes, only advances offsets, range-checks
  sizes, descends a fixed depth and reads with `?? 0`; the release gate is digest-bound, demands an
  approved record with a named reviewer, and fails closed while `reviews/` is empty; `v2/*.json`
  holds no email addresses, URLs, key-like strings or lyrics.
- FSRS attribution is in order: `docs/architecture/fsrs-upstream-license.txt`, linked from
  `fsrs-model.md:72-75`; `src/fsrs/scheduler.rs:1-2` names the pinned commit and licence; the
  reference fixture carries its own licence file.

## Documentation versus implementation

The documentation matches the code on every material claim checked; these are the discrepancies:

| Document                                                | Says                                                      | Code                                                                                                  | Finding |
| ------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------- |
| `apps/api/src/auth/README.md:58`, `security-privacy.md` | 30 requests per 15 minutes on every auth route            | `logout`, `revokeRefresh`, OAuth `callback`, `me`, `claim`, `capabilities`, `providers` are unlimited | L-3     |
| `docs/architecture/library.md`                          | `link` items are "listed in Community: No"                | `songsOfSet` lists `link` albums on any set's page                                                    | L-6     |
| `apps/api/src/library/speech.ts:243-245`                | The route cannot reveal which phrases a private set holds | A held utterance renders; an unknown one is an immediate 503                                          | L-7     |
| `docs/process/environments.md:60`                       | Lists `inbox:local`                                       | Does not note it is also accepted in production                                                       | L-1     |
| `infra/ec2/template.yaml:25`                            | Security group is "SSH only"                              | `https.yaml` adds 8080 ingress                                                                        | I-18    |
| `docs/process/ec2-deployment.md:79`                     | The release "adds … to the runtime file"                  | It adds `-e` flags; the file is untouched (better than the wording)                                   | —       |
| `apps/mobile/.env` (local, gitignored)                  | Comment says "PostHog EU"                                 | Value is the US host                                                                                  | L-16    |

<a id="not-determined"></a>

## Not determined

Things a read-only review of the repository cannot settle:

- **Runtime behaviour**: whether `X-Powered-By` is emitted (I-4), whether body-parser errors reach
  the filter as 500s (I-3), whether `/tmp` is writable in the read-only container for `inbox:local`
  (L-1), the actual CPU cost of `pack()` and `community(sort=popular)` under the 50 r/s ceiling
  (M-2), and gateway behaviour under saturation.
- **Encrypted configuration**: whether `DATABASE_URL` enforces TLS (I-11), key lengths and rotation,
  provider-key scoping, which delivery URL production uses.
- **Live AWS and GitHub state**: whether `AccountAccess` is enabled, actual security-group rules,
  WAF or access logging outside these templates, the instance's patch level, branch protection,
  secret-scanning and push-protection settings, whether Actions is disabled right now (the scripts
  check at run time), and the scope of the `gh` token used for releases.
- **Age identity custody**: who holds the identity, whether it is backed up, whether the workstation
  holding it and the SSH key is encrypted.
- **iOS project**: not generated in the tree, so ATS settings, the absence of
  `NSMicrophoneUsageDescription` and the `loro` URL type could not be inspected; the plugin logic
  says no microphone string is written.
- **Android**: whether the next `expo prebuild` removes the four permissions (L-17), and whether the
  SecureStore extraction rule keeps AsyncStorage out of cloud backup (I-13).
- **Legacy ids**: the entropy of `mine-s-*` / `mine-p-*` ids minted by the previous app (L-6).
- **Whether the app's Google client IDs are platform-bound**, which is what makes L-4 acceptable.
- **PostHog runtime**: the exact fields of iOS network telemetry and what `captureLog` forwards.
- **Web hosting**: CSP, HSTS, the OAuth `redirect_uri` allow-list and CORS for the web origin live
  outside this repo.
- **WASM reproducibility**: whether `wasm-pack` output is byte-identical across machines, which
  decides whether `--verify-build` can be a hard gate (L-30), and the real provenance of `pkg/` on
  the EC2 host (I-23).
- **The merge paths**: the current app's `/v1/library/progress` merge was reviewed from the app side
  only; the legacy `/v1/sync` classes from the packages side.

## Suggested order of remediation

1. Key the nginx zones on `$http_x_loro_source_ip` and cache or ETag the pack (M-2). Smallest change
   with the biggest availability effect.
2. Separate the refresh budget from the per-IP sign-in bucket (M-1).
3. Decide the analytics consent model and masking (M-3, M-4): opted-out constructor plus an
   onboarding step, masked inputs, no email in `identify`, telemetry and log capture off, normalised
   screen names. Record the decision in ADR-0011.
4. Gate `inbox:local` behind an explicit opt-in (L-1), and fix the `link` listing and speech-oracle
   gaps with their documentation (L-6, L-7).
5. One purge job for the growing tables (L-11); atomic kept caps (L-10); link filter on phrases and
   notes (L-9).
6. Runtime validation of packs and an error boundary in the app (L-14); fail release builds without
   an HTTPS API URL (L-16); the `decode-uri-component` override (L-22); the APK permission assertion
   (L-17).
7. Supply-chain pins and audits in `pnpm check` (L-21); `--verify-build` in the fast gate (L-30); a
   second age recipient (L-23); backup pruning and encryption (L-19); a real upload keystore before
   any wider APK distribution (L-18); a shorter HLC skew window, documented (L-27).
8. The informational items as opportunity allows; the HS256 and pool-SSL items (I-2, I-11) before a
   production deployment that is not the dev host.
