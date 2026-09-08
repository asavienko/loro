# Backend contracts, durable data, baseline security, and deployable image

- **Requirement IDs:** `F-01`, `F-02`, `F-04`, `F-07`, API security requirements
- **Milestone:** M2
- **Status:** 🟡 PostgreSQL accounts/sync, shared auth/sync validation, tenant isolation, durable
  cursors/receipts and dependency readiness are implemented. Full remaining boundary migration,
  load/security-image and operational acceptance remain; shared deployment needs explicit setup.
- **Depends on:** 54/85 completed; coordinates with 67 for principal identity and 86 for provider
  adapters; no native prerequisite.
- **Reviewed:** 2026-09-08 during plan-94 integration; release gates below remain explicit.

## Implemented scope

The runtime uses PostgreSQL repositories for accounts, device/session identity, sync rows, immutable
push receipts, cursor snapshots and server clocks. In-memory stores are isolated test adapters.
Auth/sync controllers consume shared schemas; the contract guide records remaining current→target
migration boundaries. Transactions serialize tenant writes and protect replay, tombstone/catalog
identity reconciliation and cursor consistency.

Real-Postgres tests cover authentication, refresh/replay and two-device tenant-scoped sync,
including HTTP controllers. Readiness checks real database/WASM dependencies. Request bounds,
exact-origin CORS, non-leaking problems and authenticated principals protect runtime requests.

Main's exact-image gate and restricted EC2/HTTPS preview tooling are retained. Merging durable
runtime code does not deploy it or complete plan 88's shared-service acceptance.

## Outcome

The API uses shared runtime wire schemas, durable Postgres repositories, user-ready pagination and
HLC semantics, safe defaults, and a reproducible image. It remains a sync/content/AI peer, never a
practice dependency.

## Remaining work

1. [ ] Finish documented current→target runtime validation for remaining endpoints while retaining
       compatibility and keeping draft contracts gated. Preserve per-item batch rejection.
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

## Out of scope

Sign-in UX/token issuance, mobile sync loop, live AI provider, billing, and production deployment.
