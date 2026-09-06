# Backend contracts, durable data, baseline security, and deployable image

- **Requirement IDs:** `F-01`, `F-02`, `F-04`, `F-07`, API security requirements
- **Milestone:** M2
- **Status:** 🟡 Shared contracts/OpenAPI/HTTP compatibility delivered by plan 85. Nest boundary
  wiring, Postgres, production pagination/security and image work remain; production merge semantics
  require plan 54 policy parity, with identity supplied by plan 67.
- **Depends on:** 54 local merge-policy correctness for shared semantics; may proceed alongside
  native work

## Outcome

The API uses shared runtime wire schemas, durable Postgres repositories, user-ready pagination and
HLC semantics, safe defaults, and a reproducible image. It remains a sync/content/AI peer, never a
practice dependency.

## Work

1. **Contracts delivered in [85](85-backend-integration-contracts.md):** current/target/draft
   schemas, inferred types, OpenAPI and compatibility tests. Remaining: install shared validation at
   Nest boundaries and replace local wire interfaces after preserving current behavior. Batch routes
   validate envelopes then individual items; never reject unrelated ops wholesale.
2. Implement Postgres migrations/repositories for sync rows, accounts/devices, content versions,
   idempotency, and audit metadata; keep repositories injectable and test against real Postgres.
3. Implement deterministic `(hlc,id)` cursor pagination, limits, `has_more`, tombstones, idempotent
   pushes, and transactional server HLC without global-map assumptions.
4. Add request/body limits, CORS/headers, structured non-leaking problems, timeouts, baseline rate/
   budget interfaces, and fail-closed guard hooks. Plan 67 supplies identity.
5. Fix the production image/WASM artifact contract, `.dockerignore`, pinned local dependency
   profile, non-root runtime, health/readiness checks, SBOM/scan, and Testcontainers contract suite.
6. Add compatibility, migration, rollback, cursor, concurrency, malformed-input, injection, and 10×
   load tests.

## Acceptance criteria

- API contracts have one runtime/type source and reject malformed data consistently.
- Postgres survives restart and concurrent pulls/pushes with no cross-user read path.
- Readiness reports actual dependencies; liveness does not flap on a recoverable dependency issue.
- The exact image built by CI boots non-root with the built WASM core and passes smoke/security
  scans.

## Out of scope

Sign-in UX/token issuance, mobile sync loop, live AI provider, billing, and production deployment.
