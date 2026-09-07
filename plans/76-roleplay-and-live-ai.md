# Roleplay and guarded live AI

- **Requirement IDs:** `P3A-01`…`P3A-10`, `AI-01`, `AI-02`, `AI-03`, `AI-05`
- **Milestone:** M3
- **Status:** 🟡 Bundled scene validation/provider injection and an independent Anthropic transport
  exist. Guarded runtime orchestration, locale content, Roleplay and evaluation remain; integration
  needs 59/62/63/66/67 and provider controls from 86.
- **Depends on:** 59 persistence; 62/63 spoken states; 66 API/security; 67 identity/budgets; 71
  consent/flags; 86 provider controls.
- **Reviewed:** 2026-09-07 against merged baseline `2d9e8c3`.

## Verified starting point

`apps/api/src/ai/` serves validated bundled/stub scenes; `integrations/anthropic/messages.ts` is
tested but unregistered. The current scene stub rejects pairs other than en → es-ES. Reuse the
transport, add approved per-pair content and evaluation, and never describe transport tests as
language-quality proof.

## Outcome

Roleplay runs from a validated bundled scene offline and may enhance through a live provider with
strict schemas, prompt-injection boundaries, cost/rate limits, caching, evaluation, and graceful
fallback.

## Remaining work

1. [ ] Preserve bundled scenes as the reliable floor; version scene/schema/prompt/model provenance
       and validate all authored/runtime content.
2. [ ] Reuse plan 86's tested Anthropic transport; add the service-specific validated parser, scene
       fallback and prompt policy. Plan 86 supplies transport/common deadline, concurrency and
       atomic spend controls; coordinate 67's principal checks. Retries must account for ambiguous
       spend, and credentials stay server-side.
3. [ ] Separate trusted system/catalog context from learner input, bound lengths, reject unsupported
       tool/content instructions, and apply the documented safety taxonomy.
4. [ ] Build Roleplay text and spoken states, turn persistence/resume, corrective notes,
       unavailable/ timeout/budget/safety fallbacks, and offline bundled completion.
5. [ ] Create versioned per-target/native-pair content and evals for language quality, level fit,
       factual/context adherence, safety, injection resistance, latency, and cost; gate prompt/model
       changes.
6. [ ] Reuse the same guarded translation/enrichment seam for Capture only when plan 65 requests it.

## Acceptance criteria

- Roleplay is completable offline from bundled content.
- Live output reaches the app only after runtime schema/safety validation.
- Learner audio never reaches the provider; text retention/consent follows the privacy decision.
- Provider outage, timeout, invalid output, or budget exhaustion degrades to a usable state.

## Out of scope

Open-ended tutoring, voice cloning, autonomous tools, unbounded conversation history, and DSP.
