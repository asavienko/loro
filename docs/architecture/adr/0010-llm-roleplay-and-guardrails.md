# 0010 · Use guarded text generation with a bundled fallback on every learner-facing path

- **Status:** Accepted
- **Date:** 2026-07-28
- **Deciders:** Product, tech lead, content lead
- **Amended:** 2026-07-30 to register the authored open-chat surfaces

## Context

The blueprint's roleplay screen (`Loro.dc.html:847–949`) hard-codes one three-turn café scene. Its
value is obvious and its limit is equally obvious: one scene is a demo. Real value needs scenes
generated from the learner's own themes, level, and tags — which the blueprint says explicitly:

> _"what's tricky steers the roleplay topics"_ — `Loro.dc.html:838`

There is a second, larger opportunity that isn't a runtime concern at all: enriching the catalog.
Producing `resp` respellings, `words[]` glosses, `example` sentences, and `hint` mnemonics for 600
phrases is weeks of human work. A draft-then-review pipeline turns it into days.

The constraint is the product's shape. The daily loop — add, listen, repeat, rate, review, score —
involves no LLM. It must stay that way, because the app has to work in a taxi rank in Madrid
([offline.md](../offline.md)) and because a per-learner AI bill that scales with practice would
destroy the unit economics
([`product/monetization.md`](../../product/monetization.md#cost-structure-per-learner)).

The v1.1 package subsequently added Open chat and Message inspector as two authored learner surfaces
(`Loro Chat.dc.html:95–449`, state logic `456–714`). They allow voice or text turns, suggestions,
corrections and line inspection. This amendment admits that product-level addition without admitting
an unbounded provider dependency: authored topic/reply graphs are the offline floor, a guarded live
provider is optional enhancement, and the deterministic daily loop remains LLM-free.

The prototype is evidence for visible states, not production language behavior. Its browser speech
synthesis, canned recognition, four regex corrections, fixed timer replies, text-derived ids and
fabricated due interval (`Loro Chat.dc.html:514`, `529–596`) are explicitly rejected.

## Options considered

### A · No LLM at all — hand-author every scene

**Pros** Zero cost, zero latency, zero provider dependency, complete editorial control. **Cons**
Scene variety becomes a content-production problem that scales linearly with themes × levels × tag
profiles. And it forfeits the authoring leverage, which is where most of the value is.

### B · LLM as a core, always-on dependency (generate scenes live, every time)

**Pros** Maximum freshness and personalisation. **Cons** Roleplay stops working offline. Cost scales
with usage. Provider latency and outages become learner-visible. And unreviewed model output would
reach learners directly.

### C · Guarded generation for supplementary surfaces and authoring-time enrichment, with a bundled fallback on every learner-facing path

**Pros**

- Personalised scenes and chat turns when online; real authored scenes/reply graphs when not.
- Caching makes the cost model work: bucketed keys mean the hundredth learner with a similar profile
  gets a cached scene.
- Authoring leverage without unreviewed content reaching learners, because enrichment is an offline
  step with a human gate.
- The daily loop stays LLM-free, so offline and cost properties are preserved.

**Cons** Two code paths (generated and bundled). Prompt injection surface. Cache invalidation on
content changes. Output quality must be enforced, not assumed.

## Decision

**Option C**, with five hard rules.

### 1 · AI is a garnish, never a dependency

No LLM on any daily-loop path. Roleplay, guarded open-chat turns and feedback, coach notes on
free-speech replies, and import/capture translation are the only runtime uses, and each degrades
cleanly.

### 2 · Every learner-facing AI path has a bundled fallback that is _good_

24 hand-authored scenes ship in the binary — three per theme, at two levels — written by the content
lead. Not placeholders. They are also the local-development default (`AI_PROVIDER=stub`), so they
are exercised constantly and cannot silently rot.

Open chat likewise ships versioned authored topic/reply graphs with coherent continuations,
suggestions, translations and inspector material. Offline, over budget, unsafe, timed out or invalid
live turns continue through those graphs without a fake typing delay. Stable scenes and prompts may
be cached; personalized thread turns are not shared-response cache material.

### 3 · Output is validated against pedagogical invariants, not just a schema

A scene is rejected unless: 3–4 turns; exactly 3 options per turn; **exactly one `best: true` per
turn**; every option carries a specific `tip`; no option over 12 words; the Spanish is Spanish; and
no tip contains instruction-like text. One repair attempt with the error fed back, then the bundled
fallback ([ai-services.md](../ai-services.md#output-validation)).

The "exactly one best option" rule is not cosmetic. The blueprint distinguishes _"Loro · that's how
a local says it"_ from _"Loro · coach note"_ (`Loro.dc.html:2969`), and that distinction is the
pedagogical payload of the screen — it teaches **register**, not just correctness. A scene with two
best options teaches the wrong lesson.

### 4 · Budgets fail silently to the fallback

Per-user monthly spend, global daily spend, and per-user rate limits. On breach: serve the bundled
scene or authored chat continuation with **no message**. A "you've used your AI allowance" notice
turns a graceful degradation into a visible failure, and the fallback is good enough that nothing
has been lost.

### 5 · Learner text is data, never instructions

Learner-authored phrase and bounded chat text reaches prompts. It is passed as a delimited field in
a user turn, never concatenated into the system prompt; delimiters are stripped from the content;
lengths and turn counts are capped; and the model has **no tools, no retrieval, and no cross-tenant
context** ([threat-model.md](../threat-model.md#b7--prompt-injection--the-ai-boundary)).

Recorded chat audio never reaches the prompt or JavaScript. Native on-device ASR produces text; PCM
remains handle-only native memory and is released locally. Raw thread text is excluded from
analytics and ordinary phrase/progress sync. Live provider retention and local thread retention are
release decisions, not defaults an implementation may invent.

### Where AI is explicitly not used

| Not used for                          | Why                                                                                                                             |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Generating catalog phrases at runtime | Unreviewed content would reach learners                                                                                         |
| Scoring pronunciation                 | It's signal processing, must run offline, and audio must not leave the device                                                   |
| Auto-tagging phrases                  | Difficulty and tags are the _learner's_ declaration — the entire connective thread                                              |
| Auto-adding suggested phrases         | Rule 6: nothing enters the stream without an explicit tap                                                                       |
| Deciding what to practise next        | Selection must be deterministic, reproducible on two platforms, offline, and auditable — that's what `loro-core` is for         |
| Unbounded autonomous chat             | Open chat is topic-bounded, has authored offline continuations, no tools, bounded context and explicit safety/output validation |

## Consequences

### Good

- Roleplay is personalised online and real offline.
- Open chat remains usable through authored topic/reply graphs when the provider is unavailable.
- AI cost lands around **$0.10–0.30 per engaged learner per month**, dominated by scenes, with clear
  levers (coarser cache keys, pre-generation, smaller models for tips)
  ([ai-services.md](../ai-services.md#cost-model)).
- Authoring leverage: enrichment drafts for 600 phrases in days, all human-reviewed before merge.
- The prompt-injection blast radius is capped at "you got a strange café scene for yourself",
  because the AI subsystem is deliberately unprivileged.
- Provider outages are invisible to learners.
- Model or prompt regressions are detectable: validation failure rate is a monitored metric with a
  cache purge attached.

### Bad — accepted deliberately

- Live and authored paths for each conversation surface, and every fallback must stay genuinely
  good. Mitigated by making authored content the local development default.
- Cache invalidation on `content_version` changes flushes scenes, causing a temporary cost spike
  after every content release. Accepted; alternatively pre-generation smooths it.
- Prompt and model are coupled and versioned together, so a model change is a reviewable event with
  an evaluation suite — including a native-speaker naturalness rating, because a model can pass
  every structural check and still produce stiff Spanish.
- Bundled scenes and finite chat graphs have less variety for an offline learner. Acceptable because
  both are supplementary surfaces, not the daily loop; content quality and coverage are release
  gates rather than excuses to require the provider.

### Revisit if…

- Roleplay becomes a primary loop rather than a supplement. Then pre-generation (option 3 in the
  cost levers) becomes the architecture rather than an optimisation, and the bundled set needs to be
  much larger.
- An on-device model becomes good enough to generate a scene locally, which would remove the last
  runtime provider dependency.
- Open chat needs tools, unbounded history, cross-device raw-thread sync, or provider retention
  beyond the approved window. Any of those is a new privacy/product decision rather than an
  implementation detail.
- Validation failure rates stay high enough that the "one repair then fallback" policy means most
  learners see bundled scenes anyway — at which point hand-authoring (option A) is the honest
  choice.
