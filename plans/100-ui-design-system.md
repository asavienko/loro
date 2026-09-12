# Production UI interaction design system

- **Requirement IDs:** `F-05`, `F-06`, `LB-25`…`LB-28`, `NAV-04`, `NAV-06`
- **Number allocation:** 99 is the online-first listening companion. This interaction kit was
  allocated 100 while hygiene was still on a branch. Main archived hygiene as
  [`100-hygiene-reuse-and-tooling.md`](archive/2026-09-10/100-hygiene-reuse-and-tooling.md) under
  the same ID (unresolved collision; do not silently reuse or drop either). Highest assigned ID
  is 100. Plan 101 owns the phrase-relation graph. The next new plan is 102.
- **Milestone:** M1/M2 substrate for remaining learner screens
- **Status:** 🟡 Adapter, UI-thread Pressable, `sheetUp`, Arrival, WarmingSurface, BeatBars,
  Equalizer, PulseRing and UnblurText are consumed by real routes and registered in the workbench.
  Practice/form/chat composites wait for a second caller. Physical-device 60 fps and touch proof
  remain [58](archive/2026-09-09/58-native-workspace-and-device-ci.md) /
  [72](archive/2026-09-09/72-release-quality-gates.md). Fonts, dark theme and the haptic _port_ stay
  [57](archive/2026-09-09/57-runtime-design-system.md). Spine/sheet pull _laws_ stay
  [93](archive/2026-09-09/93-mobile-shell-gestures.md).
- **Depends on:** generated tokens
  ([ADR-0013](../docs/architecture/adr/0013-design-tokens-pipeline.md), done); 57 fonts/haptics/dark
  as they land; 80 specimens; 93 pull-down laws; 56 keyboard/lists; 81 named chrome; 64/75/83
  consume the kit; 58/72 device evidence; Q-14 peak-card treatment only.
- **Reviewed:** 2026-09-10 against `66bc7ad`; current `apps/mobile/src/ui/`, generated motion
  tokens, authored `Design System.dc.html` / `components/`, [motion.md](../docs/design/motion.md),
  [component-inventory.md](../docs/design/component-inventory.md) and the
  [native-libraries review](../docs/reviews/2026-09-09-native-libraries-and-approaches.md)
  inspected. This plan supplies no new runtime, device or deployment acceptance.

## Outcome

Remaining screens compose one **production interaction kit** instead of inventing a second UI
framework or a parallel gesture stack.

The kit is:

1. **A motion adapter** over the generated tokens — Reanimated worklets on the UI thread, with the
   authored reduced-motion outcome declared once.
2. **A gesture catalog** — dedicated-handle pull, sheet dismiss, hold-to-talk, reduce-motion
   scrubber — implemented inside existing primitives, never as per-route `PanResponder` forks.
3. **Reusable practice, form and chat shapes** extracted at two call sites, with prop contracts
   written _before_ the second screen so Review, Memory, Roleplay and Chat do not each invent a
   `GradeRow`.
4. **Measured performance** — tap feedback ≤ 50 ms, sheet/warming/beat at 60 fps while audio plays,
   continuous indicators ≤ 3% CPU.
5. **The distinctive Loro features that are already specified** — warming-band interpolation, the
   beat, word un-blur, `popIn` rewards, listening equalisers — as shared primitives, not route-local
   one-offs.

The v1.1 design package remains the source of truth. Tokens stay generated. Routes still compose. A
screen used once stays in the route.

## Why this is a new owner

| Existing owner                                                                                                                | What it already covers                                                         | Why it cannot absorb this                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| [ADR-0013](../docs/architecture/adr/0013-design-tokens-pipeline.md) / [34](archive/2026-07-30/34-design-system-completion.md) | Token pipeline, contrast gate, early primitive inventory                       | Tokens and the 2026-07 inventory are data. This plan owns the runtime adapter that _plays_ motion tokens and the remaining-screen kit. |
| [57](archive/2026-09-09/57-runtime-design-system.md)                                                                          | Fonts, dark theme, haptic _port_, remaining current-screen inventory           | 57 is the visual/theme substrate. It does not own Reanimated wiring, the gesture catalog, or the remaining-screen kit roadmap.         |
| [80](archive/2026-09-09/80-dev-design-system-workbench.md)                                                                    | `/dev/tokens` gallery and specimen coverage                                    | 80 inspects production APIs; it does not implement them.                                                                               |
| [93](archive/2026-09-09/93-mobile-shell-gestures.md)                                                                          | Spine pull-down and sheet-handle dismiss (`Navigation.dc.html:474`, `681–685`) | 93 owns those two laws. This plan owns every later gesture and the optional RNGH body _inside_ `usePullDown`.                          |
| [56](archive/2026-09-09/56-navigation-failure-and-input-shell.md)                                                             | Route laws, keyboard-safe fields, scalable lists                               | 56 owns when FlashList/keyboard-controller land. This plan owns press/sheet/list _motion_ those lists sit on.                          |
| [81](archive/2026-09-09/81-navigation-spine-switcher-and-more.md)                                                             | More, named headers, exits, resume, travelling transport                       | Chrome presentation. Not press physics, beat bars or grade rows.                                                                       |
| [64](archive/2026-09-09/64-today-and-refrain-production-loop.md)                                                              | Timed waves, Refrain audio, tag drills, peak acceptance                        | 64 owns the ritual. This plan owns the warming interpolator and beat primitive 64 (and later Memory) consume.                          |
| [75](archive/2026-09-09/75-review-and-memory.md)                                                                              | Review engine, Memory curve product                                            | 75 owns scheduling and the route. This plan owns `RevealCard` / `GradeRow` / curve-panel _flip_ once a second caller exists.           |
| [77](archive/2026-09-09/77-dsp-and-speech-labs.md)                                                                            | DSP spike and Skia lab drawings                                                | Skia charts stay 77. This plan owns the reduce-motion scrubber gesture and the domain-free chart _frame_.                              |
| [83](83-open-chat-and-message-inspector.md)                                                                                   | Open chat and Message inspector screens                                        | 83 owns the conversation. This plan owns `MessageBubble`, hold-to-talk and typing-dots primitives 83 consumes.                         |

Do not fold a Tamagui/NativeBase/gluestack/NativeWind rewrite into this plan. The tokens, copy
ownership, layer lint and E2E locators already _are_ the design system
([native-libraries review](../docs/reviews/2026-09-09-native-libraries-and-approaches.md#explicit-non-goals--do-not-adopt)).

## Verified starting point (2026-09-10, `66bc7ad`)

### What already exists

- Generated colour, type, space, radius, motion, audio-timing and touch tokens in
  [`packages/design-tokens/tokens/`](../packages/design-tokens/tokens/). Front door:
  [`apps/mobile/src/ui/theme.ts`](../apps/mobile/src/ui/theme.ts).
- Runtime accent, text-scale and reduced-motion provider
  ([`ThemeProvider.tsx`](../apps/mobile/src/ui/ThemeProvider.tsx)). Learner routes still default to
  Coral. Dark theme and licensed font loading remain 57.
- 24 exported primitives and 9 composites, including `Pressable`, `Sheet`, `usePullDown`,
  `ProgressBar`, `DifficultySelector`, `TagChips`, `PhraseRow`, `EmptyState`, `NavigationMenu`.
  Inventory: [component-inventory.md](../docs/design/component-inventory.md).
- Authored reference kit: **39** JSX files under
  `design/Language Learning by Phrases - V1.1/components/` (8 chat, 7 core, 5 forms, 2 frames, 10
  navigation, 4 practice, 3 progress). These are **not** imported by the app.
- Spine/sheet pull-down via RN `PanResponder` in
  [`usePullDown.ts`](../apps/mobile/src/ui/primitives/usePullDown.ts): 4 px activate, 48 px commit,
  2× vertical dominance, dedicated handle only. Practice routes set `gestureEnabled: false`.
- `Sheet` uses RN `Modal` `animationType="slide"`, not the authored `sheetUp` (340 ms, `ease.pop`)
  on a UI-thread `translateY`.
- `Pressable` scales on the JS thread through RN `Pressable` style
  ([`Pressable.tsx`](../apps/mobile/src/ui/primitives/Pressable.tsx)). Generated press scales
  (`row 0.988`, `button 0.98`, `small 0.9`, `icon 0.82`) are already consumed.
- Refrain `WarmingCard` is **route-local** in
  [`apps/mobile/app/practice/refrain.tsx`](../apps/mobile/app/practice/refrain.tsx). It snaps to a
  band base colour (gradient string stripped to a hex). No Reanimated `interpolateColor`. No glow.
  No 500 ms transition. Peak contrast still uses the generated `warming.peak` text-size floor.
- `react-native-reanimated` **4.1.7**, `react-native-gesture-handler` **2.28.0**,
  `react-native-worklets` **0.5.1** (pinned — do not float) and `expo-font` are in
  [`apps/mobile/package.json`](../apps/mobile/package.json). **Zero**
  `from 'react-native-reanimated'` or `GestureDetector` imports in app source.
- Workbench registry covers all 33 current exports (plan 80). New kit exports must register there in
  the same change.
- Eight of 23 learner screens are built. Fifteen remain, plus chat/inspector.

### What the artifacts require that the app does not yet do

From [`motion.md`](../docs/design/motion.md) and `Loro.dc.html:19–62`:

| Authored motion                        | Current app                                          | Owner after this plan                                  |
| -------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------ |
| UI-thread animation while audio plays  | JS-thread press scale; Modal slide                   | **100** adapter                                        |
| `sheetUp` 340 ms `ease.pop`            | Platform `Modal` slide                               | **100** inside `Sheet`                                 |
| Warming card 500 ms colour + glow      | Instant band hex; route-local                        | **100** interpolator; **64** Refrain wiring; Q-14 peak |
| `barJump` beat 0.72 s / 0.34 s Speed   | Absent                                               | **100** primitive; **64** tempo                        |
| Word un-blur 300–400 ms                | Speak reveal is a copy/state swap                    | **100** primitive; Speak route consumes                |
| `popIn` reward arrivals                | Toast/lock-in appear without the signature overshoot | **100** `Arrival` wrapper                              |
| `eqA` / `eqB` / `pulseRing`            | Absent                                               | **100** equaliser / mic-ring                           |
| `flip` card / curve panel              | Absent                                               | **100** when Review/Memory prove a second caller       |
| Contour trace + reduce-motion scrubber | Unbuilt labs                                         | **77** Skia drawing; **100** scrubber gesture          |

From
[`Navigation.dc.html`](../design/Language%20Learning%20by%20Phrases%20-%20V1.1/Navigation.dc.html)
and
[`Loro Chat.dc.html`](../design/Language%20Learning%20by%20Phrases%20-%20V1.1/Loro%20Chat.dc.html):

| Gesture                          | Citation                                    | Current                    | Owner                                          |
| -------------------------------- | ------------------------------------------- | -------------------------- | ---------------------------------------------- |
| Spine pull-down opens switcher   | `Navigation.dc.html:474`                    | `usePullDown` + plan 93    | **93** laws; **100** RNGH body if devices fail |
| Sheet swipe-down dismiss         | `Navigation.dc.html:681–685`                | Handle + backdrop + Escape | **93** laws; **100** `sheetUp` physics         |
| Session back-swipe disabled      | `Navigation.dc.html:685`                    | `gestureEnabled: false`    | **56** / **93** — do not reopen                |
| Hold-to-talk, lock, cancel, Done | `Loro Chat.dc.html:208–229`                 | Unbuilt                    | **100** primitive; **83** screen               |
| Reduce-motion contour scrubber   | `motion.md` trace; `Loro.dc.html:1202–1206` | Unbuilt                    | **100** gesture; **77** plot                   |

## Library and approach matrix (executable)

This is work, not a review. Install only with `npx expo install` so versions match SDK 54. Pin
Worklets at **0.5.1**.

### Keep and deepen

| Package / approach                   | Work this plan does                                                                      | Do not                                                                                      |
| ------------------------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Generated tokens + `theme.ts`        | Consume motion/press/warming tokens through the existing front door                      | Hand-edit `design-tokens/out/`                                                              |
| `Pressable`                          | Move scale/opacity to Reanimated; keep `MIN_TAP`, dual a11y, loading/forcedState         | Add a second press primitive                                                                |
| `usePullDown` + `Sheet`              | Same laws, same testIDs. Optional RNGH _inside_ `usePullDown` only after device evidence | Import `GestureDetector` in routes; adopt `@gorhom/bottom-sheet`                            |
| Expo Router + `react-native-screens` | Native stack transitions stay the platform's                                             | Custom page-transition choreography ([motion.md](../docs/design/motion.md#what-we-dont-do)) |
| `react-native-reanimated` 4.1.7      | First app-source imports: press, sheet, warming, beat, arrivals                          | Mix into store/delta/A–G files; float Worklets                                              |
| `react-native-gesture-handler` 2.28  | Router peer today. Deepen only inside `usePullDown` or the hold-to-talk primitive        | Per-route gesture detectors                                                                 |
| Plan 80 workbench                    | Register every new export; drive real APIs                                               | Demonstration-only clones                                                                   |

### Adopt when the named owner is touched

| Package                                    | When                                     | This plan's share                                                             | Other owner              |
| ------------------------------------------ | ---------------------------------------- | ----------------------------------------------------------------------------- | ------------------------ |
| Reanimated worklets (already installed)    | First motion slice                       | Adapter + press + sheet + signature primitives                                | 57 reduced-motion policy |
| `expo-haptics` behind `src/lib/haptics.ts` | After 57 writes the named-event table    | Call after successful presentation, never from `applyDelta`, never on failure | **57** owns the port     |
| `@shopify/flash-list`                      | Owned libraries exceed starter size      | Token/Pressable rows; no layout animation in lists                            | **56** owns adoption     |
| `react-native-keyboard-controller`         | Add import + chat composer land together | Shared wrap; routes do not pick a keyboard strategy                           | **56** owns adoption     |
| RN `Switch` wrapped once                   | Settings grows true on/off rows          | Tokens, `MIN_TAP`, dual checked state                                         | **71** / **70**          |
| `@shopify/react-native-skia`               | DSP labs after the quality gate          | Chart _frame_ + scrubber gesture only                                         | **77** owns drawings     |
| Local Maestro flows                        | Native touch/60 fps evidence             | First flows: press, sheet `sheetUp`, warming 500 ms, beat CPU                 | **58** / **72** harness  |

### Do not adopt

Tamagui, NativeBase, gluestack, NativeWind, Paper, Restyle, Moti as a second motion layer,
`react-native-modal`, `@gorhom/bottom-sheet`, Lottie/Rive mascots, confetti/particle kits,
`react-native-animatable`, a second icon font, `expo-speech` / `expo-av` as UI toys, cloud ASR,
skeleton-loader kits, or a `features/` rewrite. Reasons are in the
[native-libraries review](../docs/reviews/2026-09-09-native-libraries-and-approaches.md#explicit-non-goals--do-not-adopt)
and [motion.md](../docs/design/motion.md#what-we-dont-do).

Do **not** invent swipe-to-rate, swipe-to-delete, parallax headers, or pull-to-refresh. Those are
absent from `Navigation.dc.html` and would fight session `gestureEnabled: false`.

## Shared motion adapter

Add one module, for example `apps/mobile/src/ui/motion.ts`, that:

1. Reads generated `easing`, `animation` and `transition` tokens (duration, curve, reduced-motion
   outcome).
2. Exposes typed helpers: `withToken(name)`, `pressScale(feedback)`, `sheetUp`, `popIn`, `flip`,
   `stepIn`, `fadeIn`, `grow`, `barJump({ tempoMs })`, `eqBars`, `pulseRing`, `warmingBand`,
   `wordUnblur`.
3. Applies [motion.md § Reduced motion](../docs/design/motion.md#reduced-motion) from the theme
   provider: information survives; only motion goes. Warming **colour** stays. Press feedback stays
   (130–160 ms affordance).
4. Never uses `setInterval` to drive animation. The blueprint's 80 ms progress timer
   (`Loro.dc.html:2521`) is prototype-only; real bars track real playback or real progress.
5. Never interpolates or invents learner numbers. A bar width is a real 0–1. A beat tempo is the
   authored 720 ms / 340 ms, not a guessed BPM from audio.

Unit-test token → worklet mapping and every reduced-motion branch. Browser E2E can assert presence,
labels, reduced-motion static indicators and 44 px targets. It **cannot** prove 60 fps.

## Gesture catalog

One implementation per law. Routes pass callbacks.

| Primitive              | Path                                          | Laws                                                                          | Buttons/keyboard remain         |
| ---------------------- | --------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------- |
| `usePullDown`          | existing                                      | Dedicated handle, 1 finger, 4/48/2×, short/horizontal/cancel inert            | Caret tap, Escape, Android Back |
| Sheet dismiss          | existing handle + **100** `sheetUp`           | Same handle; content keeps its scroll; scrim is a labelled button             | Backdrop, ✕, Escape             |
| `useHoldToTalk`        | new, when chat lands                          | Press-and-hold → listening; slide-out cancel; lock; Done. Distinct states     | Mic tap path stays              |
| `useScrubber`          | new, with first Skia contour                  | Horizontal drag on a labelled slider; reduce-motion replacement for the trace | Prev/next, play/pause           |
| Optional `onLongPress` | prop on `Pressable` only if a screen needs it | Same target floor; announce the action                                        | Visible control stays           |

RNGH replaces the **body** of `usePullDown` only if physical iOS/Android evidence shows PanResponder
missing simultaneous scroll, mouse-leave-handle, or predictive back. Same primitive, same E2E
`sheet-pull-handle` testID, same laws. That follow-up is this plan plus 93/58 evidence, not a second
helper.

Practice `gestureEnabled: false` stays in `_layout.tsx`. Gestures that mutate session state call
named store actions (`beginRefrainSession`, `setStreamCursor`), never `useApp.setState`.

## Reusable component map

Build when a screen proves the abstraction. Write the **contract** in this plan so the first screen
does not paint the second into a corner.

### Already shipped — deepen, do not rebuild

`Text`, `Pressable`, `Button`, `IconButton`, `Chip`, `Segmented`, `Sheet`, `Card`, `ProgressBar`,
`Dots`, `EmptyState`, `PhraseRow`, `DifficultySelector`, `TagChips`, `ActionBar`, `NavigationMenu`.

### Extract at two call sites (domain-free → `primitives/`)

| Primitive        | Authored reference          | First / second likely callers                               | Notes                                                               |
| ---------------- | --------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------- |
| `Arrival`        | `popIn` / `stepIn` / `flip` | Toast host; Refrain lock-in; onboarding step                | Rewards only for `popIn`. Routine UI must not use the 8% overshoot. |
| `Equalizer`      | `eqA` / `eqB`               | Stream listening; ambient loop; chat voice                  | Stagger 150 ms. Static under Reduce Motion.                         |
| `BeatBars`       | `barJump`                   | Refrain; later Speed-mode surfaces                          | Tempo prop in ms (720 / 340). Not a spinner.                        |
| `PulseRing`      | `pulseRing`                 | Speak mic; chat hold-to-talk                                | Listening-only. Never on a failed take.                             |
| `WarmingSurface` | warming scale + 500 ms      | Refrain card; any later automaticity hero                   | Colour is data. Glow drops under Reduce Motion. Q-14 owns peak art. |
| `UnblurText`     | word un-blur                | Speak; later inspector word rows if they share the mechanic | Instant swap under Reduce Motion.                                   |
| `SearchField`    | `forms/SearchField.jsx`     | Discover; later More search (81)                            | Keyboard ownership stays 56.                                        |
| `ChoiceCard`     | `forms/ChoiceCard.jsx`      | Onboarding already local; Settings/Account if shared        | Promote only at the second caller.                                  |
| `StepDots`       | `forms/StepDots.jsx`        | Onboarding; later flows                                     | Distinct from session `Dots`.                                       |

### Extract at two call sites (domain types → `components/`)

| Composite       | Authored reference        | First / second likely callers     | Contract                                                              |
| --------------- | ------------------------- | --------------------------------- | --------------------------------------------------------------------- |
| `RevealCard`    | `practice/RevealCard.jsx` | Review; later Run if Q-05 opens   | Prompt/answer/hint as **passed strings**. `flip` on reveal. No store. |
| `GradeRow`      | `practice/GradeRow.jsx`   | Review; Stream re-rate            | Four grades, interval **labels as props** (real FSRS intervals).      |
| `WordChip`      | `practice/WordChip.jsx`   | Speak; inspector glosses          | `lang` on target text. Un-blur via `UnblurText`.                      |
| `ScoreRing`     | `practice/ScoreRing.jsx`  | Labs after DSP gate               | Value is measured or omitted. No prototype PRNG.                      |
| `MessageBubble` | `chat/MessageBubble.jsx`  | Chat; inspector header            | Passed line + provenance. No provider calls.                          |
| `TypingDots`    | `chat/TypingDots.jsx`     | Chat pending; later composer      | Pending state, **not** proof of a live reply.                         |
| `MicButton`     | `chat/MicButton.jsx`      | Speak; chat                       | Real availability from the audio module. Pulse only while listening.  |
| `DiffRow`       | `chat/DiffRow.jsx`        | Inspector; later kept-line review | Plain diff of real corrections. Absence ≠ correctness.                |
| `MeterBar`      | `progress/MeterBar.jsx`   | Progress; Memory                  | Named bar + `ChartSummary`. Real 0–1.                                 |

Navigation named parts (`ScreenHeader`, `ExitSheet`, `ResumeStrip`, `TransportStrip`, `DayRow`,
`ArrivalNote`) stay **81**. Do not pre-create them here.

Charts (`PitchContour`, `RhythmBars`, `WaveformPair`, `ForgettingCurve`, `Sparkline`,
`LadderHistogram`, `WeekDots`) stay **target names**. 77 draws; this plan supplies the frame,
summary and scrubber. Missing samples stay missing.

## Distinctive features (specified, not invented)

These are the interesting parts of Loro. They are already in the blueprint. This plan makes them
reusable and performant.

### 1 · Warming surface — the hero metaphor (`LB-25`)

`Loro.dc.html:1438`, `3392–3396`. Four bands: cold → warm → hot → peak. 500 ms `interpolateColor` on
a shared value driven by **real** `automaticity`. Animated shadow/glow is decoration and drops under
Reduce Motion; the colour change is information and stays.

Current Refrain card snaps a band hex. The kit replaces that snap with the interpolator when the
primitive is extracted. Peak text stays ≥ 17 px semibold until Q-14 replaces the secondary-text
treatment. Do not simulate automaticity to demo the animation.

### 2 · The beat (`LB-28`)

`Loro.dc.html:1476–1482`, `3414`. Three (or more) bars, `barJump`, staggered 120 ms. Tempo **0.72
s** normally and **0.34 s** in Speed mode — the only visual cue that Speed is different. ≤ 3% CPU
combined with other continuous indicators. Static bars under Reduce Motion.

### 3 · Word un-blur — Speak (`Loro.dc.html:706–714`)

Grey block + blur → accent fill (just revealed) → settled ink. 300–400 ms. Instant swap under Reduce
Motion. The mechanic _is_ the reward; do not replace it with a fade.

### 4 · Reward arrivals (`popIn`)

8% overshoot, 300–500 ms, `ease.pop`. Lock-in diamond, completion check, level-up, toast. Using it
for routine chrome dilutes it. Reduce Motion: 150 ms cross-fade.

### 5 · Listening equaliser and mic ring

`eqA` / `eqB` / `pulseRing`. Staggered, organic, UI-thread. They mean "sound is happening", never
"the model is thinking". Typing dots in chat are a **pending** state, not evidence of a provider.

### 6 · Hold-to-talk

`Loro Chat.dc.html:208–229`. Holding, locked listening, cancel, Done are distinct. PCM stays in
native memory (ADR-0011). The primitive reports phase; it does not return audio bytes.

### 7 · UI-thread press physics

Every control already goes through `Pressable`. Moving scale to Reanimated is how tap → visual
feedback stays ≤ 50 ms while audio plays
([performance.md](../docs/architecture/performance.md#interaction-latency)).

## Performance work

Cite the budget on every perf commit.

| Surface                         | Budget                       | How this plan attacks it                                   | Proof                                           |
| ------------------------------- | ---------------------------- | ---------------------------------------------------------- | ----------------------------------------------- |
| Tap → visual feedback           | ≤ 50 ms                      | Reanimated press scale                                     | Browser presence + device trace                 |
| Warming card 500 ms             | 60 fps, always               | `interpolateColor` shared value, no band re-render         | Device floor; warming is the canary             |
| Sheet present/dismiss           | 60 fps; 340 ms `sheetUp`     | Replace Modal slide with UI-thread `translateY`            | Device + existing mouse/touch E2E               |
| Beat / equaliser / pulse        | 60 fps and ≤ 3% CPU combined | Worklets; pause offscreen; Reduce Motion static            | Device CPU; browser static under reduced-motion |
| Any animation while audio plays | 60 fps                       | No JS-thread animation on practice surfaces                | Device; Playwright cannot close this            |
| List reorder                    | transforms, never height     | Queue reorder 320 ms `ease.out`                            | Stream E2E + no-layout-animation lint/review    |
| Scrolling                       | 60 fps, 5 s, zero drops      | Keep `ScrollView` at 31 phrases; FlashList when 56 says so | Device; 56 owns the list swap                   |

No skeleton loaders — data is local. No layout animation in lists. No `setInterval` animations.

## Remaining work

1. [x] Land this plan, index row, CLAUDE next-ID, design-system/PRD pointers. No runtime.
2. [x] Motion adapter over generated tokens + unit tests for reduced-motion outcomes. First
       Reanimated import. Worklets stay 0.5.1.
3. [x] UI-thread `Pressable` scale/opacity. Keep loading/forcedState, dual a11y, `MIN_TAP`. Existing
       press E2E stays green.
4. [x] `Sheet` `sheetUp` / dismiss on UI thread. Preserve handle, scrim-as-button, copy-driven
       dismiss, web max-width, plan-93 mouse/touch/cancel coverage.
5. [x] `Arrival` wrapper for `popIn` / `stepIn` / `fadeIn`. Wire toast + one reward surface. Do not
       sprinkle `popIn` on routine chrome.
6. [x] `WarmingSurface` interpolator extracted when Refrain (or a second hero) consumes it. Colour
       stays data; glow respects Reduce Motion; Q-14 still owns peak art.
7. [x] `BeatBars`, `Equalizer`, `PulseRing` primitives with tempo/stagger props and Reduce Motion
       static variants. Refrain/Speak/Stream consume them in the same change as the first caller.
8. [x] `UnblurText` for Speak word reveal. Instant swap under Reduce Motion.
9. [ ] Practice composites (`RevealCard`, `GradeRow`, `WordChip`) in the same change as Review or
       the second caller. Interval labels are real FSRS strings.
10. [ ] Form primitives (`SearchField`, `ChoiceCard`, `StepDots`) only at the second caller.
        Keyboard strategy stays 56.
11. [ ] Chat primitives (`MessageBubble`, `TypingDots`, `MicButton`, `DiffRow`) and `useHoldToTalk`
        in the same change as 83's first surface. No PCM in JS.
12. [x] Register every new export in the plan-80 workbench with default/disabled/loading/error/
        long-copy/reduced-motion specimens. Cyrillic and 200%/310% stay required.
13. [x] Drift/static gates: no colour literals, no JS-thread animation on practice surfaces that
        play audio, no `setInterval` animation, forbidden UI-kit imports.
14. [ ] Device evidence with 58/72: press ≤ 50 ms, warming 60 fps, sheet 60 fps, beat CPU, VoiceOver
        / TalkBack on new controls, finger pull still matching plan 93. Browser green is not
        acceptance.

## Acceptance criteria

- Remaining screens can land without a second design system, a second gesture helper, or a UI kit.
- Every authored motion token that a shipped surface uses runs on the UI thread with its declared
  reduced-motion outcome.
- `Pressable`, `Sheet` and `usePullDown` keep their current accessibility and E2E contracts while
  gaining token-faithful motion.
- Warming colour, beat tempo, un-blur and `popIn` exist as reusable primitives consumed by real
  routes — not workbench-only demos.
- Learner numbers remain measured or `null`. Animations never invent scores, latency or
  automaticity.
- Recorded audio still never leaves the device. Hold-to-talk reports phase only.
- No screen, toast or haptic shames a missed day or a missed take.
- `pnpm check` is green on each slice. Learner E2E stays green when shared primitives change.
  Workbench E2E covers new exports. `pnpm test:e2e:bundle` keeps `/dev/tokens` out of production.
- Physical-device 60 fps, touch and assistive-technology proof are recorded before native release.
  Playwright does not close those gates.

## Delivery order and gates

1. **Docs/index (this change).** No runtime.
2. **Adapter + Pressable + Sheet physics.** Unblocks every later screen. No font/haptic/dark work
   (that is 57). No FlashList (that is 56).
3. **Signature primitives** as the owning route is touched: warming/beat with 64, un-blur/pulse with
   Speak, equaliser with Stream listening, `popIn` with toast/lock-in.
4. **Practice / form / chat composites** in the same PR as the first _or_ second caller — never as a
   speculative gallery.
5. **Workbench registration** in the same change as each export (80 coverage, 100 implementation).
6. **Device traces** on the floor devices in
   [performance.md](../docs/architecture/performance.md#startup) before claiming 60 fps.
7. Q-14 still gates peak-card visual treatment. Q-05 still gates Run/Phrasebook. Q-16 still gates
   chat _release_. Offline chat primitives may proceed with 83.

## Out of scope

- Font licensing/loading, dark theme, haptic _module_ —
  [57](archive/2026-09-09/57-runtime-design-system.md)
- Durable accent/motion preferences —
  [71](archive/2026-09-09/71-settings-telemetry-and-experiments.md)
- Workbench route, contrast report, production exclusion —
  [80](archive/2026-09-09/80-dev-design-system-workbench.md)
- Spine/sheet pull _laws_ and session back-swipe —
  [93](archive/2026-09-09/93-mobile-shell-gestures.md)
- Route metadata, keyboard controller, FlashList adoption —
  [56](archive/2026-09-09/56-navigation-failure-and-input-shell.md)
- More / exits / resume / transport chrome —
  [81](archive/2026-09-09/81-navigation-spine-switcher-and-more.md)
- Refrain waves, audio, drills — [64](archive/2026-09-09/64-today-and-refrain-production-loop.md)
- Review engine and Memory maths — [75](archive/2026-09-09/75-review-and-memory.md)
- Skia DSP drawings — [77](archive/2026-09-09/77-dsp-and-speech-labs.md)
- Chat product and live providers — [82](archive/2026-09-09/82-guided-chat-domain-and-service.md) /
  [83](83-open-chat-and-message-inspector.md)
- Token generator changes — plan 53 (done)
- Editing authored `.dc.html` / reference JSX
- A new UI kit, a `features/` rewrite, or abandoning Expo

## Commit sequence

1. `docs(docs): add 100 ui interaction design system (F-05)`
2. `feat(mobile): reanimated motion adapter and press scale (F-05)`
3. `feat(mobile): sheetUp physics on the shared sheet (NAV-06)`
4. `feat(mobile): arrival popIn and toast motion (F-05)`
5. `feat(mobile): warming surface interpolator (LB-25)` — with 64 consumption
6. `feat(mobile): beat equalizer and pulse primitives (LB-28)`
7. `feat(mobile): speak word un-blur primitive (LB-26)`
8. Later composites tagged with the consuming screen's requirement ID (Review, Chat, Discover)

Each commit leaves `pnpm check` green. Do not mix a font/haptic/dark change into a motion commit. Do
not let generated tokens ride along unless the commit is about regenerating them.
