# Screen 7 — Roleplay, and wiring the AI provider

- **Requirement IDs:** `P3A-01`…`P3A-10`, `AI-01`, `AI-02`, `AI-05`
- **Milestone:** M3 (v1.1)
- **Blueprint:** `Loro.dc.html:847–949`, logic `ConvoLogic` `2911–2982`
- **Spec:** `docs/product/functional-spec.md#7-roleplay`
- **Screenshots:** `01-adv.png`, `f1.png`, `advanced-initial.png`
- **Size:** L
- **ADRs:** 0010 (LLM roleplay and guardrails)

## Current state — better than it looks

The backend half is genuinely well-shaped already. `apps/api/src/ai/ai.service.ts`:

- Two complete hand-authored scenes (Café, Hotel) that are **not placeholders** — the comment at
  line 34 is explicit that this is what an offline learner gets and what local dev uses.
- `validate()` (line 237) enforces the pedagogical invariants: exactly three options, **exactly one
  `best`**, every option has a tip of ≥10 characters, nothing over 12 words, no duplicate options.
  The comment names why: "one with two 'best' options would teach the wrong lesson."
- The documented pipeline order: rate limit → budget → cache → provider → **validate** → fallback
  (line 214).
- `AI_PROVIDER=stub` by default, degrading loudly rather than pretending (line 226).

What is missing: **the screen** (nothing in `apps/mobile/app/` renders a scene), the live provider,
and every step of the pipeline except validation and fallback.

## The principle to preserve

`ai.service.ts:5–7`: "AI is a garnish, never a dependency. Every learner-facing path has a BUNDLED
FALLBACK that is good, not merely non-broken — and the fallback is the local default, so it stays
exercised and can't silently rot."

That is a strong design and easy to erode. Concretely: the offline path must remain the default in
local development and in tests, so a broken provider is caught by the fallback being _worse_, not by
a 500.

## The work

### 1. The screen

Port `ConvoLogic.renderVals()` (`2911–2982`). An NPC turn, three options, the learner picks, a tip
explains why — with the "best" option teaching the idiomatic choice rather than merely the correct
one. `SceneOption.phrase_id` links options back to catalog phrases (already in the type), so a
learner can add a phrase they met in the scene straight to their stream. That link is the screen's
real payoff — build it.

### 2. Spoken replies (`P3A-05`-ish)

The blueprint has the learner _say_ the option, not tap it. That routes through the production gate
([screen-speak-to-progress.md](21-screen-speak-to-progress.md)) with tapping as the fallback. Reuse
the gate; do not build a second matcher.

### 3. The live provider

Behind `AI_PROVIDER`. Per `docs/architecture/ai-services.md`:

- **Rate limits** per user (needs [auth](14-auth-anonymous-first.md)) and a global cap.
- **A budget** with alerts. `AI-05` and M4's "AI cost controls" both want this; a per-user daily
  token ceiling plus a global monthly one, both enforced server-side.
- **Cache** on `(theme, scene template, model version)` so the same scene is not regenerated per
  learner. This is the largest cost lever by far.
- **Validate before serving** — already implemented; make sure the live path calls it and that a
  validation failure falls back rather than retrying forever. Log the failure reason (`best_count`,
  `too_long`, …) as a metric: a rising `best_count` rate is the signal that a prompt has drifted.
- **Prompts as versioned artefacts**, reviewable in a PR, with the model id pinned. A prompt change
  is a product change.

### 4. Guardrails (ADR-0010)

- Output is constrained to the scene schema; nothing free-form reaches the learner.
- Content safety: the scenes are travel service encounters; anything off-domain is rejected by
  validation rather than filtered by hope.
- **Prompt injection** via learner-authored phrases (Import/Capture) reaching a prompt: treat
  learner text as data, never as instructions, and never echo it into the system prompt.
- No learner audio or recordings ever reach the provider (non-negotiable #1) — the roleplay is text
  in, text out.

### 5. Coach notes (`AI-02`)

Same pipeline, same fallback discipline. A coach note that cannot be generated shows nothing rather
than a generic encouragement — a fabricated personal observation is worse than silence.

### 6. Cost and privacy telemetry

Tokens, cache hit rate, fallback rate, validation-failure reasons, latency.
`docs/architecture/observability.md` and ADR-0011 (analytics and privacy) — no learner content in
telemetry payloads.

## Acceptance criteria

- The Roleplay screen works fully offline on the bundled scenes, and that is the default in dev and
  CI.
- `AI_PROVIDER=stub` remains the local default; the fallback path is exercised by tests, not just
  present.
- With a live provider: scenes are validated before display, cached, rate-limited, and
  budget-capped.
- A provider outage or a validation failure is invisible to the learner beyond serving a bundled
  scene.
- Exactly one `best` option in every scene ever displayed — enforced, not assumed.
- Options link to catalog phrases and can be added to the stream in one tap.
- Spoken replies route through the existing production gate.
- Learner-authored text can never reach a system prompt.
- Cost telemetry exists before the provider is enabled in production.

## Tests

- `validate()` already needs a fuller suite: two `best`, zero `best`, 2 options, 4 options, 13-word
  option, 9-character tip, duplicate options — one case per rejection reason.
- Fallback tests: provider throws, times out, returns malformed JSON, returns a scene that fails
  validation. Each serves a bundled scene.
- Prompt-injection test with adversarial learner phrases.
- Budget/rate-limit enforcement tests.
- A cost-regression test asserting cache hits on repeat requests.

## Risks

- **Cost at scale.** Cache first, generate second. Uncached scene generation per learner per session
  does not survive 100k learners.
- **Quality drift** when a model version changes. Pin it, and treat an upgrade as a change that
  re-runs the validation corpus.

## Out of scope

Open-ended conversation (the Deploy finisher's speech evaluation, v2 — "the hardest thing in the
product") and phrase generation (`AI-03`, Capture).
