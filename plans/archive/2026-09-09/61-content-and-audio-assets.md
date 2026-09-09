# Versioned content and audio asset pipeline

- **Requirement IDs:** content targets for M1/M2/M3, `AS-01`, `AS-02`, `P2-12`, `P2-32`, `P2-33`,
  `AS-05`, `AS-06`
- **Milestone:** M1 → M3
- **Status:** 🟡 Validated starter catalogs, content API contracts and an immutable manifest
  verifier exist. Delivery/updater, reviewed expansion and production audio remain; Q-15 blocks
  production audio only, bilingual sign-off is coordinated by 87.
- **Depends on:** 53/85 completed; 59 for client atomic activation; 86 for provider/storage
  adapters; 87 for bilingual review.
- **Reviewed:** 2026-09-09 against checkout `42f4d57`; source/plan review only, no new device or
  deployment acceptance.

**Provider decision (2026-09-07):** ElevenLabs selected. Q-15 still gates production audio on
voice/model selection, production rights, pronunciation review and budget.

**Archive disposition (2026-09-09):** Archived at user request after integration review. The partial
status and remaining acceptance criteria below are retained; archival does not mark this plan
complete. The roadmap index continues to track its unfinished scope.

## Verified starting point

`packages/content/` supplies 31-phrase es-ES/bg-BG/ru-RU starters and neutral learning catalogs;
`releaseCheck.ts` rejects pending bilingual review. `delivery.ts` provides transport-independent
manifest/resource verification with injected signature, digest and catalog validators. A production
trust store, signing/key-rotation policy and fetch/activation implementation remain required.
Independent publication, client activation and approved audio do not exist. Preserve the old
English/Spanish API as a compatibility adapter; use plan 85's delivered content schemas for the new
pipeline.

## Outcome

Content ships as signed/versioned manifests with production audio and reference artifacts, scales
from the three 31-phrase starters to the approved release catalog, and can update independently
without overwriting learner state.

## Remaining work

1. [ ] Decide voice provenance, licensing, consent, pronunciation review, provider fallback,
       regional storage, and deletion obligations. Record the decision before bulk rendering.
2. [ ] Extend the existing immutable manifest/resource contracts with locale/voice identity, codecs,
       loudness/rate metadata, ETags, signatures, compatibility, rollback, and retention.
3. [ ] Build the authoring pipeline for validation, enrichment, translation review, TTS/render
       intake, audio normalization, reference feature generation, human QA, and publication.
4. [ ] Build the client catalog updater/storage/prefetch contract with atomic activation and safe
       fallback to the bundled seed.
5. [ ] Produce an approved es-ES seed batch before bulk work; preserve the existing 150→600 Spanish
       milestone target. Record separately approved bg-BG/ru-RU expansion and voice coverage rather
       than silently multiplying that target. Plan 87 owns starter bilingual sign-off; expanded
       content uses the same ten-point quality bar and independent review.
6. [ ] Generate pronunciation/prosody reference data only from approved source audio and keep raw
       learner recordings out of the pipeline.

## ElevenLabs integration (`AS-01`, `AS-02`, `AS-05`, `AS-06`)

Provider selected by the user on 2026-09-07. Integrate the plan-86 ElevenLabs adapter into the
server-side content rendering pipeline behind `pnpm content:render`; credential provisioning alone
does not implement TTS. Keep native playback and device-TTS fallback in plan 62.

1. Consume the plan-86 provider adapter and configuration validation for `TTS_PROVIDER=elevenlabs`,
   `TTS_API_KEY`, and `TTS_VOICE_ES_ES`. Explicitly load the protected environment for the content
   command; do not assume it inherits the API container's environment. Keep `stub` as the local
   default, reject unknown providers, and fail clearly when live configuration is incomplete.
2. Pin the ElevenLabs model, voice ID, language, output format, and synthesis settings in versioned
   render metadata. Select and review an `es-ES` voice before the seed batch; add independently
   reviewed voice mappings for `bg-BG` and `ru-RU` before rendering those catalogs. Never silently
   substitute a voice or re-render an approved reference under the same asset ID.
3. Send approved catalog text only. Keep the key in SOPS/runtime secrets, redact credentials from
   logs/errors, and never expose it through `EXPO_PUBLIC_*`. No learner recordings enter this
   pipeline. Use Text-to-Speech access and voice-read permission without unrelated account access.
4. Reuse plan-86 controls for bounded concurrency, timeouts, cancellation, and bounded retries for
   transient failures/rate limits. Treat authorization and quota failures distinctly. Add a dry-run
   estimate, an explicit batch spending/credit ceiling, and resumable rendering that skips verified
   assets; retries must not imply guaranteed provider-side deduplication or zero duplicate charges.
5. Validate generated audio, write atomically, calculate checksums, normalize and generate real
   reference features through the existing pipeline boundary. Failed/stub renders must never be
   published as production audio. Record actual usage when available and distinguish estimates.
6. Require plan-86 deterministic adapter tests for success, invalid credentials, missing voice,
   timeout, 429, quota exhaustion, corrupt output, resume, and secret redaction. After Q-15 passes,
   run a bounded live seed render, inspect/listen to the output with bilingual review, and verify
   manifest/cache compatibility with plan 62. Normal CI must not call ElevenLabs or spend provider
   credits.
7. Update environment examples and local-development/content-authoring instructions with the
   implemented command, provider selection, secret-loading mechanism, and verified smoke-test steps.

The API key has been provisioned in the local encrypted environment; it is not a test result or
approval of any voice's production rights. Q-15 remains open for the asset evidence above.

## Acceptance criteria

- A bad, partial, unsigned, incompatible, or rolled-back pack cannot replace the last good pack.
- Every production phrase has verified text, metadata, audio ownership, checksums, and fallback.
- Content update changes catalog/assets without requiring an app release or mutating learner rows.
- The pipeline is reproducible, budgeted, and reports per-check quality failures.
- Explicit ElevenLabs mode renders a reviewed seed batch with pinned provenance and real audio;
  missing credentials, exhausted budget, and failed renders cannot produce a publishable pack.
- Adapter tests and `pnpm check` pass; approved live verification records usage and review evidence
  without credentials. Native playback claims require plan-62 device verification.

## Delivery order and gates

1. Reconcile `delivery.ts` with shared API content schemas before publication work: define the wire
   mapping, signed bytes, trust/key rotation, locale identity and version/rollback policy. Retain
   the injected Metro-safe validator boundary; do not import Node authoring code into mobile.
2. Implement text-only publication and crash-safe atomic client activation first using 59 storage
   and 86 transports. Cover interrupted download/install, signature/hash failure, insufficient disk
   and preservation of learner-owned phrases; failed updates retain the last usable release.
3. Coordinate reviewed catalogs with 87/90. Q-15 gates licensed production audio, not text delivery
   or fixture-based adapter work. Hand a pinned approved seed/manifest to 62 before claiming real
   recorded-playback acceptance.

## Out of scope

Playback implementation, live learner TTS endpoint, UI translation, and DSP scoring.
