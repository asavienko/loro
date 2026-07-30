# The sensory layer: generate the type and motion tokens, load the fonts, add haptics

- **Requirement IDs:** `LB-25`, `LB-26`, `LB-27`, `LB-28`, `F-05`, and the M1 deliverable "all
  tokens"
- **Milestone:** M1 — it is a prerequisite for
  [34-design-system-completion](34-design-system-completion.md), not a parallel effort
- **Spec:** `docs/design/design-system.md#typography`, `docs/design/motion.md`,
  `docs/design/copy-and-tone.md` (rule 5)
- **ADRs:** 0013 (design tokens pipeline)
- **Size:** M

## Current state — the pipeline emits half the design system

`packages/design-tokens/tokens/` holds five files. The generator reads two families and drops two:

| Token file    | Generated into `out/tokens.ts`, `Tokens.swift`, `Tokens.kt`? |
| ------------- | ------------------------------------------------------------ |
| `color.json`  | ✅                                                           |
| `accent.json` | ✅                                                           |
| `layout.json` | ✅ (space, radius, shadow)                                   |
| `type.json`   | ❌ **nothing**                                               |
| `motion.json` | ❌ **nothing**                                               |

`out/tokens.ts` exports
`surface · ink · line · semantic · scale · onDark · gradient · accents · space · radius · shadow`.
There is no font, no easing curve, no duration, on any of the three platforms. The two token
families that carry how the product _feels_ are the two that never leave JSON — and because they are
not generated, the CI drift check cannot notice they are missing, and the contrast gate has nothing
analogous to guard them.

Four consequences, each independently a defect:

### 1 · Neither typeface is loaded

`apps/mobile/src/ui/theme.ts:33–57` hand-transcribes the scale — sizes and weights only. There is no
`fontFamily` on any variant, `expo-font` is a dependency with **no `useFonts` call anywhere**, and
`app.config.ts` bundles no font asset. The app renders in SF Pro and Roboto.

`design-system.md#typography` specifies **Plus Jakarta Sans** for everything and **Instrument Serif
italic** with "exactly one job". The token file already declares both (`tokens/type.json:10`,
`:78–79`). The paragraph that opens `design-system.md` describes the result as "closer to a
well-made notebook than to a productivity app" — that is a claim about a geometric sans and a serif,
and neither is present.

### 2 · Rule 5 of the voice has no rendering mechanism

`copy-and-tone.md` rule 5 is **"Spanish first for feeling, English for meaning"**, and it ends:
_"The Spanish is always in the italic serif; the English is always in the sans."_ The serif **is**
the mechanism. Without it, `¡Hecho! Today is done` (`refrain.tsx:255`), `¡Hola! I'm Loro`
(`onboarding.tsx:181`), and `You're all set` (`:269`) render in 700-weight sans — visually identical
to a section heading. Six of the app's emotional beats currently look like UI chrome.

Note the interaction with the a11y gate: those lines carry `lang="es"` correctly. They are announced
in Spanish and displayed as if they were English UI. Only the visual half is broken.

### 3 · Every changing number jitters

`design-system.md#typography`: _"`tabular-nums` on every changing number (streaks, counters, scores)
so digits don't jitter."_ No `fontVariant: ['tabular-nums']` exists in the app. Affected, in order
of how much it matters:

| Number                 | Where                               | Why it shows                              |
| ---------------------- | ----------------------------------- | ----------------------------------------- |
| `{auto}%` automaticity | `refrain.tsx:413`                   | Changes on every rep, beside a moving bar |
| `formatLatency(...)`   | `refrain.tsx:438`                   | The falling-effort read-out — `LB-27`     |
| `Rep n / 6`            | `refrain.tsx:456`                   | Reflows the row as `1`→`2`                |
| Streak (hero, 46 px)   | `progress.tsx:106`, `index.tsx:88`  | The largest digits in the app             |
| `StatTile` values      | `index.tsx:218`, `progress.tsx:147` | Three tiles side by side                  |

This is the cheapest visible quality win in the repo and it is one property on one component.

### 4 · Reduced motion cannot be inherited

`component-inventory.md` convention 7 states: _"Reduced-motion behaviour lives in the motion tokens,
so a new component inherits it."_ `motion.md` says the same: applied "through the motion tokens, so
a new animation inherits the correct behaviour rather than needing to remember it". With
`motion.json` ungenerated, there is nothing to inherit from, and
[34-design-system-completion](34-design-system-completion.md) §3 — which is where the 11 animations
get built — asks for "the documented easing set as tokens" as an input it does not have.
`AccessibilityInfo` is never imported anywhere in the app.

## The fifth thing, which is a spec gap: there are no haptics

`motion.md` is a complete catalogue of visual feedback and mentions haptics **nowhere**.
`accessibility.md` mentions them once, for the prosody rhythm chart. Nothing in the app calls
`expo-haptics`; it is not a dependency.

For a product whose core loop is _tap, speak, watch a card warm up, six times_, that is a real
omission rather than a deferral:

- `motion.md` principle 4 is "Everything responds to touch", and principle 1 is "Motion is feedback,
  not decoration". A haptic is the same argument in a different modality, and it works with the
  phone face-down — which the ambient loop and hands-free stream explicitly encourage (`LB-05`,
  `P3-01`).
- The **lock-in** at 100% (`LB-30`) is the app's reward moment. `popIn` on a 💎 is currently its
  entire expression, and `popIn` is not implemented either.
- A learner practising aloud in public is looking away from the screen. Touch is the only channel
  left.

**Decision needed:** where haptics fire and where they must not. Proposed, to be confirmed with the
designer and then written into `motion.md` as its own section:

| Event                                      | Haptic                       | Why                                                 |
| ------------------------------------------ | ---------------------------- | --------------------------------------------------- |
| Each rep confirmed                         | `impactAsync(Light)`         | The beat of the loop; must not become tiring        |
| Lock-in at 100%                            | `notificationAsync(Success)` | The reward, once per phrase per day                 |
| Wave / set complete                        | `notificationAsync(Success)` | The ritual's full stop                              |
| Difficulty or tag chosen                   | `selectionAsync()`           | Matches the platform's own segmented controls       |
| Undo tapped                                | `impactAsync(Light)`         | Confirms a reversal the learner may not see         |
| **A missed day, an ASR miss, any failure** | **none**                     | Non-negotiable #3, and rule "never attribute fault" |

That last row is the one worth writing down: a haptic on failure is how a well-meaning
implementation would make the app punitive without a single word of copy.

Haptics must respect the system setting and a future in-app toggle
([29-settings-and-engine-switching](29-settings-and-engine-switching.md)), and must be off under
Reduce Motion only if the platform reports haptics as motion — check, do not assume.

---

## The work

### 1. Generate `type.json` and `motion.json` for all three targets

Extend `packages/design-tokens/src/generate.ts` to emit both families, and keep the existing shape:
committed output, drift-checked in CI (ADR-0013). Specifics that matter:

- **Type** emits family names, the full scale, weights, tracking, line heights, and the
  `variant: "tabular-nums"` flag. The RN target emits usable `TextStyle` objects — the point is that
  `theme.ts` stops hand-copying.
- **Motion** emits easing as platform-appropriate values (cubic-bezier control points, not a CSS
  string — Swift and Kotlin cannot parse `cubic-bezier(...)`), durations, stagger offsets, and **the
  reduced-motion behaviour per animation** as data. That last part is what makes convention 7 true.
- The Swift and Kotlin targets get both families too. The widget (`30`) renders the streak; it needs
  the same numerals.

### 2. Delete the hand-copied type scale

`theme.ts`'s `type` object becomes a re-export or a thin adapter over the generated tokens. Today it
is a second source of truth for a value the pipeline exists to own, and it has already drifted — it
is missing `serifDisplay`, `serifNum`, every family, and every tabular flag.

### 3. Load the fonts

`useFonts` in `app/_layout.tsx` with `expo-splash-screen` held until the fonts resolve — the splash
already exists in `app.config.ts`. Bundle the two families as assets; do not fetch them. Then:

- Add `serifDisplay` / `serifNum` variants to `Text` and use them for the emotional beats listed in
  `design-system.md#typography`. Note `Text` currently accepts a `variant` union off `type`, so the
  variants appear automatically once the tokens exist.
- Set `fontVariant: ['tabular-nums']` wherever the generated token says so.
- **A missing font must degrade, not crash.** If a family fails to load, fall back to the system
  family and render; never block the app on a typeface.

### 4. Add the haptic layer

One module (`src/lib/haptics.ts` or `src/platform/`, per the layer rules in
[mobile-app.md](../docs/architecture/mobile-app.md#layers)) exposing named events — `rep()`,
`lockIn()`, `complete()`, `select()` — not raw `impactAsync` calls at 40 call sites. Named events
are what let the table above be reviewed, tested, and switched off in one place.

Then write the section into `docs/design/motion.md`, because the next screen needs to inherit the
policy rather than re-derive it.

### 5. A guard, so this cannot recur

The reason this went unnoticed is that nothing checked. Add a generator test asserting **every**
file in `tokens/` contributes at least one export to every target, and failing when a new token file
is added without an emitter. That is the check that would have caught `type.json` and `motion.json`
on the day they were written.

## Acceptance criteria

- `out/tokens.ts`, `Tokens.swift`, and `Tokens.kt` each export type and motion tokens; the drift
  check covers them; a new token file cannot be added without an emitter.
- `theme.ts` contains no hand-copied token values.
- Both typefaces render on device, the splash holds until they load, and a load failure degrades to
  the system font instead of a blank screen.
- The serif renders on exactly the beats `design-system.md#typography` lists, and nowhere else — a
  lint or test check, since "never for UI labels" is a rule someone will break.
- Every changing number uses tabular numerals; the streak, `Rep n / 6`, and `{auto}%` do not reflow
  as digits change.
- Motion tokens carry a reduced-motion behaviour per animation, and `34` §3 consumes them rather
  than defining its own curves.
- The haptic policy is in `motion.md`, implemented through one named-event module, respecting the
  system setting, and **absent from every failure path**.
- `pnpm check` green, including the contrast gate and the token drift check.

## Tests

- Generator tests: every token file emits to every target; the three outputs stay in sync; the
  new-file guard fails as designed.
- A snapshot of the RN type scale, so a token change is visible in review rather than implied.
- A test that the serif variants are used only on the approved beats.
- Font-load failure renders the app with fallback families (mock the loader).
- Haptics: each named event fires the expected platform call; **no** haptic fires on a failure
  outcome, a missed day, or an ASR miss. That last assertion is the one worth having.
- Reduced-motion: with the flag on, every registered animation resolves to its documented behaviour
  — the manifest check `34` and `35` both ask for, now possible because the data exists.

## Risks

- **Font licensing and bundle size.** Plus Jakarta Sans and Instrument Serif are both open-licensed;
  confirm and record it. Five weights of a sans plus one serif is a real download — subset to Latin
  plus the Spanish accented set, and measure against the budget in
  [38-performance-budget-harness](38-performance-budget-harness.md).
- **The scale was transcribed from a CSS prototype into RN points.** `labelSm` is 10 px uppercase
  and `label` is 11 px; those are CSS pixels in a browser mock of a phone, and they are not
  obviously the same thing as 10 pt on a 6.1" device. Check the real rendered size against the
  screenshots before assuming the numbers transfer, and raise it with the designer if they do not —
  this is the one place where blueprint fidelity and legibility may genuinely conflict, and it
  interacts with dynamic type in [35-accessibility-wcag-pass](35-accessibility-wcag-pass.md) §2.
- **Haptics are easy to overdo.** Six reps a phrase, five phrases a day is 30 taps; a heavy impact
  on each will get the app muted. Start Light, and put it behind a setting.

## Out of scope

- The 11 animations themselves — [34-design-system-completion](34-design-system-completion.md) §3
  owns them and this plan is its input.
- Dark-theme tokens (`F-06`) and the runtime theme provider (`F-05`) — also `34`.
- Gradient _rendering_ (the warming card's peach and coral bands are currently flattened to their
  first stop in `refrain.tsx:353–355`). The token exists; drawing it needs Skia or
  `expo-linear-gradient`, which belongs with the warming card component in `34`.
- The prosody rhythm chart's haptic pattern —
  [27-labs-pronunciation-and-prosody](27-labs-pronunciation-and-prosody.md).
