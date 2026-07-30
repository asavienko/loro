# Complete the design system: the component inventory and the motion layer

- **Requirement IDs:** `F-05`, `F-06`, and the M1 deliverable "all tokens, ~20 core components"
- **Milestone:** M1/M2
- **Spec:** `docs/design/design-system.md`, `docs/design/component-inventory.md`,
  `docs/design/motion.md`
- **ADRs:** 0013 (design tokens pipeline)
- **Size:** M–L
- **Depends on:** [47-typography-motion-and-haptics](47-typography-motion-and-haptics.md) — §3 below
  needs the easing set and per-animation reduced-motion behaviour as **tokens**, and the generator
  emits neither today. Build components against the type tokens too, or the refactor hand-copies a
  scale that is about to be generated.

## Current state

`docs/product/roadmap.md` is candid: "Tokens + ~15 primitives; **the inventory is not complete**."

Concretely, `apps/mobile/src/ui/` is three files:

- `primitives.tsx` (373 lines) — the ~15 components
- `theme.ts` (123 lines)
- `ToastHost.tsx` (68 lines)

Against `docs/design/component-inventory.md`, which catalogues "**the ~40 components** the 21
screens are actually made of". So roughly half the inventory does not exist, and the seven ported
screens fill the gap with ad-hoc inline styles — `apps/mobile/app/add.tsx` is 500 lines,
`refrain.tsx` 486, and both contain substantial one-off layout.

The token pipeline itself is in good shape: `packages/design-tokens/` generates for three targets,
output is committed and drift-checked in CI, and `checkContrast.ts` enforces accessibility rules at
build time.

## Why finish it before more screens

Thirteen screens are unbuilt. Each one built against ad-hoc styles adds to the eventual
reconciliation, and the labs and trip screens are the visually richest in the product. Completing
the inventory first is cheaper than retrofitting.

There is also a correctness argument: the tokens "encode the accessibility rules (`accentInk` for
text, never `accent`)" (`CLAUDE.md`). A component that inlines a colour bypasses that encoding, and
the contrast gate only checks tokens — it cannot see a literal.

## The work

### 1. Audit the gap

Walk `component-inventory.md` against `primitives.tsx` and produce the actual list of missing
components. Then walk the seven ported screens for inline patterns that should be components — the
repeated card headers, chip rows, sheet layouts, and stat blocks. The extraction candidates are
wherever the same `View` + `Text` shape appears twice.

Part of that walk is already done (verified 2026-07-29), and the findings say something about
sequence:

- **Missing P1 primitives:** `Chip`, `Segmented`, `Sheet`, `IconButton`, `TextField`, `Equalizer`,
  `Scrim` — plus `TextArea` (P2). Three existing primitives are missing a documented prop: `Button`
  has no `loading`, `ProgressBar` no `animated`, `Dots` no `variant`.
- **`src/ui/components/` does not exist at all** — none of the 39 domain components. The consequence
  is concrete rather than aesthetic: the phrase row is re-implemented four times
  (`app/index.tsx:119`, `app/practice/stream.tsx:288`, `app/add.tsx:299`, and the sheet's card at
  `add.tsx:394`) with four different accessibility labels and none of the `accessibilityActions` /
  `accessibilityValue` structure `accessibility.md#every-phrase-row` specifies. **`PhraseRow` is the
  highest-value component in the inventory** — build it first, and build it to that spec rather than
  by copying one of the four.
- **A duplicate already exists:** `stream.tsx:337` defines a second, incompatible `Pill` beside
  `primitives.tsx:174`. That is what the inventory drift produces on its own.
- The tagging sheet (`add.tsx:350–494`) is the `Sheet` + `Chip` + `Segmented` + `PhraseRow`
  extraction in one place, and it is also where the sheet's screen-reader defects live
  ([35](35-accessibility-wcag-pass.md)) and where its drawn-but-inert drag handle sits (`:382`). One
  component fixes three plans' findings.

### 2. Build the missing components

From the inventory, grouped by the screens that need them next: sheets and modals (the tagging sheet
already exists inline in `add.tsx`), list rows, chips and pills, stat blocks, rings and gauges,
charts (curve, contour, bars), the warming card as a reusable component, transport controls, and the
empty/error state components that every screen currently reinvents.

`WarmingCard` carries one defect worth naming: two of its four bands are **gradients**, and
`app/practice/refrain.tsx:353–355` regex-extracts their first hex stop and fills flat. The peach and
hot-coral bands — the reward states — are currently the wrong colour, and the fix needs a real
gradient (Skia or `expo-linear-gradient`), not another token. The band colours themselves are
correct and generated; only the drawing is missing.

Each component: token-only styling, an accessibility label API, a `testID`, and a reduced-motion
path if it animates.

### 3. The motion layer

`docs/design/motion.md` catalogues **all 11 keyframe animations**, the easing set, and the
touch-feedback layer. Today `react-native-reanimated` is a dependency and almost nothing is
animated.

Implement the 11 as named, reusable primitives — not as per-screen animation code — with:

- The documented easing set as tokens, so a screen cannot invent a curve.
- A reduced-motion behaviour per animation that preserves its information
  ([accessibility-wcag-pass.md](35-accessibility-wcag-pass.md) §3).
- A registry, so the reduced-motion coverage gate can assert every animation is registered.

The touch-feedback layer matters more than it sounds: it is the difference between the blueprint
feeling like a prototype and the app feeling built.

### 4. Accent theming and dark theme (`F-05`, `F-06`)

The token pipeline already generates all four accents and the contrast gate already checks all four.
What is missing is the runtime: a theme provider, a switch, and every component reading from it
rather than from a static import. `theme.ts` is imported directly today
(`import { accent, ink, … } from '../src/ui/theme'`), which is a static binding — that has to become
a hook or a context before a runtime switch is possible.

Dark theme needs a token set that does not exist yet. Generating it is the design work; consuming it
is the same refactor.

### 5. A component gallery

A route (dev-only, or web-only) rendering every component in every state, every accent, light and
dark, at default and largest type. This is how design fidelity gets reviewed without a device build,
and it is what makes the design-fidelity gate in `docs/process/definition-of-done.md` practical
rather than aspirational.

### 6. Guard the boundary

- Lint: no colour literals outside `packages/design-tokens` (extend the existing lint setup — the
  rule matters more than the exact form). **The existing rule only matches hex**, so `rgba()` slips
  through in six places;
  [48-app-shell-failure-states-and-input](48-app-shell-failure-states-and-input.md) §3 lands that
  fix ahead of this refactor, since it blocks nothing else. Do not do it twice.
- Lint: `apps/mobile/app/**` may not define styled layout primitives; those belong in `src/ui/`.

## Acceptance criteria

- Every component in `component-inventory.md` exists, or is explicitly marked not-needed with a
  reason.
- The seven ported screens are refactored onto the components; no repeated inline layout remains.
- Zero colour literals in `apps/mobile`, lint-enforced.
- All 11 animations implemented as named primitives with reduced-motion behaviours and a registry.
- Accent theme switches at runtime across the whole app; contrast gates green for all four.
- Dark theme tokens generated and consumed.
- The gallery renders every component × state × theme × type size.
- `pnpm check` green, including the drift check on generated token output.

## Tests

- Snapshot tests per component per state, driven from the gallery's manifest so a new component is
  covered by construction.
- Contrast gate over the dark token set.
- A lint test proving the colour-literal rule fires.
- Largest-dynamic-type snapshots for the text-heavy components.

## Risks

- **Refactoring the seven screens while other plans edit them.** Sequence it: land the components,
  then refactor screen by screen in small PRs, rather than one 2 000-line change.
- **Dark theme is design work, not just engineering.** The warming gradient is already
  contrast-constrained in light theme (Q-14); dark will surface its own version of that problem.
  Budget designer time.

## Out of scope

A published, versioned design-system package for external consumers. There is one app.
