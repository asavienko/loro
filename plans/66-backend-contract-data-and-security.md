# Backend contracts, durable data, baseline security, and deployable image

- **Requirement IDs:** `F-01`, `F-02`, `F-04`, `F-07`, API security requirements
- **Milestone:** M2
- **Status:** Not started; Nest seams and WASM merge already exist
- **Depends on:** 54 local merge-policy correctness for shared semantics; may proceed alongside
  native work

## Outcome

The API uses shared runtime wire schemas, durable Postgres repositories, user-ready pagination and
HLC semantics, safe defaults, and a reproducible image. It remains a sync/content/AI peer, never a
practice dependency.

## Work

1. Put request/response/problem schemas in `@loro/core`, generate/infer types from them, and
   validate at the Nest boundary. Remove hand-cast wire contracts only after compatibility tests
   pass.
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
