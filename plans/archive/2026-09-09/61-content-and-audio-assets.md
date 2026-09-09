# Versioned content and audio asset pipeline

- **Requirement IDs:** content targets for M1/M2/M3, `AS-01`, `AS-02`, `P2-12`, `P2-32`, `P2-33`,
  `AS-05`, `AS-06`
- **Milestone:** M1 → M3
- **Status:** 🟡 Validated starter catalogs, a shared signed-release wire contract and an immutable
  verifier exist. The mobile-safe local activation seam verifies candidates and commits the catalog
  installation with its release pointer; fetching/publication, reviewed expansion and production
  audio remain. Q-15 blocks production audio only, bilingual sign-off is coordinated by 87.
- **Depends on:** 53/85 completed; 59 for client atomic activation; 86 for provider/storage
  adapters; 87 for bilingual review.
- **Reviewed:** 2026-09-09 against `aafa61f`; current source, tests and retained review records
  inspected. This plan refresh supplies no new runtime, device or deployment acceptance.
- **Priority:** 4; text delivery with 66/86.

**Provider decision (2026-09-07):** ElevenLabs selected. Q-15 still gates production audio on
voice/model selection, production rights, pronunciation review and budget.

**Archive disposition (2026-09-09):** Archived at user request after integration review. The partial
status and remaining acceptance criteria below are retained; archival does not mark this plan
complete. The roadmap index continues to track its unfinished scope.

## Verified starting point

`packages/content/` supplies 31-phrase es-ES/bg-BG/ru-RU starters and neutral learning catalogs;
`releaseCheck.ts` now loads the current material-digest record and validates retained payload
hashes, locale/course identities, attributable approvals and reviewer-language coverage. Actual
approvals remain outstanding. `delivery.ts` provides transport-independent manifest/resource
verification with injected signature, digest and catalog validators. A production trust store,
signing/key-rotation policy and fetch/publication implementation remain required. The mobile local
activation seam rechecks monotonic catalog identity inside its SQLite transaction and keeps the old
pointer on an installation failure; it does not fetch, persist catalog rows itself, or authorize a
release. Independent publication and approved audio do not exist. Preserve the old English/Spanish
API as a compatibility adapter; use plan 85's delivered content schemas for the new pipeline.
`content:enrich`, `content:render` and `content:publish` are declared scripts whose source
entrypoints are absent at this revision; implementing the authoring commands remains part of this
plan.

**2026-09-09 verifier slice:** The Metro-safe boundary accepts an unknown manifest and rejects
malformed manifest/signature/resource shapes with `MANIFEST_INVALID` before cryptography. Valid JSON
with a malformed catalog shape fails with `CATALOG_INVALID`. Compatibility floors now respect
semantic-version prerelease precedence and ignore build metadata. Focused verification covers these
rejections alongside signature/hash, partial-release, rollback and version-collision cases. This is
verification-library coverage, not evidence of client activation or a published signed release.

## Outcome

Content ships as signed/versioned manifests with production audio and reference artifacts, scales
from the three 31-phrase starters to the approved release catalog, and can update independently
without overwriting learner state.

## Remaining work

1. [ ] Decide voice provenance, licensing, consent, pronunciation review, provider fallback,
       regional storage, and deletion obligations. Record the decision before bulk rendering.
2. [ ] Complete the signed-release transport boundary: `delivery.ts` now consumes the shared planned
       API wire schema and the generated target OpenAPI documents the separate release manifest.
       Define locale/pair adaptation, trust/key rotation, ETag and retention policy before runtime
       publication; the legacy/current manifests remain compatibility views, not signed releases.
3. [ ] Build the authoring pipeline for validation, enrichment, translation review, TTS/render
       intake, audio normalization, reference feature generation, human QA, and publication.
4. [ ] Wire a downloader, release storage and catalog-row installer into the tested local activation
       seam. It must bound bytes/cancellation, retain the bundled/last-good release on failure and
       preserve learner-owned phrases, per-course progress and active checkpoints.
5. [ ] Produce an approved es-ES seed batch before bulk work; preserve the existing 150→600 Spanish
       milestone target. Record separately approved bg-BG/ru-RU expansion and voice coverage rather
       than silently multiplying that target. Plan 87 owns starter bilingual sign-off; expanded
       content uses the same ten-point quality bar and independent review.
6. [ ] Generate pronunciation/prosody reference data only from approved source audio and keep raw
       learner recordings out of the pipeline.

## ElevenLabs integration (`AS-01`, `AS-02`, `AS-05`, `AS-06`)

Provider selected by the user on 2026-09-07. Integrate the plan-86 ElevenLabs adapter into the
server-side content rendering pipeline behind `pnpm content:render` (currently a declared script
whose implementation is absent); credential provisioning alone does not implement TTS. Keep native
playback and device-TTS fallback in plan 62.

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
- Text-only delivery acceptance requires reviewed text/teaching metadata, identity and checksums; it
  does not imply recorded audio. Audio-enabled releases additionally require verified rights, pinned
  voice/codec metadata and fallback.
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
   and preservation of learner-owned phrases, per-course progress and active checkpoints; failed
   updates retain the last usable release. Prove an old/new version is selected atomically after
   process death, and that a concurrent course change cannot activate data for the wrong course.
   Wire exact-material approval into publication with 87/72; fixture releases never authorize
   shipping unreviewed content.
3. Coordinate reviewed catalogs with 87/90. Q-15 gates licensed production audio, not text delivery
   or fixture-based adapter work. Hand a pinned approved seed/manifest to 62 before claiming real
   recorded-playback acceptance.

## Out of scope

Playback implementation, live learner TTS endpoint, UI translation, and DSP scoring.
