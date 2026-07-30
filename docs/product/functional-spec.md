# Functional specification

Screen-by-screen behaviour for all 23 learner screens: the original 21 in `Loro.dc.html` and the two
v1.1 conversation screens in `Loro Chat.dc.html`. The navigation shell in `Navigation.dc.html` wraps
them and is specified separately; it is not a twenty-fourth learner destination. The PRD says _what_
exists ([prd.md](prd.md)); this says _how it behaves_ — states, transitions, and edge cases.

Each screen section carries its blueprint anchor. **Open the blueprint and interact with the screen
before implementing it.** The prototype is executable spec; the prose below is a summary of it.

**Contents and implementation status (2026-07-30)**

`Built` means an Expo route exists; it does not mean every target behaviour in that section is
complete. `Planned` means the section specifies future behaviour and has no current learner route.

| #                                        | Screen             | Loop | Rel  | Repository status           |
| ---------------------------------------- | ------------------ | ---- | ---- | --------------------------- |
| [1](#1-onboarding)                       | Onboarding         | —    | v1   | Built · `/onboarding`       |
| [2](#2-add-phrases)                      | Add phrases        | —    | v1   | Built · `/add`              |
| [3](#3-phrase-detail)                    | Phrase detail      | —    | v1   | Built · `/phrase/[id]`      |
| [4](#4-adaptive-stream)                  | Adaptive stream    | all  | v1   | Built · `/practice/stream`  |
| [5](#5-speak-to-progress)                | Speak to progress  | A    | v1   | Planned                     |
| [6](#6-review-session)                   | Review session     | A    | v1.1 | Planned                     |
| [7](#7-roleplay)                         | Roleplay           | A+   | v1.1 | Planned                     |
| [8](#8-memory-model)                     | Memory model       | A+   | v1.1 | Planned                     |
| [9](#9-pronunciation-lab)                | Pronunciation lab  | A+   | v1.1 | Planned                     |
| [10](#10-prosody-lab)                    | Prosody lab        | A+   | v1.1 | Planned                     |
| [11](#11-today--the-ritual)              | Today — the ritual | B    | v1   | Built · `/`                 |
| [12](#12-the-refrain)                    | The Refrain        | B    | v1   | Built · `/practice/refrain` |
| [13](#13-the-run)                        | The Run            | C    | v2   | Planned                     |
| [14](#14-phrasebook--collection--ladder) | Phrasebook         | C    | v2   | Planned                     |
| [15](#15-progress)                       | Progress           | —    | v1   | Built · `/progress`         |
| [16](#16-set-the-arrival)                | Set the arrival    | Trip | v1   | Planned                     |
| [17](#17-countdown-home)                 | Countdown home     | Trip | v1   | Planned                     |
| [18](#18-daily-drop)                     | Daily drop         | Trip | v1   | Planned                     |
| [19](#19-lock-screen-widget)             | Lock screen widget | Trip | v1   | Planned · native surface    |
| [20](#20-survival-mode)                  | Survival mode      | Trip | v1   | Planned                     |
| [21](#21-souvenir)                       | Souvenir           | Trip | v1   | Planned                     |
| [22](#22-open-chat)                      | Open chat          | D    | v1.1 | Planned                     |
| [23](#23-message-inspector)              | Message inspector  | D    | v1.1 | Planned                     |

Plus: [Navigation shell](#navigation-shell) · [Permissions](#permissions) ·
[Global behaviours](#global-behaviours)

---

## Keeping specification, routes, and states aligned

The current app has 7 learner routes and 20 declared learner-visible browser states. The exact
route-to-state inventory is maintained in
[`screen-catalog.md`](../design/screen-catalog.md#current-implementation-and-browser-coverage), and
the executable manifest is [`apps/mobile/e2e/states.ts`](../../apps/mobile/e2e/states.ts).

When functionality grows, extend these three layers together:

- Describe the state and its transitions in the appropriate numbered section here. Preserve the
  section number: it maps to the authored 21-screen blueprint, not to implementation order.
- Add the Expo route if the screen is new. A route file alone is not functional coverage.
- Add a manifest entry for each materially different learner-visible state in the same change. This
  includes sheets/dialogs, empty and not-found views, permission fallbacks, completion states, and
  drilled sub-views. Give each entry a unique stable name, its actual route, a reference to the
  correct section here, and a learner-reachable interaction path.
- Update the catalog's current-inventory table whenever a route or manifest state changes, and run
  `pnpm test:e2e`. Its route guard, accessibility suite, and text-scale suite all consume the state
  manifest.

The manifest's `spec` field is traceability metadata and uses the canonical headings in this file:
Onboarding §1, Add §2, Phrase detail §3, Adaptive stream §4, Today §11, Refrain §12, and Progress
§15. Update those references in the same change if a heading is deliberately renumbered.

---

## Navigation shell

`Navigation.dc.html:35–499` · state laws `512–873` · requirements `NAV-01…NAV-16`

This is one route-owned system around every learner screen, not an alternative navigation mode. Each
route declares one of five surface classes plus its place, parent/resolved home, built state,
expected frequency, resumability, practice-source behavior, and menu grouping.

**Surface states**

| Class     | Header/exit behavior                                                                                                                                             |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Root`    | No Back. The resolved home has its stateful text rail and exactly one primary filled action.                                                                     |
| `Push`    | Names the route actually below it (`‹ Today`, `‹ Phrasebook`). Cold entry has no invented history and renders `✕ <resolved home>`.                               |
| `Session` | Back gesture disabled. `✕` opens **Pause · End it here · Keep going**, with Pause first. Pausing writes a resumable checkpoint.                                  |
| `Flow`    | Back steps within the flow and preserves answers. The switcher offers answered/current valid steps and Finish, never a guarded dead link.                        |
| `Sheet`   | Owns focus and the only active escape. Scrim, swipe-down, and its `✕` dismiss it while the mounted surface beneath is inert; the spine is not duplicated inside. |

**Spine, switcher, rail, and More**

- Every non-Sheet surface has one 28 px spine directly below the status bar
  (`Navigation.dc.html:311–330`, `454–475`). The left word names the current place and opens the
  switcher. The right side is absent for no ongoing work, opens one item directly, or reads
  `n ongoing` and opens the Ongoing group. Glyph/color alone never carries that state.
- Ongoing is one canonical list: paused Sessions, playing loops, and half-answered Flows appear
  consistently in the spine, switcher, and resolved home (`383–397`, `460–462`).
- The switcher begins with Ongoing, then built roots and contextual Flow steps. `/more` renders
  Lately, Phrases, Practice, and You from route metadata with real counts. Unbuilt/empty groups are
  omitted, not disabled (`272–305`, `383–450`, `494–499`).
- A home rail is declared on every possible resolved home. It contains only real destinations and
  real state (for example `Review 12`); the bottom thumb arc belongs to the one filled CTA
  (`111–163`, `479–499`).

**Entry, interruption, and failure states**

| State                         | Required behavior                                                                                                                                                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Warm stack Push               | Back names and pops the actual prior screen.                                                                                                                                                                             |
| Cold Push                     | `✕ <resolved home>` replaces the false Back label; a one-line arrival note may name the widget/notification/deep link source (`Navigation.dc.html:696–746`).                                                             |
| Session dismissed             | Resolved home's primary CTA becomes **Resume rep n**; no second CTA is added. The checkpoint is addressable and survives process restart (`518–578`).                                                                    |
| Deep link, no work at stake   | Land immediately.                                                                                                                                                                                                        |
| Deep link, work at stake      | Keep the current rep/answers mounted, show the queued destination in-surface, and let the learner switch or keep going (`582–638`).                                                                                      |
| Sheet over Session            | Underlying Session exit dims, is removed from accessibility, and does not respond. Sheet dismiss keeps audio/rep state alive (`643–691`).                                                                                |
| Valid route, empty source     | Stay on the Session route; name the empty source and offer exactly two useful paths: fill that set or do today's instead (`751–799`).                                                                                    |
| Gone/deleted source           | Resolve to Phrasebook with a reason.                                                                                                                                                                                     |
| Malformed/unresolvable source | Resolve to the guarded home with a reason. Never spinner-then-error or silently bounce.                                                                                                                                  |
| Travelling audio              | One transport appears directly under Root/Push header with real title/position, Pause and End. It hides on its own Session; another practice Session pauses it; Flow/Sheet hide it while playback continues (`802–860`). |

`expectedUse: daily | weekly | rare` is route metadata, not taste at render time. Q-17 owns the
remaining product decision about which daily destinations win scarce rail positions; it does not
permit a daily built route to become unreachable.

---

## 1. Onboarding

`Loro.dc.html:128–212` · logic `2068–2174` · screenshot `screenshots/01-p1.png`

One screen, three state families, six steps.

**Step machine**

```
welcome → choice(goal) → choice(level) → choice(mins) → choice(packs, multi) → ready
```

A segmented bar shows 6 segments; segments `0..step` are accent-filled. The back chevron appears
from step 1 onward. Back never loses answers.

**States**

| State     | Body                                                                                                                                           | CTA                 |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| `welcome` | 🦜 in a rounded gradient tile (pops in), _"¡Hola! I'm Loro"_ in italic serif, headline "Learn Spanish by the phrase", the method paragraph     | `Let's go →`        |
| `choice`  | Question + helper, then a scrollable option list. Each option: emoji tile, label, sub-label, radio (single) or check (multi)                   | `Continue`          |
| `ready`   | ✅ tile, _"You're all set"_, "**N** phrases are in your stream", the daily-minutes promise, and a 4-row summary (Goal · Level · Daily · Packs) | `Start learning 🎧` |

**Interactions**

- Single-select replaces the answer; multi-select toggles it.
- `Continue` is **disabled** — grey background, grey text, `not-allowed` cursor, no shadow — until
  the current step is answered (`multi` requires ≥1). Tapping a disabled CTA does nothing; it does
  not shake or toast.
- Seeded phrase count on `ready` = Σ `count` of selected packs (8+10+8+8+6+8 available).

**Edge cases**

- Reaching `ready` and tapping the CTA commits the stream and exits onboarding. In the blueprint it
  loops back to step 0 for demo purposes — **the app must not do that**.
- Re-running onboarding (from Settings) must not duplicate already-owned phrases; pack seeding is
  idempotent on `phrase_id`.
- `goal = trip` routes to [16 · Set the arrival](#16-set-the-arrival) instead of home.

---

## 2. Add phrases

`Loro.dc.html:222–427` · logic `2176–2433` · screenshots `02-p1.png`, `btn-stream.png`

The busiest screen in the app. Header shows a live "_N_ in stream" pill.

### Mode: Discover (default)

- **Search field** — placeholder _"Type a phrase, or a topic…"_, accent border on focus, clear ✕
  when non-empty.
- **Scenario chips** — a horizontally scrolling row prefixed "Scenario", 5 chips. Tapping toggles;
  selecting one clears the query and the association anchor.
- **Suggestion list** — rows with emoji, Spanish (bold), English, a ♪ preview button, and a `+`.
  Tapping the row opens the tagging sheet; tapping ♪ speaks without adding (event must
  `stopPropagation`).
- **Context label** above the list, resolved in this priority order (`2364–2368`):
  1. query non-empty → `Matches for "q"` or `No matches in the library`
  2. scenario active → `For: <scenario label>`
  3. association anchor set → `More like "<last added phrase>"`
  4. otherwise → `Popular starters`
- **Add your own** — appears when the query is ≥2 chars and doesn't exactly match a library phrase.
  Rendered as a distinct accented row above the suggestions.
- **`+ Add all N`** — shown whenever ≥2 suggestions are visible.

**The association mechanic (P2-04).** After a phrase is added, `anchorTheme` is set to that phrase's
theme and `anchorEs` to its text. The next zero-query suggestion list is _same-theme-first, then
everything else_, capped at 6 (`2304–2308`). This is what makes Discover feel like it's following
the learner rather than serving a catalogue.

### Mode: Browse

- **Grid of 8 theme tiles** (Café · Dining · Travel · Directions · Shopping · Small talk · Survival
  · Hotel), each with a count label — `"N to add"` or `"all added ✓"`.
- Tapping a theme opens a filtered list with a `‹ Themes` back chip, a title (`"Café · 3 left"`),
  and `+ Add all N`.

### Mode: Import

- Instruction copy, `Paste sample menu` and `Clear` buttons, a 90 px textarea.
- Parsing runs live on every keystroke: split lines, trim, drop blanks, cap at **12**, then for each
  line try separators in order `" — "`, `" – "`, `" - "`, `" = "`, `" : "`, `": "`, `"\t"`; first
  hit at index > 0 splits Spanish / English. No hit → the whole line is Spanish with an empty
  English (rendered as `—`).
- Header: `Found N — tap to deselect` or `Paste above to see phrases`.
- Rows are **selected by default**; tapping toggles. Commit button reads `Add N phrases`, and is
  hidden when nothing is selected.
- Imported phrases get `theme: 'Imported'`, `emoji: '📝'`, `custom: true`, `difficulty: 'med'`, no
  tags.

### The tagging sheet

Slides up (`sheetUp`, 340 ms) over a 42%-black scrim, with a grab handle.

1. **Phrase card** — emoji tile, Spanish, English, ♪ button.
2. **"How hard is it for you?"** — three equal segments: Easy · Learning · Difficult. `med`
   (Learning) is preselected.
3. **"What's tricky about it?"** + `pick any` — 4 toggleable chips: Pronunciation · Hard to remember
   · Very useful ⭐ · Tricky words 🔤.
4. **`Add to my stream`** (or `Save changes` when editing).
5. **`Remove from stream`** — only when editing an existing phrase.

Dismiss: tap the scrim, or swipe down.

### In-your-stream strip

A bottom band (`In your stream · N` / `tap to open ›`) with a horizontally scrolling set of the 14
most recent additions, newest first. Each chip is background- and border-coloured by its difficulty,
shows a difficulty dot, the Spanish (ellipsised at 172 px), the difficulty label, and the emoji of
each active tag. The currently selected phrase gets a 2 px ring.

**Toasts and undo.** Every mutation toasts for 2.6 s with an `Undo` action. Undo of an add removes
by id; undo of a remove re-adds the captured entry. Adding a single phrase toasts _"Added — here are
more like it"_, which names the association mechanic.

**Edge cases**

- Adding a phrase already in the stream is a no-op (`addPhrase` guards on id).
- `Add all` while a scenario is active clears the scenario afterwards.
- Empty state only renders when there is genuinely nothing to suggest _and_ no custom-add row.
- The textarea is uncontrolled (a ref) to avoid IME and caret problems; state syncs on input.

---

## 3. Phrase detail

`Loro.dc.html:436–581` · logic `2435–2514` · screenshot `03-p1.png`

The single source of truth for a phrase. Reached from every list in the app.

**Header** — back, theme pill, ♥/♡ love toggle.

**Body, in order**

1. **Hero** — Spanish 28 px, English, phonetic respelling in italic, and the sync hint _"Synced with
   your stream · tap any phrase to open it here"_.
2. **Hear it** (0.92×) / **Slow** (0.6×).
3. **Word by word** — chips of `es` + gloss; tapping a chip speaks that word at 0.85× (using the
   `say` field when the chip text is a fragment, e.g. `¿Dón` → `dónde`).
4. **How hard is it for you?** — live difficulty editor; changing it toasts `Difficulty → Learning`.
5. **What's tricky** + `tap to toggle` — live tag editor.
6. **In context** — a longer example sentence with translation.
7. **Memory hook** — if set: the note in a warm card with `tap to change`. If empty: three generated
   suggestions, each tappable to adopt. The three are: _say it aloud 3×_, _tie the opening words to
   the exact moment you'd use it_, _picture the scene_.
8. **Add related to your stream** — up to 3 same-theme phrases not yet owned, each with ♪ and `+`.
   Added ones flip to a green `✓ Added` row.
9. **Status row** — a dot, `Learning`/`Learned`, `Next review <due>`, and a `Mark learned` toggle.

**Footer** — `Remove` (destructive, outlined) and `Practice now →` (primary).

**Edge cases**

- No phrase selected → placeholder copy _"No phrase selected / Add or tap a phrase to view it"_, all
  editors inert.
- Sections 3, 6, and 7 are conditional on data presence; a phrase with no `words` shows no
  word-by-word block.
- `Remove` navigates back and toasts; it does not confirm (undo covers it).
- Editing a note clears it first, revealing the suggestion list again.

---

## 4. Adaptive stream

`Loro.dc.html:600–677` · logic `2516–2632` · screenshots `01-dev.png`, `btn-stream.png`

Hands-free listening. **The one screen every persona uses.**

**Now-playing card** (dark gradient) — theme pill + emoji, animated equaliser, Spanish 24 px,
English, `repeat` pips, a per-repetition progress bar, transport (`◄◄` · play/pause · `►►`), and a
speed chip.

**Rating bar** — `How's this one?`, then ♥ Love, `✓ Learned`, and a three-way segmented control
(Easy · Learning · Difficult) styled as an iOS segmented control.

**Up next** — the ordered remainder of the queue with per-row ♥ and a difficulty pill that cycles
`easy → med → hard` on tap. Header carries three counters: ♥ loved · Difficult · Learned.

**The engine**

```
rank(p)      = plays + (hard: −6 | easy: +4 | med: 0) + (loved: −3)
order        = active phrases (not learned), ascending by rank
repeatTarget = hard: 4 | med: 3 | easy: 2
tick (80 ms) = progress += 0.02 × speed
               progress ≥ 1 → repeatIndex++
               repeatIndex ≥ repeatTarget → plays++, advance to next id, reset
```

**Interactions and their consequences**

- Rating `Difficult` → repeats more _and_ returns sooner (rank −6). Toast: _"Difficult — repeats
  more, comes back sooner"_.
- Rating `Easy` → _"Easy — drifting to the back"_.
- Re-tapping the active difficulty resets to `med` ("Back to normal").
- `♥ Love` → _"Loved — surfacing more often"_.
- `✓ Learned` → removed from the stream; if it was the current phrase, the stream advances
  immediately.
- Tapping an Up-next row opens it in [Phrase detail](#3-phrase-detail).

**Edge cases**

- Empty / all-learned stream → _"Your stream is empty / Add phrases to start listening"_, controls
  inert.
- Only one active phrase → `pickNextId` falls back to the same phrase rather than crashing.
- The current phrase being removed or learned mid-playback must advance, not stall.
- Real implementation replaces the synthetic 80 ms tick with actual audio-clip completion callbacks;
  the progress bar tracks real playback position
  ([audio-speech.md](../architecture/audio-speech.md)).
- Backgrounding continues playback and keeps lock screen controls in sync.

---

## 5. Speak to progress

`Loro.dc.html:688–739` · logic `2634–2740` · screenshot `02-dev.png`

Production, not recognition. The gate is the whole point.

**Layout** — deck progress bar + `n / 5`; a prompt card showing the **English** and
`Hear the answer`; a centred row of word chips; a status line; a big mic; then `Hint` and the locked
`Next`.

**Word chip states**

| State         | Rendering                                                   |
| ------------- | ----------------------------------------------------------- |
| hidden        | grey fill, transparent text, `blur(6px)`, text-shadow ghost |
| just revealed | accent fill, white text                                     |
| revealed      | white fill, dark text, light border                         |

Transitions are 300–400 ms on `filter`, `color`, `background`, `transform`.

**Matching** (`2674–2683`) — normalise both sides (lowercase, strip diacritics, strip
non-alphanumeric-except-ñ). Then walk the target tokens from the current reveal index, searching
forward in the heard tokens with a monotonically increasing cursor. This means:

- Words must be produced **in order**.
- Extra ASR words between target words are tolerated.
- Partial credit is kept — `revealed` only ever increases (`Math.max`).

**Status copy by state** — idle _"Tap the mic and say it out loud"_ · listening _"Listening… speak
now"_ · good _"Sí! keep going →"_ · retry _"Didn't catch it — try that word again"_ · hint
_"Revealed — now say the next word"_ · done _"¡Perfecto! You said the whole phrase ⭐⭐⭐"_.

**Stars** — 0 hints ⭐⭐⭐ · 1 hint ⭐⭐ · 2+ ⭐.

**Edge cases**

- **No ASR / permission denied** → `micBlocked`. The mic button becomes a reveal button and the hint
  reads _"No mic here — tap to reveal a word"_. The screen still completes.
- On completion the full phrase is spoken back after 250 ms, and `Next` unlocks.
- Tapping the mic while listening stops recognition.
- Interim results are consumed, so partial recognition can advance the reveal mid-utterance.

---

## 6. Review session

`Loro.dc.html:750–821` · logic `2742–2813` · screenshots `03-dev.png`, `04-dev.png`

Classic SRS, made tag-aware.

**Card front** — a focus banner, then the theme pill, difficulty pill, prompt label, and the
English. **Card back** (after reveal, `flip` 300 ms) — a rule, the Spanish in accent ink, the
respelling in italic, `Hear it`, and — for `remember`-tagged phrases — the memory hook in a warm
card.

**The focus banner is the connective thread made visible** (`2769–2774`):

| Tag (first match wins) | Banner                                | Palette   |
| ---------------------- | ------------------------------------- | --------- |
| `pron`                 | PRONUNCIATION FOCUS — SAY IT OUT LOUD | info blue |
| `remember`             | HARD TO REMEMBER — USE THE HOOK       | violet    |
| `useful`               | ⭐ HIGH-USE PHRASE — WORTH NAILING    | amber     |
| none                   | 🔁 RECALL — THINK, THEN REVEAL        | neutral   |

`pron` also changes the prompt label to _"Say this in Spanish"_, the reveal button to _"Reveal &
hear it"_, and auto-plays the audio 200 ms after reveal.

**Grading** — four buttons with their intervals shown:

| Grade     | Interval label                                              | Writes back                                                       |
| --------- | ----------------------------------------------------------- | ----------------------------------------------------------------- |
| Again     | `<5 min`                                                    | `difficulty = hard` (reps unchanged)                              |
| Difficult | `~10 min`                                                   | `difficulty = hard`, `reps++`                                     |
| Good      | `1 day` (reps 0) / `3 days` (reps 1–2) / `1 week` (reps ≥3) | `reps++`                                                          |
| Easy      | `5 days`                                                    | `difficulty = easy`, `reps++`, and `learned = true` if `reps ≥ 3` |

> The blueprint's intervals are a **display model**. Production scheduling uses FSRS — see
> [scheduling.md](../architecture/scheduling.md) and
> [ADR-0004](../architecture/adr/0004-fsrs-scheduler.md). The four grades map onto FSRS
> `Again/Hard/Good/Easy`, and the labels shown to the user must be the _real_ computed intervals,
> not these constants.

**Deck** — built once at session start: unlearned phrases, ascending by
`reps + (hard: −5 | easy: +3)`. The deck is frozen for the session so re-rating mid-session doesn't
reshuffle under the learner.

**Completion** — ✓ pop-in, _"¡Hecho!"_, `N phrases reviewed · X% recalled well`, then streak and
next-due tiles, and `Review again`.

**Edge cases** — empty deck renders the done state with a _"No cards due"_ card. Accuracy counts
`good` + `easy` over all grades.

---

## 7. Roleplay

`Loro.dc.html:847–949` · logic `2911–2982` · screenshots `01-adv.png`, `f1.png`

**Scene header** (dark) — emoji tile, place, `role · city 🇪🇸`, turn label, turn pips.

**Transcript** — NPC bubbles left (white, tail bottom-left), learner bubbles right (accent fill,
tail bottom-right). Both show Spanish + English and are tappable to hear. A typing indicator (three
bouncing dots) covers NPC latency.

**Coach note** — after each reply, a warm card labelled either _"Loro · that's how a local says it"_
(when the best option was chosen) or _"Loro · coach note"_.

**Reply composer** — label `Your reply` + `tap to send · ♪ to hear it first`, then 3 options
(Spanish + English + ♪), then `Say your own reply` with a mic. Listening state shows an equaliser,
_"Listening… say any line above"_, and `Stop`.

**Recap** — dark card, _"¡Escena completada!"_, then turns · natural lines · fluency %
(`60 + best_ratio × 40`), and `Replay scene ↺`.

**Production notes**

- The blueprint hard-codes one 3-turn café scene. Production generates scenes from the learner's
  themes and tags ([ai-services.md](../architecture/ai-services.md)), streams NPC turns, and always
  ships with a bundled offline scene set.
- Reply options must include exactly one "best/most native" option and two plausible ones; the coach
  note must be specific to the chosen line, never generic praise.
- Free-speech replies are matched against the options with the same normalisation as
  [screen 5](#5-speak-to-progress); an unmatched utterance is a soft retry, never a failure.

---

## 8. Memory model

`Loro.dc.html:963–1037` · logic `2984–3045` · screenshots `02-adv.png`, `g1.png`

Makes the scheduler legible instead of magic.

**Flow** — card (theme pill, `Recall in Spanish`, English) → `Show answer` → the Spanish (tap to
hear) → the rating panel.

**Rating panel**

1. **Forgetting curve** — an SVG with a dashed 100% line, a dashed ~50% review threshold, the decay
   curve `R(t) = 0.5^(t/S)` filled beneath, a dot at _now_, and a ringed dot at the next review
   point. The x-axis spans `Dmax = clamp(ceil(S × 1.9), 6, 60)` days. It **redraws live** as the
   learner picks a confidence level.
2. **Read-outs** — strength (`S` in days) · recall at +7 d (`0.5^(7/S)`) · next review, formatted
   `~10 min` / `tomorrow` / `N days` / `N wks`.
3. **Five confidence levels** — Forgot (blank) · Shaky (guessed) · OK (effortful) · Strong (quick) ·
   Instant (automatic), with multipliers `0.35 / 0.9 / 1.7 / 2.7 / 4.3`.
   `S' = max(0.4, base × mult × (1 + reps × 0.25))`.
4. **`Schedule & next card →`** appears only once a level is chosen.

**Copy** — before rating: _"Rate your recall and the curve redraws — that sets when this returns."_
After: _"Scheduled to resurface right as memory nears 50% — never too early, never too late."_

> As with screen 6, the display formula is the blueprint's teaching model; the real stability comes
> from FSRS. The **visualisation contract** — always show the curve, always mark the 50% threshold,
> always redraw on rating — is what must be preserved.

---

## 9. Pronunciation lab

`Loro.dc.html:1051–1110` · logic `3047–3120` · screenshots `03-adv.png`, `h1.png`

**Layout** — phrase card with `Hear native`; **Syllable accuracy** chips; a two-lane waveform panel
(Native / You); a score card; the record button.

**Syllable chips** — the phrase pre-split into syllables (`¿Dón · de · es · tá · el · ba · ño?`).
Each chip is tappable to hear its parent word. After scoring, each shows a 0–99 number and takes its
band colour: ≥85 green · ≥70 amber · <70 red.

**Waveforms** — 34 bars per lane. Native is static grey. Yours animates (`barJump`, randomised
duration and delay per bar) while recording, then settles into the overall score's colour.

**Score card** — a conic-gradient ring filled to the overall %, the numeric score, a verdict
(`¡Excelente!` ≥85 · `Casi — keep polishing` ≥70 · `Keep practising`), and **one concrete fix**.

The single-fix copy is the point. Examples from the blueprint: _"Soften the ñ in baño — say
'ba-nyo', tongue to the roof of the mouth."_ · _"Move the stress to the end: ca-FÉ and fa-VOR."_ ·
_"The double rr in perro & corre needs a real roll."_

**Record states** — idle (`Tap to record yourself`) → recording 1.5 s (`Recording… speak now`) →
analyzing 0.75 s (`Analyzing your audio…`) → scored (`Re-record this phrase`), then `Next phrase →`.

**Production note** — the blueprint fakes scores with a seeded PRNG. Real scoring comes from forced
alignment + GOP scoring in `loro-core` ([prosody-dsp.md](../architecture/prosody-dsp.md)). Latency
budget for the analyzing state is 600 ms p95 on the device floor.

---

## 10. Prosody lab

`Loro.dc.html:1124–1291` · logic `3122–3293` · screenshots `04-adv.png`, `ph-prosody.png`, `i1.png`

The most sophisticated screen in the product, and the one whose reward structure is unusual: **the
reward is the removal of help.**

**Cue bar** — `Cue · <level label>` plus a maturity bar (`level / 3`), and a ⏱ timer chip when the
level imposes one.

| Level | Label           | Hint                             | Timer | Prompt shows         | Model audio |
| ----- | --------------- | -------------------------------- | ----- | -------------------- | ----------- |
| 0     | Listen & repeat | Hear the model, then say it      | —     | full Spanish text    | ✅ offered  |
| 1     | From text       | Say it from the text — no audio  | —     | full Spanish text    | ❌          |
| 2     | From meaning    | Recall it from the meaning alone | 5 s   | English + gloss only | ❌          |
| 3     | Cold recall     | From memory — go                 | 3 s   | English + gloss only | ❌          |

**Level-up:** a take scoring ≥88 raises the level. The celebration is explicit about what happened:
_"Leveled up — a cue just dropped / Next time you get less help. That's the point."_

**Body panels**

1. **Prompt** — cue-dependent (above). After a take, it becomes the per-syllable result strip.
2. **This phrase · three skills** — Perception / Recall / Production bars. They advance at different
   rates: Production moves toward the score (`+max(3, (score−current)×0.3)`), Recall gains `+6` at
   cue ≥2 else `+2`, Perception `+1`. Recall advancing faster at high cue levels is deliberate —
   recalling _without_ cues is what trains recall.
3. **Pitch & melody** — the hero. An SVG with three gridlines, the native contour as a grey dashed
   polyline, yours as a solid accent polyline, and dark dots on points more than 0.15 off. A `Trace`
   button plays a synchronised cursor: a vertical rule plus one dot on each contour, interpolated
   across the take.
4. **Rhythm & stress** — one column per syllable, flexed by its duration, with paired native/you
   bars whose heights encode stress.
5. **Result card** — melody score (band-coloured), a `↑ +N clearer than last time` delta chip, a
   verdict (`Native-like melody` ≥85 / `Getting closer` ≥75 / `Keep shaping it`), the phrase's
   coaching note, and a sparkline of the last 6 takes.
6. **Playback row** — `Native` · `My take`. The authored **`Hear myself, perfectly`**
   voice-conversion control is excluded: it cannot be implemented by uploading a learner recording.
   It may be reconsidered only if a real on-device implementation can keep the privacy promise.
7. **Remediation** — when the take is weak: _"Let's nail this — a quick drill on the part that
   slipped."_

**Footer** — mic (idle → recording → processing) with the hint text tracking state, and 🔒 _"Private
— your audio stays on your device"_. After a result: `Try again ↺` and `Next →`.

**Edge cases**

- Cue level is **per phrase**, persisted, and never decreases within a session.
- The timer at cue 2–3 is a soft nudge; expiry does not fail the attempt.
- Recorded audio never leaves the device. Consent is not an exception
  ([security-privacy.md](../architecture/security-privacy.md)).

---

<a id="11-today--the-ritual"></a>

## 11. Today — the ritual

`Loro.dc.html:1316–1391` · logic `3295–3341` · screenshots `01-rest.png`, `c-refrain.png`

Loop B's home. **No queue, no algorithm surfaced: you always see today.**

**Header** — `<weekday> · the daily refrain` and "Today", plus a 🔥 streak chip.

**Panels**

1. **Today's five** — the closed set. Per phrase: Spanish, a `LOCKED` badge at 100%, a `day n/4`
   label, and an automaticity bar. Header shows `n of 5 locked in`. Tapping a phrase speaks it.
2. **Today's three waves** — Morning (`Meet & first reps`, 8:00) · Midday (`Re-rep, from memory`,
   1:00) · Evening (`Cold + perform`, 7:00). States: done (✓, green dot) · ready (accent border and
   tint, ● ) · locked (○, grey).
3. **Ambient loop** — a dark card toggling all-day hands-free looping of today's set, with a live
   equaliser when on. Copy: `Hands-free · catchy on a loop`.
4. **Rolling window** — `Fading tail` (yesterday's phrases with `Nd left`) beside a
   `graduated & banked` count.

**CTA** — the next incomplete wave (`Start midday wave →`).

**Edge cases**

- Fewer than 5 available phrases → the set is whatever exists; copy must not say "five".
- All waves done → CTA becomes a review/extra-practice offer, not a locked button.
- Set composition is chosen once per day and **must be stable across app restarts** — it is written
  to the day's `refrain_day` row, not recomputed.

---

## 12. The Refrain

`Loro.dc.html:1405–1532` · logic `3343–3424` · screenshots `02-rest.png`, `ph-prosody.png`

**★ The v1 hero screen.** Its job is to make "again" feel alive.

**Chrome** — wave label + `Phrase n / 5`; set dots (done/current/todo); the mode strip.

**Mode rotation** — the mode is a function of rep count, clamped at the last:

| Rep | Mode      | Display                             | Model audio | Mic label   |
| --- | --------- | ----------------------------------- | ----------- | ----------- |
| 0   | Echo 🔁   | full Spanish + English              | 0.95×       | Say it      |
| 1   | Chorus 🎵 | full                                | 0.95×       | Chorus it   |
| 2   | Speed ⚡  | full                                | 1.15×       | Faster!     |
| 3   | Cloze ◻️  | `¿Qué ___?` + English               | —           | Fill & say  |
| 4   | Call 💬   | English only, "say the Spanish for" | —           | Respond     |
| 5+  | Cold ❄️   | ❄️ + `from memory · <hook>`         | —           | Say it cold |

**The warming card** — the hero metaphor. Background, text colour, and glow all shift with
automaticity:

| Automaticity | Background                               | Text      | Glow         |
| ------------ | ---------------------------------------- | --------- | ------------ |
| 0–32%        | `#edf0f4` (cold blue-grey)               | `#516275` | barely there |
| 33–65%       | `#faf1e7` (cream)                        | `#9b6a3c` | soft         |
| 66–99%       | gradient `#f8ddc8 → #f0cfa9` (peach)     | `#8f4a1f` | warm         |
| 100%         | gradient `#e08a4a → #bf5722` (hot coral) | `#ffffff` | strong       |

Transitions are 500 ms on both background and box-shadow. This is the single most important
animation in the app: **the phrase visibly heats up as it becomes automatic.**

**Automaticity & effort**

- `automaticity = min(100, round(reps / 6 × 100))` — 6 reps is the daily target.
- `latency ≈ max(0.5, 2.0 − reps × 0.26)` seconds, shown as `1.2s` with a green `effort ↓` tag, plus
  a bar chart of the last 4 reps and a plain label: `tap to begin` → `warming up` →
  `getting smoother` → `quick & smooth` → `instant & smooth`.
- **The falling bar chart, not a rising score, is the feedback.** Effort dropping is the felt
  progress.

**Beat** — three animated bars at 0.72 s, dropping to 0.34 s in Speed mode, labelled `on the beat`.

**Lock-in** — at 100%: a green card, 💎, _"Locked in for today / It comes out without thinking
now."_ The rep control is replaced by `Next phrase →` (or `Finish the set →` on the last).

**Completion ritual** — 🔥 tile, _"¡Hecho! Today is done"_, three tiles (locked in · reps today ·
day refrain), and a graduation card: _"'¿Qué tal?' graduated / Out of rotation — you own it now."_

**Edge cases**

- Latency must be measured for real (mic-onset minus prompt-end), not simulated. If measurement
  fails, hide the latency read-out rather than showing a fake number.
- Cloze gap selection: blank the phrase's most informative content word, not a function word.
- Cold mode with no memory hook falls back to the English.
- Overlearning is intentional — the target does **not** shorten when a learner nails rep 1.

---

## 13. The Run

`Loro.dc.html:1572–1694` · logic `3426–3571` · screenshots `04-rest.png`, `c-rogue.png`, `j1.png`

Five phases: `ready → spine → reveal → finisher → wrap`.

**Ready** — _"today's run / Spine, then a card off the deck"_, two stat tiles (in your deck ·
deployed), then **your deck of finishers**: four rows (the Rally I · the Curveball II · the Gauntlet
III · the Sportscaster IV), each either ✓ `ready in the deck` or `Locked · needs a <rung> phrase`.
`Start a run →`.

**Spine** (the constant ritual, always the same)

1. _Re-fire your chain_ — recite up to 3 phrases already in rotation. "Retrieval disguised as a
   warm-up."
2. _Meet today's phrase_ — a new phrase in a warm gradient card, `new · joins at Accumulated`.
   Folding it onto the chain immediately is the point: used the instant it's learned.

**Reveal — the draw**

- 1.2 s shuffle: three stacked rotated dark cards with a 🃏, _"shuffling the deck… / dealing what
  you're ready for"_.
- Then the dealt card: icon tile, card name, `<finisher> · <flavour>`, and a targets block naming
  the phrase, the rung it climbs to, and the tier.
- **The draw is real but constrained.** Eligible cards = unlocked _and_ the deck contains a phrase
  at exactly that card's source rung. Among eligible cards, the one whose candidate phrases have the
  highest total `need` wins, plus a small random term. The target is the highest-`need` candidate.
  `need(p) = (stale ? 2 : 0) + stumbles`.
- One `🔀` redraw per run, excluding the card just drawn.

**Finisher** — a beat sequence per card type:

| Card                      | Beats                                                                   |
| ------------------------- | ----------------------------------------------------------------------- |
| Bend (the Rally)          | say it → _now as a question_ → _now in the past_                        |
| Transfer (the Curveball)  | _At a café…_ → _…now in a taxi_ (same phrase, unexpected place)         |
| Pressure (the Gauntlet)   | calm → _they're impatient now — faster_ → _noisy street — push through_ |
| Deploy (the Sportscaster) | _Narrate what's around you_ → _keep going… free & spontaneous_          |

Each beat shows a felt-progress chip (`Rally ×2`, `Round 3 survived`, `Swerve handled`,
`Free & flowing`).

**Wrap** — ⬆️ tile in the new rung's colour, _"it climbed"_, the phrase, `from → to` rung pills, a
line of prose, and **`✓ Nothing lost — you only climb or hold.`** Then `Another run ↺`.

On success the target phrase's rung increments (capped at Deployed), `stale` resets to 0, and
`stumbles` decrements by 1 (floor 0).

---

<a id="14-phrasebook--collection--ladder"></a>

## 14. Phrasebook — Collection & ladder

`Loro.dc.html:1708–1767` · logic `3518–3569` · screenshots `c-ladder.png`, `j1.png`

Loop C's meta surface — "the arrival". The load-bearing screen for long-term motivation.

- **Header** — "Phrasebook", `N phrases`.
- **Across the ladder** — a five-bar histogram (Acc · Bent · Transf · Pressure · Deployed) with
  counts above and rung colours. _This distribution is the learner's real ability._
- **Sort** — `By rung` / `Needs work`.
- **Phrase list** — per row: Spanish, a `refresh` flag if stale or ≥2 stumbles, 🏆 if Deployed, then
  five pips filled to the current rung in that rung's colour, and the rung name.
- **Recent climbs** — a small feed (`"¿Qué tal?" reached Deployed`).

Ladder palette: Accumulated `#5f6b78` · Bent `#7f6a44` · Transferred `#8a6810` · Pressure-tested
`#bf5722` · Deployed `#8c3f18`.

---

## 15. Progress

`Loro.dc.html:1787–1876` · logic `2815–2871` · screenshots `ph-progress.png`, `d1.png`

- **Range toggle** — Week / All time.
- **Streak card** (dark) — current streak at 46 px, `Best` on the right, and a 7-day strip where
  practised days are accent-filled with 🔥 and today is a faint `·`.
- **Three stats** — minutes listened · phrases in stream · reviews done.
- **Phrase mastery** — a stacked bar plus a legend. Buckets: `learned → Mastered`;
  `reps ≥ 3 → Strong`; `reps ≥ 1 → Learning`; else `New`. Colours
  `#a8a196 · #c99236 · #5b89ab · #3f7d5d`.
- **What's tricky in your stream** — one row per tag the learner actually uses (zero-count tags are
  hidden), bar-scaled to the largest count. **Tapping a row starts a drill of exactly those
  phrases** — this is the tag thread closing its loop.
- **Milestones** — earned ones in white with a green ✓; unearned ones greyed
  (`grayscale(1) opacity(.55)`).

**The streak is derived, never stored.** The store keeps `practiceDays` — the distinct
[streak days](../architecture/scheduling.md#two-day-keys-not-one) on which at least one **rep**
landed — and the count comes from `loro-core`'s `streak()`, the same function the widget calls, so
the two can never disagree. A listen in the stream is not a rep and does not extend a streak.

**Streak states**, all three of which the screen must render without apology:

| State                               | The number | The label      | The 7-day strip                                      |
| ----------------------------------- | ---------- | -------------- | ---------------------------------------------------- |
| No practice ever                    | `—`        | `start today`  | seven neutral cells                                  |
| A live run (today or yesterday)     | the count  | `day` / `days` | accent-filled with 🔥 on the days actually practised |
| Broken (last practice ≥ 2 days ago) | `—`        | `start today`  | filled cells stay where they were                    |

The strip shows the **last seven real local days**, filled from `practiceDays` membership. It must
not be drawn from the streak count: `i < streak` renders a seven-day streak for a learner who
practised once, which is both a fabricated number (non-negotiable #2) and a calendar that never
happened.

An unpractised cell is **neutral** — no red, no ✗, no count-down copy, and a broken streak gets the
same invitation as a fresh install. A streak of zero is an absence, not a zero: `—`, never
`0 days 😞` (non-negotiable #3, [copy-and-tone.md](../design/copy-and-tone.md)).

**Edge cases** — an empty stream must render zeroes, not division-by-zero (`totalPhrases || 1`). No
copy on this screen may frame a missed day as failure. Timezone travel westward moves the local date
backwards; it must not break a streak or re-count a day.

---

## 16. Set the arrival

`Loro.dc.html:1897–1923` · screenshot `01-rest.png` (trip rail)

- `New trip` / **"When do you land?"**
- **Destination card** — flag tile, city + country, `European Spanish · change`, ✓.
- **Arrival date** — big date, a live `N days away` pill, and a compact day strip.
- **Trip type** — 🏖 Vacation · 💼 Work · 👪 Family.
- **`Build my countdown →`**

The destination determines the Spanish variant, the content pack set, and the drop schedule. Trip
type biases which themes are prioritised (Work → small talk and logistics; Family → warmth and small
talk; Vacation → café, dining, sightseeing).

**Edge cases** — a date in the past or today jumps straight to survival mode. A date >90 days out is
allowed but the drop schedule stretches (see [trip-arc.md](trip-arc.md)).

---

## 17. Countdown home

`Loro.dc.html:1930–1954`

Replaces the normal home while a trip is active.

- Greeting + streak chip.
- **Countdown card** (dark, watermark 🦜) — `Madrid 🇪🇸`, days-to-go at 62 px, and
  `Phrases owned 38 / 100` with a progress bar. **Ownership, not lessons, is the readiness metric.**
- **Today's drop** — `TODAY'S DROP · DAY 12`, theme name and icon, two preview lines, and
  `▶ Play today's 8 in the stream`.
- **Three shortcuts** — 🗺️ Trip plan · 🎧 Stream · 🔁 Review.

---

## 18. Daily drop

`Loro.dc.html:1961–1980`

- Header — `Day 9 · 9 days left`.
- **Unlock reveal** — a gradient theme tile, `NEW DROP UNLOCKED`, the theme name,
  `8 phrases · ~3 min to add`.
- **Phrase list** — each with ▶ and a check box; already-owned ones pre-checked, new ones dimmed and
  unchecked.
- **`Add 8 & load into today's stream`** — adds _and_ routes into the stream in one action.

---

## 19. Lock screen widget

`Loro.dc.html:1988–2007`

Not a screen — a lock screen surface. Two glass cards over the wallpaper:

1. **Readiness** — a conic ring at ownership %, days-to-go in the centre, `LORO · 3 DAYS TO MADRID`,
   `You own 84 of 100 phrases`, `16 left — finish the essentials today`.
2. **Phrase of the moment** — Spanish, English, a ▶ button and a playback progress bar.

Platform mapping: iOS → Lock Screen widget + Live Activity while a trip is active; Android → Glance
app widget + an ongoing notification. See
[widgets-notifications.md](../architecture/widgets-notifications.md).

**🔒 Copy constraint:** _urgency, not guilt._ `16 left — finish the essentials today` is acceptable;
`You've missed 2 days` is not.

---

## 20. Survival mode

`Loro.dc.html:2016–2029`

The app **flips** on the arrival date.

- Status bar shows `✈ OFFLINE` when offline.
- **Welcome banner** — gradient, 🛬 watermark, `¡BIENVENIDO A MADRID!`, _"Survival deck is live /
  Reordered for what you need first · works offline"_.
- **Capture card** (dark, promoted to second position) — 📷 _"Heard something new? / Snap a sign or
  menu to bank it"_ with a `＋`.
- **`Right now you'll need`** — a need-ordered deck: taxi → hotel → wifi, each a big tappable row
  with ▶.

Ordering is driven by a time-and-context heuristic: hours since landing, time of day, and the trip's
itinerary themes. Everything on this screen must work with zero connectivity.

---

## 21. Souvenir

`Loro.dc.html:2037–2057`

- **Recap card** (dark, 🦜 watermark) — `YOUR MADRID TRIP · 6 DAYS`, then `47` **phrases used in
  real life** at 56 px, and three tiles: new captured · essentials % · streak.
- **Graduation card** — 🎓 _"Graduated to your library / All 100 now in spaced review"_, and the
  handoff copy: _"Loro will resurface these over the coming weeks so Madrid stays with you — and
  they're ready for your next trip."_
- **`Share recap`** / **`Plan next trip`**.

"Phrases used in real life" is counted from survival-deck plays and captures while abroad — it must
be a real number, not an estimate.

---

## 22. Open chat

`Loro Chat.dc.html:91–328` · logic `456–684` · requirements `P3E-01…P3E-10`, `P3E-15…P3E-18`

Open chat is a supplementary, private conversation loop with a bundled offline floor. Spanish is
primary. The screen is a bottom-anchored thread plus one composer; it does not turn provider
availability, tokens, or safety machinery into learner-facing scores.

**Header and thread**

- Header shows Loro, current topic, pace, and a real `Nothing kept` / `n kept` control
  (`Loro Chat.dc.html:108–116`, `646–657`). Topic/pace opens its Sheet; kept opens its own Sheet.
- Loro turns are unboxed on the left; learner turns are tinted bubbles on the right. One selected
  line exposes its action row without a decorative selection outline (`118–162`, `607–635`).
- Selected Loro: **Hear · EN/Hide · Save/Saved · Open**. Selected learner: **Say again · EN/Hide ·
  Save/Saved · Open/Fix n**. A correction count is the real correction-array length.
- English is hidden initially and revealed for one line only. Spanish remains visible and is marked
  `es-ES` for native accessibility. New turns anchor at the bottom without stealing focus from a
  learner editing the composer.

**Text composer and suggestions**

| State                 | Behavior                                                                                                                                                                                                 |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Empty                 | Spanish placeholder and mic are available; Send is absent/disabled.                                                                                                                                      |
| Draft                 | Non-whitespace text enables Send and temporarily removes the mic so the two actions cannot conflict (`242–262`, `674–677`).                                                                              |
| Draft correction      | A validated, high-confidence `was → now · kind · Fix` row may appear (`198–206`). Applying it changes the draft only. Editing invalidates stale feedback; send-as-is remains possible.                   |
| Suggestions collapsed | **Ways to answer** chip is available when not listening or confirming speech.                                                                                                                            |
| Suggestions open      | Three context suggestions show Spanish, English, register, Hear, and Send. Tapping text copies it into the editable field; Send sends as-is. **Others** changes the set; **Hide** closes it (`172–196`). |
| Submitted             | The learner turn appears immediately and the composer clears. One real pending indicator follows; a cancelled, failed, stale, or budget-blocked request cannot later overwrite the thread (`163–169`).   |
| Degraded/offline      | The bundled topic graph continues coherently and identifies its fallback provenance where useful. There is no fake typing delay, canned "AI" claim, or network-required dead end.                        |
| Safety/provider error | Preserve the submitted turn and offer a useful bundled continuation/retry. Never show raw provider text, internal policy detail, or a reply that failed schema/safety validation.                        |

**Voice composer**

| State                  | Behavior                                                                                                                                                  |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Permission not decided | First mic action requests permission in context.                                                                                                          |
| Denied/unavailable     | Explain how to re-enable it and keep text/suggestions fully usable; never insert a transcript.                                                            |
| Holding                | Real input meter/listening state, **Keep talking**, cancel, and `Release to send · slide up to lock` where the platform supports the gesture (`208–228`). |
| Locked                 | **Listening…**, cancel, and **Done**. Background, route change, interruption, or lost permission ends capture honestly.                                   |
| Silence/no match/error | No fabricated recognition. Keep the draft/thread and offer Again or text entry.                                                                           |
| Final transcript       | **Heard you say** shows the on-device final transcript with **Again** and **Send it**; it is never sent automatically (`231–240`).                        |

Recorded PCM stays in native memory and never reaches JS or a request. Only the learner-confirmed
on-device transcript may become a text turn. Browser tests use an explicitly labelled speech fake;
production never falls back to `SpeechSynthesisUtterance`, a canned transcript, or the prototype's
timer (`Loro Chat.dc.html:504`, `529–531`, `576–588`).

**Topic/pace Sheet** (`Loro Chat.dc.html:265–291`)

- Four authored topic entries show the selected mark. **Natural** and **Slow + English** change
  actual playback/help policy, not just the label.
- Topic change follows the durable thread policy: preserve the thread or explicitly start a new one;
  never silently replace turns. **Start over** requires confirmation when retained learner turns
  exist, then clears the durable thread/draft according to the retention contract.
- Scrim, swipe, and Done dismiss the Sheet and restore focus. The thread remains mounted.

**Kept Sheet** (`Loro Chat.dc.html:293–318`)

- Empty explains how to save. Populated rows show Spanish and English/note with real Hear and Remove
  actions. Header count updates immediately and survives relaunch.
- **Queue for today's review** is disabled/honest when empty and otherwise reports the actual
  singular/plural count. It invokes Review's queue contract; it does not write progress or invent a
  due interval.

**Persistence, privacy, and production divergence**

The current topic/pace, durable turns, confirmed draft, kept references, and pending-request
identity survive ordinary backgrounding and relaunch under Q-19's retention decision. Ephemeral
selection, open Sheets, pending animation, and toasts do not. Thread text and ASR transcripts are
excluded from telemetry and normal phrase sync. A live request may contain only the bounded text
context authorized by Q-20; audio is structurally impossible.

The authored `ChatLogic` is a state fixture, not a language/service implementation. Production
explicitly rejects its regex corrections (`568–575`), text-derived IDs (`542–545`), canned reply
timer (`576–588`), browser speech (`514`), and canned microphone result (`529–531`). Corrections,
replies, suggestions, counts, playback, and recognition must come from their real owners.

---

## 23. Message inspector

`Loro Chat.dc.html:331–449` · logic `686–710` · requirements `P3E-11…P3E-16`

The inspector opens the selected durable turn. It is a Push surface: warm Back names Chat; cold
entry uses the navigation contract's truthful resolved-home exit. If the turn was removed or
expired, explain that and offer Chat plus the nearest retained conversation/phrase destination.

**Common states**

- Header identifies **Loro** or **You**, shows real `position / total`, returns to Chat, and steps
  previous/next without wrapping or selecting an absent turn (`Loro Chat.dc.html:337–345`).
- Body shows the full Spanish line, then available English and respelling. **Hear** and **Slow** use
  real reference audio/rates; learner turns also offer **Say again** through on-device capture
  (`347–365`). **Keep it/Kept** is idempotent.
- Alternatives show Spanish, English, register, independent Hear, and `+`/`✓`. Saving an alternative
  uses canonical phrase identity and the same explicit phrase transaction as every other add
  (`400–412`).
- Word-by-word rows speak the word and show its gloss (`414–427`). **Why it's said this way**
  appears only when validated explanation content exists (`429–434`). Missing optional content
  removes its section; it does not render placeholder expertise.

**Learner correction states**

| State                | Behavior                                                                                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No correction        | A validated positive state may say **Nothing to fix — this reads naturally**; provider failure/low confidence must omit the claim rather than manufacture approval (`393–398`). |
| Correction available | Show real count; for each item show struck original, replacement, category, and specific explanation. Then show the complete fixed line and Hear (`367–388`).                   |
| Apply                | **Use it & keep the fix** performs one explicit repository transaction, previews real audio, retains the original turn as evidence, and cannot double-add (`389`).              |
| Already applied/kept | Render `Kept`/`✓` from repository identity. Re-entry, repeated taps, and process restart do not create another phrase.                                                          |

Saving an original, corrected, or alternative line preserves chat provenance/register/note metadata
and enters the same phrase/outbox path as other learner-authored content. Queueing it for Review
uses Review's explicit queue handoff; neither inspector nor chat writes practice outcomes directly.

---

## Permissions

Requested **in context only**, never at launch:

| Permission               | Requested when                                                  | If denied                                                                                                    |
| ------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Microphone               | First mic tap on any speaking screen                            | Reveal-based fallback ([screen 5](#5-speak-to-progress)); prosody/pronunciation labs show a re-enable prompt |
| Notifications            | After the first completed session, framed as the daily reminder | No reminders; nothing else degrades                                                                          |
| Camera                   | First Capture tap                                               | Manual paste via Import                                                                                      |
| Speech recognition (iOS) | With the microphone                                             | Same as microphone denial                                                                                    |

## Global behaviours

- **Toasts** — dark pill, bottom-centred, `popIn` 300 ms, 1.7 s (informational) or 2.6 s (with
  Undo). One at a time; a new toast replaces the current one.
- **Tap feedback** — every interactive element scales on press (0.98 for rows/cards, 0.90 for icon
  buttons) and every interactive target has a minimum 44×44 hit area regardless of visual size. See
  [motion.md](../design/motion.md).
- **Audio playback is exclusive** — starting any utterance cancels the current one.
- **Every owned/library row that represents an existing learner phrase opens
  [Phrase detail](#3-phrase-detail)** on tap. Discovery suggestions may instead open the Add tagging
  sheet because the phrase does not exist in the learner library yet.
- **Every rating control anywhere writes to the same phrase record** and is reflected everywhere
  immediately.
- **No modal blocks audio.** The stream keeps playing behind sheets and navigation.
