# Copy and tone

Loro's voice, extracted from the blueprint's own microcopy. Every example below is verbatim from
`Loro.dc.html` unless marked otherwise.

---

## The voice, in three lines

**Warm, specific, and never disappointed in you.**

Loro talks like a patient friend who happens to speak Spanish — one who notices what you did, tells
you exactly what to change, and never mentions what you didn't do.

| Loro is                                                     | Loro is not                               |
| ----------------------------------------------------------- | ----------------------------------------- |
| Specific — _"Move the stress to the end: ca-**FÉ**"_        | Vague — _"Keep practising!"_              |
| Physical — _"flutter your tongue tip behind your teeth"_    | Abstract — _"improve your pronunciation"_ |
| Present-tense — _"It comes out without thinking now"_       | Aspirational — _"you'll get there!"_      |
| Honest — _"You flatten the ending"_                         | Falsely positive — _"Nice try!"_          |
| Bilingual by design — _"¡Hecho!"_ then _"Session complete"_ | Monolingual, or Spanish as decoration     |
| Quiet about failure                                         | Punitive, or performatively encouraging   |

---

## The five rules

### 1 · Never shame a missed day

This is the product's strongest copy constraint, and it's architectural — it constrains the
notification scheduler and the widget, not just strings
([`architecture/widgets-notifications.md`](../architecture/widgets-notifications.md#copy-constraints)).

| ✅                                           | ❌                            |
| -------------------------------------------- | ----------------------------- |
| _"16 left — finish the essentials today"_    | _"You've missed 2 days"_      |
| _"You own 84 of 100 phrases"_                | _"Your streak is at risk"_    |
| _"✓ Nothing lost — you only climb or hold."_ | _"Don't lose your progress!"_ |
| _"Five phrases are ready. ~4 minutes."_      | _"We miss you!"_              |

The roguelike loop states the principle outright (`Loro.dc.html:1690`), and it applies to every
surface.

### 2 · Name the specific thing to change

The pronunciation lab's feedback is the model for all instructional copy: one concrete, physical
change.

> _"Soften the ñ in baño — say 'ba-nyo', tongue to the roof of the mouth."_ — `3053` _"Move the
> stress to the end: ca-FÉ and fa-VOR. Let the pitch rise on the last syllable."_ — `3056` _"The
> double rr in perro & corre needs a real roll — flutter your tongue tip behind your teeth."_ —
> `3059` _"You flatten the ending — keep the pitch climbing. That rise is what makes it a
> question."_ — `3126`

Pattern: **name the error → give the physical fix → (sometimes) say why it matters.** Never a list.
Never "work on your pronunciation".

### 3 · State the consequence of an action

The blueprint's toasts don't confirm; they explain what just changed. This is what makes the tagging
thread feel real rather than decorative.

> _"Difficult — repeats more, comes back sooner"_ — `2564` _"Easy — drifting to the back"_ — `2564`
> _"♥ Loved — surfacing more often"_ — `2575` _"✓ Learned — removed from the stream"_ — `2576`
> _"Added — here are more like it"_ — `2324` _"Back in a few minutes"_ / _"Pushed out 5 days"_ —
> `2765`

Compare with what a normal app writes: _"Saved"_. The blueprint's version teaches the model.

### 4 · Frame removal of help as the reward

The prosody lab's cue ladder inverts the usual reward structure, and the copy has to carry that.

> _"Leveled up — a cue just dropped"_ _"Next time you get less help. That's the point."_ — `1257`

That second line is doing real work: without it, losing the model audio would read as a punishment.

### 5 · Spanish first for feeling, English for meaning

Spanish appears for emotional beats and celebrations; English does the explaining. Never Spanish as
decoration on a UI label.

> _"¡Hola! I'm Loro"_ → _"Learn Spanish by the phrase"_ _"¡Hecho!"_ → _"Session complete"_ _"¡Escena
> completada!"_ → _"You held a full café exchange."_ _"¡BIENVENIDO A MADRID!"_ → _"Survival deck is
> live"_ _"¡Hecho! Today is done"_ → _"Today's set is warmed up"_

The Spanish is always in the italic serif; the English is always in the sans
([design-system.md](design-system.md#typography)).

---

## Patterns by surface

### Buttons

Verbs, with a direction when they advance.

| Context | Copy                                                                             |
| ------- | -------------------------------------------------------------------------------- |
| Advance | `Continue` · `Let's go →` · `Next phrase →` · `Take it on →`                     |
| Commit  | `Add to my stream` · `Add 8 & load into today's stream` · `Build my countdown →` |
| Start   | `Start learning 🎧` · `Start a run →` · `Start midday wave →`                    |
| Repeat  | `Try again ↺` · `Review again` · `Run the wave again ↺` · `Another run ↺`        |
| Speak   | `Say it` · `Chorus it` · `Faster!` · `Fill & say` · `Respond` · `Say it cold`    |
| Reveal  | `Show answer` · `Reveal & hear it` · `Hear it` · `Slow`                          |

Note the mode-specific mic labels (`3415`). _"Faster!"_ with an exclamation mark is the only
exclamation on a button in the whole app, and it's there because Speed mode is meant to feel urgent.

### Section labels

11 px uppercase, tracked. Often a **question** rather than a noun:

> `How hard is it for you?` · `What's tricky about it?` · `How's this one?` ·
> `How well did you recall it?` · `Word by word` · `In context` · `Memory hook` ·
> `Add related to your stream` · `What's tricky in your stream` · `This phrase · three skills`

Questions are why the tagging sheet feels like a conversation rather than a form. _"How hard is it
for you?"_ — the _for you_ is load-bearing.

### Helper text

Short, and it always says what the answer affects:

> _"We'll lead with the phrases that fit."_ _"Sets how long and tricky your first phrases are."_
> _"Your daily stream is built to fit."_ _"Choose at least one — these seed your stream now."_
> _"pick any"_ · _"tap to toggle"_ · _"helps it stick"_ · _"tap to send · ♪ to hear it first"_

### Empty states

Always route forward. Never a dead end.

> _"Nothing more to suggest here. Try another theme, scenario, or type your own above."_ _"Your
> stream is empty / Add phrases to start listening"_ _"No phrase selected / Add or tap a phrase to
> view it"_ _"No cards due / Add phrases to review"_

### Status and progress

> _"3 of 5 locked in"_ · _"day 2/4"_ · _"Rep 4 / 6"_ · _"2 / 5"_ · _"12 days away"_ · _"38 / 100"_ ·
> _"1.2s effort ↓"_ · _"warming up"_ → _"getting smoother"_ → _"quick & smooth"_ → _"instant &
> smooth"_

That four-step effort ladder (`3411`) is the plain-language version of the automaticity number, and
it's what a learner actually reads.

### Rewards

Short, present tense, and about what's now true.

> _"Locked in for today / It comes out without thinking now."_ _"'¿Qué tal?' graduated / Out of
> rotation — you own it now."_ _"it climbed"_ → _"You bent, swerved, and climbed. X is stronger."_
> _"¡Perfecto! You said the whole phrase ⭐⭐⭐"_ _"Native-like melody"_ / _"Getting closer"_ /
> _"Keep shaping it"_ _"+7 clearer than last time"_

Note the three-tier verdict: praise at ≥85, honest encouragement at ≥75, and neutral instruction
below. _"Keep shaping it"_ is not _"try harder"_ — it's a description of the work.

### Errors and failures

None of these use the words "error", "failed", or "invalid".

> _"Didn't catch it — try that word again"_ — ASR miss _"No mic here — tap to reveal a word"_ — no
> recogniser _"Couldn't hear that clearly — try again"_ — low SNR (ours, not the blueprint's) _"That
> didn't sound like the phrase — want to hear it again?"_ — unalignable take (ours)

Pattern: **describe what happened, offer the next action.** Never attribute fault.

---

## Spanish content conventions

For catalog authoring ([`process/content-authoring.md`](../process/content-authoring.md)):

| Rule                                                       | Example                                                                                        |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Full punctuation, including `¿` and `¡`                    | `¿Cuánto cuesta?`                                                                              |
| European Spanish (`es-ES`) as actually spoken              | `Me pone un cortado` — not `Quisiera un cortado`                                               |
| `en` is what an English speaker would **say**, not a gloss | `Me pone un cortado, por favor` → _"A cortado, please"_ — not _"Me put a cortado, for favour"_ |
| Respelling uses CAPS for stress                            | `meh PO-neh oon kor-TAH-doh por fah-VOR`                                                       |
| Word glosses may be literal — that's their job             | `¿Dónde` → _"Where"_ · `la parada` → _"the stop"_                                              |
| Memory hooks use etymology or imagery                      | _"'Encantado' = enchanted — you are 'enchanted to meet you.'"_                                 |
| Examples embed the phrase verbatim in a longer sentence    | _"Perdone, ¿dónde está la parada de taxis más cercana?"_                                       |
| Register is marked, and matters                            | `neutral` \| `casual` \| `formal`                                                              |

---

## What we never write

| Never                                          | Why                                                                  |
| ---------------------------------------------- | -------------------------------------------------------------------- |
| _"Oops!"_ · _"Uh oh!"_                         | Infantilising, and there's nothing to apologise for                  |
| _"Great job!"_ · _"Awesome!"_                  | Unspecific praise teaches nothing                                    |
| _"You're on fire!"_                            | The streak is a chip, not a personality                              |
| _"Only 3 days left!"_ on a non-trip event      | Manufactured urgency                                                 |
| _"Don't break your streak"_                    | The rule-1 violation                                                 |
| _"Error"_ · _"Failed"_ · _"Invalid"_           | See the errors section                                               |
| _"Loading…"_                                   | There's almost nothing to load — data is local                       |
| _"Are you sure?"_                              | Undo instead ([FS](../product/functional-spec.md#global-behaviours)) |
| _"Premium"_ · _"Unlock"_ on a learning surface | Paywalls belong at the three defined moments, not sprinkled          |
| Emoji in body copy                             | Emoji are structural here (row identity, tiles), not punctuation     |
| Exclamation marks in UI chrome                 | Reserved for Spanish celebrations and `Faster!`                      |

---

## Localisation notes

English-only in v1, but every string goes through ICU message format from day one
([`process/localization.md`](../process/localization.md)).

Three things that will be hard to translate and need translator notes:

1. **The Spanish celebrations stay Spanish.** _"¡Hecho!"_ is not translated into the UI language —
   it's target-language content, not UI copy.
2. **The pronunciation fixes are language-pair-specific.** _"Say 'ba-nyo'"_ only makes sense to an
   English speaker. Each fix template is keyed by `(target_language, ui_language)`.
3. **The effort ladder is idiomatic.** _"quick & smooth"_ → _"instant & smooth"_ is a progression a
   translator needs to preserve as a progression, not four independent strings. They ship as a group
   with a note.
