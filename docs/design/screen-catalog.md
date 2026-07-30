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
below. As of 2026-07-30, **7 of the 23 learner screens have Expo routes**. The other 16 remain
target behaviour in the blueprint and functional spec; they must not be treated as runnable app
surfaces. `apps/mobile/app/_layout.tsx` is the shell and is not counted as a learner screen.

The browser suites exercise **20 declared learner-visible states across all 7 routes** through
[`apps/mobile/e2e/states.ts`](../../apps/mobile/e2e/states.ts). A route being present is only the
first coverage gate: sheets, empty states, completion states, and other materially different views
need their own manifest entries.

| #     | Screen               | Current Expo route         | Declared E2E states                                                                                        |
| ----- | -------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1     | Onboarding           | `/onboarding`              | `onboarding · welcome`; `onboarding · packs step`                                                          |
| 2     | Add phrases          | `/add`                     | `add · discover`; `add · browse grid`; `add · theme drilled`; `add · difficulty sheet`; `add · no matches` |
| 3     | Phrase detail        | `/phrase/[id]`             | `phrase detail`; `phrase detail · edited`; `phrase detail · unknown id`                                    |
| 4     | Adaptive stream      | `/practice/stream`         | `stream · first phrase`; `stream · all learned`                                                            |
| 5–10  | Loop A practice      | — not implemented          | —                                                                                                          |
| 11    | Today                | `/`                        | `today · seeded`; `today · nothing in rotation`                                                            |
| 12    | The Refrain          | `/practice/refrain`        | `refrain · first rep`; `refrain · locked in`; `refrain · set complete`; `refrain · tag drill`              |
| 13–14 | Run and Phrasebook   | — not implemented          | —                                                                                                          |
| 15    | Progress             | `/progress`                | `progress · zero state`; `progress · with a tagged phrase`                                                 |
| 16–18 | Trip app screens     | — not implemented          | —                                                                                                          |
| 19    | Lock screen widget   | — native surface not built | —                                                                                                          |
| 20–21 | Survival, Souvenir   | — not implemented          | —                                                                                                          |
| 22–23 | Open chat, Inspector | — not implemented          | —                                                                                                          |

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
  numbered screens and are implemented under plan 81.
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

### Current honesty gaps

Two implemented web routes still violate that line and remain incomplete until plan 55/64 removes
the placeholders:

- Stream renders a hard-coded 35% playback bar while no audio is playing. It must read real native
  playback position or stay absent.
- Refrain measures prompt-to-button-confirm elapsed time and presents it as latency. Real latency is
  prompt-end to detected speech onset; without microphone/onset measurement it must be `null` and
  hidden.

E2E expectations must prove these indicators remain absent until the real measurement sources land;
tests may not preserve the placeholders as intended behavior.
