# Screen catalog

All 21 screens, mapped to their blueprint line ranges, their logic classes, their screenshots, and
the specs that describe them.

**Open the blueprint before implementing any screen.** `Language Learning by Phrases/Loro.dc.html`
is executable spec: every phone is interactive, and the card beside each one explains what it does
and how it connects. This table is an index into it, not a substitute.

---

## How to read the blueprint

```bash
open "Language Learning by Phrases/Loro.dc.html"
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

Screenshots are in `Language Learning by Phrases/screenshots/`. Naming is loose (the blueprint's own
working names), so this table is the reliable mapping.

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

---

## Where the blueprint is a prototype, not a spec

Five places the implementation must diverge. All five are also flagged where they occur.

| Blueprint                                                    | Reality                                                                               |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| An 80 ms `setInterval` drives stream progress (`2521`)       | Real playback position from the audio module                                          |
| Latency computed as `2.0 − reps × 0.26` (`3377`)             | **Measured** from prompt-end to speech onset, `null` if unmeasurable                  |
| Pronunciation scores from a seeded PRNG (`3068`, `3079`)     | **Real** forced alignment and scoring ([prosody-dsp](../architecture/prosody-dsp.md)) |
| Prosody contour blended linearly toward native (`3158–3161`) | **Real** F0 extraction from the recording                                             |
| Review intervals as fixed labels (`2790–2795`)               | FSRS-computed, displayed with the blueprint's formatter                               |
| Onboarding loops back to step 0 on completion (`2120`)       | Commits the stream and exits                                                          |

The three "real" rows are the honesty line for the product
([overview.md](../architecture/overview.md#the-ten-rules), rule 4).
