# Vision

## One sentence

Loro teaches Spanish by the phrase: you collect the phrases _you_ will actually say, tell the app
what's hard about each one, and everything downstream — what repeats, what returns when, what your
progress screen shows — is shaped by that.

## The thesis

Most language apps hand you a curriculum and measure your compliance with it. The unit of learning
is a word or a grammar rule, the unit of progress is a lesson, and the reward is a streak for having
done what you were told.

Loro inverts three of those:

|                                           | Conventional app          | Loro                                                                |
| ----------------------------------------- | ------------------------- | ------------------------------------------------------------------- |
| **Unit of learning**                      | Word / grammar point      | **Phrase** — the smallest thing you can actually say to a person    |
| **Who chooses content**                   | The curriculum            | **You** — by association, by scenario, or by pasting a menu         |
| **What the model knows about difficulty** | Inferred from your errors | **You told it** — difficulty + "what's tricky" tags, set as you add |
| **What progress means**                   | Lessons completed         | **Effort dropping** on phrases you own                              |

The third row is the load-bearing one. From the blueprint's own framing:

> Difficulty and "what's tricky" tags, set while adding in Phase 2, reshape the practice queue in
> Phase 3 and roll up into your stats in Phase 4. — `Loro.dc.html:117–120`

That is the connective thread. A learner who marks _"¿Dónde está la parada de taxis?"_ as
**Difficult** with a **Pronunciation** tag has, in one tap, told the system to: repeat it more often
in the hands-free stream, route it to a say-it-out-loud review card instead of a recall card,
prioritise it in the prosody lab, and count it toward the "Pronunciation" bar on the progress
screen. No inference, no cold start, no guessing.

## Why phrases

1. **They're usable immediately.** "La cuenta, por favor" works the first day. "The subjunctive"
   never works on its own.
2. **They carry pronunciation and prosody.** A phrase has melody; a word list doesn't. Spanish
   question intonation, the rise on _¿De verdad?_, the stress moving to _ca-**FÉ**_ — none of that
   survives being taught word by word.
3. **They're memorable as units.** Chunking is how fluent speakers actually store language.
4. **They make the parrot honest.** Loro means parrot. Repeating until it's yours is the method, not
   a shortcut — and the app says so on the welcome screen (`Loro.dc.html:149`).

## Who it's for

Primarily: **an adult with a real reason and a real deadline.** A trip in twelve days. A partner's
family. A job that just moved to Madrid. See [personas.md](personas.md).

Not for: learners who want a gamified habit with no destination, or academic learners who need
grammatical scaffolding and written exams. Both are well served elsewhere.

## What Loro is not

- **Not a grammar course.** No conjugation tables, no exercises about rules. Grammar shows up only
  as a word-by-word gloss on a phrase you already care about.
- **Not an unbounded AI companion.** v1.1 includes an optional open-chat surface authored in
  `Loro Chat.dc.html`, but the product still does not outsource its curriculum, relationship, or
  daily loop to a model. Conversation has learner-chosen topics, a finite bundled offline floor,
  explicit save/review handoffs, bounded provider context, and a message inspector that turns talk
  back into phrases. Provider availability enhances it; it never gates learning.
- **Not a streak machine.** The streak exists (it's motivating and cheap), but the honest progress
  surfaces are phrase mastery, the automaticity meter, and the ladder distribution — all of which
  reflect ability, not attendance. Nothing in Loro punishes a missed day; the roguelike loop states
  it outright: _"Nothing lost — you only climb or hold."_ (`Loro.dc.html:1690`)
- **Not surveillance.** Recorded audio is scored on-device and always discarded. The prosody screen
  prints this promise to the user (`Loro.dc.html:1281`), so it constrains the architecture.

## The three product bets

The blueprint is unusual in that it doesn't pretend to have resolved the central design question. It
ships **three complete, mutually exclusive philosophies** of what daily practice should be:

- **Loop A — the engine.** Spaced repetition over a growing library, plus pronunciation and prosody
  labs. Optimises _retention across breadth_.
- **Loop B — the ritual.** Five phrases a day, three waves, rotating manner each rep, until each one
  locks in. Optimises _automaticity through depth_. Marked ★ hero in the blueprint.
- **Loop C — the run.** A bounded run: a fixed spine plus one challenge dealt from a deck, and a
  five-rung ladder every phrase climbs permanently. Optimises _sustained engagement without
  cruelty_.

We do not resolve this by guessing. We resolve it by making the loop a plug-in
([practice-loops.md](practice-loops.md),
[ADR-0006](../architecture/adr/0006-pluggable-practice-engines.md)) and letting real retention data
pick the winner. **v1 ships Loop B as the hero** with the hands-free stream alongside it, because
depth-first is the differentiated bet and the cheapest to build well.

The v1.1 package also authors **Loop D — guided open chat** (`Loro Chat.dc.html:91–99`). It is
supplementary conversation, not a fourth answer to the daily-practice question and therefore not a
`PracticeEngine`. It reads from bundled topic/phrase content and hands explicitly kept lines back to
the shared phrase and Review paths. Its live text provider is guarded garnish over a usable offline
conversation, never the method itself.

## Success conditions

Loro works if, at 8 weeks:

| Condition                          | Measure                                                  | Target |
| ---------------------------------- | -------------------------------------------------------- | ------ |
| People own phrases, not lessons    | Median phrases at `mastered` per active learner          | ≥ 40   |
| The tagging thread is real         | % of added phrases with ≥1 tag or non-default difficulty | ≥ 55%  |
| Depth actually happens             | Median reps per phrase before graduation                 | ≥ 18   |
| It survives the trip               | % of trip-mode users who open the app _while abroad_     | ≥ 60%  |
| Speaking is the habit, not reading | % of sessions containing ≥1 mic attempt                  | ≥ 70%  |
| It doesn't need us                 | % of sessions fully served offline                       | ≥ 80%  |

Anti-goals we will actively watch (guardrails in [metrics.md](metrics.md)): streak-driven retention
with no mastery growth; collection hoarding (adding phrases, never practising); mic avoidance.

## The name

**Loro** — parrot, in Spanish. The mascot is a parrot 🦜. The method is repetition until it's yours.
The welcome screen says it plainly: _"like a parrot, until they're yours."_
