# AI services

Where Claude is used, how it's constrained, and how the product stays whole without it.

Rationale: [ADR-0010](adr/0010-llm-roleplay-and-guardrails.md)

---

## Position

**AI is a garnish, never a dependency** ([overview.md](overview.md#the-ten-rules), rule 9).

The daily loop — add, listen, repeat, rate, review, score — involves no LLM at all. That's a
deliberate architectural choice, not an oversight: it keeps the product offline-capable, keeps unit
costs at cents per learner, and means a provider outage degrades one optional surface instead of
breaking the app.

Every learner-facing AI path has a **bundled fallback** that is good, not merely non-broken.

---

## Where AI is used

| Use                                                               | Runtime?           | Learner-facing? | Fallback                                    |
| ----------------------------------------------------------------- | ------------------ | --------------- | ------------------------------------------- |
| **Roleplay scenes**                                               | Yes                | Yes             | 24 bundled scenes, 3 per theme              |
| **Coach notes** for free-speech replies                           | Yes                | Yes             | The scene's pre-authored tip                |
| **Translation** for Import and Capture                            | Yes                | Yes             | Leave untranslated; the learner can type it |
| **Content enrichment** — `resp`, `words`, `example`, `hint`       | No, authoring-time | No              | Human authoring                             |
| **Phrase-quality review** — flag stiff or unnatural catalog lines | No, CI             | No              | Human review                                |

Rows 4 and 5 are where the LLM earns most of its value: enriching 600 phrases with respellings,
glosses, examples, and memory hooks is weeks of work, and a draft-then-review pipeline turns it into
days. That work happens offline, in CI, with a human gate
([`process/content-authoring.md`](../process/content-authoring.md)) — so no learner ever waits on it
and no unreviewed model output reaches a learner.

---

## Roleplay scenes

The only substantial runtime use.

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

## Prompt injection

The threat is real and specific: **learner-authored phrase text reaches a prompt.**

A learner can type any phrase, import any pasted text, and photograph any sign. That text flows into
`/ai/translate` and — via `phrase_ids` for owned phrases — into scene generation.

| Defence                           |                                                                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Structural separation**         | Learner text is passed as data in a user-turn field, never concatenated into the system prompt                                       |
| **Delimiting and escaping**       | Learner content is wrapped in explicit delimiters, with delimiter sequences stripped from the content                                |
| **Length caps**                   | 200 chars per phrase, 12 phrases per request. A prompt-injection payload usually needs room                                          |
| **Output validation**             | The gate above is a second line: even a successful injection has to produce a valid scene, in Spanish, with correct structure        |
| **Instruction detection**         | `containsInstruction()` flags imperative English patterns in tips (`ignore previous`, `system:`, `you are now`) and fails validation |
| **No tool access**                | The LLM has no tools, no retrieval, no ability to make requests. Output is text                                                      |
| **No privileged data in context** | Prompts contain the learner's phrases, level, and tags. No email, no ids, no other learners' data                                    |
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
scenes. Levers, in the order we'd pull them:

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

| Cap                       | Behaviour on breach                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------ |
| Per-user monthly AI spend | Silently serve the bundled fallback. **No error, no paywall** — the learner should not be able to tell |
| Global daily spend        | Same, plus an alert                                                                                    |
| Per-user rate limits      | 429 with `Retry-After`; client falls back                                                              |

**Silent fallback is a product requirement.** A message saying "you've used your AI allowance" turns
a graceful degradation into a visible failure, and the fallback scenes are good enough that the
learner has lost nothing.

---

## Model choice

| Use                            | Model            | Why                                                                                    |
| ------------------------------ | ---------------- | -------------------------------------------------------------------------------------- |
| Scene generation               | Claude Sonnet 5  | Quality matters — register, naturalness, and the best-option judgement are the product |
| Coach notes                    | Claude Haiku 4.5 | One sentence about a known line                                                        |
| Translation                    | Claude Haiku 4.5 | Short, well-constrained                                                                |
| Content enrichment (authoring) | Claude Opus 5    | Highest quality, offline, human-reviewed, low volume — no reason to economise          |

Model ids are configuration, not code, and every prompt is versioned alongside its model so a model
change is a reviewable, revertable event.

**Evaluation before any model change:** a fixture suite of 40 scene requests, scored on the
validation invariants plus a native-speaker rating of naturalness on a 20-scene sample. A model that
validates but produces stiff Spanish is a regression, and only a human notices.

---

## Observability

`ai_request_completed` ([metrics.md](../product/metrics.md)) carries `endpoint`, `cache_hit`,
`latency_ms`, `tokens_in/out`, `fallback_used`, `validation_failures`, `repair_attempted`.

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

| Not doing                               | Why                                                                                                                                           |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Generate catalog phrases at runtime** | Unreviewed content would reach learners. Generation is an authoring step with a human gate                                                    |
| **Score pronunciation with an LLM**     | It's a signal-processing problem, it must run offline, and audio must not leave the device ([prosody-dsp.md](prosody-dsp.md))                 |
| **Open-ended chat**                     | The blueprint's roleplay is a bounded scene with a coach. Free chat is a different product, and much harder to keep pedagogically honest      |
| **Auto-tag phrases for the learner**    | Difficulty and tags are the _learner's_ declaration — that's the entire connective thread ([learning-model.md](../product/learning-model.md)) |
| **Auto-add suggested phrases**          | Rule 6: nothing enters the stream without an explicit tap                                                                                     |
| **Personalise with an LLM at runtime**  | Selection and scheduling are deterministic, testable, and explainable. An LLM in that loop would make the product unauditable                 |
| **Send learner audio to a model**       | The 🔒 on-screen promise ([ADR-0011](adr/0011-analytics-and-privacy.md))                                                                      |

The last two are the important ones. A tempting version of this product asks an LLM "what should
this learner practise next?" We don't, because the answer has to be correct, reproducible on two
platforms, and computable offline — which is exactly what `loro-core` is for.
