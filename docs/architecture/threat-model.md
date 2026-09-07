# Threat model

Assets, actors, attack surface, and what we do about each. Complements
[security-privacy.md](security-privacy.md), which describes the controls; this document describes
the adversary.

Method: asset-centric, with STRIDE applied per trust boundary. Reviewed each milestone and after any
change to auth, sync, or the AI endpoints.

---

## Assets, by what an attacker would actually want

| #   | Asset                                            | Why it's valuable                                                                                      | Impact if lost                                                                      |
| --- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| A1  | **Learner recorded audio**                       | Biometric-adjacent; voice is identifying. And we promised, in writing, that it stays on the device     | **Catastrophic** — breaks the product's core trust claim and is a reportable breach |
| A2  | **The phrase library, notes, and captured text** | Personal in ways it doesn't look: private mnemonics, photographed prescriptions and letters, addresses | High                                                                                |
| A3  | **Trip city and dates**                          | Tells an attacker **when a specific person's home is empty**                                           | High                                                                                |
| A4  | Auth tokens / session                            | Full account takeover                                                                                  | High                                                                                |
| A5  | Email and provider identities                    | Phishing, credential correlation                                                                       | Medium                                                                              |
| A6  | AI budget (our spend)                            | Free LLM inference at our expense                                                                      | Medium (financial)                                                                  |
| A7  | Catalog content                                  | Our authored work                                                                                      | Low — it's shipped to every device anyway                                           |
| A8  | Service availability                             | Denial of sync                                                                                         | **Low** — the app works offline, which is a real security dividend                  |
| A9  | Learning integrity                               | Corrupted scheduling or scores harm the learner silently                                               | Medium                                                                              |

**A3 is the asset most likely to be underestimated.** "Madrid, arriving June 30" plus an email
address is a burglary tip. It's why trip data is P2, why it's never in analytics as free text, and
why the export/deletion paths must actually work.

---

## Trust boundaries

```
┌─────────────────────────────────────────────────────────────────┐
│ DEVICE (learner-controlled, assume it can be fully compromised) │
│                                                                  │
│  ┌────────────────────────────────────────────┐                 │
│  │ App sandbox                                │                 │
│  │  JS ── B1 ──▶ native modules ── B2 ──▶ PCM │                 │
│  │  SQLite (OS-encrypted)                     │                 │
│  │  Keychain / Keystore ◀── B3                │                 │
│  └────────────────────────────────────────────┘                 │
│                                                                  │
│  Widgets (separate process) ◀── B4 ── App Group / DataStore     │
└──────────────────────────────┬──────────────────────────────────┘
                               │ B5  TLS 1.3 + pinning
┌──────────────────────────────▼──────────────────────────────────┐
│ OUR CLOUD                                                        │
│  api ── B6 ──▶ Postgres / Redis / S3                            │
│   │                                                              │
│   └── B7 ──▶ Claude,  B8 ──▶ TTS provider,  B9 ──▶ CDN          │
└─────────────────────────────────────────────────────────────────┘
```

| Boundary | Crossing             | Primary risk                                          |
| -------- | -------------------- | ----------------------------------------------------- |
| **B1**   | JS ↔ native          | A compromised JS bundle requesting audio it shouldn't |
| **B2**   | native ↔ PCM buffers | Audio escaping the device (**A1**)                    |
| **B3**   | app ↔ keychain       | Token theft on a compromised device                   |
| **B4**   | app ↔ widget process | Data leaking to a less-protected surface              |
| **B5**   | device ↔ our API     | MITM, replay, token theft, tenant confusion           |
| **B6**   | api ↔ data stores    | Injection, cross-tenant reads                         |
| **B7**   | api ↔ Claude         | **Prompt injection**, data leakage into prompts       |
| **B8**   | api ↔ TTS            | Learner audio leaving on the clone path               |
| **B9**   | CDN                  | Content tampering                                     |

---

## Actors

| Actor                      | Capability                                | Motivation                                                                               |
| -------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Curious learner**        | Their own device, proxy, rooted phone     | Unlock paid features, see how it works                                                   |
| **Malicious learner**      | Same, plus crafted API requests           | Free AI inference (A6), abuse others (A2–A5)                                             |
| **Network attacker**       | Hostile wifi — hotel, airport, café       | Credentials, session, MITM. **High relevance: our users are travellers on foreign wifi** |
| **Opportunistic thief**    | Physical possession of an unlocked device | Everything on it                                                                         |
| **Automated scanner**      | Internet-wide scanning                    | Known CVEs, exposed endpoints                                                            |
| **Malicious insider**      | Staff production access                   | A2, A3, A5 at scale                                                                      |
| **Compromised dependency** | Code execution in our build or app        | Everything                                                                               |
| **Compromised provider**   | Access to what we send them               | Prompt content (B7); recorded learner audio is never sent                                |

The **network attacker on hostile wifi** deserves emphasis. The primary persona is, by definition,
using this app on unfamiliar networks in a foreign country. Hotel wifi with a captive portal that
MITMs TLS is not hypothetical.

---

## STRIDE by boundary

<a id="b2--audio-leaving-the-device--the-one-that-matters-most"></a>

### B2 · Audio leaving the device — the one that matters most

| Threat                                                        | Mitigation                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A feature added later uploads audio for "quality improvement" | **Architectural**: PCM lives in native memory and is passed to `loro-core` by handle. There is no JS API that returns audio bytes, so the code to upload it does not exist and would have to be deliberately added to a native module. Plus a CI test asserting no network call originates in the audio module |
| A future endpoint accepts recorded learner audio              | Prohibited by ADR-0011; API contract tests and architecture review reject any recorded-audio request body                                                                                                                                                                                                      |
| Crash reporter attaches an audio buffer                       | Crash reporter configured with no attachments; PCM is not in a JS-visible structure so it can't be serialised into a report                                                                                                                                                                                    |
| Analytics accidentally includes a derivative                  | Redaction allowlist; a CI test asserts every documented event's props are allowlisted ([metrics.md](../product/metrics.md#instrumentation-rules))                                                                                                                                                              |
| Debug builds log audio paths                                  | Audio never has a path — it's never written to disk                                                                                                                                                                                                                                                            |

**Design principle:** the promise is kept by _making the violation hard to write_, not by
remembering not to write it. That's why this is an architecture concern and not a policy one.

### B5 · Device ↔ API

| Threat                                                | Mitigation                                                                                                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **MITM on hostile wifi**                              | TLS 1.3 + certificate pinning on `api.loro.app`, with a backup pin and rotation runbook                                                          |
| Captive portal interception                           | Portals get HTML back from a probe → treated as offline; no request proceeds ([offline.md](offline.md#detecting-connectivity))                   |
| Token theft from a rooted device                      | Short-lived access tokens (15 min); rotating refresh with reuse detection revoking the family                                                    |
| Replay of a sync push                                 | Idempotent by HLC comparison — replaying an op is a no-op                                                                                        |
| **Tenant confusion** — reading another learner's rows | `user_id` is required by the repository signature; controllers cannot query without it. Covered by an e2e test that asserts cross-user reads 404 |
| Forged HLC to win all conflicts                       | A learner can only corrupt _their own_ data; server clamps absurd future clocks and logs it                                                      |
| Enumerating accounts via magic link                   | `/auth/magic-link` returns 202 regardless of existence                                                                                           |
| Sync flood                                            | Rate limits per user and per IP; batch caps                                                                                                      |

<a id="b7--prompt-injection--the-ai-boundary"></a>

### B7 · Prompt injection — the AI boundary

The realistic vector: a learner types or pastes phrase text, which reaches a prompt.

| Threat                                                  | Mitigation                                                                                                                                                                                                                                              |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Injected instructions change the scene output           | Structural separation (learner text is data in a user turn, never in the system prompt); delimiting with escape stripping; strict output validation with one repair attempt then a bundled fallback ([ai-services.md](ai-services.md#prompt-injection)) |
| Injection exfiltrates other learners' data              | **Impossible by construction**: prompts contain only the requesting learner's phrases, level, and tags. No retrieval, no cross-tenant context                                                                                                           |
| Injection makes the model call a tool                   | The model has **no tools**. Output is text                                                                                                                                                                                                              |
| Injection produces harmful content shown to the learner | Output validation (language, length, structure, instruction detection); worst case is a weird scene for the person who injected it                                                                                                                      |
| Someone burns our AI budget (A6)                        | Per-user rate limits (20 scenes/hour, 60/day), per-user monthly spend cap, global daily cap, aggressive caching. Over budget → silent bundled fallback                                                                                                  |
| A poisoned cached scene is served to others             | Cache keys include the learner-independent parameters only; a validation-failure spike triggers a cache purge for the affected prefix                                                                                                                   |

The AI subsystem is deliberately **unprivileged**: no tools, no retrieval, no cross-tenant data, no
ability to mutate state. That's what caps the impact of a successful injection at "you got a strange
café scene".

### B6 · API ↔ data stores

| Threat                                    | Mitigation                                                                                                                   |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| SQL injection                             | Target: parameterised queries via Drizzle. No server repository exists yet ([ADR-0008](adr/0008-backend-nestjs-postgres.md)) |
| Cross-tenant read via a missing predicate | Repository layer requires `user_id`; no `db.query` in controllers; e2e test                                                  |
| Redis cache poisoning                     | Keys are namespaced and derived server-side from validated input; never from raw client strings                              |
| Backup exfiltration                       | Encrypted at rest, access audit-logged, restore requires break-glass approval                                                |

### B3 / B4 · On-device

| Threat                                               | Mitigation                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Token theft from insecure storage                    | Keychain / Keystore-backed only. **Never AsyncStorage** — CI lint rule forbidding token keys there                                                                                                                                                                                                                                                                              |
| Widget snapshot leaks data to a less-protected store | The snapshot is minimal (city, days, counts, one phrase). No notes, no captured text, no tokens                                                                                                                                                                                                                                                                                 |
| Malicious app reads our App Group                    | App Groups are entitlement-scoped to our team id                                                                                                                                                                                                                                                                                                                                |
| Deep link mutates state                              | Deep links may navigate only; every parameter validated; no mutating handler is reachable from a link                                                                                                                                                                                                                                                                           |
| SQL injection into the device database               | Every learner value is a bound parameter. The device layer is handwritten SQL over `SqlDriver` and no ORM ([ADR-0003 amendment](adr/0003-offline-first-sqlite-sync.md#amendment--2026-07-30--handwritten-sql-on-the-client-no-orm)); the only interpolations are generated identifiers — the column list, the placeholder count, and table names read back from `sqlite_master` |

<a id="b9--cdn"></a>

### B9 · CDN

| Threat                            | Mitigation                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------- |
| Tampered audio served to learners | Content-addressed paths; the client verifies `sha256` before use and re-fetches on mismatch |
| Cache poisoning                   | Immutable, versioned paths; no query-string variance                                        |

### Supply chain

| Threat                         | Mitigation                                                                                                       |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Malicious npm/cargo dependency | Lockfiles committed; CI advisory gate; minimal dependency surface; no postinstall scripts allowed without review |
| Compromised CI                 | Least-privilege OIDC to cloud; signing keys in a separate scope; no secrets in PR-triggered workflows from forks |
| Malicious OTA update           | EAS-signed updates; channel promotion is release-gated and audited                                               |
| Typosquatted package           | Lockfile review is part of code review for any dependency addition                                               |

### Insider

| Threat                           | Mitigation                                                                                            |
| -------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Staff browsing learner libraries | Production DB access requires break-glass approval and is audit-logged; no standing access            |
| Staff exporting P2 at scale      | Export endpoint is per-user and rate-limited; bulk export requires a reviewed job                     |
| Debug flag exposing others' data | No admin impersonation feature exists. If one is ever needed, it needs its own ADR and an audit trail |

---

## Abuse cases (not attacks — misuse)

| Case                                                               | Handling                                                                                                                                 |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| A learner stores something harmful as a "phrase"                   | It's private data on their device. We don't scan it. It never enters a prompt in a way that could produce harmful output past validation |
| Captured OCR of a document containing someone else's personal data | Stays on-device unless synced; covered by P2 handling; export and deletion apply                                                         |
| Someone else's voice recorded during a take                        | Never leaves the device; released after scoring                                                                                          |
| A learner uses the app to translate abusive text                   | Translation is short, bounded, and not published anywhere. Not a moderation surface                                                      |
| A shared device (family)                                           | Sign-out keeps local data by design; "sign out and erase" is available and clearly labelled                                              |

---

## Residual risks — accepted, with reasons

| Risk                                                                                  | Why accepted                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A rooted/jailbroken device can read the SQLite file**                               | The learner owns the device and the data is theirs. We don't ship SQLCipher because it costs latency on the hot path and OS full-disk encryption covers theft ([Q-09](../decisions/open-questions.md)) |
| A learner can bypass client-side entitlement caching to get Plus features temporarily | Server verification on the next connection corrects it. Aggressive enforcement would break the offline grace period that legitimate travellers need                                                    |
| A determined learner can extract catalog content                                      | It's shipped to every device; it isn't a secret. Our moat is the pedagogy, not the phrase list                                                                                                         |
| Sync availability depends on us                                                       | The app works offline, so an outage delays sync rather than blocking learning (A8 is genuinely low impact)                                                                                             |
| A compromised TTS provider sees a learner's typed phrase text                         | Documented sub-processor; text only, no identity attached to the render request (content-addressed by hash)                                                                                            |
| Claude sees a learner's owned catalog phrase ids and tag counts                       | Documented sub-processor; no identity, no notes, no audio                                                                                                                                              |

---

## Review checklist

Applied to any PR touching auth, sync, the AI endpoints, or the audio module:

- [ ] Does any new code path move audio, or a derivative of audio, off the device?
- [ ] Does any new query lack a `user_id` predicate?
- [ ] Does any new event property carry free text?
- [ ] Does learner-controlled text reach a prompt without delimiting and validation?
- [ ] Does any new endpoint lack a rate limit?
- [ ] Does any new token or secret get stored outside Keychain/Keystore?
- [ ] Does a new deep-link handler mutate state?
- [ ] Is the new data flow reflected in the Apple Privacy Manifest and Play Data Safety form?
- [ ] Does a new sub-processor need adding to the privacy policy?

## Implemented Google/Apple identity boundary (plan 88)

[Account implementation](google-apple-auth.md) now rejects substituted issuers/audiences/nonces,
replayed state/tickets/refresh credentials and arbitrary callback redirects. Provider identity is
never inferred from email. PostgreSQL session locks serialize refresh rotation across processes;
replay revocation also invalidates access credentials. Native refresh uses SecureStore and web
credentials remain in memory. Auth-enabled deployments disable legacy shared sync/AI repositories.
No learning text, audio or progress enters this identity flow. Persisted P1 data is the provider
subject, account ID and session relationships; email/name are not persisted. Raw IP is hashed for
the 15-minute auth rate bucket, not logged as account metadata. Provider callback codes/state and
all credentials require proxy/APM redaction; application-level unexpected auth errors are redacted.
Account deletion/export, release store disclosures, production transport and native device evidence
remain release gates, not properties proved by the browser suite.
