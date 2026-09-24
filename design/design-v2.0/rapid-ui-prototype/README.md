# Loro — rapid UI prototype

A phone-sized web prototype of Loro's phrase player: hear a phrase in English, say it in Spanish
in the pause, then hear the Spanish.

## Run locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`
3. Run the state-machine tests:
   `npm test`

No API key is needed; nothing in the app calls Gemini.

## How it is built

- `src/content/` — the vocabulary as JSON (phrases, sets, topics, languages). Content only.
- `src/state/machine.ts` — the app state machine. `transition(state, event)` is pure; the whole
  state is JSON, so it can be copied, persisted and synced (`src/state/persistence.ts`).
- `src/state/memory.ts` — forgetting curve and points. `src/state/selectors.ts` derives every
  number the screens show. `src/state/clock.ts` is the only place that reads the time.
- `src/audio/` — runs each phase: speak the prompt, hold a pause for the learner, speak the phrase.
  Browser speech is a prototype stand-in for recorded audio.
- `src/screens/`, `src/components/` — the UI.

Review notes and their status: [`../ui-ux-review/README.md`](../ui-ux-review/README.md).
