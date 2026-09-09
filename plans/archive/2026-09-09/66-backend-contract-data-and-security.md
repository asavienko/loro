# Backend contracts, durable data, baseline security, and deployable image

- **Requirement IDs:** `F-01`, `F-02`, `F-04`, `F-07`, API security requirements
- **Milestone:** M2
- **Status:** 🟡 PostgreSQL accounts/sync, shared auth/sync validation, tenant isolation, durable
  cursors/receipts and dependency readiness are implemented. Full remaining boundary migration,
  load/security-image and operational acceptance remain; the recorded development deployment does
  not close full shared-service acceptance.
- **Depends on:** 54/85 completed; coordinates with 67 for principal identity and 86 for provider
  adapters; no native prerequisite.
- **Reviewed:** 2026-09-09 against `aafa61f`; current source, tests and retained review records
  inspected. This plan refresh supplies no new runtime, device or deployment acceptance.
- **Priority:** 4; content boundaries with 61/86; acceptance alongside priority 9.

**Archive disposition (2026-09-09):** Archived at user request after implemented slices landed. The
partial status and remaining acceptance criteria are retained; archival does not mark this plan
complete. The roadmap index continues to track its unfinished scope.

## Implemented scope

The runtime uses PostgreSQL repositories for accounts, device/session identity, sync rows, immutable
push receipts, cursor snapshots and server clocks. In-memory stores are isolated test adapters.
Auth/sync controllers and multilingual content queries consume shared schemas; the contract guide
records remaining current→target migration boundaries. Transactions serialize tenant writes and
protect replay, tombstone/catalog identity reconciliation and cursor consistency.

Real-Postgres tests cover authentication, refresh/replay and two-device tenant-scoped sync,
including HTTP controllers. Readiness checks real database/WASM dependencies. Request bounds,
exact-origin CORS, non-leaking problems and authenticated principals protect runtime requests.

The 2026-09-09 content-contract delivery recorded passing shared schema/registry, registered HTTP
contract and controller-pair tests plus core/API typechecks. These retained results do not close
image, load or operational acceptance.

Main's exact-image gate and restricted EC2/HTTPS preview tooling are retained. The 2026-09-08
account-release record in `docs/process/ec2-deployment.md` reports a deployed durable image,
isolated restore and guarded Google development access. Reverify the deployed artifact before
changes; this historical evidence does not close plan 88's full shared-service acceptance.

## Outcome

The API uses shared runtime wire schemas, durable Postgres repositories, user-ready pagination and
HLC semantics, safe defaults, and a reproducible image. It remains a sync/content/AI peer, never a
practice dependency.

## Remaining work

1. [ ] Finish documented current→target runtime validation for remaining endpoints while retaining
       compatibility and keeping draft contracts gated. The three implemented `/v1/content/v2/*`
       learning-catalog routes are now registered with shared request/response schemas (28 current
       operations); scalar query, language-pair and version validation is enforced with HTTP
       regression coverage. Legacy content and AI boundaries remain. Preserve per-item batch
       rejection.
2. [ ] Complete content-version/audit/retention repositories as their owning features need them;
       exercise migrations, backup restore and rollback with the new durable runtime.
3. [ ] Verify the exact production image with configured PostgreSQL/auth, non-root/WASM readiness,
       dependency/security scans and isolated HTTP smoke before deployment.
4. [ ] Expand malformed-input, concurrency, injection and 10× load/security testing. Authentication
       and tenant tests do not establish the performance or full production-security budget.
5. [ ] Complete principal-scoped live-provider budgets/timeouts with plan 86 before activating live
       AI; shared tester access remains gated on the deployment/operational evidence in 88/91. When
       86's ElevenLabs adapter exists, host draft `POST /tts/render` (metadata + authorized download
       URL, never learner PCM) using plan 61 identity rules. Listening-class voice ids are a plan 97
       consumer; Q-15 still gates live rendering.

## Acceptance criteria

- API contracts have one runtime/type source and reject malformed data consistently.
- Postgres survives restart and concurrent pulls/pushes with no cross-user read path.
- Readiness reports actual dependencies; liveness does not flap on a recoverable dependency issue.
- The exact image built by CI boots non-root with the built WASM core and passes smoke/security
  scans.

## Delivery order and gates

1. Complete the plan-61 publication/download wire boundary first, preserving legacy content
   compatibility and the implemented v2 query validation. Derive request/response parsing and
   generated OpenAPI from shared schemas; prove rejected locale/version/manifest inputs fail before
   publication or activation. Migrate unrelated legacy/AI endpoints in later owner-specific changes;
   do not activate draft AI, account-management or trip contracts incidentally.
2. Keep exact-image/PostgreSQL tests local and isolated. Reuse `ci-api-image.sh`, the real database
   tests and existing tenant/session runtime; 88 owns deployed load/recovery evidence. Retain the
   tested image digest, schema version and report together. A historical passing local gate or
   readiness response is not a fresh security scan, load result or deployed-image identity.
3. Coordinate lifecycle repositories with 67 and provider budgets with 86. Neither full account
   lifecycle nor a paid provider is required to finish the existing endpoint-validation slice.

## Out of scope

Sign-in UX/token issuance, mobile sync loop, live AI provider, billing, and production deployment.

## Post-main review and archive disposition — 2026-09-09

The [review at `de81744`](../../../docs/reviews/2026-09-09-post-main-plan-review.md) records this
plan's current contribution, remaining work and gates. [Delivered slices](IMPLEMENTED-SLICES.md) are
retained in the archive; this plan remains incomplete. Earlier verification is dated evidence, not
acceptance of the current combined branch.
