# v2.0 prototype: every phrase has an image, its sounds, a memory hint and a grammar rule

- **Requirement IDs:** `P2-04` (phrase detail), `F-03` (offline-first), `AI-06` (suggested phrases)
- **Milestone:** Design exploration (v2.0 rapid prototype); no app release depends on it
- **Archived 2026-09-30:** implemented. The notes content and the device's rules live in
  `apps/mobile/src/shared/content/` and `apps/mobile/src/shared/notes/`, and the app's player shows
  them. The writer's live run goes with plan 103's: the dev server that called it was removed with
  the web prototype (Git history at `52a0e3b`).
- **Status (at archive):** 🟡 Scope 1–8 implemented and tested on 2026-09-28: every phrase has all
  four, including one the learner types that neither the bank nor the writer covers (scope 8, the
  device's rules). **Left:** one run of the writer against the real service (its notes and pictures
  are verified against a stand-in only), the same run plan 103 waits for. **Blocked by:** a key on
  the machine that runs it. All new text awaits native review (`meta.json`), the device's rule
  library too. Owner request 2026-09-28: "every phrase should have image, phonetic, mnemonic hint,
  and grammar rules".
- **Depends on:** plans [103](103-prototype-phrase-generator.md) (the phrase bank and suggestions)
  and [104](../../104-prototype-react-native.md) (paused; it will read the same content).
- **Number allocation:** the highest assigned ID was 104; this plan is **105**. The next new plan
  is 106.

## Outcome

Every phrase Loro provides or writes carries four things, and the build refuses one that doesn't:

1. **An image** — a pictogram of one to three Material Symbols on the topic's colour. Drawn, as the
   covers are (the round-3 decision): it works offline, costs nothing to load and never shows text.
   It is decorative for screen readers: the phrase and its meaning are text.
2. **Its sounds** — IPA and a respelling, with a short note on the sound to watch.
3. **A memory hint** — a hook for the phrase or its key word.
4. **A grammar rule** — the one rule the phrase shows.

Notes are written in English and translated into Bulgarian and Russian (never into the phrase's own
language), as the existing notes are.

## What "every phrase" covers

- **The course** (34 phrases): the 60 missing notes and all 34 images.
- **The phrase bank** (132 phrases): all notes and images, so a phrase added through Make a set
  keeps them: an own phrase from the bank keeps its bank id and reads them from the bank.
- **AI suggestions**: the writer returns all four for each phrase, in the learner's language,
  schema-checked like the phrases; an added AI phrase keeps them.
- **A phrase the learner types**: it takes the bank's notes when the bank has the same phrase, and
  otherwise asks the writer when the server has one. Until then, or with no writer at all, the
  device works its notes out (scope 8), and its details say so. `Phrase.image` and `Phrase.notes`
  are not nullable, so no phrase can be without them. A text with nothing to say aloud (no letter or
  digit) is not a phrase: the store refuses it.

## Scope

1. Schema: `image` and all three notes required for course and bank phrases; bank note translations
   validated like the course's; icons checked against the registry.
2. Content: the course's missing notes and images; the bank's notes, translations and images.
3. State: an own phrase keeps `bankId`, or its AI-written `notes` and `image`, sanitised on load.
4. Writer: suggestions and a notes route return image and notes; the client validates them.
5. UI (web prototype): the image on the player, the phrase details, the suggestion cards and the
   rows; the three notes always shown; the respelling under the phrase in its details.
6. Icons: the image icons join the subset (web woff2 and the native app's TrueType).
7. Tests: content validation, state, server and client parsing, E2E for the image and the notes.
8. The device's notes (`src/notes/`), for a typed phrase neither the bank nor the writer covers.
   Each is derived from the phrase by written rules; nothing is guessed:
   - **Sounds**: Castilian Spanish from its spelling (glides, syllables, the accent and vowel-n-s
     stress rule, soft b/d/g, n assimilation); Bulgarian from its letters with voicing and final
     devoicing. A Bulgarian word's stress only from the course's and bank's own transcriptions (or
     the word with its article). An unseen word keeps full vowels, no mark, and its note names it.
     Digits are spelled out.
   - **Grammar**: a written rule library in English, Bulgarian and Russian, picked by the
     construction the phrase shows, ending on a rule true of any phrase.
   - **Memory**: a cognate with the learner's meaning, a word shared with one of Loro's phrases, or
     its pieces or beats.
   - **Picture**: icons of Loro's phrases sharing its words (rarer words weigh more) and an everyday
     word list; speech bubbles when nothing matches.

## Implementation record (2026-09-28)

| Scope     | Where                                                                                                                                  | Evidence                                                                                                                                                                                                                                                                                                         |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Schema  | `content/schema.ts` (`notesSchema`, `imageSchema`, `bankProblems`)                                                                     | `content.test.ts`: a missing note or image fails; every bank note has its versions                                                                                                                                                                                                                               |
| 2 Content | `phrases.json`, `note-translations.json`: 60 notes, 34 pictures; `bank.json`, `bank-note-translations.json`: 396 notes, 132 pictures   | Written in the existing notes' voice (the bank by four agents from one brief and a checker, then read and merged)                                                                                                                                                                                                |
| 3 State   | `OwnPhrase.bankId`, `notes`, `image`; `SET_OWN_NOTES`; load sanitising                                                                 | `machine.test.ts`, `persistence.test.ts`, `deck.test.ts`                                                                                                                                                                                                                                                         |
| 4 Writer  | `server/suggest.ts` (notes on every suggestion, `/api/phrases/notes`), `generate/remote.ts`                                            | `server/suggest.test.ts`, `suggest.test.ts`                                                                                                                                                                                                                                                                      |
| 5 UI      | `ui/PhraseImage.tsx`; the player's cover, the details (picture, sounds, three notes, Write its notes), the Make a set card's band      | `e2e/phrase-notes.spec.ts`, `e2e/make-set.spec.ts`, the a11y suite's details screen                                                                                                                                                                                                                              |
| 6 Icons   | 203 icons: the web woff2 and the native app's TrueType (a 32-bit map for one past U+FFFF)                                              | `ui.test.ts` holds content icons to the registry                                                                                                                                                                                                                                                                 |
| 7 Tests   | as above; the full Chromium suite green (355)                                                                                          | 2026-09-28                                                                                                                                                                                                                                                                                                       |
| 8 Device  | `src/notes/` (sounds, grammar, memory, picture, numbers); `state/catalog.ts` fallback; non-null `Phrase` notes/image; `limits.sayable` | `notes.test.ts`: 140 of the 166 course and bank transcriptions match exactly and the 26 others are listed with reasons (the corpus contradicts itself); every course/bank phrase typed in every UI language yields schema-valid notes and registry icons; `e2e/phrase-notes.spec.ts`; the full suite green (359) |

## Acceptance

- [x] `validateContent()` fails for a course or bank phrase missing its image or any note, or a
      translation of one.
- [x] Every course and bank phrase's details show its image, IPA and respelling, memory hint and
      grammar rule, in each UI language (English, Bulgarian and Russian checked end to end).
- [x] A phrase added from the bank or from AI suggestions keeps all four (AI verified with a
      stand-in writer).
- [x] A phrase the learner types that neither the bank nor the writer covers has all four, worked
      out on the device and marked as such; the writer's notes replace them when it answers.
- [x] `npm run check` and the Playwright suite are green.

## Out of scope

Commissioned illustrations or photographs, recorded pronunciation, notes for another learner's
language pair beyond the three UI languages, and native review (recorded in `meta.json`).
