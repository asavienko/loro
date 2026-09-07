# Shared provider adapters and integration verification

- **Requirement IDs:** `F-01`…`F-04`, `F-07`, `AS-01`…`AS-06`, `AI-01`…`AI-05`, `P3E-*`
- **Milestone:** M2/M3, phased beta
- **Status:** 🟡 Anthropic transport is implemented and the plan-85 contract handoff is merged.
  Shared provider controls and remaining vendor adapters are to do; each runtime integration needs
  its owning feature. Q-15, Q-08/Q-12 and Q-18/Q-20 gate their respective production uses, not all
  adapter work.
- **Depends on:** 85 completed; 66 backend seams; 61/67/71/73/74/76/82 for the relevant provider
  slice.
- **Reviewed:** 2026-09-07 against merged baseline `2d9e8c3`.

## Verified starting point and superseded restrictions

Merged commit `2d9e8c3` contains plan 85's schemas, OpenAPI, migration guide and integration
inventory together with `apps/api/src/integrations/anthropic/messages.ts`. The transport provides
text-only structured requests, mandatory result parsing, bounded bytes/deadlines, reported usage,
sanitized failures and no automatic retries/redirects. Its deterministic/loopback tests are present;
`app.module.ts` still registers only StubSceneProvider.

The earlier isolated-worktree restriction and “wait until plan 85 merges” instructions were specific
to the pre-merge parallel tasks. They are superseded by this review. Use normal repository branches
and coherent requirement-tagged commits; no hardcoded external worktree or defunct task is a gate.
Keep test databases, ports and vendor resources isolated from other work.

## Ownership

This plan owns vendor transports, common provider execution controls and adapter-level verification.
It does not reimplement feature plans:

| Owner        | Product/runtime integration                                                             |
| ------------ | --------------------------------------------------------------------------------------- |
| 66           | Nest validation, Postgres, tenant cursors, server HLC, HTTP foundation, exact API image |
| 67 / 68      | Identity/account lifecycle / device sync and convergence                                |
| 61 / 62 / 63 | Catalog publication / native playback / on-device recognition                           |
| 71 / 73      | Consent/events/flags / deployment, diagnostics, recovery and SLOs                       |
| 74           | Approved purchases and offline entitlement policy                                       |
| 76 / 82      | Roleplay / chat schemas, prompts, safety, evals and bundled coordinators                |

Consume current/target schemas from completed 85. Drafts stay gated. Missing contract changes land
as explicit reviewed contract changes before runtime consumers, never duplicate provider-local API
types. Target/native language identity must flow through cache keys, asset selection and provider
requests; unsupported pairs get the owning feature's honest fallback.

## Remaining work

1. [ ] Review the delivered inventory/migration guide per integration slice and select its stable
       request/result parser. Preserve current HTTP compatibility until the owning migration lands.
2. [ ] Supply shared server-side execution controls: credential/config validation, deadlines,
       concurrency, atomic spend reservation/reconciliation, rate limits, circuit breaking and
       redacted metadata. Account for ambiguous charges on timeouts; do not retry merely because a
       result is absent. Plan 67 supplies principals; 76/82 supply semantic safety and fallback
       decisions.
3. [ ] Add approved identity verification and email transports for 67, including token/signature
       validation, sender/bounce lifecycle and deterministic failure tests. Account state stays
       in 67.
4. [ ] Add catalog storage/CDN and licensed TTS adapters for 61 after the relevant decisions.
       Require immutable hashes, target/voice/version identity and scoped asset access. Q-15
       approves production rendering; local architecture and test fixtures can proceed without
       vendor credentials.
5. [ ] Integrate Anthropic through 76/82 only after their parser, identity, budget, retention,
       evaluation and bundled fallback contracts pass. Add guarded text-only enrichment/translation
       transport as requested by 61/65; keep live chat disabled while Q-18/Q-20 are open.
6. [ ] Add telemetry/crash transports for 71/73 with pre-egress allowlists and approved regional
       storage; disable free text, transcripts, recordings, replay and screenshots by default.
7. [ ] Add the selected billing/webhook verification adapter only after Q-08/Q-12; 74 owns products,
       reconciliation and offline grace. Supply infrastructure/provider health checks and bounded
       staging smoke evidence to 73, which owns provisioning and promotion.

## Vendor decision inputs

For the shared testing environment, [plan 88](88-low-cost-backend-infrastructure.md) is the approved
owner and selects AWS EC2/PostgreSQL/private S3 in Frankfurt. It supersedes the earlier Render/R2
testing recommendation. Consume its infrastructure outputs; 61/86 still own content adapters and
authenticated URL issuance. Production vendor choices remain separate.

The earlier plan proposed Render (API/Postgres/jobs), Cloudflare R2/CDN, Apple/Google verification,
Amazon SES, Polly, Anthropic, RevenueCat and Sentry EU/OTel. These remain research candidates, not
provisioned infrastructure or approved pricing/retention/voice choices. Re-verify official support,
regions, cost, language/voice coverage and data terms when choosing a slice. There is no new vendor
selection or spending authorization in this documentation refresh. Local development stays stubbed.

## Acceptance and delivery

- Adapter tests cover malformed output, stalled/oversized bodies, cancellation, budget races,
  ambiguous spend, replay/order and redaction, using isolated local resources.
- Each registered integration passes the owning feature's real database/device/fallback tests;
  transport tests alone cannot establish language quality, native correctness or deployment.
- No audio/image-upload, cloud ASR, voice cloning, private-thread sync or learner-text telemetry
  path is introduced. PCM remains native; secrets remain server-side.
- Paid provider checks are bounded staging smoke tests, separate from ordinary CI.
- Deliver one coherent adapter/control slice per commit/PR with `pnpm check` and applicable browser,
  contract, integration and device checks. Record actual runtime registration in the inventory.
