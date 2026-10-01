# Copy and tone

Every learner-facing string lives in `apps/mobile/src/shared/copy/` (`en.ts`, `bg.ts`, `ru.ts`).

## The voice

**Warm, specific, and never disappointed in you.** Loro talks like a patient friend who speaks the
language: it notices what you did, says exactly what changed, and never mentions what you didn't do.

| Loro is                                            | Loro is not                             |
| -------------------------------------------------- | --------------------------------------- |
| Specific — _"Phrase decks: 2 of 3 left"_           | Vague — _"Keep practising!"_            |
| Present-tense — _"Nothing is due right now."_      | Aspirational — _"You'll get there!"_    |
| Honest — _"Demo sound (no music provider set up)"_ | Falsely positive — _"Nice try!"_        |
| Quiet about failure                                | Punitive, or performatively encouraging |

## The rules

1. **Never shame a missed day.** This is a non-negotiable. It constrains reminders and any widget,
   not just strings. Write _"Five phrases are ready"_, never _"You've missed 2 days"_, _"Your streak
   is at risk"_ or _"We miss you!"_.
2. **Say what an action changed.** A confirmation explains the effect, not just _"Saved"_; a rating
   given in the hold is confirmed with Undo.
3. **Say where something came from.** AI phrases are marked unchecked by a native speaker; fallbacks
   are labelled (_"Demo sound"_, the phrase bank, drawn covers). Nothing pretends to be AI, a real
   recording or reviewed content.
4. **Route forward from empty.** Every empty state says what to do next (_"Make a set or a song
   first; then draw it a cover here."_).
5. **Describe, then offer the next action.** Failures never say "error", "failed" or "invalid", and
   never attribute fault.

## What we never write

| Never                                          | Why                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------- |
| _"Oops!"_ · _"Uh oh!"_                         | Infantilising; there's nothing to apologise for                     |
| _"Great job!"_ · _"Awesome!"_                  | Unspecific praise teaches nothing                                   |
| _"Don't break your streak"_                    | Breaks rule 1                                                       |
| _"Error"_ · _"Failed"_ · _"Invalid"_           | See rule 5                                                          |
| _"Are you sure?"_ for a reversible action      | Offer Undo instead; confirm only what can't be undone               |
| _"Premium"_ · _"Unlock"_ on a learning surface | No paywall is decided ([Q-08](../decisions/open-questions.md#q-08)) |
| Exclamation marks in UI chrome                 | Reserved for target-language celebrations                           |

## Target-language content

- Full punctuation, including `¿` and `¡`; European Spanish (`es-ES`) as actually spoken.
- The translation is what a speaker would **say**, not a gloss; word glosses may be literal.
- Respellings use CAPS for stress: `meh PO-neh oon kor-TAH-doh`.
- Target-language celebrations are content, not UI copy, and are not translated.
- New text awaits native review ([Q-23](../decisions/open-questions.md#q-23)).
