# Observability: crash reporting, metrics, and learning-quality telemetry

- **Requirement IDs:** `F-09`, and the measurement behind Q-01, Q-03, Q-05
- **Milestone:** M0 leftover → M2
- **Spec:** `docs/architecture/observability.md`, `docs/product/metrics.md`
- **ADRs:** 0011 (analytics and privacy)
- **Size:** M–L

## Current state

Two M0 deliverables are explicitly unmet (`docs/product/roadmap.md`, "Where we actually are"): the
API is not deployed to a `dev` environment, and **crash reporting is not wired to a dashboard** —
the M0 exit criterion was "a deliberate crash appears in the dashboard".

There is no analytics client, no metrics emission, and no traces. `apps/api/src/main.ts` logs to the
console. So today: a crash in a dogfooding session is invisible, and every learning-quality question
in `docs/decisions/open-questions.md` is unanswerable.

## Why this blocks product decisions, not just operations

Three of the open questions are measurement questions, and none of them can be retro-fitted:

- **Q-01** (is 6 reps right?) needs latency-plateau data across a rep sequence.
- **Q-03** (does declared difficulty stay accurate?) needs tag predictiveness — AUC of declared
  difficulty predicting recall failure, target ≥0.65
  (`docs/architecture/observability.md#learning-quality-telemetry`). It is called the most important
  open question in the product.
- **Q-05** (who owns the loop decision) **blocks M3 start** specifically because "the common cold
  probe has to be instrumented before the arms are live — you cannot retro-fit the measure onto an
  experiment already running."

So the instrumentation is on the critical path for M3, not a follow-up.

## The privacy constraint shapes the design

ADR-0011 and the non-negotiables: recorded audio never leaves the device. Extending that honestly:

- **No learner content in telemetry.** No phrase text, no transcripts, no notes, no audio, no
  derived features that could reconstruct them. Event payloads carry ids and enums.
- **Phrase ids are catalog ids, not user rows** — a catalog id is content, a user row id is
  personal.
- **Opt-in vs opt-out** must match what the privacy policy and store privacy manifest say. Decide
  once, document it, and make the code match the manifest — a mismatch is a store rejection and a
  trust problem.
- A **payload allowlist** enforced in code: the event emitter accepts only declared fields per event
  type, so adding learner content requires editing a schema that a reviewer sees.

## The work

### 1. Crash reporting, first and cheaply

Sentry (or equivalent) on mobile and API, with source maps / debug symbols uploaded from CI so a
stack trace is readable. Scrub PII in the `beforeSend` hook. Then do the M0 exit test: ship a
deliberate crash behind a debug action and confirm it lands in the dashboard, symbolised.

### 2. The event taxonomy, typed

`docs/product/metrics.md` has the taxonomy. Implement it as a **discriminated union in
`@loro/core`** so both apps emit the same events with the same fields and a typo is a compile error.
One emitter, one queue, offline-buffered (events must survive an offline week like everything else),
batched.

### 3. The funnel and guardrails

`metrics.md` defines the north star, the funnel, and guardrail metrics. M2 exit criteria require
**every guardrail metric instrumented and reading** — so this is release-blocking, and
"instrumented" means a dashboard someone looks at, not an event that exists.

### 4. Learning-quality telemetry

The distinctive part, and the reason this plan is not boilerplate:

- Latency samples per rep index (from [fix-latency-measurement.md](03-fix-latency-measurement.md))
  so a plateau is visible.
- Declared difficulty and tags alongside every review outcome, so tag predictiveness is computable.
- The cold probe for the loop experiment (Q-02/Q-05), instrumented **before** any arm goes live.
- Engine switches with from/to/when
  ([settings-and-engine-switching.md](29-settings-and-engine-switching.md)).
- Score distributions from the labs, so "a wrong score is worse than no score" is monitorable in the
  field rather than only in the release gate.

### 5. API observability

Structured logs with a request id, traces on the sync and AI paths (the two that will surprise you),
metrics for sync conflicts by `(entity, field, mergeClass)`, AI cost and cache-hit rate, and outbox
depth reported by clients. SLOs and alerting are M4 (`docs/process/incident-response.md` has the
runbook shape) but the signals must exist before the SLO can.

### 6. A debug surface on device

Event log, last N crashes, sync diagnostics, flag overrides. Dogfooding "starts here and never
stops" (M1 exit criteria), and a dogfooder who cannot see what the app just did files unusable bug
reports.

## Acceptance criteria

- A deliberate crash appears symbolised in the dashboard from both mobile and API — the M0
  criterion, finally closed.
- Every event in `metrics.md` is emitted from typed code; an undeclared field fails to compile.
- No event payload can carry learner content; enforced by an allowlist and a test that scans emitted
  fixtures for text fields.
- Events survive a week offline and flush in order.
- Every guardrail metric has a dashboard and a reading.
- Tag predictiveness (Q-03) is computable from shipped data.
- The cold probe is instrumented before any loop experiment arm is enabled.
- Consent state matches the store privacy manifest, verified as part of the release checklist.

## Tests

- Payload-scrubbing test: construct an event with every field populated, assert no learner text
  present.
- Offline buffering: 1 000 events, no network, then flush; ordering and no loss.
- A schema test that the emitted taxonomy matches `metrics.md` (parse the doc's table if it is
  machine-readable; otherwise a checked-in list reviewed together with it).

## Risks

- **Instrumenting late** is the default failure. Every screen plan should list its events; a screen
  that ships uninstrumented is a screen whose effect is unknowable.
- **Vendor lock-in and cost** at 100k learners. Keep the emitter behind an interface so the sink is
  replaceable.

## Out of scope

SLOs, alert routing, and on-call rotation — M4 and `docs/process/incident-response.md`.
