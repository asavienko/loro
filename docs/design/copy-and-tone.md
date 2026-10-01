# Copy and tone

Every learner-facing string lives in `apps/mobile/src/shared/copy/` (`en.ts`, `bg.ts`, `ru.ts`).

## The voice

**Warm, specific, and never disappointed in you.** Loro talks like a patient friend who speaks the
language: it notices what you did, says exactly what changed, and never mentions what you didn't do.

| Loro is                                            | Loro is not                             |
| -------------------------------------------------- | --------------------------------------- |
| Specific — _"Songs: 2 of 5 left"_                  | Vague — _"Keep practising!"_            |
| Present-tense — _"Nothing is due right now."_      | Aspirational — _"You'll get there!"_    |
| Honest — _"Demo sound (no music provider set up)"_ | Falsely positive — _"Nice try!"_        |
| Quiet about failure                                | Punitive, or performatively encouraging |

## The rules

1. **Never shame a missed day.** This is a non-negotiable, and it holds for any notification or
   reminder as well as screen copy. Write _"5 phrases are due"_, never _"You've missed 2 days"_,
   _"Your streak is at risk"_ or _"We miss you!"_.
2. **Say what an action changed.** A confirmation explains the effect, not just _"Saved"_; a rating
   given in the hold is confirmed with Undo.
3. **Say where something came from.** AI phrases and notes are marked as unchecked by a native
   speaker; fallbacks are labelled (_"Demo sound"_, the phrase bank, drawn covers). Nothing pretends
   to be AI, a real recording or reviewed content.
4. **Route forward from empty.** Every empty state says what to do next (_"Make a set or a song
   first; then draw it a cover here."_).
5. **Describe, then offer the next action.** Failures never say "error", "failed" or "invalid", and
   never attribute fault (_"The album couldn't be loaded."_).

## What we never write

| Never                                          | Why                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------- |
| _"Oops!"_ · _"Uh oh!"_                         | Infantilising; there's nothing to apologise for                     |
| _"Great job!"_ · _"Awesome!"_                  | Unspecific praise teaches nothing                                   |
| _"Don't break your streak"_                    | Breaks rule 1                                                       |
| _"Error"_ · _"Failed"_ · _"Invalid"_           | See rule 5                                                          |
| _"Are you sure?"_ for a reversible action      | Offer Undo instead; confirm only what can't be undone               |
| _"Premium"_ · _"Unlock"_ on a learning surface | No paywall is decided ([Q-08](../decisions/open-questions.md#q-08)) |
| Exclamation marks in UI copy                   | They belong to the phrases being learned, not the interface         |

## Target-language content

- Full punctuation, including `¿` and `¡`; European Spanish (`es-ES`) as actually spoken.
- The translation is what a speaker would **say**, not a gloss; word glosses may be literal.
- Respellings use capitals for the stressed syllable: `lah KWEN-tah, por fah-VOR`.
- New text awaits native review ([Q-23](../decisions/open-questions.md#q-23)).
