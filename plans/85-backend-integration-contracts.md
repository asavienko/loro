# Backend integration inventory and API contracts

- **Requirement IDs:** F-01, F-02, F-04, F-07, F-08, AI-01–AI-05, P3E-01–P3E-18
- **Status:** ✅ Implemented; contracts and inventory verified. Runtime service integration and
  product gates remain with their owning plans.
- **Depends on:** Existing Nest development seams; scoped contract extraction from plan 66.

## Outcome

Map all 23 authored learner screens and supporting services to shared runtime schemas, inferred
types, current and target OpenAPI documents, offline behavior and owning roadmap plans. Current API
behavior remains unchanged. Target contracts are not a deployed service promise.

## Work and commit sequence

1. Inventory and current wire schemas; catalog type ownership; HTTP conformance tests (F-04).
2. Target and gated draft schemas; OpenAPI generation and drift checks; schema tests (F-04).
3. Documentation reconciliation and final verified status (F-04).

Each coherent commit must pass `pnpm check` and `pnpm test:e2e`.

## Acceptance

- Every screen and supporting backend feature is mapped with sources, IDs, status and owner.
- All ten current routes have HTTP conformance coverage, including real WASM sync.
- Request, response and problem types derive from runtime schemas; generated specs are
  drift-checked.
- Drafts are explicit, carry decision gates and are absent from stable target exports.
- No audio upload, server practice dependency, fake measurement or private-thread sync is
  introduced.

## Boundaries

No server middleware/services, mobile networking, deployment, or product-gate decisions. Plan 66
retains persistence/security/production integration; 61, 67–71, 74, 76 and 82 retain their feature
implementation. Q-05, Q-07, Q-08/Q-12, Q-15, Q-16/Q-18–Q-20 remain unresolved.

## Delivered and verified (2026-09-06)

- All 23 screens and supporting functions are mapped in the backend integration inventory.
- Ten current routes have real-HTTP/WASM conformance coverage, including readiness failure.
- Stable target and explicitly gated draft schemas, inferred types, examples and two generated
  OpenAPI 3.1 documents exist; drift checks run before Turbo caching in `pnpm check`.
- Core schema tests cover sync/FSRS/privacy/AI/chat boundaries; content tests verify catalog
  compatibility and independently compile generated schemas with Ajv 2020-12.
- `pnpm check`: all 23 Turbo tasks passed plus the contract drift gate.
- `pnpm test:e2e`: initial 68-test suite passed; the expanded 83-test suite passed using the same
  suite/config on dedicated port 8187 after a shared 8082 server disappeared during a concurrent UI
  task. Only server port and output location were overridden; no tests were omitted.
- No controller behavior, mobile networking, database, native functionality or release gate was
  implemented or enabled. Concurrent mobile/UI edits were preserved.
