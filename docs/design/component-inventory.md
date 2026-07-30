# Component inventory

The current React Native inventory, followed by the rules for extending it toward the full
blueprint. Only the items in the current tables exist. The authored 39 JSX prototype components in
`design/Language Learning by Phrases - V1.1/components/` are design references, not modules the app
imports.

All reusable app UI lives under `apps/mobile/src/ui/`. Seven learner screens plus the shell use 24
exported primitives and 6 exported composites. There is no `src/ui/charts/` directory yet.

## Current primitives · `src/ui/primitives/`

Primitives are domain-free. Their public exports come from `primitives/index.ts`.

| Component       | Main props/current contract                                                                                          |
| --------------- | -------------------------------------------------------------------------------------------------------------------- |
| `Text`          | `variant`, `color`, `align`, `lang`, `numberOfLines`, `style`; `lang="es"` sets native `es-ES`                       |
| `SectionLabel`  | `size: md\|sm`, `color`; tracked uppercase text                                                                      |
| `ChartSummary`  | Visible `captionSm` summary to accompany a future chart                                                              |
| `SectionHeader` | `label`, optional `hint`, `variant: label\|caption`; baseline aligned                                                |
| `CardHeader`    | `title`, `meta`, `metaVariant`; owns the body gap                                                                    |
| `Pressable`     | `feedback`, `disabled`, `selected`, accessibility props; checked state in native and flat web forms                  |
| `Screen`        | Full-screen `surface.app` container                                                                                  |
| `Card`          | `padding`, numeric `radius`, `background`, border colour/width, optional grouped accessibility; no elevation yet     |
| `DarkCard`      | Flat `surface.dark`, 24 px radius; gradients/shadows are not mapped yet                                              |
| `Divider`       | One-pixel subtle line                                                                                                |
| `Row`           | `gap`, `align`, `justify`, `wrap`, `style`; wraps vertically for large text when requested                           |
| `Stack`         | Vertical `gap` and `style`                                                                                           |
| `Grid`          | Wrapping row with stretch alignment, for same-shaped controls/tiles                                                  |
| `Button`        | `label`, `variant: primary\|secondary\|destructive`, `size: md\|lg`, `disabled`, hint                                |
| `IconButton`    | Required glyph and accessible label; uses the icon target floor                                                      |
| `Pill`          | Static `label`, optional emoji, `tone: neutral\|accent\|onDark`, five sizes, colour overrides                        |
| `Chip`          | Selectable label; `variant: tag\|scenario\|toggle`, `tone: tint\|solid`, explicit role/state                         |
| `Segmented`     | Generic options/value/change; `variant: pill\|track`, button or radio role                                           |
| `Sheet`         | `visible`, `onDismiss`, required learner-facing `dismissLabel`; slide modal with tappable backdrop; grabber is inert |
| `ProgressBar`   | Clamped 0–1 value, colour/track/height/radius, optional label; labelled or hidden, never unnamed                     |
| `Dots`          | Count, filled count, optional size; simple accent pips                                                               |
| `EmojiTile`     | Decorative emoji square with size/radius/background/font-size overrides                                              |
| `Dot`           | Decorative sized colour dot                                                                                          |
| `StatTile`      | String value/label grouped into one accessible node                                                                  |

`controlStyle.ts` is private style algebra for `Chip` and `Segmented`; its unit test pins variant
geometry. Files such as `bars.tsx`, `tiles.tsx`, and `surfaces.tsx` are source grouping, not extra
public components.

## Current composites · `src/ui/components/`

Composites may accept domain types, but do not import the store or learner-facing copy.

| Component            | Current contract and use                                                                                                         |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `ActionBar`          | Safe-area-aware fixed action container; row/column direction. Screen-specific scroll clearance remains named in component tokens |
| `DifficultySelector` | `Difficulty`, labels, `cards\|segmented` layout, default/tight density; add, detail, and stream                                  |
| `EmptyState`         | Passed title/body/action plus padding/gap/alignment; four empty states share the shape                                           |
| `PhraseRow`          | Passed `es`, `en`, `emoji`, `queue\|suggestion`, labels/hint, and non-focusable trailing content                                 |
| `StatRow`            | A row of passed `Stat` values; current call sites supply three                                                                   |
| `TagChips`           | Passed tag order/labels/selected suffix and toggle callback; checkbox semantics and a visible selected mark                      |

`ToastHost.tsx` is a deliberate app host, not a reusable composite: it subscribes to the store and
reads toast copy. Keep store-aware hosts at the UI root rather than weakening the component-layer
rule.

## What is not implemented

The blueprint still calls for reusable audio transport, microphone/listening states, phrase-detail
rich content, practice/reveal/grade surfaces, warming/automaticity feedback, trip/drop surfaces,
roleplay, navigation sheets, and progress/lab visualizations. None should be claimed as an app
component until a real route uses it.

There are also no Skia chart components. `PitchContour`, `RhythmBars`, `WaveformPair`,
`ForgettingCurve`, `Sparkline`, `LadderHistogram`, and `WeekDots` remain target names only. When a
chart lands, pair it with a visible `ChartSummary` and real measurements; missing samples stay
missing rather than being interpolated or simulated.

## Load-bearing component rules

### `PhraseRow`

The current row deliberately takes three display strings rather than a `Phrase` object so catalog
and store views can share it without confusing id spaces. It is one focusable button; `trailing` is
display-only. Both bilingual lines ellipsise at one line and Spanish always carries `lang="es"`. If
future row variants need audio/love/difficulty actions, design and test native accessibility actions
before adding nested focusable controls.

### `Pressable`, `Chip`, and `Segmented`

All taps go through `Pressable` for press feedback and target sizing. A radio or checkbox must pass
`selected`; the primitive emits both `accessibilityState.checked` for native and `aria-checked` for
the browser. Selected controls use border/mark changes as well as colour. `Chip` separates visible
and announced labels because a visible selected suffix must not pollute the accessible name.

### `ProgressBar`

A supplied label produces a named progressbar with native `accessibilityValue` and flat web
`aria-value*` props. Without a label, the visual bar is hidden from assistive technology because the
surrounding row already announces the value. Never create an unnamed progressbar.

### `Sheet` and `ActionBar`

The sheet backdrop is a labelled button; its grabber is not a drag handle yet. `ActionBar` reads the
safe-area inset but does not measure its own height, so each route uses a named clearance token.
Replacing those values with measurement is a behaviour/layout change and needs text-scale E2E
verification.

## Where a new shape belongs

Use this decision order:

1. One call site: keep a named local component in the route. A component used once is not reuse.
2. Two or more call sites, no domain knowledge: add a primitive.
3. Two or more call sites and domain types are useful: add a composite in `components/`.
4. Store subscription or navigation coordination: keep it in a route/app host and pass plain props
   down. Do not make the reusable component subscribe.

For every reusable addition:

- import palette/global scale through `src/ui/theme.ts`; put repeated exact geometry in
  `src/ui/tokens/`, and keep single-use values local without rounding them;
- pass every learner-facing string from `src/lib/copy.ts` through props;
- preserve the 44 px target, visible press feedback, native and web state/value semantics, Spanish
  language, vertical growth at large text, and reduced-motion behaviour;
- export it from the appropriate index, test non-trivial variants, and remove the replaced local
  copies in the same change;
- add or update the learner-visible state in `apps/mobile/e2e/states.ts`, then run `pnpm check` and
  `pnpm test:e2e`.

Build components when a screen proves the abstraction. This keeps the system extendable without
turning the blueprint's prototype catalog into a speculative second UI framework.
