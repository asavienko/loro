# Roleplay and guarded live AI

- **Requirement IDs:** `P3A-01`…`P3A-10`, `AI-01`, `AI-02`, `AI-03`, `AI-05`
- **Milestone:** M3
- **Status:** Not started; bundled scene/provider seam already exists
- **Depends on:** 63 speech, 66 API contracts/security, 67 auth/budgets, 71 telemetry/flags

## Outcome

Roleplay runs from a validated bundled scene offline and may enhance through a live provider with
strict schemas, prompt-injection boundaries, cost/rate limits, caching, evaluation, and graceful
fallback.

## Work

1. Preserve bundled scenes as the reliable floor; version scene/schema/prompt/model provenance and
   validate all authored/runtime content.
2. Implement a live provider adapter with server-side credentials, timeouts, retries, circuit
   breaker, concurrency/rate/cost budgets, structured output, and redacted observability.
3. Separate trusted system/catalog context from learner input, bound lengths, reject unsupported
   tool/content instructions, and apply the documented safety taxonomy.
4. Build Roleplay text and spoken states, turn persistence/resume, corrective notes, unavailable/
   timeout/budget/safety fallbacks, and offline bundled completion.
5. Create a versioned eval corpus for Spanish quality, level fit, factual/context adherence, safety,
   injection resistance, latency, and cost; gate prompt/model changes.
6. Reuse the same guarded translation/enrichment seam for Capture only when plan 65 requests it.

## Acceptance criteria

- Roleplay is completable offline from bundled content.
- Live output reaches the app only after runtime schema/safety validation.
- Learner audio never reaches the provider; text retention/consent follows the privacy decision.
- Provider outage, timeout, invalid output, or budget exhaustion degrades to a usable state.

## Out of scope

Open-ended tutoring, voice cloning, autonomous tools, unbounded conversation history, and DSP.
