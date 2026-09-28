# v2.0 prototype: every phrase has an image, its sounds, a memory hint and a grammar rule

- **Requirement IDs:** `P2-04` (phrase detail), `F-03` (offline-first), `AI-06` (suggested phrases)
- **Milestone:** Design exploration (v2.0 rapid prototype); no app release depends on it
- **Status:** 🟡 In progress. Owner request 2026-09-28: "every phrase should have image, phonetic,
  mnemonic hint, and grammar rules".
- **Depends on:** plans [103](103-prototype-phrase-generator.md) (the phrase bank and suggestions)
  and [104](104-prototype-react-native.md) (paused; it will read the same content).
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
  otherwise asks the writer when the server has one. With neither, its details say where notes come
  from and offer to ask again. Nothing is invented on the device.

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

## Acceptance

- `validateContent()` fails for a course or bank phrase missing its image or any note, or a
  translation of one.
- Every phrase's details show its image, IPA and respelling, memory hint and grammar rule, in each
  UI language.
- A phrase added from the bank or from AI suggestions keeps all four.
- `npm run check` and the Playwright suite are green.

## Out of scope

Commissioned illustrations or photographs, recorded pronunciation, notes for another learner's
language pair beyond the three UI languages, and native review (recorded in `meta.json`).
