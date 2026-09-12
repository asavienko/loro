# Screen catalog

All 23 learner screens, mapped to their authored artifact ranges, logic classes, screenshots, and
the specs that describe them. Shared navigation chrome and the developer workbench are cataloged
separately because neither is a twenty-fourth learner destination.

**Open the applicable artifact before implementing any screen.** The four `.dc.html` files under
`design/Language Learning by Phrases - V1.1/` are executable specs: every phone is interactive, and
the card beside each one explains what it does and how it connects. This catalog is an index into
them, not a substitute.

Precedence is scoped: `Loro.dc.html` owns screens 1–21, `Loro Chat.dc.html` owns screens 22–23,
`Navigation.dc.html` owns the shell and navigation laws across all 23, and `Design System.dc.html`
owns the authored visual reference. Navigation's spine-on-every-screen rule
(`Navigation.dc.html:35–40`, `94–102`, `456–474`) supersedes Chat's earlier “no chrome” description
(`Loro Chat.dc.html:95–98`): Chat has no card/drill chrome inside the conversation, but it still
participates in the shared app shell.

---

## How to read the artifacts

```bash
open "design/Language Learning by Phrases - V1.1/Loro.dc.html"
open "design/Language Learning by Phrases - V1.1/Loro Chat.dc.html"
open "design/Language Learning by Phrases - V1.1/Navigation.dc.html"
open "design/Language Learning by Phrases - V1.1/Design System.dc.html"
```

Structure:

- **Markup** — lines 1–2064. Each screen is a `.device` block; `sc-if` / `sc-for` are conditionals
  and loops over the logic's `renderVals()` output.
- **Logic** — lines 2065–3629, inside `<script type="text/x-dc">`. One `DCLogic` class per screen,
  namespaced (`onb`, `add`, `det`, `str`, `spk`, `rev`, `prg`, `cvo`, `crv`, `prn`, `pro`, `day`,
  `rfn`, `rog`).
- **The shared store** — lines 3575–3626. One phrase store injected into every screen, which is why
  rating a phrase in one screen updates every other. That property is preserved in the app by
  [ADR-0012](../architecture/adr/0012-state-management.md).
- **Seed data** — lines 2873–2909: `LORO_SEED` (10 phrases with real state) and `LORO_RICH`
  (respellings, glosses, examples, hooks).
- **The catalog** — lines 2179–2211: 31 phrases across 8 themes. Extracted to
  [`packages/content/`](../../packages/content/).

`Loro Chat.dc.html` has two phone blocks at `101–329` and `331–446`; both share `ChatLogic` at
`456–714`. `Navigation.dc.html` specifies five surface classes at `38–78` and the shared spine and
navigation laws; it wraps screens rather than adding a destination. `Design System.dc.html` is the
authored visual specimen, while reviewed runtime tokens live in `packages/design-tokens/tokens/`.

Screenshots are in `design/Language Learning by Phrases - V1.1/screenshots/`. Naming is loose (the
artifacts' own working names), so this table is the reliable mapping.

---

## Current implementation and browser coverage

This is the repository inventory, not a claim that a built route already satisfies every behaviour
below. As of 2026-09-08, **8 of the 23 learner screens have Expo routes**. The other 15 remain
target behaviour in the blueprint and functional spec; they must not be treated as runnable app
surfaces. `apps/mobile/app/_layout.tsx` is the shell and is not counted as a learner screen.

The browser suites exercise the declared learner-visible states across all built routes through
[`apps/mobile/e2e/states.ts`](../../apps/mobile/e2e/states.ts). A route being present is only the
first coverage gate: sheets, empty states, completion states, and other materially different views
need their own manifest entries.

| #     | Screen               | Current Expo route         | Declared E2E states                                                                                                                   |
| ----- | -------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Onboarding           | `/onboarding`              | `onboarding · welcome`; `onboarding · packs step`                                                                                     |
| 2     | Add phrases          | `/add`                     | `add · discover`; `add · browse grid`; `add · theme drilled`; `add · theme fully added`; `add · difficulty sheet`; `add · no matches` |
| 3     | Phrase detail        | `/phrase/[id]`             | `phrase detail`; `phrase detail · edited`; `phrase detail · unknown id` (the remove confirmation lands on Today)                      |
| 4     | Adaptive stream      | `/practice/stream`         | `stream · first phrase`; `stream · all learned`                                                                                       |
| 5 | Speak to progress | `/practice/speak` | `speak · initial reveal`; `speak · partial reveal`; `speak · revealed reveal`; `speak · empty` |
| 6–10 | Remaining Loop A practice | — not implemented | — |
| 11    | Today                | `/`                        | `today · seeded`; `today · switcher`; `today · nothing in rotation`; `today · remove undo offered`                                    |
| 12    | The Refrain          | `/practice/refrain`        | `refrain · first rep`; `refrain · locked in`; `refrain · set complete`; `refrain · no difficult phrases`; `refrain · difficult only` |
| 13–14 | Run and Phrasebook   | — not implemented          | —                                                                                                                                     |
| 15    | Progress             | `/progress`                | `progress · zero state`; `progress · with a tagged phrase`                                                                            |
| 16–18 | Trip app screens     | — not implemented          | —                                                                                                                                     |
| 19    | Lock screen widget   | — native surface not built | —                                                                                                                                     |
| 20–21 | Survival, Souvenir   | — not implemented          | —                                                                                                                                     |
| 22–23 | Open chat, Inspector | — not implemented          | —                                                                                                                                     |

Languages, Account and storage opening/recovery are utility/shell states in the same manifest.
The state names above are the executable inventory; the numbered sections in this catalog and the
functional spec remain the product taxonomy. The `spec` labels in `states.ts` use those canonical
section numbers; new coverage must link to the actual heading rather than copy a neighbouring label.

---

## Phase 1 · Onboard

| #   | Screen                                            | Blueprint | Logic                  | Screenshots           | Spec                                                                                               | Rel |
| --- | ------------------------------------------------- | --------- | ---------------------- | --------------------- | -------------------------------------------------------------------------------------------------- | --- |
| 1   | **Onboarding** — welcome · 4 choice steps · ready | `128–212` | `OnbLogic` `2068–2174` | `01-p1.png`, `b1.png` | [FS §1](../product/functional-spec.md#1-onboarding) · [PRD P1](../product/prd.md#phase-1--onboard) | v1  |

## Phase 2 · Build the stream

| #   | Screen                                                           | Blueprint | Logic                  | Screenshots                             | Spec                                                   | Rel |
| --- | ---------------------------------------------------------------- | --------- | ---------------------- | --------------------------------------- | ------------------------------------------------------ | --- |
| 2   | **Add phrases** — Discover · Browse · Import + the tagging sheet | `222–427` | `AddLogic` `2176–2433` | `02-p1.png`, `btn-stream.png`, `b2.png` | [FS §2](../product/functional-spec.md#2-add-phrases)   | v1  |
| 3   | **Phrase detail**                                                | `436–581` | `DetLogic` `2435–2514` | `03-p1.png`, `c1.png`                   | [FS §3](../product/functional-spec.md#3-phrase-detail) | v1  |

## Phase 3 · Practice daily

| #   | Screen                                      | Blueprint | Logic                  | Screenshots                    | Spec                                                       | Rel  |
| --- | ------------------------------------------- | --------- | ---------------------- | ------------------------------ | ---------------------------------------------------------- | ---- |
| 4   | **Adaptive stream** — hands-free listening  | `600–677` | `StrLogic` `2516–2632` | `01-dev.png`, `btn-stream.png` | [FS §4](../product/functional-spec.md#4-adaptive-stream)   | v1   |
| 5   | **Speak to progress** — the production gate | `688–739` | `SpkLogic` `2634–2740` | `02-dev.png`, `g2.png`         | [FS §5](../product/functional-spec.md#5-speak-to-progress) | v1   |
| 6   | **Review session** — tag-aware SRS          | `750–821` | `RevLogic` `2742–2813` | `03-dev.png`, `04-dev.png`     | [FS §6](../product/functional-spec.md#6-review-session)    | v1.1 |

## Phase 3+ · Advanced practice (Loop A)

| #   | Screen                                          | Blueprint   | Logic                    | Screenshots                                        | Spec                                                       | Rel  |
| --- | ----------------------------------------------- | ----------- | ------------------------ | -------------------------------------------------- | ---------------------------------------------------------- | ---- |
| 7   | **Roleplay** — AI conversation simulator        | `847–949`   | `ConvoLogic` `2911–2982` | `01-adv.png`, `f1.png`, `advanced-initial.png`     | [FS §7](../product/functional-spec.md#7-roleplay)          | v1.1 |
| 8   | **Memory model** — the visible forgetting curve | `963–1037`  | `CurveLogic` `2984–3045` | `02-adv.png`, `g1.png`                             | [FS §8](../product/functional-spec.md#8-memory-model)      | v1.1 |
| 9   | **Pronunciation lab** — per-syllable scoring    | `1051–1110` | `PronLogic` `3047–3120`  | `03-adv.png`, `h1.png`                             | [FS §9](../product/functional-spec.md#9-pronunciation-lab) | v1.1 |
| 10  | **Prosody lab** ★                               | `1124–1291` | `ProLogic` `3122–3293`   | `04-adv.png`, `ph-prosody.png`, `i1.png`, `i2.png` | [FS §10](../product/functional-spec.md#10-prosody-lab)     | v1.1 |

## Loop B · The Daily Refrain (v1 hero)

Authored Loop B treats Refrain as the daily hero. Production [plan 101](../../plans/101-stream-as-daily-wave.md)
starts the wave in Stream; Refrain is a targeted or difficult-only drill. The
`design/**/*.dc.html` artifacts are not edited.

| #   | Screen                         | Blueprint   | Logic                  | Screenshots                     | Spec                                                         | Rel |
| --- | ------------------------------ | ----------- | ---------------------- | ------------------------------- | ------------------------------------------------------------ | --- |
| 11  | **Today** — the ritual surface | `1316–1391` | `DayLogic` `3295–3341` | `01-rest.png`, `c-refrain.png`  | [FS §11](../product/functional-spec.md#11-today--the-ritual) | v1  |
| 12  | **The Refrain** ★★             | `1405–1532` | `RfnLogic` `3343–3424` | `02-rest.png`, `ph-prosody.png` | [FS §12](../product/functional-spec.md#12-the-refrain)       | v1  |

## Loop C · The Roguelike Run (v2)

| #   | Screen                                            | Blueprint   | Logic                    | Screenshots                  | Spec                                                                      | Rel |
| --- | ------------------------------------------------- | ----------- | ------------------------ | ---------------------------- | ------------------------------------------------------------------------- | --- |
| 13  | **The Run** — spine · the draw · finisher · climb | `1572–1694` | `RogueLogic` `3426–3571` | `04-rest.png`, `c-rogue.png` | [FS §13](../product/functional-spec.md#13-the-run)                        | v2  |
| 14  | **Phrasebook** — collection & ladder              | `1708–1767` | `RogueLogic` (same)      | `c-ladder.png`, `j1.png`     | [FS §14](../product/functional-spec.md#14-phrasebook--collection--ladder) | v2  |

## Phase 4 · Stay on track

| #   | Screen       | Blueprint   | Logic                  | Screenshots                 | Spec                                                | Rel |
| --- | ------------ | ----------- | ---------------------- | --------------------------- | --------------------------------------------------- | --- |
| 15  | **Progress** | `1787–1876` | `PrgLogic` `2815–2871` | `ph-progress.png`, `d1.png` | [FS §15](../product/functional-spec.md#15-progress) | v1  |

## Phase 5 · The trip arc

Static screens — the trip rail is a storyboard rather than interactive prototypes.

| #   | Screen                 | Blueprint   | Screenshots | Spec                                                                                                                | Rel |
| --- | ---------------------- | ----------- | ----------- | ------------------------------------------------------------------------------------------------------------------- | --- |
| 16  | **Set the arrival**    | `1897–1923` | trip rail   | [FS §16](../product/functional-spec.md#16-set-the-arrival)                                                          | v1  |
| 17  | **Countdown home**     | `1930–1954` | trip rail   | [FS §17](../product/functional-spec.md#17-countdown-home)                                                           | v1  |
| 18  | **Daily drop**         | `1961–1980` | trip rail   | [FS §18](../product/functional-spec.md#18-daily-drop)                                                               | v1  |
| 19  | **Lock screen widget** | `1988–2007` | trip rail   | [FS §19](../product/functional-spec.md#19-lock-screen-widget) · [widgets](../architecture/widgets-notifications.md) | v1  |
| 20  | **Survival mode**      | `2016–2029` | trip rail   | [FS §20](../product/functional-spec.md#20-survival-mode)                                                            | v1  |
| 21  | **Souvenir**           | `2037–2057` | trip rail   | [FS §21](../product/functional-spec.md#21-souvenir)                                                                 | v1  |

Additional screenshots not tied to one screen: `mobile.png` and `phone-review.png` (responsive
checks), `final-a.png` (a full-canvas capture).

## Loop D · The Open Chat (v1.1)

Both phones share one `ChatLogic` state machine (`Loro Chat.dc.html:456–714`); selecting a message
in the conversation determines what the inspector shows, and keeping/removing a line updates both
surfaces (`518–566`, `604–712`). The six `01-chat*.png`–`03-chat*.png` captures show states of the
paired live phones rather than six additional screens.

| #   | Screen                | Authored markup             | Logic                        | Screenshots                                    | Spec                                                         | Rel  |
| --- | --------------------- | --------------------------- | ---------------------------- | ---------------------------------------------- | ------------------------------------------------------------ | ---- |
| 22  | **Open chat**         | `Loro Chat.dc.html:101–329` | `ChatLogic` `456–714`        | `01-chat.png`, `02-chat.png`, `03-chat.png`    | [FS §22](../product/functional-spec.md#22-open-chat)         | v1.1 |
| 23  | **Message inspector** | `Loro Chat.dc.html:331–446` | shared `ChatLogic` `456–714` | `01-chat2.png`, `02-chat2.png`, `03-chat2.png` | [FS §23](../product/functional-spec.md#23-message-inspector) | v1.1 |

### Open chat state catalog

| Visible state                    | Exact authored citation                | Contract                                                                                  |
| -------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------- |
| Thread, selected AI/learner line | `Loro Chat.dc.html:108–170`            | Spanish-first thread; one selected line exposes Hear/EN/Save/Open or Say again actions.   |
| Translation revealed             | `Loro Chat.dc.html:123–135`, `143–158` | English appears for one line only after `EN`; `renderVals()` controls it at `613–617`.    |
| Reply pending                    | `Loro Chat.dc.html:163–169`            | Typing dots are a pending state, not evidence of a real provider response.                |
| Ways to answer                   | `Loro Chat.dc.html:173–196`            | Three editable/sendable/hearable suggestions, with alternate set and explicit hide.       |
| Draft correction                 | `Loro Chat.dc.html:198–206`            | A proposed correction can be applied before send; production corrections must be genuine. |
| Voice, hold-to-talk              | `Loro Chat.dc.html:208–229`            | Holding, locked listening, cancel, and Done are distinct capture states.                  |
| Recognition confirmation         | `Loro Chat.dc.html:231–240`            | Recognized text is shown before Again or Send; production may not fabricate recognition.  |
| Idle text/mic composer           | `Loro Chat.dc.html:242–262`            | Draft text enables send; an empty draft exposes the microphone path.                      |
| Topic and pace sheet             | `Loro Chat.dc.html:265–291`            | Four topics, Natural/Slow + English pace, Start over, and Done.                           |
| Kept sheet, empty/populated      | `Loro Chat.dc.html:293–318`            | Empty guidance or removable kept lines, plus explicit queue-for-review handoff.           |
| Confirmation toast               | `Loro Chat.dc.html:320–322`            | Short, outcome-specific feedback overlays the conversation.                               |

### Message inspector state catalog

| Visible state                    | Exact authored citation     | Contract                                                                                 |
| -------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------- |
| AI or learner line               | `Loro Chat.dc.html:337–365` | Thread position, full line, optional translation/respelling, two playback speeds, Keep.  |
| Learner line with corrections    | `Loro Chat.dc.html:367–391` | Plain diff, reason, corrected sentence, playback, and explicit use-and-keep action.      |
| Learner line with no corrections | `Loro Chat.dc.html:393–398` | Truthful “Nothing to fix” state; absence of provider output is not proof of correctness. |
| Alternatives                     | `Loro Chat.dc.html:400–412` | Register-labelled alternatives can be heard and individually added.                      |
| Word-by-word glosses             | `Loro Chat.dc.html:414–427` | Optional tappable word rows pair Spanish with short glosses.                             |
| Usage explanation                | `Loro Chat.dc.html:429–434` | Optional plain-language explanation of why the line is said that way.                    |
| Confirmation toast               | `Loro Chat.dc.html:437–439` | Keep/fix outcomes appear over the inspector.                                             |

### Shell and developer-only surfaces

- The navigation shell is not learner screen 24. Its five surface classes are authored at
  `Navigation.dc.html:38–78`; the spine and route/switcher/exit/resume/transport laws wrap the
  numbered screens and are implemented under plan 81. The shared layout now mounts the spine and
  built-hub switcher on Today, Add, Progress, Stream, Refrain, and phrase detail. Today additionally
  owns the root header band, text rail, and day-as-hairline-rows treatment. Every shared-menu
  surface has a switcher state in the browser manifest; onboarding retains its step-based
  navigation. `/more` now lists built destinations from the shared registry and has a browser
  state; it is a utility, not one of the 23 authored learner screens. `/music` (Phrase songs) is a
  later garnish from More → Practice — not a 24th authored v1.1 screen and not in `Loro.dc.html`.
  Default CI uses the lyrics-only floor and fixture playback; live generation stays behind plan 96
  / proposed Q-21. Grouping/search, the spine's
  ongoing chip, travelling transport, exit sheet, resume and full named-back policy remain plan
  81's, on plan 56's route metadata.
- The existing stack headers now provide a labelled Today escape when a cold entry has no stack
  history (plan 84). Warm entries retain native Back. Today redirects to onboarding if setup is
  incomplete. This fixes direct Add/Progress/practice/detail dead ends; it is not the full plan-81
  session-exit/resume system.
- The design-system workbench is not a learner screen or an entry in `apps/mobile/e2e/states.ts`.
  `Design System.dc.html` is its authored reference and plan 80 owns a development-only
  `/dev/tokens` inspection route that must be absent from production builds.

---

## Reading a `DCLogic` class

Every logic class follows the same shape, and knowing it makes the blueprint fast to read:

```js
class RfnLogic extends DCLogic {
  constructor() {
    super()
    this.set = [/* fixture data */]
    this.modes = [/* configuration */]
    this.state = {/* the screen's mutable state */}
  }

  // Handlers — what taps do
  rep() {
    /* mutate state */
  }

  // The view model: state → everything the markup interpolates
  renderVals() {
    return { autoPct: '…', warmBg: '…', repPhase: true, rep: () => this.rep() }
  }
}
```

**`renderVals()` is the useful part.** It's a complete, explicit view model — every string, colour,
boolean, and handler the screen needs. When porting a screen, `renderVals()` tells you exactly what
state the component requires, and the `sc-if` flags tell you every visual state that exists.

Note the convention: booleans are `true` or `''` (truthy/falsy), and paired flags
(`active`/`inactive`, `repPhase`/`locked`/`done`) enumerate mutually exclusive states explicitly.
Those pairs are the state machine.

---

## Fidelity checklist

Before a screen is done, compare against the blueprint side by side
([`process/definition-of-done.md`](../process/definition-of-done.md)):

- [ ] Every `sc-if` state has been implemented, including empty and error states
- [ ] Every `onClick` handler does what the logic class does
- [ ] Toast copy matches verbatim (they carry real meaning — _"Difficult — repeats more, comes back
      sooner"_)
- [ ] Colours come from tokens, and the correct variant (`accentInk` for text, not `accent`)
- [ ] Animations match [motion.md](motion.md), with reduced-motion behaviour
- [ ] Press feedback on every interactive element
- [ ] Spanish text carries `lang="es-ES"`
      ([accessibility](../architecture/accessibility.md#screen-readers))
- [ ] Numbers are real, not simulated
      ([learning model](../product/learning-model.md#where-the-blueprints-numbers-came-from--and-what-is-real))
- [ ] The screen still works with an empty store

### Extending a learner-visible screen or state

A change is incomplete until the spec, route, and state inventory agree:

1. Add or amend the behaviour in the matching numbered section of
   [`functional-spec.md`](../product/functional-spec.md), keeping the blueprint anchor intact.
2. Implement the route or state. A learner-visible state includes a materially different view such
   as a sheet/dialog, empty or not-found state, permission fallback, completion state, or drilled
   sub-view; a transient animation frame is not a separate state.
3. Add one row to [`apps/mobile/e2e/states.ts`](../../apps/mobile/e2e/states.ts) for every new
   state, in the same change. Give it a unique stable name, the real Expo route, the correct
   functional-spec section, and a `reach` path that uses learner interactions. Use `firstRun` only
   when onboarding first would make the state dishonest.
4. Update the inventory above when a route or declared state is added, removed, or renamed. Do not
   mark a blueprint screen implemented merely because a shared component or domain contract exists.
5. Run `pnpm test:e2e`. The route guard rejects a route with no manifest state; the manifest-driven
   accessibility and text-scale suites then exercise every declared state.

---

## Where the blueprint is a prototype, not a spec

Six places the implementation must diverge. All six are also flagged where they occur.

| Blueprint                                                                                 | Reality                                                                               |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| An 80 ms `setInterval` drives stream progress (`2521`)                                    | Real playback position from the audio module                                          |
| Latency computed as `2.0 − reps × 0.26` (`3377`)                                          | **Measured** from prompt-end to speech onset, `null` if unmeasurable                  |
| Pronunciation scores from a seeded PRNG (`3068`, `3079`)                                  | **Real** forced alignment and scoring ([prosody-dsp](../architecture/prosody-dsp.md)) |
| Prosody contour blended linearly toward native (`3158–3161`)                              | **Real** F0 extraction from the recording                                             |
| Review intervals as fixed labels (`2790–2795`)                                            | FSRS-computed, displayed with the blueprint's formatter                               |
| Onboarding loops back to step 0 on completion (`2120`)                                    | Commits the stream and exits                                                          |
| Browser speech synthesis supplies Chat audio (`Loro Chat.dc.html:514`)                    | Catalog/reference audio or on-device TTS behind the production audio contract         |
| Timers and fixture arrays produce Chat replies (`Loro Chat.dc.html:582–588`)              | Guarded live text provider with a bundled authored reply graph as the offline floor   |
| Regex substitutions claim Chat corrections (`Loro Chat.dc.html:568–574`)                  | Genuine validated correction output; uncertainty degrades honestly                    |
| Timers copy a suggested answer into Chat recognition (`Loro Chat.dc.html:529–531`, `596`) | Real on-device recognition or an explicit unavailable/permission fallback             |

The three "real" rows are the honesty line for the product
([overview.md](../architecture/overview.md#the-ten-rules), rule 4).

### Current unavailable-capability treatment

Stream's fabricated playback bar and repeat dots were removed in plan 84. Its manual navigation does
not record plays, and the phrase card explains that audio is unavailable.

- Refrain's manual confirmation now records `latencyMs: null`. The button-timing chart and inferred
  fluency summaries are removed until prompt-end to detected speech-onset measurement exists.
  Practice counts remain real, cues offer read-aloud alternatives to unavailable model playback, and
  lock-in confirms completion of practice rounds rather than unmeasured speaking ability.

---

## Current-surface divergences

Every place a built route departs from the applicable authored `renderVals()`, with the reason and
the plan that closes it. Audited screen by screen against `Loro.dc.html`'s logic classes and `sc-if`
states (plan 55 §1); the prototype table above covers the numbers that must never be ported at all,
and this covers what is simply not there yet or is deliberately different.

**A row here is a promise that the screen does not IMPLY the missing thing.** An omission is honest;
an inert control shaped like a working one is not.

### 1 · Onboarding

| Authored                                                               | Built                                       | ID               | Why                                                                                                          |
| ---------------------------------------------------------------------- | ------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------ |
| Ready summary values are a second label set — `Upcoming trip` (`2153`) | The option's own label — `A trip coming up` | `P1-08`          | A summary of the answers reads back the words they were offered in. Two label sets can disagree.             |
| Summary rows carry emoji (`2155–2159`)                                 | Label and value only                        | `P1-08`          | Presentational; the four rows and their values are the requirement.                                          |
| `goal`/`level` steer content (`2079–2083` helpers)                     | Both stored, neither read                   | `P1-03`, `P1-04` | Set selection is [plan 60](../../plans/archive/2026-09-09/60-authoritative-core-maths.md); storing first is plan 50 §3's order. |
| `goal = trip` opens the trip flow                                      | Always exits to Today                       | `P1-10`          | [Plan 69](../../plans/69-trip-domain-and-arc.md) owns the trip arc. Nothing offers a trip.                   |

### 2 · Add phrases

| Authored                                                                          | Built                              | ID      | Why                                                                                                                |
| --------------------------------------------------------------------------------- | ---------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------ |
| Three modes — Discover · Browse · **Import** (`2351`)                             | Built                              | `P2-14` | [Plan 65](../../plans/archive/2026-09-09/65-import-and-capture.md). Import is a third Discover segment, not a fourth reach layer.     |
| `custom` free-text add row (`2372`)                                               | Built (plan 97)                    | `P2-07` | Discover Add your own; generated candidates use the same sheet and stay own-phrases. Live suggest is Q-21. |
| `+ Add all N` (`canAddAll`, `2374`, `308`, `315`)                                 | Absent                             | `P2-08` | Plan 65 with Import; bulk add needs the tagging sheet's answer for N phrases at once.                              |
| In-your-stream strip (`hasRecent`, `recent`, `2384–2397`)                         | Absent                             | `P2-03` | [Plan 56](../../plans/archive/2026-09-09/56-navigation-failure-and-input-shell.md)'s list work; Today's rail carries the count today. |
| Search field's `✕` clear (`showClear`, `2419`)                                    | Absent                             | `P2-07` | Plan 56 owns input behaviour.                                                                                      |
| `♪` per suggestion row, and in the sheet (`playSheet`, `2426`)                    | Absent                             | `AS-01` | No audio module ([plan 62](../../plans/archive/2026-09-09/62-native-audio-playback.md)). A ♪ that plays nothing claims playback.      |
| The sheet edits an owned phrase (`sheetEditing`, `Save changes`, `removeEditing`) | Add-only; editing is phrase detail | `P2-26` | One editor per control, reached from the row it belongs to. Two would drift.                                       |

### 3 · Phrase detail

| Authored                                                   | Built                      | ID      | Why                                                                                       |
| ---------------------------------------------------------- | -------------------------- | ------- | ----------------------------------------------------------------------------------------- |
| `Hear it` 0.92× and `Slow` 0.6× (`hearNormal`, `hearSlow`) | Absent                     | `AS-01` | Plan 62. Two disabled speed buttons would imply audio exists.                             |
| Word chips speak at 0.85× (`words[].onTap`)                | Chips render, do not speak | `AS-01` | Plan 62. The chips carry the gloss, which is real; the tap is not offered.                |
| `Add related to your stream`, up to 3 (`related`, `2494`)  | Absent                     | `P2-24` | Plan 60's ranking owns "related"; the blueprint's own `added` flag is dead (`added:''`).  |
| Status row shows `Next review <due>` (`phrase.nextDue`)    | `N reps · <bucket>`        | `P3-02` | FSRS intervals are not displayed anywhere yet — plan 60. `'soon'` is not a real interval. |
| Sync hint line (`viewHint`, `2498`)                        | Absent                     | `P2-30` | Presentational; the behaviour it describes (one row, every list) is what is implemented.  |

### 4 · Adaptive stream

| Authored                                                        | Built                                        | ID      | Why                                                                                       |
| --------------------------------------------------------------- | -------------------------------------------- | ------- | ----------------------------------------------------------------------------------------- |
| Per-repetition progress bar (`progressPct`, `624`)              | Absent                                       | `P3-03` | Plan 62 §5. Shipped as a literal `0.35` over silence; removed by plan 55.                 |
| Repeat pips (`dots`, `617–622`)                                 | Absent; audio-unavailable note               | `P3-03` | Plan 62 §5. The target is real; the INDEX needs a playback position.                      |
| Play/pause (`playIcon`, `629`)                                  | Absent; labelled `Next phrase →` button      | `P3-03` | Plan 62. A ► on a screen that cannot play claims playback; it also duplicated `Skip`.     |
| Speed chip 1× · 1.25× · 1.5× · 0.75× (`cycleSpeed`, `2559`)     | Absent                                       | `P3-06` | Plan 62. Nothing to set a rate on.                                                        |
| Animated equaliser (`606–611`)                                  | Absent                                       | `P3-03` | Plan 62. It animates unconditionally in the blueprint, which reads as "audio is playing". |
| Up-next rows carry `♥` and a difficulty pill that cycles on tap | The pill is decorative; the row opens detail | `P3-09` | One action per row (`accessibility.md`); the row states the action it has.                |
| Queue is every active phrase; heading `Up next` (`2568–2584`)   | Today's frozen wave, heading `This wave`     | `LB-08` | [Plan 101](../../plans/101-stream-as-daily-wave.md). The wave is the Stream list. A live-empty wave falls back to remaining active phrases. |
| No path from Stream into the Refrain                            | `Practice this phrase` opens a one-phrase drill | `LB-08` | Refrain is remediation for a phrase the learner is looking at, not the daily wave itself. |

### 5 · Speak

The route implements capability-gated on-device recognition and assisted reveal from
`Loro.dc.html:688–739`. An unavailable platform/language has working reveal/skip controls; reveal
never claims spoken success. Transcript matching uses the canonical Rust boundary. Prompt-to-onset
latency remains null until native onset measurement is validated. Physical-device speech accuracy,
installed-language coverage and audible model playback still require the acceptance described in
[plan 63](../../plans/archive/2026-09-09/63-native-speech-speak-and-latency.md).

### 11 · Today

| Authored                                                     | Built                                 | ID      | Why                                                                                                                                                 |
| ------------------------------------------------------------ | ------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Waves are `done` / `ready` / `locked` (`3309–3311`)          | `passed` / `next` / `later`; `done` from ten phrases heard three times (or a finished Refrain set); never a practice lock | `LB-03` | Authored locked/ready gates blocked further listening. A wave now records that the learner showed up. `passed` remains a clock fact. |
| Wave times `8:00` · `1:00` · `7:00`, hardcoded               | `PRODUCTION_WAVE_TIMES`, 24-hour      | `LB-03` | `1:00` is wrong for 13:00, and two sources for one fact drift. Fixed by NAV-16.                                                                     |
| Ambient loop row and its transport (`toggleAmbient`, `1357`) | Absent                                | `LB-05` | Plan 62. A loop control with no audio behind it is the clearest possible false claim.                                                               |
| Fading tail (`tail`, `1370–1375`)                            | Absent                                | `LB-06` | Nothing tracks a phrase leaving rotation. Plan 64.                                                                                                  |
| Tapping a set row speaks the phrase (`setList[].onTap`)      | Opens phrase detail                   | `AS-01` | Plan 62. The row's hint says what it does.                                                                                                          |
| `dateLabel` `Tuesday · the daily refrain`, `streak` `12`     | The real local date; a derived streak | `LB-02` | Both are fabricated in the prototype. `streak()` is the same function the widget calls.                                                             |
| `Start the * wave` opens the Refrain (`3334`)                | Opens Stream; a paused phrase or hard drill resumes that drill | `LB-03` | [Plan 101](../../plans/101-stream-as-daily-wave.md). The wave is listed in Stream. Day-list start is hidden while a drill is paused. Browser mouse/touch opens Stream → `?phrase=`. Stream Leave / Android Back opens Leave this wave? / Pause the wave with no Today resume row. Linux emulator v14 (`emulator-5554`, APK `d0a802591f75`) passed twelve catalog rows including Stream and phrase-detail Practice now → `?phrase=` and that sheet; `closesPhysicalGate` stays false. Practice sessions also set `fullScreenGestureEnabled: false` for iOS 26. `pnpm ios:evidence` is the Mac one-shot (boot/install + simctl/idb) and is still unevaluated here; physical-device / VoiceOver remain 58/93. Authored `design/**/*.dc.html` is not edited. |

### 12 · The Refrain

| Authored                                                                                           | Built                                       | ID      | Why                                                                                                        |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------- |
| `waveLabel` `Midday wave` above the phrase counter (`3407`)                                        | Wave title on `?wave=`; `This phrase` / `Difficult phrases` on targeted drills | `LB-20` | Plan 101. Targeted finish and pause copy do not claim the day wave. |
| `♪ hear` beside the mic (`hear`, `1500`)                                                           | Absent                                      | `AS-01` | Plan 62. Read-aloud cues explain that model audio is unavailable.                                          |
| "On the beat" equaliser at `beatDur` (`1477–1481`)                                                 | Absent                                      | `LB-23` | Plan 62. A beat with no audio is a claim about sound.                                                      |
| Completion card: `5 locked in` literal, `🔥 13 day refrain`, `"¿Qué tal?" graduated` (`1522–1527`) | Phrases worked and reps today, both counted | `LB-31` | Three fabricated numbers. Graduation is real in the store but not a completion-card fact yet — plan 64.    |
| `Run the wave again ↺` (`restart`)                                                                 | `Back to today`                             | `LB-32` | Re-running a finished wave would record reps a second time; plan 64 owns wave state.                       |
| Set dots are `done` / `current` / `todo` (`setDots`)                                               | Filled-to-cursor `Dots`                     | `LB-21` | Presentational; the count and the position are the information.                                            |
| Menu / switcher opens the timed daily set                          | Menu / More open Difficult phrases only; Stream and phrase detail pass `?phrase=` | `LB-08` | [Plan 101](../../plans/101-stream-as-daily-wave.md). Untargeted `?wave=` is still wave focus; the clock no longer locks it. A bare Refrain URL is the hard-only drill. Browser mouse/touch opens `?filter=hard`. Linux emulator v14 passed Stream and phrase-detail Practice now → `?phrase=` plus switcher/More/phrase-focus `?filter=hard`, including Android Back, labelled Dismiss, and TalkBack variants. `pnpm ios:evidence` is the Mac one-shot and is still unevaluated here; physical-device / VoiceOver remain 58/93. Authored `design/**/*.dc.html` is not edited. |

### 15 · Progress

| Authored                                                                                                          | Built                                          | ID      | Why                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Week / All time range toggle (`1794–1796`)                                                                        | Absent — one range                             | `P4-01` | The two stats it switches are the fabricated ones; with a real history it returns. [Plan 59](../../plans/archive/2026-09-09/59-device-persistence-and-resume.md), then 60.                    |
| Stats are `minutes listened` · `phrases in stream` · `reviews done`, at `84`/`38` and `20.6h`/`410` (`2839–2840`) | `phrases in stream` · `reps done` · `mastered` | `P4-03` | Nothing measures listening time (no audio) or reviews (no SRS session). Two of three stats had no source, so they were replaced by two that do.                            |
| `Best` streak `14` (`2865`)                                                                                       | Absent                                         | `P4-02` | A best streak needs a history longer than the session. Plan 59.                                                                                                            |
| Milestones: `7-day streak` at `6 of 7 — one more day!`, `First Café pack` (`2857–2860`)                           | `First tagged phrase`, `First locked in`       | `P4-07` | Both authored subs are literals, and "one more day" is a nudge about a missed day (non-negotiable 3). The two replacements are earned by signals that cannot go backwards. |
| Tapping a tricky row drills exactly those phrases (`2855`)                                                        | A non-interactive rollup                       | `P4-06` | No tag-filtered session exists. Plan 64 §4 over plan 60's tag-scoped selection.                                                                                            |

## Account utility (F-01)

`/account` is the optional identity utility implemented by plans 89 and 96. It uses the shared spine
and push header, outside the 23 authored learner screens. The route presents a method chooser,
separate email and code views, provider connecting/cancelled/failed states, immediate sign-in
confirmation and returning-account management with actual sync status. Email and provider
credentials remain in the account runtime; the route never renders fabricated provider identity.
Its intended-design extension and state inventory are recorded in
[functional-spec.md](../product/functional-spec.md#f-01-account) and
[the account screen plan](../../plans/archive/2026-09-09/96-account-sign-in-screens.md).

## Listening companion utility (AS-07)

`/listen-export` is a built More/Phrases utility owned by
[plan 99](../../plans/99-batch-phrase-audio-export.md). It is not learner screen 24. It generates
licensed multi-voice takes online, caches each phrase×voice clip on device, and plays that cache
offline. Q-15 leaning pins enable licensed generate; pronunciation review remains. Concatenating
the cache into a shareable AAC/M4A waits on Q-22. An Android emulator has played a labeled
development fixture from cache in airplane mode;
that is not licensed generate and not physical-device 58/72. It does not replace Stream, catalog
reference audio, or account JSON export. States are
recorded in
[functional-spec.md](../product/functional-spec.md#as-07-batch-phrase-listening-export).
