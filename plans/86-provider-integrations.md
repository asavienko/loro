# Backend and provider integrations

- **Requirement IDs:** `F-01`–`F-04`, `F-07`, `AS-01`–`AS-06`, `AI-01`–`AI-05`, `P3E-*`;
  monetization Q-08/Q-12
- **Milestone:** M2/M3, phased low-cost beta
- **Status:** 🟡 Independent Anthropic transport implemented with tests; not registered in the
  runtime. Remaining adapters, backend/mobile wiring and deployment are blocked by the
  merged/verified plan-85 handoff and the listed feature/product gates.
- **Depends on:** plan 85 Backend integration inventory and API contracts; owning feature plans 59,
  61–63, 65–68, 71, 73–74, 76, 82–83 as applicable

## Outcome and ownership

Implement the backend services, provider adapters, and mobile connections described by plan 85
without duplicating its schemas or interfering with the task **Define backend API contracts**.

Plan 85 owns wire definitions, current/target/draft exports, the operation registry, generated
OpenAPI, contract-generation tooling and conformance tests, shared catalog wire definitions, the
functionality inventory, and the contract migration table. Feature plans own product behavior. This
plan coordinates provider selection, adapters, runtime wiring, and integration verification.

## Mandatory isolation and handoff

1. Work only in `/Users/antonsavienko/Projects/loro-provider-integrations`, on
   `codex/f-04-provider-integrations`, with a separate PR. The worktree initially started at
   `00b1945`; the isolated provider commit was then rebased onto main `5ee247f` to exclude unrelated
   unmerged UI commits from its PR. It excludes the contract task's uncommitted work. Do not
   implement this plan in `/Users/antonsavienko/Projects/loro` or switch, stage, stash, reset,
   format, install dependencies, or run generators in that checkout.
2. Until plan 85 is merged, do not modify its owned surfaces: `packages/core/src/api/`, its
   export/package configuration, shared catalog wire definitions, OpenAPI output/generators,
   contract tests, the backend integration inventory, or contract/API documentation. Do not copy
   in-progress files from the other checkout or create substitute request/response types.
3. Independent work may add provider-local adapters and tests in new integration-specific files,
   using provider SDK types and provider-local results only. It must not create alternate app-facing
   API contracts or change existing controllers, composition roots, shared manifests, lockfiles, CI,
   or common configuration before handoff. If useful work needs one of those changes, queue it for
   after handoff.
4. Use isolated test resources: separate database/schema, Redis key prefix, object-store
   bucket/prefix, ports, and environment files. Never run reset/seed/migration commands against
   another task's resources. Do not run Docker teardown, kill processes, or mutate cloud services
   owned by the other task.
5. Handoff requires a merged plan-85 commit, its verification results, and review of the delivered
   inventory, stable exports, and migration table. Bring the merged base into this branch without
   taking files from an active checkout. Record the consumed commit in this plan before runtime
   integration starts.
6. Consume stable target contracts; drafts do not become production interfaces by import. A missing
   or conflicting contract is a separate, narrowly scoped contract follow-up, merged before
   dependent runtime work. Do not silently change contracts inside a provider PR.
7. Reconcile this plan's roadmap row only after bringing in plan 85, preserving its row and status.
   Shared documentation and status updates happen after handoff and must reflect implemented
   behavior only. Never edit or renumber plan 85.

Physical separation prevents checkout interference; contract ownership and the merge gate prevent
divergent implementations. This is a downstream plan, not a promise that contract-dependent features
can finish before their contracts exist.

## Provider defaults

| Concern          | Recommended default                                                | Gate / boundary                                                               |
| ---------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| API and database | Small paid Render Docker service and Postgres in Frankfurt         | Durable beta storage; production recovery/availability remains plan 73        |
| Cache and jobs   | Render Key Value and BullMQ worker                                 | Durable jobs; worker added when needed                                        |
| Assets           | Cloudflare R2 EU jurisdiction and CDN for public catalog assets    | Private learner assets excluded from public caching                           |
| Identity         | Apple/Google verification; Loro access and rotating refresh tokens | Optional sign-in; verified ownership for claim/link                           |
| Email            | Amazon SES in Ireland                                              | Verified sender, production access, bounce handling                           |
| TTS              | Amazon Polly neural es-ES; Lucia evaluation candidate              | Q-15 licensing, voice quality, and content review before production rendering |
| Text AI          | Anthropic Claude server adapters                                   | Evaluated pinned models, bounded spend and approved retention                 |
| Billing          | RevenueCat                                                         | Q-08 pricing and Q-12 mechanism remain open                                   |
| Diagnostics      | Sentry EU; OpenTelemetry instrumentation                           | Pre-egress allowlists; no recordings, free text, replay, or screenshots       |

These are recommendations, not provisioned services or resolved product decisions. Price the
selected resource sizes before provisioning. Local development remains stubbed and credential-free.
Keep provider secrets server-side and out of public mobile environment variables.

## Implementation sequence after contract handoff

1. **Foundation — 66/73:** consume shared schemas in runtime validation and a typed data-layer
   mobile HTTP client; implement Postgres repositories, transactional HLC, tenant scope,
   idempotency, limits, redaction, and readiness. Follow the delivered migration table for clocks,
   identity fields, pagination, pack paths, responses, and status codes. Preserve current contracts
   until explicit migration.
2. **Identity/account/sync — 59/67/68:** verified sign-in and magic links, rotating sessions with
   secure native storage, authenticated claim, mobile outbox push/pull, device
   management/revocation, asynchronous export creation/status/download, and deletion lifecycle.
   Retain local progress through interrupted claim, account switch, and prolonged offline use.
3. **Content/audio — 61–63:** immutable checksummed assets, signed versioned manifests,
   full-download recovery, atomic activation and rollback; approved TTS seed batch before bulk
   rendering; text-only idempotent TTS with scoped private assets and budgets. Preserve offline
   playback, native TTS, on-device ASR/DSP, and reveal fallback.
4. **AI/chat/support — 65/71/76/82/83:** staff-only enrichment first, then typed
   roleplay/coaching/translation adapters; deadlines, concurrency and atomic spend reservations,
   schema/safety checks and bundled fallback. JSON first, structured streaming later according to
   the contract, never unvalidated provider text. Chat remains gated by Q-16/Q-18–Q-20. Remote
   configuration remains draft-only until its contract and experiment decisions pass. Analytics is
   consent-controlled and allowlisted.
5. **Billing/release — 73/74:** purchase verification, entitlement refresh/restore, authenticated
   and deduplicated webhook processing, authoritative reconciliation and approved offline grace. Add
   secrets/rotation inventory, quotas, ownership, deletion procedures, staging smoke tests, backup
   restoration and rollback runbooks.

Scheduling, practice outcomes, scoring, OCR, reminders, and widgets remain local under their owning
plans. No cloud ASR, audio-upload, image-upload, voice-cloning, maps, or v1 push API is added by
this plan. Practice writes still use the engine/applyDelta boundary.

## Verification and delivery

- Reuse plan 85's schema, compatibility, OpenAPI, and drift checks; do not rebuild them here.
- Add meaningful adapter and real Postgres/SQLite integration tests for tenant isolation, restart,
  cursor/tombstone behavior, duplicate operations, interrupted claim, offline convergence,
  revocation, export and deletion.
- Cover corrupted assets, provider timeout/invalid output, budget races, prompt injection, fallback
  continuity, webhook replay/order, restore/refund, and offline entitlement grace.
- Prove that native recorded audio cannot egress and telemetry excludes text, transcripts, tokens,
  receipts, and recordings. Keep raw chat history outside ordinary sync.
- Paid live-provider checks are bounded staging smoke tests, never ordinary CI. Browser checks
  cannot establish native speech, secure storage, or offline-device correctness.
- Run Node 22 with Cargo on PATH, `pnpm check`, applicable E2E and native-device checks before
  implementation commits. Every new learner-visible state gets its E2E manifest row.
- Deliver coherent requirement-tagged commits and a separate PR per coherent integration slice.
  Update the inventory/feature status after handoff only when actual runtime behavior passes.

## Implementation evidence and remaining work

- **Contract handoff:** not consumed. The contract task remains active; a partial commit is not the
  merged/verified handoff.
- **Independent implementation:** `apps/api/src/integrations/anthropic/messages.ts` implements
  text-only structured HTTP requests, mandatory parsing, provider-reported token usage, bounded
  bytes/deadline, sanitized failure codes and no automatic retries/redirects. It is not registered
  with Nest.
- **Adapter verification:** 22 deterministic tests, including malformed UTF-8 rejection and a real
  loopback HTTP body-stall timeout. No live credentials, paid requests or learner data were used.
- **Repository verification:** `pnpm check` passes all 23 tasks. The rebased main baseline passes
  all 62 browser E2E tests via a temporary configuration using dedicated port 8186 and
  `reuseExistingServer: false`; the temporary file was removed. The original UI-containing baseline
  also passed 68 tests before the rebase. These establish compatibility, not completed production
  integrations.
- **Formatting gate:** all five files in this PR pass Prettier. Repository-wide `format:check`
  reports 158 pre-existing failures, verified by checking each flagged file's `origin/main` content
  with the same formatter configuration. Do not rewrite authored artifacts or unrelated files here.
- **Foundation and mobile client:** not implemented; wait for handoff, then plan 66 and
  device-persistence dependencies.
- **Identity/account/sync:** not implemented; needs stable contracts, durable data and device
  persistence.
- **Content/TTS/native integration:** not implemented; SDK dependencies and wiring wait for handoff;
  Q-15 remains open for production audio.
- **Guarded AI/chat:** transport only. Budget store, identity, validation/safety integration,
  evaluation corpus and fallback coordinator are still missing. Chat gates remain open.
- **Billing/analytics/deployment:** not implemented. Q-08/Q-12, consent implementation, resource
  sizing, credentials and release verification remain outstanding.
- **Next action:** verify merged plan 85 and consume its exact commit. Until then, do not relax file
  ownership to make more runtime progress. Other vendor adapters requiring new SDK dependencies wait
  for the permitted manifest/lockfile handoff.

## Provider references

- [Render regions](https://render.com/docs/regions),
  [free-tier limitations](https://render.com/docs/free),
  [background workers](https://render.com/docs/background-workers)
- [R2 jurisdiction controls](https://developers.cloudflare.com/r2/reference/data-location/)
- [Apple sign-in](https://developer.apple.com/documentation/signinwithapple/authenticating-users-with-sign-in-with-apple),
  [Google backend verification](https://developers.google.com/identity/sign-in/web/backend-auth)
- [SES regions](https://docs.aws.amazon.com/ses/latest/dg/regions.html),
  [Polly neural voices](https://docs.aws.amazon.com/polly/latest/dg/neural-voices.html)
- [Claude structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs),
  [retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention)
- [RevenueCat webhooks](https://www.revenuecat.com/docs/integrations/webhooks),
  [Sentry EU storage](https://sentry.io/changelog/data-storage-location-in-germany-is-generally-available/)
