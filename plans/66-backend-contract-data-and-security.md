# Backend contracts, durable data, baseline security, and deployable image

- **Requirement IDs:** `F-01`, `F-02`, `F-04`, `F-07`, API security requirements
- **Milestone:** M2
- **Status:** 🟡 Shared API schemas/OpenAPI and HTTP compatibility exist. Nest validation, durable
  Postgres, tenant cursors, security and image proof remain; foundation work can start now,
  authenticated principal integration belongs to 67.
- **Depends on:** 54/85 completed; coordinates with 67 for principal identity and 86 for provider
  adapters; no native prerequisite.
- **Reviewed:** 2026-09-07 against merged baseline `2d9e8c3`.

## Verified starting point

`apps/api/src/app.module.ts` still injects InMemorySyncRepository and StubSceneProvider.
Current/target/draft schemas and 13 current routes exist; these are not installed as Nest boundary
validation. Docker has a non-root skeleton and expects prebuilt WASM, but no exact-image deployment
proof. The later `5f4fb76` environment commit supplies SOPS/age tooling and `.dockerignore`; these
do not establish a deployed API or durable store. Plan 88 owns the selected AWS testing environment
and consumes this plan's image/data/security slices. Own server pagination here; 68 consumes it
rather than implementing it twice.

## Outcome

The API uses shared runtime wire schemas, durable Postgres repositories, user-ready pagination and
HLC semantics, safe defaults, and a reproducible image. It remains a sync/content/AI peer, never a
practice dependency.

## Remaining work

1. [ ] Install plan 85's delivered shared schemas at Nest boundaries and replace local wire
       interfaces, preserving the current 13-route contract including learning-content endpoints.
       Follow the documented current→target migration; draft exports stay gated. Batch routes
       validate envelopes then individual items; never reject unrelated ops wholesale.
2. [ ] Implement Postgres migrations/repositories for sync rows, accounts/devices, content versions,
       idempotency, and audit metadata; keep repositories injectable and test against real Postgres.
3. [ ] Implement deterministic `(hlc,id)` cursor pagination, limits, `has_more`, tombstones,
       idempotent pushes, and transactional server HLC without global-map assumptions.
4. [ ] Add request/body limits, CORS/headers, structured non-leaking problems, timeouts, baseline
       rate/ budget interfaces, and fail-closed guard hooks. Plan 67 supplies identity.
5. [ ] Prove and complete the existing non-root production image/WASM artifact contract,
       `.dockerignore`, pinned local dependency profile, non-root runtime, health/readiness checks,
       SBOM/scan, and Testcontainers contract suite.
6. [ ] Add compatibility, migration, rollback, cursor, concurrency, malformed-input, injection, and
       10× load tests.

## Acceptance criteria

- API contracts have one runtime/type source and reject malformed data consistently.
- Postgres survives restart and concurrent pulls/pushes with no cross-user read path.
- Readiness reports actual dependencies; liveness does not flap on a recoverable dependency issue.
- The exact image built by CI boots non-root with the built WASM core and passes smoke/security
  scans.

## Out of scope

Sign-in UX/token issuance, mobile sync loop, live AI provider, billing, and production deployment.
