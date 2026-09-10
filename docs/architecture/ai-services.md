# AI services

Where Claude is used, how it's constrained, and how the product stays whole without it.

Rationale: [ADR-0010](adr/0010-llm-roleplay-and-guardrails.md)

---

## Position

**AI is a garnish, never a dependency** ([overview.md](overview.md#the-ten-rules), rule 9).

The daily loop — add, listen, repeat, rate, review, score — involves no LLM at all. That's a
deliberate architectural choice, not an oversight: it keeps the product offline-capable, keeps unit
costs bounded, and means a provider outage degrades supplementary surfaces instead of breaking the
app.

Every learner-facing AI path has a **bundled fallback** that is good, not merely non-broken.

---

## Where AI is used

| Use                                                               | Runtime?           | Learner-facing? | Fallback                                         |
| ----------------------------------------------------------------- | ------------------ | --------------- | ------------------------------------------------ |
| **Roleplay scenes**                                               | Yes                | Yes             | 24 bundled scenes, 3 per theme                   |
| **Coach notes** for free-speech replies                           | Yes                | Yes             | The scene's pre-authored tip                     |
| **Open-chat turns, suggestions and feedback**                     | Yes                | Yes             | Authored topic/reply graphs                      |
| **Translation** for Import and Capture                            | Yes                | Yes             | Leave untranslated; the learner can type it      |
| **Discover phrase suggestions**                                   | Yes                | Yes             | Catalog, scenarios, Add your own, bundled topics |
| **Content enrichment** — `resp`, `words`, `example`, `hint`       | No, authoring-time | No              | Human authoring                                  |
| **Catalog/scenario drafts**                                       | No, authoring-time | No              | Human review; `review_required`                  |
| **Phrase-quality review** — flag stiff or unnatural catalog lines | No, CI             | No              | Human review                                     |

The authoring-time enrichment rows are where the LLM earns most of its value: enriching 600 phrases
with respellings, glosses, examples, and memory hooks is weeks of work, and a draft-then-review
pipeline turns it into days. That work happens offline, in CI, with a human gate
([`process/content-authoring.md`](../process/content-authoring.md)) — so no learner ever waits on it
and no unreviewed model output reaches a learner.

---

## Roleplay scenes

The reusable, cacheable runtime generation path.

### Request flow

```
POST /ai/scene
  → rate limit  (20/h, 60/day per user)
  → budget check (per-user monthly cap; global daily cap)
  → cache lookup: key = sha256(theme, level, tag_profile_bucket, phrase_ids, city, content_version)
      hit → return immediately  (~200 ms)
  → Claude, with prompt caching on the system prompt
  → OUTPUT VALIDATION  (see below)
      fail → one repair attempt → fail again → bundled fallback
  → persist to Redis (30 days) and to Postgres (permanent, so scenes accumulate)
  → stream to client
```

Because scenes are cached by a bucketed key, the **hundredth learner** with a Café/some/pron-heavy
profile gets a cached scene. Target cache hit rate ≥70%, which is what makes the cost model work.

### The prompt

Structure, not the final text — the live prompt is in `apps/api/src/ai/prompts/scene.ts` and is
versioned.

```
SYSTEM  (cached — stable across requests)
  You write short roleplay scenes for a Spanish-learning app.
  Register: European Spanish (es-ES) as actually spoken in Spain today.
  Hard rules:
    • 3 turns, plus one closing line from the NPC.
    • Each turn offers exactly 3 learner replies.
    • Exactly ONE reply per turn is marked best:true — the one a local would
      most naturally say. The other two must be plausible and correct, not wrong.
    • Every reply carries a `tip`: one sentence, specific to THAT line.
      Never generic praise. Explain an idiom, a register choice, or a cultural fact.
    • Max 12 words per reply.
    • Natural speech, never textbook Spanish. Contractions and ellipsis are good.
    • The NPC is warm and ordinary. No jokes about the learner's Spanish.
  Output: JSON matching the provided schema. Nothing else.

USER
  Theme: {theme}          Level: {level}
  City: {city}            Trip type: {trip_type}
  Exercise these phrases the learner owns: {phrases}
  The learner finds these things hard: {tag_profile}
```

**Why `best: true` matters so much.** The blueprint's coach note distinguishes _"Loro · that's how a
local says it"_ from _"Loro · coach note"_ (`Loro.dc.html:2969`). That distinction is the
pedagogical payload of the whole screen — it teaches register, not just correctness. A scene without
exactly one best option per turn is invalid.

**Tag steering.** `tag_profile` is why the blueprint says _"what's tricky steers the roleplay
topics"_ (`Loro.dc.html:838`). A learner with many `pron` tags gets scenes exercising the sounds
they've flagged; a `useful`-heavy learner gets high-frequency transactional scenes.

### Output validation

Server-side, before the response leaves. A schema check is not enough — the pedagogical invariants
matter more than the shape.

```ts
const SceneSchema = z.object({
  place: z.string().max(40),
  city: z.string().max(40),
  emoji: z.string().max(4),
  role: z.string().max(30),
  turns: z
    .array(
      z.object({
        npc: z.object({ es: z.string().max(120), en: z.string().max(140) }),
        options: z
          .array(
            z.object({
              es: z.string().max(80),
              en: z.string().max(100),
              best: z.boolean().optional(),
              tip: z.string().min(10).max(160),
              phrase_id: z.string().optional(),
            }),
          )
          .length(3),
      }),
    )
    .min(3)
    .max(4),
  closer: z.object({ es: z.string().max(120), en: z.string().max(140) }),
})

function validateScene(s: Scene): Result<Scene, ValidationError> {
  for (const t of s.turns) {
    if (t.options.filter((o) => o.best).length !== 1) return err('best_count')
    if (t.options.some((o) => wordCount(o.es) > 12)) return err('too_long')
    if (t.options.some((o) => o.tip.length < 10)) return err('tip_missing')
    if (new Set(t.options.map((o) => o.es)).size !== 3) return err('duplicate_options')
  }
  if (!looksLikeSpanish(allEs(s))) return err('wrong_language')
  if (containsInstruction(allTips(s))) return err('injection_suspected')
  return ok(s)
}
```

One repair attempt (the validation error is fed back), then the bundled fallback. **We never ship an
invalid scene to a learner** — a scene with two "best" options teaches the wrong lesson.

### Bundled fallback

24 hand-authored scenes ship in the app binary: three per theme, at two levels. They are good
scenes, written by the content lead, not degraded placeholders. A learner offline, over budget, or
hitting a provider outage gets a real roleplay experience and no error message.

The fallback set is also the **local development default** (`AI_PROVIDER=stub`), which means it's
exercised constantly and can't silently rot.

---

## Guarded open chat

`Loro Chat.dc.html:95–328` specifies the conversation and `331–449` its Message inspector; the state
logic is at `456–714`. Production preserves topic/pace, text and voice turns, on-demand translation,
answer suggestions, explained corrections, alternatives, glosses, explicit keep/remove and Review
handoff. It does not preserve the prototype's language machinery.

### Local floor and live enhancement

Versioned authored topic packs contain finite reply graphs, safe continuations, suggestions,
English, respellings, explanations, alternatives, register labels and word glosses. They are usable
offline and are the local development default. A guarded provider may produce a more responsive turn
from bounded recent text context, but it never becomes the source of thread persistence, practice
selection, progress or the phrase library.

Each live request is authenticated and entitled as decided for release, rate- and budget-limited,
bounded by turn count and characters, structurally separates learner text from instructions, and
requires validated structured output. Timeout, safety rejection, invalid output, stale response,
provider failure or budget exhaustion continues the authored graph. There is no artificial minimum
latency and no pending indicator after a request has failed.

Raw threads, drafts, corrections, translations and ASR transcripts are excluded from application
logs, analytics and ordinary sync. A request sends only its bounded text context to the configured
provider under the approved retention/no-training terms. Recorded audio is structurally absent:
on-device ASR yields text while PCM remains in native memory. Reference playback uses production
assets or approved on-device speech, never browser `speechSynthesis`.

### Prototype mechanisms explicitly rejected

`ChatLogic` demonstrates view states, not a production language service. Do not port:

- browser speech synthesis (`Loro Chat.dc.html:514`);
- canned recognition selected from suggestions (`529–535`);
- text-length/character-code phrase ids or a fabricated due interval (`542–544`);
- the four regex corrections in `fixFor()` (`568–575`);
- canned replies dispatched after a fixed 1.2-second timer (`586–596`).

Corrections and explanations must be validated and attributable; low-confidence feedback is omitted.
IDs are opaque and stable. Saving a line is an explicit learner action through the normal phrase
mutation boundary, and queuing it for Review cannot write progress or invent an interval.

---

## Prompt injection

The threat is real and specific: **learner-authored phrase and chat text reaches a prompt.**

A learner can type any phrase, import any pasted text, photograph any sign, or enter a chat turn.
That text flows into `/ai/translate`, via `phrase_ids` into scene generation, or as bounded recent
context into `/chat/turn`.

| Defence                           |                                                                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Structural separation**         | Learner text is passed as data in a user-turn field, never concatenated into the system prompt                                       |
| **Delimiting and escaping**       | Learner content is wrapped in explicit delimiters, with delimiter sequences stripped from the content                                |
| **Length caps**                   | 200 chars per phrase plus endpoint-specific chat turn/context caps. A prompt-injection payload usually needs room                    |
| **Output validation**             | The gate above is a second line: even a successful injection has to produce a valid scene, in Spanish, with correct structure        |
| **Instruction detection**         | `containsInstruction()` flags imperative English patterns in tips (`ignore previous`, `system:`, `you are now`) and fails validation |
| **No tool access**                | The LLM has no tools, no retrieval, no ability to make requests. Output is text                                                      |
| **No privileged data in context** | Prompts contain only required phrase/chat text and learning context. No email, ids, or other learners' data                          |
| **Rate limits**                   | Bound the blast radius of iterative probing                                                                                          |

Worst realistic case: a learner injects a prompt and receives a weird scene _for themselves_. There
is no cross-tenant path, no data exfiltration surface, and no privilege to escalate. That's by
design — the AI subsystem is deliberately unprivileged. Full analysis:
[threat-model.md](threat-model.md).

---

## Cost model

Assumptions to re-derive before pricing ([`product/monetization.md`](../product/monetization.md)):

|                           |                                                                           |
| ------------------------- | ------------------------------------------------------------------------- |
| Scene request             | ~1 200 input tokens (mostly the cached system prompt), ~900 output tokens |
| Roleplay usage            | ~6 scenes/month for an engaged learner                                    |
| Cache hit rate            | 70% target                                                                |
| Effective billed requests | ~1.8 scenes/learner/month                                                 |
| Coach notes               | ~2/month, ~200 tokens                                                     |
| Translation               | ~1 import/month, ~300 tokens                                              |

At those volumes the AI cost per engaged learner lands around **$0.10–0.30/month**, dominated by
scenes. This estimate predates open chat and cannot authorize its entitlement or budget. Chat must
ship behind a separately approved per-user/global cap derived from measured turns, context size and
fallback usage. Levers for the reusable scene workload, in the order we'd pull them:

1. **Cache key coarseness.** Bucketing `tag_profile` into 4 buckets instead of 16 roughly doubles
   the hit rate.
2. **Prompt caching** on the system prompt — already assumed above.
3. **Pre-generation.** Generate the top 200 `(theme, level, bucket)` combinations in a worker, off
   the learner path entirely. This is the biggest lever and it converts a variable cost into a fixed
   one.
4. **A smaller model for coach notes and translation.** Scene generation needs quality; a
   one-sentence tip on a known line does not.

### Budgets

Enforced in `ai/budget.service.ts`, two layers:

| Cap                       | Behaviour on breach                                                   |
| ------------------------- | --------------------------------------------------------------------- |
| Per-user monthly AI spend | Silently serve the bundled scene/chat graph. **No error, no paywall** |
| Global daily spend        | Same, plus an alert                                                   |
| Per-user rate limits      | 429 with `Retry-After`; client falls back locally                     |

**Silent fallback is a product requirement.** A message saying "you've used your AI allowance" turns
a graceful degradation into a visible failure, and the authored fallback content is good enough that
the learner has lost the provider enhancement rather than the surface.

---

## Model choice

| Use                            | Model                 | Why                                                                                    |
| ------------------------------ | --------------------- | -------------------------------------------------------------------------------------- |
| Scene generation               | Claude Sonnet 5       | Quality matters — register, naturalness, and the best-option judgement are the product |
| Guarded chat turns             | Configured text model | Validated conversational Spanish within the approved latency/cost/retention envelope   |
| Coach notes                    | Claude Haiku 4.5      | One sentence about a known line                                                        |
| Translation                    | Claude Haiku 4.5      | Short, well-constrained                                                                |
| Content enrichment (authoring) | Claude Opus 5         | Highest quality, offline, human-reviewed, low volume — no reason to economise          |

Model ids are configuration, not code, and every prompt is versioned alongside its model so a model
change is a reviewable, revertable event.

**Evaluation before any model change:** a fixture suite of 40 scene requests, scored on the
validation invariants plus a native-speaker rating of naturalness on a 20-scene sample. A model that
validates but produces stiff Spanish is a regression, and only a human notices.

Chat provider/prompt changes additionally run a consented fixture corpus covering CEFR fit,
Spain/Latin-America policy, agreement, correction and explanation quality, register, suggestion
usefulness, mixed/empty/long input, safety, injection, fallback continuity, latency and cost. The
release thresholds belong with the provider decision; the prototype's handful of seeded lines is not
an evaluation set.

---

## Observability

`ai_request_completed` ([metrics.md](../product/metrics.md)) carries `endpoint`, `cache_hit`,
`latency_ms`, `tokens_in/out`, `fallback_used`, `validation_failures`, `repair_attempted`,
`safety_code`, and `budget_state`. For chat, `cache_hit` describes stable prompt/resource caches,
not reuse of a personalized turn. No request, response, translation, correction or transcript text
is logged or emitted.

| Metric                    | Alert                                                                             |
| ------------------------- | --------------------------------------------------------------------------------- |
| Cache hit rate            | < 55% — the key is too fine-grained or content shipped and invalidated everything |
| Validation failure rate   | > 5% — the prompt or the model has drifted                                        |
| Fallback rate             | > 15% — provider trouble or budgets biting                                        |
| p95 latency               | > 5 s                                                                             |
| Spend vs budget           | > 80% of the daily cap                                                            |
| Injection suspicion count | any sustained non-zero                                                            |

A validation-failure spike is the canary for a model or prompt regression, and because scenes are
cached, a bad batch can persist — so a spike triggers a cache purge for the affected key prefix.

---

## What we deliberately don't do with AI

| Not doing                                      | Why                                                                                                                                           |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Generate catalog phrases at runtime**        | Unreviewed content would reach learners. Generation is an authoring step with a human gate                                                    |
| **Score pronunciation with an LLM**            | It's a signal-processing problem, it must run offline, and audio must not leave the device ([prosody-dsp.md](prosody-dsp.md))                 |
| **Unbounded/autonomous chat**                  | Authored open chat is topic-bounded, has a finite offline floor, bounded context, no tools, and validated output                              |
| **Auto-tag phrases for the learner**           | Difficulty and tags are the _learner's_ declaration — that's the entire connective thread ([learning-model.md](../product/learning-model.md)) |
| **Auto-add suggested phrases**                 | Rule 6: nothing enters the stream without an explicit tap                                                                                     |
| **Personalise practice selection with an LLM** | Selection and scheduling are deterministic, testable, and explainable. An LLM in that loop would make the product unauditable                 |
| **Send learner audio to a model**              | The 🔒 on-screen promise ([ADR-0011](adr/0011-analytics-and-privacy.md))                                                                      |

The last two are the important ones. A tempting version of this product asks an LLM "what should
this learner practise next?" We don't, because the answer has to be correct, reproducible on two
platforms, and computable offline — which is exactly what `loro-core` is for.
