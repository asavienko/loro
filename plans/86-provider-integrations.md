# Shared provider adapters and integration verification

- **Requirement IDs:** `F-01`–`F-04`, `F-07`, `AS-01`–`AS-06`, `AI-01`–`AI-05`, `P3E-*`
- **Milestone:** M2/M3, phased testing
- **Status:** 🟡 Tested Anthropic transport and plan-85 contracts are merged. Common provider
  controls, remaining adapters and runtime wiring remain; each needs its owning feature slice and
  applicable product decision.
- **Depends on:** 85 completed; 66 backend seams; owning feature slices in 61/65/67/71/74/76/82; 88
  supplies testing infrastructure and 73 owns production operations.
- **Reviewed:** 2026-09-07 against merged contracts/transport in `2d9e8c3` and the agreed plan 88.

## Current evidence

`apps/api/src/integrations/anthropic/messages.ts` implements text-only structured requests,
mandatory result parsing, bounded bytes/deadlines, reported usage and sanitized failures without
automatic retries or redirects. Its deterministic/loopback tests exist. Nest still registers only
`StubSceneProvider`; the transport is not a live AI feature.

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
- TTS remains disabled in testing. Q-15 voice/licensing/quality evidence gates production rendering;
  no voice or vendor is selected merely by mentioning an adapter candidate.
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
2. [ ] Supply plan-67 identity verification and email adapters with deterministic signature,
       delivery and failure tests. Keep account state and token issuance in 67.
3. [ ] Supply plan-61 S3 upload/download and asset-integrity adapters with scoped permissions and
       expiry handling. Use local fixtures first; verify against private testing S3 when available.
4. [ ] Wire Anthropic only through plans 76/82 after their semantics, evaluations, identity, budget
       and fallback checks pass. Keep live chat disabled while Q-18/Q-20 remain open. Supply guarded
       text-only enrichment and translation transports when requested by plans 61/65.
5. [ ] Add licensed TTS, billing and privacy-safe diagnostics adapters only as their feature and
       decision gates pass; no recorded learner audio or voice-clone transport.
6. [ ] Cover malformed output, oversized/stalled bodies, cancellation, credential failures,
       ambiguous spend, replay and log redaction. Add bounded paid smoke tests only when explicitly
       enabled, separate from ordinary CI and the $25–35 infrastructure allowance.

## Acceptance and delivery

Every registered integration passes its owning feature's tests. Transport tests cannot establish
native speech quality, tenant isolation, durable device sync or production readiness. No
audio/image-upload, cloud ASR, voice cloning, private-thread sync or learner-text telemetry path is
introduced. Native recordings, captured text and private chat threads retain their existing privacy
boundaries.

Deliver coherent requirement-tagged commits with `pnpm check` and applicable browser, integration or
device tests. Update runtime registration and inventory only after the implemented path passes.
