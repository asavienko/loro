# Loro — rapid UI prototype (v2.0)

A phone-sized web prototype of Loro as a listening-first player: hear a phrase in your language,
say it in the pause, hear it in the language you're learning, then rate how it went.

## Run locally

Node 22+. From this folder:

```bash
npm install
npm run dev          # http://localhost:3000
npm run check        # lint + strict typecheck + unit tests + build
npm run test:e2e     # Playwright at 390×844 (npx playwright install chromium once)
```

The scheduler is Loro's Rust core: the app imports the generated
`packages/core-rs/browser/loro_core.js` from this repository, so run it from a full checkout.

## How it is built

- `src/content/` — vocabulary as JSON (phrases, sets, topics, languages), validated with zod at
  start-up. No learner progress lives here.
- `src/core/fsrs.ts` — FSRS through `core_call` (Rust, WASM). No scheduling maths of its own.
- `src/state/` — `transition(state, event)` is pure, and `chart.ts` holds the allowed events. The
  learner's history is an append-only log; memory and points are derived from it (`memory.ts`).
  `merge.ts` merges two copies (another tab, the server), and `persistence.ts` migrates old saves.
  `selectors.ts` derives every number shown on screen. A rating waits five minutes (change or
  undo) before it joins the log; `displayLearner` applies it at once to every status, due and
  learned figure, while points wait for the log. `clock.ts` is the only place that reads the time.
- `src/audio/` — the loop's side effects, soft cues and the Media Session. Device speech stands in
  for recorded clips, which the backend will provide (`audio`/`durationMs` in content).
- `src/copy/` — every string, in English, Bulgarian and Russian.
- `src/nav/` — hash routes, and Back handling for overlays and sheets.
- `src/screens/`, `src/sheets/`, `src/ui/` — the UI.
- `scripts/icons.mjs` — rebuilds the local icon-font subset from `src/ui/icons.ts`.

Review notes and their status: [`../ui-ux-review/README.md`](../ui-ux-review/README.md).
