# API hardening: input validation, rate limits, and the threat-model mitigations

- **Requirement IDs:** cross-cutting; the M4 security review and penetration test
- **Milestone:** M2 (the essentials) → M4 (the review)
- **Spec:** `docs/architecture/threat-model.md`, `docs/architecture/security-privacy.md`
- **Size:** M

## Current state

The API is small, which is the good news — a small surface is a defensible one.
`apps/api/src/main.ts` is 45 lines, there are four controllers, and error handling is deliberate:
`LoroError` + `problem-filter.ts` implements RFC 7807 problem responses with tests
(`errors.test.ts`, 81 lines).

The gaps, all verifiable in the current source:

### 1. No validation pipeline — wire types are casts

`sync.controller.ts` hand-declares `PushOp`/`PushBody`/`PullBody` as TypeScript interfaces (lines
21–35) and receives them via `@Body()`. TypeScript interfaces do not exist at runtime, so `body.ops`
could be anything. The controller does defend itself — `if (!Array.isArray(ops))` at line 60, the
`MAX_OPS` cap at line 61, and a per-field merge-class check at 78–90, with a comment that is exactly
right ("this is untrusted input: the guards below have to survive it being absent", line 17). But
that is per-endpoint hand-rolled validation, and the next endpoint will not have it.

Add a global `ValidationPipe` with schemas (Zod or class-validator) and put the wire types in
`@loro/core` so client and server share one definition
([sync-client-loop.md](15-sync-client-loop.md) §Risks).

### 2. No rate limiting anywhere

`app.module.ts` registers no guard or interceptor. The AI endpoints are the expensive ones —
`ai.service.ts:214` documents the intended pipeline as "rate limit → budget → cache → provider →
VALIDATE → fallback" and only the last two exist. `docs/architecture/threat-model.md` calls abuse of
the AI endpoints out specifically.

Needed: per-user limits (requires [auth](14-auth-anonymous-first.md)), a tighter anonymous bucket, a
global circuit breaker, and a hard cost ceiling that fails closed to the bundled fallback rather
than to an error.

### 3. No security headers, no CORS policy, no request size limit

Check `main.ts` against the basics: Helmet-equivalent headers, an explicit CORS allowlist (not `*`),
a body size limit (a 500-op push batch has a legitimate size; 50 MB does not), and request timeouts.

### 4. The sync endpoints are unauthenticated and unscoped

Covered in [fix-sync-pull-cursor-and-scoping.md](06-fix-sync-pull-cursor-and-scoping.md) — a
cross-tenant read today. Repeating it here because it is the highest-severity item in this plan and
should not be missed by someone reading only this file.

### 5. Error responses may leak

`problem-filter.ts` is the right pattern. Verify that an unexpected exception cannot serialise a
stack trace, a query, or learner content into the response in production, and that the same shape is
returned whether a resource is missing or forbidden where enumeration matters.

## The work

1. **Global validation pipe** with shared schemas; `whitelist: true` and `forbidNonWhitelisted` so
   unknown fields are rejected rather than passed through.
2. **Rate limiting and budgets**, per the AI pipeline order that is already documented. Fail closed
   to the fallback.
3. **Headers, CORS, body limits, timeouts.**
4. **Auth guard, fail-closed** with an explicit `@Public()` opt-out and a test enumerating every
   route ([auth-anonymous-first.md](14-auth-anonymous-first.md) §5).
5. **Secrets handling** — no secrets in logs, none in error responses, rotation documented in
   `docs/process/environments.md`.
6. **Dependency and container hygiene** — Dependabot is configured (`.github/dependabot.yml`); add
   `pnpm audit` to CI with a documented triage policy, and pin/scan the Docker base image
   (`apps/api/Dockerfile`).
7. **Prompt-injection defence** for the AI path: learner text is data, never instructions, and never
   echoed into a system prompt ([screen-roleplay-and-ai.md](26-screen-roleplay-and-ai.md) §4).
8. **Walk the threat model and check off each mitigation.** `threat-model.md` lists assets, actors,
   attack surface, and mitigations. Turn it into a checklist with a status per row — an unchecked
   mitigation in a doc reads as done.
9. **The M4 penetration test**, with the report's findings tracked to closure.

## Acceptance criteria

- Every endpoint validates its input against a runtime schema; unknown fields are rejected.
- Malformed, oversized, and adversarial payloads produce a problem response, never a 500 with a
  stack.
- Rate limits enforced per user and globally; the AI budget ceiling fails closed to the bundled
  scene.
- Security headers present; CORS is an explicit allowlist; body size and timeouts bounded.
- Every route is guarded or explicitly public, asserted by a test.
- No secret or learner content appears in any log or error response — verified by a fixture scan.
- `pnpm audit` runs in CI with a triage policy.
- Every threat-model mitigation has a status.
- Penetration-test findings are tracked and closed.

## Tests

- A malformed-input suite per endpoint: wrong types, missing fields, extra fields, huge arrays, deep
  nesting, unicode edge cases, prototype-pollution keys (`__proto__`, `constructor`).
- Rate-limit and budget enforcement tests.
- The route-guard enumeration test.
- Prompt-injection fixtures.
- A log-scan test asserting no secret patterns.

## Risks

- **Rate limiting anonymous users** is genuinely hard when the whole product is anonymous-first. Key
  on device id plus IP, accept that it is imperfect, and rely on the cost ceiling as the real
  backstop.
- **Over-tightening breaks offline clients** — a client returning from a week offline pushes a large
  batch legitimately. Size limits must accommodate `MAX_OPS` at realistic field sizes.

## Out of scope

SQLCipher for the local database (Q-09, deferred) and infrastructure hardening (`ops`-side).
