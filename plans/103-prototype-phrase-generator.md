# v2.0 prototype: make a set from a topic, keywords or a text

- **Requirement IDs:** `AI-06` (guarded phrase suggestions, explicit add), `AI-05` (bounded AI path
  with a bundled fallback), `P2-06` (a scenario builds a coherent set), `P2-07` (add your own)
- **Milestone:** Design exploration (v2.0 rapid prototype); no app release depends on it
- **Status:** 🟡 In progress. Owner request 2026-09-28: "generate my albums/phrases from topic or
  text or keywords … user input … suggest phrases … a UI similar to Tinder to add and to skip".
- **Depends on:** nothing in the app. Works inside `design/design-v2.0/rapid-ui-prototype`. The
  product boundary is plan [97](97-generative-discover-and-phrase-reach.md) and ADR-0010's
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

## Acceptance

- Topic, keywords and text each produce a deck offline for topics the bank covers, in both courses.
- Swipe right/left, the buttons and ←/→ add and skip; Undo restores the last card and its choice.
- Saving creates one set holding exactly the added phrases in the order they were added; a catalog
  phrase is added by its id (no duplicate in Mine); an existing own phrase is reused.
- With `ANTHROPIC_API_KEY` set, the dev server's suggestions are labelled as AI-written; a failed or
  invalid reply falls back to the bank with a notice.
- `npm run check` and the Playwright suite are green.

## Out of scope

The production app (plan 97 owns Discover suggestions there), per-learner spend caps and Q-21's
evaluation, streaming cards as they are written, generated audio, sharing a generated set.
