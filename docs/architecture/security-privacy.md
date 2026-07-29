# Security and privacy

Rationale: [ADR-0011](adr/0011-analytics-and-privacy.md) · Attacker's view:
[threat-model.md](threat-model.md)

---

## The promise that constrains everything

The prosody lab prints this on screen, to the learner, in writing:

> 🔒 **Private — your audio stays on your device** — `Loro.dc.html:1281`

That single line is the strongest constraint in the entire architecture. It rules out server-side
pronunciation scoring, cloud ASR by default, "anonymous audio sampling for model improvement", and
any telemetry that includes a waveform. It's the reason `loro-core` does DSP on-device
([prosody-dsp.md](prosody-dsp.md)) and the reason recorded PCM is passed between native modules by
handle and never surfaced to JavaScript ([audio-speech.md](audio-speech.md#loro-audio-api)).

**A promise displayed to a user is a technical requirement.** If we ever need to break it, the
screen changes first, with consent, in the same release.

---

## Data classification

| Class                 | Data                                                                                        | Where it lives                        | Leaves the device?                                      |
| --------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------- |
| **P0 · Never leaves** | Recorded audio (PCM buffers)                                                                | Native memory, released after scoring | **No** — except a per-use, consented voice-clone sample |
| **P1 · Sensitive**    | Email, auth identities, purchase receipts                                                   | Server, encrypted at rest             | Yes, to us and to the store providers                   |
| **P2 · Personal**     | Phrase library, notes/memory hooks, difficulty and tags, trip city and dates, captured text | Device + server (synced)              | Yes, to us only                                         |
| **P3 · Derived**      | Scores, latencies, reps, FSRS state, ladder rungs                                           | Device + server                       | Yes, to us only                                         |
| **P4 · Telemetry**    | Events with ids, no free text                                                               | Device queue → analytics              | Yes, pseudonymous                                       |
| **P5 · Public**       | Catalog content                                                                             | CDN                                   | It's public content                                     |

### What P2 actually contains, and why it matters

A learner's phrase library is more personal than it looks. It can contain:

- Their memory hooks, which are private associations, sometimes about people.
- Captured text — photographs of prescriptions, letters, forms, addresses.
- Their trip city and dates, i.e. **when their home is empty**.
- Imported text they pasted from anywhere.

So P2 is treated as personal data in the GDPR sense throughout, not as "app content".

### What never enters analytics

| Never                                                  | Instead                                        |
| ------------------------------------------------------ | ---------------------------------------------- |
| Recorded audio, or any derivative of it beyond a score | The score                                      |
| Phrase text for learner-authored phrases               | A salted hash, so we can count without reading |
| Note / memory-hook text                                | A boolean: has a note                          |
| Captured OCR text                                      | A count of lines                               |
| ASR transcripts                                        | Match outcome only                             |
| Email, name, or any provider identity                  | `user_id`                                      |
| Precise location                                       | Trip city, only when the learner set it        |
| The learner's own phrase list as a payload             | Per-phrase events, catalog ids only            |

Enforced by a redaction allowlist in the analytics client: an event property not on the allowlist
for its event name is **dropped before queueing**, and a CI test asserts that every documented
event's properties are allowlisted ([metrics.md](../product/metrics.md#instrumentation-rules)).

---

## Authentication

**Anonymous-first.** The whole app works with no account. An anonymous learner gets a locally
generated `anon_id` and a local user row; signing in later binds or merges without data loss
([sync-protocol.md](sync-protocol.md#first-sign-in-on-a-device-with-local-data)).

| Aspect             | Choice                                                                                                                           |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Providers          | Apple, Google, email magic link. **No passwords** — nothing to leak, nothing to reuse                                            |
| Access token       | JWT, ES256, 15 min, claims `sub`, `plan`, `device_id`, `ver`                                                                     |
| Refresh token      | Opaque, 90 days, **rotating**, stored hashed (Argon2id) server-side                                                              |
| Refresh reuse      | Detected → the whole token family is revoked and the event is logged                                                             |
| Client storage     | iOS Keychain (`kSecAttrAccessibleAfterFirstUnlock`) / Android Keystore-backed EncryptedSharedPreferences. **Never** AsyncStorage |
| Transport          | TLS 1.3 minimum; certificate pinning on `api.loro.app` with a documented rotation runbook                                        |
| Sign-out           | Revokes the refresh family, keeps local data, stops syncing                                                                      |
| Sign-out and erase | Separate, explicitly confirmed action                                                                                            |

**Why no passwords.** Every password is a support burden, a reset flow, a hashing decision, and a
breach liability. Provider sign-in plus magic links covers every learner and removes the category.

---

## Authorisation

- Every server query is scoped by `user_id`, and the repository layer **requires it as a
  parameter**. There is no `db.query` accessible from a controller.
- A cross-tenant read is therefore a compile-time impossibility rather than a code-review concern.
- Entitlements (`plan`) are checked by a guard on paid endpoints and cached client-side with a grace
  period, so a learner abroad with no network keeps Plus features
  ([backend.md](backend.md#billing)).
- Staff endpoints (`/ai/enrich`) sit behind a separate token type and are not reachable with a
  learner token.

---

## Encryption

| Layer                 | Approach                                                                                     |
| --------------------- | -------------------------------------------------------------------------------------------- |
| In transit            | TLS 1.3, HSTS, pinned for the API host                                                       |
| Server at rest        | Managed disk encryption; Postgres column encryption for `email`                              |
| **Device at rest**    | The SQLite file relies on OS-level full-disk encryption. **Not** SQLCipher in v1 — see below |
| Secrets in the app    | None. There are no API keys in the binary; all provider calls go through our API             |
| Secrets on the server | Managed secret store, injected as env, rotated quarterly                                     |

**Why not SQLCipher.** It costs 5–15% on every read, and the hot path (reading phrase state mid-rep)
is latency-sensitive. OS full-disk encryption already protects against device theft for any device
with a passcode. ⚠️ Revisit if we ever store anything more sensitive than a phrase library —
**Q-09** in [open-questions.md](../decisions/open-questions.md).

**No secrets in the app bundle** is worth emphasising: the client never holds an Anthropic key, a
TTS key, or an analytics write key with elevated scope. Every third-party call is proxied
([backend.md](backend.md)), which is also what makes rate limiting and budget enforcement possible.

---

## Permissions

Requested in context, with an honest reason, never at launch
([functional-spec.md](../product/functional-spec.md#permissions)).

| Permission               | Purpose string (must be specific)                                                                         |
| ------------------------ | --------------------------------------------------------------------------------------------------------- |
| Microphone               | "Loro listens while you practise speaking. Your recordings are scored on this device and never uploaded." |
| Speech recognition (iOS) | "Speech recognition runs on your device so you can practise offline."                                     |
| Camera                   | "Photograph a sign or menu to add the phrases you see."                                                   |
| Notifications            | "One reminder a day, at a time you choose. Nothing else."                                                 |

The microphone string states the privacy promise, because the permission dialog is where the learner
decides whether to trust it.

**Not requested, ever:** location, contacts, photo library (camera capture only — we never browse
the library), calendar, health.

---

## Retention

| Data                                     | Client                                    | Server                                                        |
| ---------------------------------------- | ----------------------------------------- | ------------------------------------------------------------- |
| Recorded audio                           | Released after scoring, same call stack   | Never stored                                                  |
| Voice-clone sample                       | Not stored                                | Deleted within the request; `retained: false` in the response |
| `user_phrase`, `trip`, `settings`        | Until deleted by the learner              | Until account deletion                                        |
| `review_log`                             | Forever (needed for FSRS re-optimisation) | 3 years                                                       |
| `latency_sample`, `attempt`              | Pruned after 90 days; aggregates kept     | 1 year, then aggregated                                       |
| `take` (scores, contour)                 | Last 20 per phrase                        | 1 year                                                        |
| Analytics events                         | Queue: 7 days / 5 000 events              | 25 months, pseudonymous                                       |
| Server logs                              | —                                         | 30 days                                                       |
| Audit log (auth, deletion, staff access) | —                                         | 2 years                                                       |
| Backups                                  | —                                         | 35 days PITR                                                  |

**Deleted accounts** are hard-deleted with cascades within 30 days, including from backups as they
age out, and a verification job confirms zero remaining rows.

---

## GDPR / regulatory duties

| Duty                          | Implementation                                                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Lawful basis                  | Contract (delivering the service) for P1–P3; **consent** for P4 analytics and for cloud ASR and voice cloning                  |
| Right of access / portability | `GET /account/export` — complete JSON, documented, re-importable ([api.md](api.md#account))                                    |
| Right to erasure              | `DELETE /account` — 24 h cancellation window, then hard cascade delete, verified                                               |
| Right to object               | Analytics opt-out in Settings; **client-side**, so nothing is even queued                                                      |
| Data minimisation             | No location, no contacts, no photo library, no free text in analytics                                                          |
| Purpose limitation            | Learner data is never used to train a model. Stated in the policy and true in the pipeline                                     |
| Sub-processors                | Documented and listed in the privacy policy: TTS provider, Anthropic (roleplay text only), crash reporting, analytics, hosting |
| DPIA                          | Required — the app processes voice. The mitigation is that voice never leaves the device                                       |
| Age                           | 16+; no child-directed features, no age-gated content flows                                                                    |
| Store disclosures             | Apple Privacy Manifest and Play Data Safety kept in sync with this document, in the same PR as any data-flow change            |

**Learner data is never used for model training.** Not the phrases, not the notes, not the audio.
This is a promise we can make cheaply because the AI use is text generation from a prompt, not
personalisation from a corpus ([ai-services.md](ai-services.md)).

---

## Consent surfaces

Three explicit, revocable consents. Each is off by default and stored in `settings`.

| Consent                | Asked when                                  | Effect if declined                               |
| ---------------------- | ------------------------------------------- | ------------------------------------------------ |
| **Analytics**          | Once, after the first week, honestly framed | Nothing is queued. No functional change          |
| **Cloud ASR**          | Only if on-device ASR is unavailable        | Reveal mode ([offline.md](offline.md#asr))       |
| **Voice cloning** (v2) | At first use of "Hear myself, perfectly"    | The feature is unavailable; nothing else changes |

Each is revocable in Settings, and revoking cloud ASR or voice cloning takes effect immediately.

---

## Client hardening

| Measure                  |                                                                                                |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| No secrets in the bundle | Verified by a CI secret scan of the built artifact, not just the source                        |
| Certificate pinning      | On the API host, with a backup pin and a documented rotation runbook                           |
| Jailbreak/root detection | **No.** It's defeatable, it breaks legitimate power users, and there's nothing to protect      |
| Screenshot prevention    | **No.** Nothing here is a secret from the learner                                              |
| Deep-link validation     | Every parameter validated; a deep link can navigate but never mutate                           |
| WebViews                 | None in the app                                                                                |
| Third-party SDKs         | Minimised, each one reviewed for what it collects; no ad SDKs, no attribution SDKs             |
| OTA updates              | Signed by EAS; the update channel is release-gated ([`process/ci-cd.md`](../process/ci-cd.md)) |

**Deep links can navigate but never mutate** is worth stating as a rule: a link that could add a
phrase, start a purchase, or change a setting would be an attack surface reachable from any web
page.

---

## Server hardening

| Measure          |                                                                                           |
| ---------------- | ----------------------------------------------------------------------------------------- |
| Input validation | Zod schemas shared with the client — the contract cannot drift                            |
| Rate limits      | Per-user and per-IP, strictest on `/auth/*` and `/ai/*` ([api.md](api.md#rate-limits))    |
| SQL              | Parameterised via Drizzle throughout; raw SQL requires review and a comment justifying it |
| Errors           | RFC 9457 problem details; no stack traces, no internal ids, no SQL text                   |
| Logging          | Structured, with a redaction allowlist. `user_id` only, never email                       |
| Headers          | HSTS, `X-Content-Type-Options`, restrictive CSP on any HTML surface                       |
| Dependencies     | Lockfile committed; CI fails on known-critical advisories; automated update PRs           |
| Container        | Distroless base, non-root, read-only filesystem                                           |
| Network          | API is the only public surface; DB and Redis are private-subnet only                      |
| Staff access     | SSO, MFA, audit-logged; production DB access requires an approved break-glass             |

---

## Incident response

Full runbook: [`process/incident-response.md`](../process/incident-response.md). Privacy-specific:

| Severity       | Definition                                                                        | Response                                                                  |
| -------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **P0 privacy** | Any recorded audio left the device without consent, or cross-tenant data exposure | Immediate: disable the path, notify within 72 h per GDPR, full postmortem |
| **P1 privacy** | P1/P2 data exposed to an unauthorised party                                       | Same-day containment, assess notification duty                            |
| **P2 privacy** | Analytics captured data outside the allowlist                                     | Purge the affected events, fix the allowlist, document                    |

A P0 privacy incident is the only class of incident that halts all feature work until closed.
