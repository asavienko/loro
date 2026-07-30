# The three practice loops and supplementary conversation

The blueprint's most important structural feature is that it **does not resolve** what daily
practice should be. It presents three complete philosophies and explicitly labels the transitions
between them:

> _"or a different philosophy entirely ↓"_ — `Loro.dc.html:1299` _"or one more philosophy ↓"_ —
> `Loro.dc.html:1541`

This document records how we treat that, what ships when, and what it costs.

`Loro Chat.dc.html` later labels its conversation surface “Loop D”. That name does not change the
three-way daily-practice decision: guided open chat is a supplementary conversation loop, not a
fourth `PracticeEngine`.

---

## The decision

**We do not pick one. We make the loop a plug-in.**

All three loops read and write the same tagged phrase store. What differs is the _selection,
sequencing, and feedback_ of practice — which is exactly the surface a strategy interface should
abstract. See [ADR-0006](../architecture/adr/0006-pluggable-practice-engines.md) and
[`architecture/practice-engines.md`](../architecture/practice-engines.md).

```
                     ┌──────────────────────────────┐
                     │  Phrase store (shared)       │
                     │  difficulty · tags · reps    │
                     │  · loved · learned · srs     │
                     │  · automaticity · rung       │
                     └──────────────┬───────────────┘
                                    │
                  ┌─────────────────┼─────────────────┐
                  │                 │                 │
        ┌─────────▼──────┐  ┌───────▼───────┐  ┌──────▼────────┐
        │ Loop A         │  │ Loop B        │  │ Loop C        │
        │ SrsEngine      │  │ RefrainEngine │  │ RunEngine     │
        │ ProsodyEngine  │  │               │  │               │
        │ PronEngine     │  │               │  │               │
        └────────────────┘  └───────────────┘  └───────────────┘
                  │                 │                 │
                  └─────────────────┼─────────────────┘
                                    │
                          ┌─────────▼─────────┐
                          │  StreamEngine     │
                          │  (used by all)    │
                          └───────────────────┘
```

**Why not just pick one?** Because the question is empirical and we don't have the data. The three
loops optimise different outcomes ([learning-model.md](learning-model.md)), suit different personas
([personas.md](personas.md)), and the blueprint's author deliberately left the fork open after
building all three to a high fidelity. Guessing would throw away that work; the abstraction costs
roughly one interface and one router.

---

## Release plan

| Release  | Ships                                                                                                           | Rationale                                                                                                                                                                                   |
| -------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **v1**   | **StreamEngine** + **RefrainEngine** (Loop B, hero)                                                             | Depth-first is the differentiated bet, it's the cheapest of the three to build _well_, and the blueprint marks the Refrain ★ hero. The stream is universal and cheap.                       |
| **v1.1** | **SrsEngine** (review session, memory model), **PronEngine**, **ProsodyEngine**; supplementary guided open chat | Loop A completes retention and the labs need the long-lead DSP. Chat uses the shared phrase/audio/speech foundations but has a separate private conversation coordinator and bundled floor. |
| **v2**   | **RunEngine** + Phrasebook/ladder                                                                               | Highest build cost, most speculative payoff. Gated on v1 retention data.                                                                                                                    |

Each engine is behind a flag from day one
([process/experimentation.md](../process/experimentation.md)), so the release order can change
without refactoring.

## How we'll actually decide

Once ≥2 engines are live for ≥6 weeks, compare cohorts on:

1. **Retention of learning** — phrases still recalled at 30 days, measured by a common cold-probe
   card that all engines feed into. _This is the primary measure._
2. **Production latency** — measured mic-onset delay, trending down.
3. **Session adherence** — sessions per week, without counting streak-only opens.
4. **Self-reported readiness** — a single question after a trip or at week 8.

Explicitly _not_ the deciding measure: DAU, streak length, or session count alone. An engine that
maximises engagement while teaching less loses.

⚠️ **Decision needed (Q-05):** who owns this call, and at what date. See
[open-questions.md](../decisions/open-questions.md).

---

<a id="loop-a--the-engine"></a>

## Loop A — The engine

**Screens:** [Review session](functional-spec.md#6-review-session) ·
[Memory model](functional-spec.md#8-memory-model) ·
[Pronunciation lab](functional-spec.md#9-pronunciation-lab) ·
[Prosody lab](functional-spec.md#10-prosody-lab) · [Roleplay](functional-spec.md#7-roleplay)

**Shape.** A growing library, scheduled by FSRS. Each session drains a due queue. Cards are
tag-typed: pronunciation-tagged phrases become say-it-aloud cards, memory-tagged ones surface their
hook. Four advanced surfaces go deeper on request.

**Its strength.** It scales. A learner with 400 phrases is served correctly; the algorithm decides
what today needs. The forgetting-curve screen makes the invisible visible, which is a genuinely
novel contribution — most SRS apps hide the model and learners distrust it.

**Its weakness.** Review debt. Miss a week and the queue is a wall. It also treats recognition-level
recall as success by default; a learner can grade `Good` on a card they could never produce at speed
in a café.

**What's uniquely valuable here.** The prosody lab. Pitch contour vs native, per-syllable grading,
rhythm and stress, three skill axes, and the cue ladder that strips help as you improve. Nothing
else on the market does this well, and it directly serves the app's central promise (phrases carry
melody).

---

<a id="loop-b--the-daily-refrain--v1-hero"></a>

## Loop B — The Daily Refrain · **v1 hero**

**Screens:** [Today](functional-spec.md#11-today--the-ritual) ·
[The Refrain](functional-spec.md#12-the-refrain)

**Shape.** Five phrases. Three waves across the day. Each phrase gets 6 reps, and the _manner_
rotates every rep: Echo → Chorus → Speed → Cloze → Call → Cold. The screen shows automaticity
climbing and effort dropping until the phrase **locks in**. Four days of lock-in and it graduates,
banked, out of rotation. A fading tail carries yesterday's set. An ambient loop plays it all day.

**Its strength.** It's honest about depth and it makes repetition _feel alive_ — the single hardest
UX problem in language learning. The warming card (cold blue → hot coral as automaticity climbs) is
the best piece of feedback design in the blueprint. And there's no hidden scheduler: **you always
see today**, which means you can finish, which means the app has an end.

**Its weakness.** Throughput. Five a day is ~150 a month at best, and Mara has twelve days.
Mitigated by the trip arc running on top of it (drops feed the daily set) and by the ambient loop
carrying passive breadth.

**Why it's the v1 hero.**

1. It's the differentiated bet — nobody else builds for automaticity.
2. Its feedback loop needs no DSP, no ASR scoring, and no LLM. Latency measurement and TTS are
   enough. That makes it the only loop we can ship _fully realised_ in v1.
3. "You always see today" is the antidote to the review-debt failure mode that kills SRS apps.

---

<a id="loop-c--the-roguelike-run"></a>

## Loop C — The Roguelike Run

**Screens:** [The Run](functional-spec.md#13-the-run) ·
[Phrasebook](functional-spec.md#14-phrasebook--collection--ladder)

**Shape.** A bounded run: a constant spine (re-fire the chain → meet and fold in one new phrase),
then **the Draw** — a real shuffle that deals one of four finisher cards — then that finisher's beat
sequence, then a climb up the five-rung ladder. Nothing is ever lost.

**Its strength.** The ladder is the most pedagogically defensible progress model in the whole
blueprint — Accumulated → Bent → Transferred → Pressure-tested → Deployed is a real competence
hierarchy, and the Phrasebook's distribution histogram literally _is_ the learner's ability. The
draw solves the variety problem structurally: surprise reads as fun while the targeting
(`need = stale×2 + stumbles`, constrained to eligible rungs) does the pedagogy invisibly.

**Its weakness.** Most expensive to build (four distinct finisher mechanics, each needing real
evaluation), and the novelty of a draw decays. The Deploy finisher ("narrate what's around you")
needs open-ended speech evaluation, which is the hardest thing in the product.

**What we should steal even if it doesn't ship.** The ladder. See Q-04 in
[learning-model.md](learning-model.md) — a five-rung depth model per phrase would improve Loops A
and B too, and it's cheap to record even when no Loop C surface exists. **Decision: we persist
`rung` on every phrase from v1**, populated by whichever engine is active, so Loop C has real data
the day it ships and the Phrasebook is not empty.

---

<a id="loop-d--guided-open-chat"></a>

## Loop D — Guided open chat · **v1.1 supplementary**

**Screens:** [Open chat](functional-spec.md#22-open-chat) ·
[Message inspector](functional-spec.md#23-message-inspector)

**Shape.** Choose a topic and Loro's pace, speak or type Spanish, reveal help only when wanted, then
open any line to inspect audio, alternatives, glosses, and real correction evidence. Saving is
always explicit; kept lines join the normal phrase stream and can be queued through Review's own
contract (`Loro Chat.dc.html:91–99`, `293–318`, `331–449`).

**Why it is not a practice engine.** It does not own selection, scheduling, a progress delta, or a
graduation rule. It is an input/feedback surface over a private conversation domain. Its only
learning-state handoffs are explicit phrase save/remove and queue-for-review commands; it never
writes reps, automaticity, FSRS, or rungs.

**The production guard.** Every topic has a versioned bundled reply graph and answer suggestions, so
offline use is coherent rather than a disabled composer. A live text provider may improve variety
only after the entitlement/budget, retention, privacy, safety, and quality gates are met. Requests
contain bounded text context, never recorded audio. Thread text/transcripts remain local and outside
telemetry/normal phrase sync under the product privacy floor. Invalid, unsafe, late, or over-budget
responses fall back without masquerading as live output.

**What the authored prototype does not authorize.** Its deterministic correction regexes, timed
canned replies, browser speech synthesis, and canned microphone recognition are executable
presentation fixtures (`Loro Chat.dc.html:504`, `529–531`, `568–588`), not product mechanisms. Every
correction, reply, transcript, playback state, and count shown in production must be real.

**Release gate.** Q-16 decides whether this is a committed v1.1 loop or an experiment. Q-18 decides
entitlement and provider budget; Q-19/Q-20 decide local and provider retention. Those questions may
gate live/release behavior, but they do not weaken the bundled offline and privacy requirements.

---

## What all three share

Everything below the loop line is common and built once:

| Shared                                                                     | Where it lives                                             |
| -------------------------------------------------------------------------- | ---------------------------------------------------------- |
| The phrase store — difficulty, tags, loved, learned, reps, notes           | [data-model.md](../architecture/data-model.md)             |
| Audio: TTS, rates, background playback, caching                            | [audio-speech.md](../architecture/audio-speech.md)         |
| ASR and phrase-level matching                                              | [audio-speech.md](../architecture/audio-speech.md)         |
| Pitch/DSP scoring                                                          | [prosody-dsp.md](../architecture/prosody-dsp.md)           |
| FSRS state per phrase (maintained even when the active engine ignores it)  | [scheduling.md](../architecture/scheduling.md)             |
| `rung`, `automaticity`, `reps_today` (all maintained regardless of engine) | [scheduling.md](../architecture/scheduling.md)             |
| The stream (used by every loop)                                            | [functional-spec.md](functional-spec.md#4-adaptive-stream) |
| Progress rollups and the tag histogram                                     | [functional-spec.md](functional-spec.md#15-progress)       |
| The trip arc — layers on top of any loop                                   | [trip-arc.md](trip-arc.md)                                 |
| Design system, motion, components                                          | [../design/](../design/)                                   |

**The invariant that makes this work:** _every engine maintains every progress signal, even the ones
it doesn't display._ A learner who practises exclusively in the Refrain still accrues FSRS state and
ladder rungs. Switching loops therefore never resets progress, and A/B comparison is possible on a
common measure. This is stated as a rule in
[`architecture/overview.md`](../architecture/overview.md#the-ten-rules).

---

## Can a learner switch loops?

Yes, from Settings → _How you practise_, with an honest one-screen explanation of each:

| Option                          | Pitch to the learner                                                             |
| ------------------------------- | -------------------------------------------------------------------------------- |
| **The Daily Refrain** (default) | "Five phrases a day, repeated until they come out without thinking."             |
| **Review & labs**               | "A growing library, scheduled so you review right before you'd forget."          |
| **The Run**                     | "A short daily run with a surprise challenge, and a ladder every phrase climbs." |

Switching is free and reversible. The learner keeps everything.

Loop D is entered as a conversation destination, not listed in this engine switcher. Entering or
leaving it does not change the active practice engine.

⚠️ **Decision needed (Q-06):** is the loop a _setting_ (learner-chosen, as above) or an _assignment_
(chosen by the app from the onboarding goal)? Setting is more respectful; assignment produces
cleaner experiment cohorts and fewer confused learners. Current lean: assign a default from the
onboarding goal, allow switching, and log switches as a signal.
