# v2.0 prototype: make a set from a topic, keywords or a text

- **Requirement IDs:** `AI-06` (guarded phrase suggestions, explicit add), `AI-05` (bounded AI path
  with a bundled fallback), `P2-06` (a scenario builds a coherent set), `P2-07` (add your own)
- **Milestone:** Design exploration (v2.0 rapid prototype); no app release depends on it
- **Archived 2026-09-30:** the web prototype became the app. The generator logic (`local.ts`,
  `suggest.ts`, `remote.ts`, `deck.ts`) and its tests now live in
  `apps/mobile/src/shared/generate/`. The web swipe-deck UI and the dev server's Claude writer
  (`server/suggest.ts`) were removed with the prototype (Git history at `52a0e3b`). The native Make
  a set screen is plan [104](../../104-prototype-react-native.md) scope 4; a live writer needs a
  server route, which plan [97](../../97-generative-discover-and-phrase-reach.md) owns
  (`/v1/phrases/suggest`, Q-21).
- **Status (at archive):** 🟡 Scope 1–7 implemented and tested on 2026-09-28. **Left:** one run of
  the live path with a real `ANTHROPIC_API_KEY`. The request shape, reply parsing, refusal handling
  and the fallback are verified against a stand-in server and a refused (unauthorised) call only.
  **Blocked by:** a key on the machine that runs it. The bank and its copy await native review, as
  all prototype content does. Owner request 2026-09-28: "generate my albums/phrases from topic or
  text or keywords … user input … suggest phrases … a UI similar to Tinder to add and to skip".
- **Depends on:** nothing in the app. Works inside `design/design-v2.0/rapid-ui-prototype`. The
  product boundary is plan [97](../../97-generative-discover-and-phrase-reach.md) and ADR-0010's
  amendment: runtime suggestions are the learner's own phrases, marked, editable, never auto-added.
- **Number allocation:** the highest assigned ID was 102 (worktrees and untracked `plans/` files
  checked); this plan is **103**. The next new plan is 104.

## Outcome

A learner types a **topic** ("at the pharmacy"), a few **keywords** ("hotel, towel, breakfast") or
pastes a **text** (a message, a menu, a few lines they want to say), and gets a deck of suggested
phrases in the language they are learning. They swipe right to add a phrase and left to skip it, one
card at a time, and what they added becomes a new set of their own (an "album"), or joins the set
they started from.

## Product boundary (from plan 97, applied to the prototype)

- **Explicit add, one phrase at a time.** A swipe right, the Add button or → adds one phrase. There
  is no "Add all": the deck is the review.
- **Editable before add.** Every card can be corrected (both languages) before it is added.
- **Provenance is visible.** A card says where it came from: a course set ("From Café & Mañanas"),
  Loro's phrase bank, or "Written by AI · not checked by a native speaker". An added AI phrase keeps
  that mark in its details.
- **Honest offline.** With no generator reachable, suggestions come from the bundled phrase bank and
  the course; if nothing matches, the screen says so and offers Add your own. Nothing is invented to
  fill the deck.
- **Untrusted input.** What the learner types is data: bounded in length, wrapped as data in the
  prompt, and the reply is schema-validated, clipped and deduplicated before it is shown.
- **The key stays on the server.** The prototype's dev/preview server calls Claude with
  `ANTHROPIC_API_KEY` from its own environment. The browser never sees a key. A static build has no
  generator and uses the bank.
- **No audio leaves the device.** The generator takes text only.

## Scope

1. **Phrase bank** — `src/content/bank.json`: themes with multilingual keywords, and phrases per
   course language with every native translation, validated like the rest of the content. Awaits
   native review (recorded in `meta.json`).
2. **Offline generator** — `src/generate/local.ts`: topic, keyword and text input reduced to terms
   (stop words dropped, inflections matched by shared stems), ranked over the course's catalog
   phrases and the bank. Pure and unit-tested.
3. **Live generator** — a Vite plugin serving `GET /api/phrases/status` and
   `POST /api/phrases/generate` in dev and preview. Claude (`claude-opus-5`, structured JSON output,
   refusal fallback) writes up to 12 phrases; request and reply are validated with zod. The client
   falls back to the bank on any failure and says so.
4. **One save event** — `ADD_PICKS` creates the new own phrases and the set (or extends one) in a
   single transition, so ids, undo and sync stay atomic. Own phrases may carry `origin` (`bank` |
   `ai`), sanitised on load and merged like the rest of the phrase.
5. **Make a set** — a full-screen flow: input (Topic · Keywords · Text, with topic chips), the swipe
   deck (drag, buttons, arrow keys, Undo, Edit, Listen), and the save step (name, the kept list).
   Opened from Library's +, from an Explore search with no phrase, and from your own set.
6. **Copy** in English, Bulgarian and Russian; icons added to the local subset.
7. **Tests** — unit tests for the bank, generator, deck, save event, server validation; Playwright
   for the whole flow offline, the live path with a mocked server, the fallback, the empty state,
   the Bulgarian course, accessibility and 44 px targets.

## Implementation record (2026-09-28)

| Scope               | Where                                                                           | Evidence                                                                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Phrase bank       | `src/content/bank.json`, `schema.ts` (`bankProblems`)                           | 12 themes, 72 es-ES and 60 bg-BG phrases; build and `content.test.ts` validate it                                                                                     |
| 2 Offline generator | `src/generate/local.ts`                                                         | `local.test.ts`: terms, stems, topic/keywords/text, both courses, duplicates, exclusions                                                                              |
| 3 Live generator    | `server/suggest.ts`, `src/generate/remote.ts`, `suggest.ts`                     | `server/suggest.test.ts`, `suggest.test.ts`; dev-server smoke: no key → offline, invalid key → refused, bad body → 400                                                |
| 4 One save event    | `ADD_PICKS`, `OwnPhrase.origin`                                                 | `machine.test.ts`, `persistence.test.ts`                                                                                                                              |
| 5 Make a set        | `src/screens/MakeSetScreen.tsx`, `src/ui/SwipeDeck.tsx`, `src/generate/deck.ts` | `deck.test.ts`; entry points in Library +, My sets, Explore (no phrase), own set                                                                                      |
| 6 Copy and icons    | `src/copy/{en,bg,ru}.ts` (`make`), `auto_awesome`/`undo` in the icon subset     | `copy.test.ts` key parity; `ui.test.ts` font drift                                                                                                                    |
| 7 Tests             | `e2e/make-set.spec.ts`, `e2e/a11y.spec.ts`                                      | 11 flow tests green in Chromium, WebKit, Firefox and the production preview; axe, 44 px and text size on the three steps at 100%/200%; full Chromium suite 350 passed |

Found while building: a card on its way out stayed in the accessibility tree (two cards were read at
once), so a leaving card is now inert and hidden; and a drag must not start a text selection, so the
draggable card is not selectable.

## Acceptance

- [x] Topic, keywords and text each produce a deck offline for topics the bank covers, in both
      courses.
- [x] Swipe right/left, the buttons and ←/→ add and skip; Undo restores the last card and its
      choice.
- [x] Saving creates one set holding exactly the added phrases in the order they were added; a
      catalog phrase is added by its id (no duplicate in Mine); an existing own phrase is reused.
- [ ] With `ANTHROPIC_API_KEY` set, the dev server's suggestions are labelled as AI-written
      (verified with a stand-in server); a failed or invalid reply falls back to the bank with a
      notice (verified). A run against the real service remains.
- [x] `npm run check` and the Playwright suite are green.

## Out of scope

The production app (plan 97 owns Discover suggestions there), per-learner spend caps and Q-21's
evaluation, streaming cards as they are written, generated audio, sharing a generated set.
