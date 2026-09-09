# Shared provider adapters and integration verification

- **Requirement IDs:** `F-01`–`F-04`, `F-07`, `AS-01`–`AS-06`, `AI-01`–`AI-05`, `P3E-*`
- **Milestone:** M2/M3, phased testing
- **Status:** 🟡 Tested Anthropic transport, Google/Apple identity verification and plan-85
  contracts are merged. Process-local concurrency admission now bounds the Anthropic transport.
  Remaining common provider controls, adapters and runtime wiring remain; each needs its owning
  feature slice and applicable product decision.
- **Depends on:** 85 completed; 66 backend seams; owning feature slices in 61/65/67/71/74/76/82; 88
  supplies testing infrastructure and 73 owns production operations.
- **Reviewed:** 2026-09-09 against checkout `42f4d57`; source/plan review only, no new device or
  deployment acceptance.

## Current evidence

`apps/api/src/integrations/anthropic/messages.ts` implements text-only structured requests,
mandatory result parsing, bounded bytes/deadlines, reported usage and sanitized failures without
automatic retries or redirects. Its deterministic/loopback tests exist. Nest still registers only
`StubSceneProvider`; the transport is not a live AI feature.

The shared `integrations/provider-concurrency.ts` admission primitive and Anthropic's required
`maxConcurrentRequests` configuration reject excess calls before dispatch, with no waiting queue or
retry. Permits cover response handling and release after settled success, failure or cancellation;
duplicate release cannot increase capacity. Deterministic tests cover overlap, streamed bodies,
failure/cancellation recovery and fixed rejection metadata. Limits apply to one transport instance
in one process; account/distributed admission and atomic spend remain unimplemented.

The former fixed-worktree restriction and wait-for-plan-85 instructions applied to work before the
merge and are removed. Use normal repository branches, isolated test resources and shared contracts;
no copied schemas, permanent external worktree or alternate API type system is required.

## Ownership

| Owner   | Responsibility                                                                          |
| ------- | --------------------------------------------------------------------------------------- |
| 66      | Runtime validation, Postgres repositories, principal-ready cursors/HLC, exact API image |
| 67 / 68 | Authentication and account lifecycle / mobile sync and convergence                      |
| 61      | Content publication, asset identity and client update behavior                          |
| 86      | Vendor transports, common execution controls and adapter verification                   |
| 76 / 82 | AI feature prompts, semantics, evaluations and bundled fallback coordinators            |
| 71 / 73 | Consent/telemetry behavior / production delivery and diagnostics                        |
| 74      | Approved purchases, entitlements and offline policy                                     |
| 88      | Testing EC2, local Postgres, private S3, IAM, deployment, monitoring and recovery       |

Consume plan 85's current/target contracts according to the migration guide. Drafts remain gated. A
missing interface requires a shared-contract change before dependent runtime work. Preserve
language/course identity in asset selection, requests and cache keys.

## Infrastructure and provider choices

- Testing hosting and storage are selected: AWS Frankfurt, one EC2 instance, local PostgreSQL and
  private S3 under plan 88. Remove Render, R2, managed cache and CDN from testing prerequisites.
- Provide an AWS S3 adapter through the standard temporary-credential chain. Plan 61 owns immutable
  asset keys and authorized download behavior; neither public buckets nor a static private-bucket
  URL can substitute for it.
- Identity verification/email transports support plan 67's approved providers. Sender setup,
  verification, delivery failures and external credentials remain implementation requirements.
- ElevenLabs is the selected cloud TTS provider (product-owner decision, 2026-09-07); voice/model
  IDs remain pending. TTS remains disabled in testing. Q-15 voice/licensing/quality evidence gates
  production rendering; no voice or vendor is selected merely by mentioning an adapter candidate.
- AI remains stubbed until the owning feature's identity, budget, safety, retention and fallback
  gates pass. The merged Anthropic transport is an input to that work.
- Billing awaits Q-08/Q-12; diagnostics vendor selection must satisfy privacy/region constraints.
  CloudWatch/SNS host operations from plan 88 do not require a mobile analytics SDK.
- Redis, queues and workers are deferred until an implemented consumer and revised budget justify
  them. Do not provision idle services for transport tests.

## Remaining work

1. [ ] Add common credential/configuration validation, deadlines, concurrency limits, atomic spend
       reservation/reconciliation, rate limits, circuit breaking and redacted metadata. Account for
       ambiguous provider charges on timeout; do not retry solely because a result is absent.
       Process-local concurrency admission is implemented for Anthropic; the remaining controls and
       feature-level composition are still open.
2. [ ] Reuse `auth/provider.ts` and `auth/auth.providers.ts` for the implemented OAuth exchange and
       direct identity-proof paths. Add missing email delivery and common transport hardening with
       deterministic signature, delivery and failure tests; do not create a second auth stack. Keep
       account state and token issuance in 67.
3. [ ] Supply plan-61 S3 upload/download and asset-integrity adapters with scoped permissions and
       expiry handling. Use local fixtures first; verify against private testing S3 when available.
4. [ ] Wire Anthropic only through plans 76/82 after their semantics, evaluations, identity, budget
       and fallback checks pass. Keep live chat disabled while Q-18/Q-20 remain open. Supply guarded
       text-only enrichment and translation transports when requested by plans 61/65.
5. [ ] Implement the ElevenLabs transport and deterministic failure/redaction tests for the
       [plan-61 integration checklist](61-content-and-audio-assets.md#elevenlabs-integration-as-01-as-02-as-05-as-06).
       Adapter implementation can proceed with fixtures; Q-15 gates live production rendering. Add
       licensed TTS, billing and privacy-safe diagnostics adapters only as their feature and
       decision gates pass; no recorded learner audio or voice-clone transport.
6. [ ] Cover malformed output, oversized/stalled bodies, cancellation, credential failures,
       ambiguous spend, replay and log redaction. Add bounded paid smoke tests only when explicitly
       enabled, separate from ordinary CI and the $25–35 infrastructure allowance.

## Delivery order and gates

1. Reuse existing identity and Anthropic transports. Add shared bounded execution/configuration
   controls, then the email/S3/ElevenLabs adapters required by 67/61. Test with deterministic
   fixtures.
2. Agree the content publication/download contract with 61 before S3 wiring; 88 supplies private
   resources and IAM. Keep authenticated URL issuance separate from resource downloads, and never
   forward API bearer credentials to an arbitrary manifest URL.
3. Production rendering still waits for Q-15; live AI waits for its feature's consent, budget and
   evaluation gates. Provider credentials or a passing transport test do not close those gates.

## Acceptance and delivery

Every registered integration passes its owning feature's tests. Transport tests cannot establish
native speech quality, tenant isolation, durable device sync or production readiness. No
audio/image-upload, cloud ASR, voice cloning, private-thread sync or learner-text telemetry path is
introduced. Native recordings, captured text and private chat threads retain their existing privacy
boundaries.

Deliver coherent requirement-tagged commits with `pnpm check` and applicable browser, integration or
device tests. Update runtime registration and inventory only after the implemented path passes.
