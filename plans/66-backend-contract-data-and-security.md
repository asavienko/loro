# Backend contracts, durable data, baseline security, and deployable image

- **Requirement IDs:** `F-01`, `F-02`, `F-04`, `F-07`, API security requirements
- **Milestone:** M2
- **Status:** 🟡 PostgreSQL accounts/sync, shared auth/sync validation, tenant isolation, durable
  cursors/receipts and dependency readiness are implemented. Full remaining boundary migration,
  load/security-image and operational acceptance remain; the recorded development deployment does
  not close full shared-service acceptance.
- **Depends on:** 54/85 completed; coordinates with 67 for principal identity and 86 for provider
  adapters; no native prerequisite.
- **Reviewed:** 2026-09-09 against checkout `42f4d57`; source/plan review only, no new device or
  deployment acceptance. Subsequent local content-contract validation on 2026-09-09 passed the
  shared schema/registry suite, registered HTTP contract tests, controller pair checks and
  core/API typechecks; image, load and operational gates remain open.

## Implemented scope

The runtime uses PostgreSQL repositories for accounts, device/session identity, sync rows, immutable
push receipts, cursor snapshots and server clocks. In-memory stores are isolated test adapters.
Auth/sync controllers and multilingual content queries consume shared schemas; the contract guide
records remaining current→target migration boundaries. Transactions serialize tenant writes and
protect replay, tombstone/catalog identity reconciliation and cursor consistency.

Real-Postgres tests cover authentication, refresh/replay and two-device tenant-scoped sync,
including HTTP controllers. Readiness checks real database/WASM dependencies. Request bounds,
exact-origin CORS, non-leaking problems and authenticated principals protect runtime requests.

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
       AI; shared tester access remains gated on the deployment/operational evidence in 88/91.

## Acceptance criteria

- API contracts have one runtime/type source and reject malformed data consistently.
- Postgres survives restart and concurrent pulls/pushes with no cross-user read path.
- Readiness reports actual dependencies; liveness does not flap on a recoverable dependency issue.
- The exact image built by CI boots non-root with the built WASM core and passes smoke/security
  scans.

## Delivery order and gates

1. Reconcile the registered routes with shared current contracts, then migrate remaining content
   boundaries with 61. Do not activate draft AI, account-management or trip contracts incidentally.
2. Keep exact-image/PostgreSQL tests local and isolated. Reuse `ci-api-image.sh`, the real database
   tests and existing tenant/session runtime; 88 owns deployed load/recovery evidence.
3. Coordinate lifecycle repositories with 67 and provider budgets with 86. Neither full account
   lifecycle nor a paid provider is required to finish the existing endpoint-validation slice.

## Out of scope

Sign-in UX/token issuance, mobile sync loop, live AI provider, billing, and production deployment.
