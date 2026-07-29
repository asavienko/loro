# Feature flags and experimentation

Flags, A/B tests, and the ethics of experimenting on someone's learning.

---

## Feature flags

Flags are how unfinished work lives on `main`, which is what makes trunk-based development possible
here ([git-workflow.md](git-workflow.md)).

### Implementation

```ts
type FlagValue = boolean | string | number

interface FlagReader {
  bool(key: string, fallback: boolean): boolean
  string(key: string, fallback: string): string
  number(key: string, fallback: number): number
  variant(experiment: string): string | null
}
```

Resolution order:

```
1. Local override      (dev builds only — a debug menu)
2. Remote config       (cached in SQLite, refreshed on launch and every 6 h)
3. Compiled default    (in the binary)
```

**Flags must resolve offline.** The cached value is used when there's no network; if there has never
been a fetch, the compiled default applies. A flag that blocks on a network call would break the
offline guarantee ([`../architecture/offline.md`](../architecture/offline.md)).

### Current flags

| Flag                       | Type   | Default | Purpose                           |
| -------------------------- | ------ | ------- | --------------------------------- |
| `engine.stream`            | bool   | `true`  | StreamEngine                      |
| `engine.refrain`           | bool   | `true`  | RefrainEngine (v1 hero)           |
| `engine.srs`               | bool   | `false` | SrsEngine (v1.1)                  |
| `engine.prosody`           | bool   | `false` | ProsodyEngine (v1.1)              |
| `engine.pronunciation`     | bool   | `false` | PronunciationEngine (v1.1)        |
| `engine.roleplay`          | bool   | `false` | RoleplayEngine (v1.1)             |
| `engine.run`               | bool   | `false` | RunEngine (v2)                    |
| `refrain.repTarget`        | number | `6`     | The automaticity target           |
| `refrain.setSize`          | number | `0`     | `0` = derive from daily minutes   |
| `prosody.levelUpThreshold` | number | `88`    | Cue-ladder threshold              |
| `asr.fuzzyTolerance`       | bool   | `false` | Bounded edit distance in matching |
| `srs.dailyCapMultiplier`   | number | `4`     | Cards per daily minute            |
| `capture.enabled`          | bool   | `false` | OCR capture                       |
| `voiceClone.enabled`       | bool   | `false` | v2                                |
| `paywall.phraseLimit`      | number | `60`    | Free-tier ceiling                 |
| `trip.dropHour`            | number | `6`     | Local hour a drop unlocks         |

Note how many are **numbers, not booleans**. `refrain.repTarget`, `prosody.levelUpThreshold`, and
`srs.dailyCapMultiplier` are pedagogical parameters we genuinely don't know the right value of, and
making them remotely tunable is how they get answered with data instead of opinion
([`../product/learning-model.md`](../product/learning-model.md#open-pedagogical-questions)).

### Hygiene

1. **Every engine is flag-gated from day one.** That's what lets the release order change without a
   refactor ([ADR-0006](../architecture/adr/0006-pluggable-practice-engines.md)).
2. **A flag is removed one release after full rollout.** A flag left in for six months becomes an
   untested code path.
3. **Both paths are tested** while a flag exists. A flag whose off-path is broken is not a flag;
   it's a time bomb.
4. **Flags never gate a privacy control or a safety behaviour.** The three non-negotiables are not
   configurable.
5. **A flag has an owner and a removal date** in its registry entry.

---

## A/B testing

### What we experiment on

| ✅ Fair game                                                       | ❌ Never                                                              |
| ------------------------------------------------------------------ | --------------------------------------------------------------------- |
| Pedagogical parameters — rep target, level-up threshold, daily cap | Whether recorded audio leaves the device                              |
| Practice engine assignment (the loop question)                     | Whether a screen shames a missed day                                  |
| Onboarding copy and step order                                     | Whether displayed numbers are real                                    |
| Paywall placement and pricing                                      | Whether the app works offline                                         |
| Notification copy and timing (within the 3/day cap)                | Removing a safety behaviour                                           |
| Drop schedules and pack ordering                                   | Anything that makes learning measurably worse to test whether it does |
| Suggestion ordering in Discover                                    |                                                                       |

The last ❌ row deserves stating: we do not run an arm we expect to teach less, to prove that it
teaches less. That's a real temptation in learning products and it's not acceptable.

### Mechanics

```ts
const variant = flags.variant('refrain-rep-target') // 'control' | 'reps-4' | 'reps-8' | null
```

- **Assignment is stable per learner**, hashed from `(user_id, experiment_id)` — deterministic, so
  it works offline and survives reinstall on the same account.
- **Assignment happens once** and is persisted. A learner never switches mid-experiment; switching a
  rep target mid-week would be actively confusing.
- **Anonymous learners are included**, keyed on `anon_id`, and their assignment carries through the
  sign-in merge.
- Assignment is in the `experiments{}` property on every analytics event
  ([`../product/metrics.md`](../product/metrics.md#common-properties)).

### Design rules

| Rule                                                                | Why                                                                                                                          |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **One experiment per surface at a time**                            | Interaction effects are unreadable at our sample sizes                                                                       |
| **Minimum 2 weeks**                                                 | Learning effects don't show up in days                                                                                       |
| **Powered for the learning metric, not the engagement metric**      | The engagement metric moves faster and matters less                                                                          |
| Pre-registered hypothesis and primary metric, written before launch | Prevents metric-shopping after the fact                                                                                      |
| **Guardrails checked as a stopping condition**                      | A win on the primary metric with a tripped guardrail is a loss ([`../product/metrics.md`](../product/metrics.md#guardrails)) |
| Stop early only for harm, never for a win                           | Stopping on an early win is how false positives ship                                                                         |

### The primary metric is almost always retention of learning

**Not DAU, not session count, not streak length.** Those can all rise while the app teaches less,
which is exactly the failure mode the guardrails exist to catch.

The comparable measure across every engine is **30-day retention on a common cold probe**, which is
why every engine feeds FSRS and why the probe exists at all
([`../product/practice-loops.md`](../product/practice-loops.md#how-well-actually-decide)).

---

## The loop experiment

The biggest planned experiment, and the reason the engine abstraction exists.

**Question:** which practice loop teaches best?

**Design**

|            |                                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Arms       | `refrain` (control, v1 default) · `srs` · `run` (once v2 ships)                                                                |
| Assignment | On onboarding completion, stratified by the goal answer                                                                        |
| Duration   | **8 weeks minimum**                                                                                                            |
| Primary    | 30-day retention on the common cold probe                                                                                      |
| Secondary  | Production latency trend · phrases mastered · sessions/week · self-reported readiness                                          |
| Guardrails | All of them, checked weekly                                                                                                    |
| Sample     | ⚠️ To be powered once we know retention variance — **Q-05** ([../decisions/open-questions.md](../decisions/open-questions.md)) |

**What makes this valid at all:** every engine maintains every progress signal, so the arms are
measured on the same yardstick and switching is lossless
([rule 5](../architecture/overview.md#the-ten-rules)). Without that invariant, this experiment would
be uninterpretable.

**What makes it ethical:** all three arms are complete, well-built learning experiences that we
believe in. We're comparing three good things, not testing a deliberately worse one.

**Learners can switch out.** If someone dislikes their assigned loop, Settings → _How you practise_
lets them change, and the switch is recorded as a signal (a high opt-out rate is itself a result).

---

## Ethics

Loro experiments on how people spend their time and what they retain. That deserves more care than
testing button colours.

| Principle                                                          | In practice                                                                   |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| **Every arm is one we'd ship**                                     | No deliberately-degraded control                                              |
| **No dark patterns, ever**                                         | Not even as an arm. No manufactured urgency, no streak-loss anxiety, no guilt |
| **No experiment makes learning worse to prove a point**            |                                                                               |
| **The learner can always opt out of their arm**                    | Settings → _How you practise_                                                 |
| **Results are written down**, including the null and negative ones | A file per experiment in `docs/experiments/`                                  |
| **Guardrails outrank the primary metric**                          | A tripped guardrail reverts the change regardless of its wins                 |
| **Nothing experiments on the privacy posture**                     | The three non-negotiables are not flags                                       |

### Why this matters more here than usual

A learning app that optimises engagement will find dark patterns, because dark patterns work. Streak
anxiety increases DAU. Manufactured urgency increases sessions. Loss aversion increases retention —
of _usage_, not of Spanish.

The product's own design rejects all of that
([`../product/vision.md`](../product/vision.md#what-loro-is-not)), and the guardrail metrics exist
specifically so that an experiment can't quietly reintroduce it while showing a green primary
metric.

---

## Recording results

One file per experiment in `docs/experiments/NNNN-slug.md`:

```markdown
# 0001 · Refrain rep target: 4 vs 6 vs 8

- **Status:** Complete
- **Ran:** 2026-09-01 → 2026-10-27
- **Arms:** control (6) · reps-4 · reps-8
- **N:** 1 240 / 1 198 / 1 215

## Hypothesis

Pre-registered: 8 reps improves 30-day retention over 6 by ≥5 points, at the cost of session length.

## Primary result

30-day retention: 64.1% / 58.7% / 66.9%. reps-8 beats control by 2.8pp (CI −0.4 to 6.0). Not
significant.

## Secondary

Session length +34% in reps-8. Completion rate −11%.

## Guardrails

None tripped.

## Decision

Keep 6. reps-8's retention gain is within noise and its completion cost is real. reps-4 is clearly
worse — that's the useful finding: overlearning past first success matters.

## What we'd do differently

Powered for a 5pp effect; the real effect looks like ~3pp. Needed roughly 2× the sample.
```

Nulls and negatives get written up too. The reps-4 finding above is a null on the headline and a
genuinely useful result underneath, and a process that only records wins would have thrown it away.
