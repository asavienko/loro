# Guided open-chat domain and guarded conversation service

- **Requirement IDs:** `P3E-01`…`P3E-10`, `P3E-16`…`P3E-18`, `AI-05`, `F-03`, `F-04`, `AS-01`,
  `AS-02`
- **Milestone:** M3 / v1.1
- **Status:** 🟡 The bundled topic-graph schema and deterministic traversal exist in core; authored
  topic packs, local chat domain/persistence and coordinator remain. Duplicate suggestion IDs must
  be rejected before use (post-main B4). Offline content/eval work can start now. Q-19 gates
  retention, Q-18/Q-20 live traffic, and Q-16 release enablement.
- **Depends on:** 79/85 completed; 59 for device storage; 61 for content publication; 66/67/86 for
  live service; 68 only for the explicit kept-phrase sync boundary.
- **Reviewed:** 2026-09-07 against merged baseline `2d9e8c3`.

## Verified starting point

`packages/core/src/api/draft.ts` carries chat draft schemas. The shared
`packages/core/src/api/chat-topic.ts` validates bounded authored topic/reply graphs and advances
only through their declared edges; it creates neither turns nor text. No `ChatThread` repository,
authored topic pack, chat endpoint or coordinator exists. Plan 86's Anthropic transport is
unregistered. Start with offline content/evals, reuse compatible draft shapes, and promote wire
contracts only after the relevant decisions.

## Outcome

Open chat has a real, typed conversation domain and a guarded text provider with a useful bundled
offline floor. Threads, topics, pace, suggestions, translations, corrections, explanations,
alternatives, and keep/review handoffs have stable schemas. No prototype timer, regex, seeded score,
or browser speech API can masquerade as product behavior.

## Product and privacy boundary

`Loro Chat.dc.html` specifies free conversation by voice or text and demonstrates four topics,
natural versus slow/English pace, suggestions, line inspection, correction diffs, alternatives, word
glosses, and saved lines. Its `ChatLogic` is an executable view-model fixture, not a production
language engine: `fixFor()` matches a few regexes, `pushUser()` selects canned replies after 1.2s,
and `say()` uses browser speech synthesis.

Production keeps these invariants:

- recorded audio stays in native memory and only the on-device ASR transcript reaches JS;
- thread text is local/private by default, excluded from analytics and ordinary phrase sync;
- a live request sends only bounded text context after Q-18 and Q-20 authorize the provider budget
  and retention contract;
- every provider path has an authored topic graph and answer suggestions as an offline floor;
- saving a line is always an explicit learner tap and writes through the phrase repository/outbox.

## Remaining work

1. [ ] Define the missing local domain around the existing offline graph contract and review/reuse
       plan 85's gated draft request/result shapes, and promote wire contracts only after their
       decision gates. Define shared schemas for `ChatThread`, `ChatTurn`, `ChatTopic`, `ChatPace`,
       `ChatSuggestion`, `ChatCorrection`, `ChatAlternative`, `ChatGloss`, provider request/result,
       fallback provenance, safety outcome, and keep/review commands. Use opaque stable IDs; never
       derive identity from text length or a character code as the prototype does.
2. [ ] Define lifecycle and persistence: local thread metadata/turns, active draft, topic/pace,
       provider provenance, clear/start-over semantics, crash resume, retention expiry,
       export/erasure, and migrations. Keep ephemeral selection/sheets/toasts out of durable
       storage. Do not sync raw thread text; plan 79 excludes it from ordinary sync, so any future
       sync change requires a new explicit consent decision and merge contract.
3. [ ] Declare supported topic coverage per target/native pair; never silently use Spanish/English
       for another pair. Author versioned bundled topic packs with finite reply graphs, safe
       continuations, suggestions, native-language translations, respellings, explanations,
       alternatives, register labels, and word glosses. Validate packs in `@loro/content`; local
       development and offline mode use them by default.
4. [ ] Add a guarded `/v1/chat/turn` API contract behind anonymous/auth budgets. Bound context and
       turn count; separate trusted system/catalog/topic data from learner text; use structured
       output; validate target/native-language fields, lengths, tags, and enumerations; enforce
       timeout, retry, circuit-breaker, concurrency, rate, and cost limits.
5. [ ] Treat learner text as untrusted data, not instructions. Prevent prompt/tool injection, refuse
       disallowed content safely, avoid personal-data solicitation, redact logs, and store no
       provider transcript beyond the approved retention window. Recorded audio is structurally
       absent from the request type and endpoint.
6. [ ] Implement a conversation coordinator that selects live or bundled behavior, returns explicit
       provenance/degraded state, cancels stale turns, retries only idempotently, and resumes after
       app backgrounding or network loss. Provider failure must continue the topic without a fake
       “AI is typing” delay.
7. [ ] Implement language feedback as validated output with evidence/provenance. Do not port the
       four prototype regexes as if they were general correction. A failed/low-confidence correction
       is omitted; it never invents a rule. UI-facing counts derive from the returned correction
       array.
8. [ ] Define phrase handoff factories for original, corrected, and alternative lines. Preserve
       source attribution and register/note metadata, deduplicate through canonical phrase identity,
       and keep the `addPhrase` write explicit. Define queue-for-review semantics without mutating
       progress or schedules outside their owning repository/engine contract.
9. [ ] Build an evaluation corpus covering CEFR fit, Spain/LatAm policy, gender/profile agreement,
       correctness, explanation quality, register, suggestion usefulness, safety, prompt injection,
       long/empty/mixed-language input, latency, cost, fallback continuity, and schema failures.
       Define named thresholds with the provider evaluation gate before enabling live traffic.
10. [ ] Add observability using IDs, booleans, counts, timings, safety codes, fallback provenance,
        and budget state only. Static/runtime tests reject phrase text, thread text, translations,
        corrections, ASR transcripts, and audio fields in telemetry.

## Acceptance criteria

- With API/network disabled, every bundled topic can complete multiple coherent turns, expose
  suggestions/inspector data, and save a line; degradation is usable and clearly sourced.
- Live output reaches the app only after schema, safety, length, and budget validation. Invalid or
  late responses cannot overwrite a newer thread state.
- No API or JS type accepts audio bytes/paths/handles for chat, and network canaries prove the
  native capture module never initiates a request.
- Restart/start-over/expiry/export/erasure behavior is migration-tested against real SQLite.
- Corrections are never produced by the prototype regex fixture and no UI count is fabricated.
- Contract, repository, API integration, safety, fallback, eval, and telemetry-denylist tests pass.

## Commit sequence

1. [ ] `feat(core): define conversation and feedback contracts (P3E-01)`
2. [ ] `feat(content): add validated offline chat topic packs (AI-05)`
3. [ ] `feat(core): persist local chat threads and handoffs (P3E-16)`
4. [ ] `feat(api): add guarded chat turn service (P3E-17)`
5. [ ] `test(api): gate chat safety quality and privacy (P3E-18)`

## Out of scope

Rendering the chat screens, microphone/native ASR implementation, uploading audio, voice cloning,
unbounded memory, autonomous tools, social chat, teacher dashboards, and learner-text telemetry.

## Post-main review and archive disposition — 2026-09-09

The [review at `de81744`](../docs/reviews/2026-09-09-post-main-plan-review.md) records this plan's
current contribution, remaining work and gates.
[Delivered slices](archive/2026-09-09/IMPLEMENTED-SLICES.md) are retained in the archive; this plan
remains incomplete. Earlier verification is dated evidence, not acceptance of the current combined
branch.
