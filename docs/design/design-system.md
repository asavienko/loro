# Design system

The design system has an authored reference, a generated token package, and a partial React Native
implementation. Keeping those three states explicit prevents a prototype treatment from being
mistaken for shipped behaviour.

Pipeline and contrast rationale: [ADR-0013](../architecture/adr/0013-design-tokens-pipeline.md) ·
Implemented components: [component-inventory.md](component-inventory.md) · Motion contract:
[motion.md](motion.md)

## Source hierarchy

Precedence is scoped, not one global file order:

1. `design/Language Learning by Phrases - V1.1/Loro.dc.html` owns the visual and interaction intent
   of learner screens 1–21; `Loro Chat.dc.html` owns screens 22–23.
2. `Navigation.dc.html` owns the shared shell, five surface classes, spine, switcher, and
   exit/resume/transport laws across all 23 learner screens. Its spine rule supersedes Chat's
   earlier “no chrome” phrase: that phrase excludes drill/card chrome inside the conversation, not
   the app shell.
3. `Design System.dc.html`, `tokens/*.css`, `components/`, screenshots, and the small `ui_kits/` app
   explain and demonstrate the authored visual language. They are references, not code imported by
   the app. Do not edit them during implementation.
4. [`packages/design-tokens/tokens/`](../../packages/design-tokens/tokens/) is the reviewed,
   machine-readable runtime source. Its generator emits TypeScript, Swift, and Kotlin.
5. `apps/mobile/src/ui/theme.ts` maps generated tokens to React Native, while
   `apps/mobile/src/ui/tokens/` names exact component geometry not covered by the global scale.

An accessibility correction may intentionally differ from the authored colour. Record that deviation
in the token JSON, keep the design intent, and let the contrast gate prove the result.

### Authored inventory counts

The headline inside `Design System.dc.html:36–37` says **245 tokens / 37 components**, but that
caption predates the final files beside it. The checked-in package contains **246 unique CSS custom
property names** across `tokens/*.css` and **39 JSX reference components** under `components/` (8
chat, 7 core, 5 forms, 2 frames, 10 navigation, 4 practice, 3 progress). The four JSX files in
`ui_kits/loro-app/` are screen/demo composition and are not included in the 39-component count. Use
the filesystem inventory for workbench coverage and drift checks; retain 245/37 only when quoting
the stale authored headline itself.

## What is implemented now

The web learner shell uses a centered column with a 640px maximum width, including its stack headers
and action bars. Bottom sheets use the same maximum width over a full-window scrim. Phones and
native layouts remain fluid; the developer workbench retains the full browser width. This web
adaptation is named by `webLayout.learnerMaxWidth` and tested in `e2e/responsive.spec.ts`.

The web accessibility adaptation also allows bilingual phrase rows to wrap fully, with status
badges moving below the text when necessary. Choice controls wrap onto additional rows rather than
overlapping enlarged labels. Progress tiles share a row height. Fixed action bars publish their
measured height so final scroll content and toasts remain above them as text grows. These deliberate
layout adaptations preserve the authored colors and metrics; the authored artifacts are unchanged.

- All colour, accent, spacing, gutter, radius, size, typography metadata, shadow, gradient, motion,
  audio-timing, and touch tokens are generated and committed.
- The app consumes generated colours, spacing, radii, sizes, typography metrics, and press scales
  through one front door: `src/ui/theme.ts`.
- A typed runtime provider resolves Coral by default, supports all four generated accents for the
  dev workbench, scales production text for inspection, and suppresses press scaling under Reduce
  Motion. Learner routes still have no theme selector and retain Coral as their active accent.
- React Native primitives and six reusable composites cover the seven implemented learner screens.
- The v1.1 navigation tokens (`tokens/navigation.css`) are **not** in the generated package. Today,
  the one screen on the v1.1 shell, transcribes the handful it needs — spine, rail, day-row and CTA
  geometry — next to its own blocks, with the authored custom-property name beside each value. They
  become generated tokens when plan 81 gives them a second call site.
- The contrast gate currently passes 122 pairings across four accent themes.
- `/dev/tokens` enumerates all 404 generated primitive leaves, computes that same contrast report,
  and renders current production specimens without entering the learner route/state manifest.
Browser Storybook (`pnpm storybook`) catalogs the same production primitives and composites
outside the Expo Router tree; it does not replace the workbench.

The following are specified but not yet implemented: custom font loading/family assignment,
learner-selectable accents, CSS-shadow/gradient-to-native rendering, Skia
charts, and the component families required by the other 16 learner screens. The current `DarkCard`
therefore uses flat `surface.dark`, and `Card` intentionally has no elevation prop. Plan 57 owns
fonts, dark theme and the haptic port. [Plan 100](../../plans/100-ui-design-system.md) owns the
shared motion adapter (now wired), gesture catalog and remaining-screen primitives that consume
these tokens. Device 60 fps proof remains 58/72. Do not adopt a third-party UI kit to skip that kit.

## Visual character

Warm paper rather than pure white; near-black ink with a warm cast; burnt-orange Coral used
sparingly for action; charcoal-brown stage surfaces for focused moments; generous 12–24 px corners;
and low, warm shadows. Plus Jakarta Sans is the authored everyday face. Instrument Serif italic is
reserved for emotional punctuation such as completion and arrival moments, never labels or body
copy. Those families are tokenized, but the current app still relies on the platform font until font
loading is implemented.

## Iconography

There is no icon library, icon font, or SVG set in the authored system. Loro uses a small semantic
set of Unicode glyphs for actions such as audio, repeat, send, done, cancel, and sheet expansion;
the microphone, waveform, typing dots, and progress pips are built from primitives. Emoji are not a
general icon set: the two legacy blueprint emoji are replacement work, not precedent for adding
more. Every glyph still needs an accessible name, a 44×44 target when interactive, and a
cross-platform rendering check.

## Colour contract

### Surfaces, ink, and lines

| Group    | Current tokens                                                                      | Rule                                                                                                            |
| -------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Surfaces | `canvas`, `app`, `card`, `sunken`, `sunken2`, `device`, `scrim`, `dark`             | `app` is the screen; `card` is a raised light surface; `scrim` is only an overlay; `device` is blueprint chrome |
| Ink      | `ink`, `ink2`, `ink3`, `ink4`, `muted`, `muted2`, `muted3`                          | `muted2` is large semibold/non-text only; `muted3` is decorative only                                           |
| Lines    | `subtle`, `default`, `strong`, `stronger`, `strongest`                              | Use stronger borders for interaction/selection, not arbitrary darker literals                                   |
| Dark ink | `primary`, `secondary`, `tertiary`, `muted`, `faint`, `surface`, `surface2`, `line` | Use only on dark surfaces                                                                                       |

The app background is `surface.app` (`#f6f2ea`); primary ink is `ink.ink` (`#23201b`). The current
`ink.muted` is `#6a6558`, darkened from the authored value so it also clears AA on
`surface.sunken2`. `surface.scrim` is the single modal backdrop token; no text is laid directly on
it.

### Accent themes

| Theme           | `accent`  | `accentInk` | `accentOnDark` | `wash`    |
| --------------- | --------- | ----------- | -------------- | --------- |
| Coral (default) | `#bf5722` | `#a2461a`   | `#e8a06a`      | `#f8ece1` |
| Sunset          | `#95560f` | `#7d470b`   | `#ddab5e`      | `#f6ecdc` |
| Teal            | `#1f7d6c` | `#186356`   | `#68c0ae`      | `#e4f2ef` |
| Berry           | `#9c4470` | `#7f345a`   | `#d98fb4`      | `#f6e9ef` |

`accent` is for fills, borders, and large semibold text on the fill. `accentInk` is the
accent-coloured text token on light surfaces. `accentOnDark` is for dark cards. Each theme also
generates 7% `tint`, 10% `tint2`, and 38% `tintBorder` overlays from its accent.

### Semantic and ordered colour

Semantic families are `success`, `warn`, `danger`, `info`, `violet`, and `hook`, with `Alt`/`Meta`
variants where the design needs a secondary mark or line. A family with a background carries a
text/background/border triple; use the triple together.

Four ordered scales encode product state, so key order is part of their contract:

- mastery: `new → learning → strong → mastered`;
- ladder: `accumulated → bent → transferred → pressureTested → deployed`;
- confidence: `forgot → shaky → ok → strong → instant`;
- warming: `cold (0–32%) → warm (33–65%) → hot (66–99%) → peak (100%)`.

The warming scale communicates automaticity. Its colour transition must survive Reduce Motion. Peak
uses a darkened authored gradient so white large text passes 3:1; **all text on peak must be at
least 17 px semibold** until the unresolved secondary-text treatment is replaced.

## Typography

The generated scale is:

| Token                          |         Size | Weight | Intended use                           |
| ------------------------------ | -----------: | -----: | -------------------------------------- |
| `display`                      |  62 (max 74) |    700 | countdown/clock                        |
| `hero`                         |  46 (max 56) |    700 | streak and recap values                |
| `title1` / `title2` / `title3` | 26 / 22 / 20 |    700 | phrase hero, screen/card headings      |
| `headline`                     |           18 |    700 | lab headings                           |
| `body` / `bodySm`              |      15 / 14 |    700 | primary row and button text            |
| `caption` / `captionSm`        |      13 / 12 |    600 | supporting text and translations       |
| `label` / `labelSm`            |      11 / 10 |    700 | tracked uppercase labels               |
| `prose`                        |           14 |    400 | longer copy                            |
| `serifDisplay` / `serifNum`    |      26 / 32 |    400 | emotional punctuation / phase numerals |

The generated rules require tabular numerals for changing numbers and tracking on uppercase labels.
The current React Native mapping implements the 12 sans metric variants from `display` through
`prose`/`labelSm`, but it does not yet load the families or expose the two serif variants. Shared
`Text` applies the generated `tabular-nums` variant to every style, including counters embedded in
translated copy. The typography E2E checks equal digit advances in the current browser fallback
font on Today, Progress and practice; native font rendering still requires device proof.
Spanish nodes do work today: `lang="es"` on the `Text` primitive becomes
`accessibilityLanguage="es-ES"`; the source scanner protects this because react-native-web does not
forward that property.

## Space, radius, and exact geometry

The global spacing scale is 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, and 24 px (`space.0.5` through
`space.6`). Screen gutters are named `dense: 14`, `default: 18`, and `roomy: 22`.

Radii are `sm: 8`, `md: 10`, `lg: 12`, `xl: 16`, `2xl: 20`, `3xl: 24`, `pill: 999`, plus the
authored sheet and blueprint-chrome radii. `radius.lg` is the interactive workhorse.

Do not round a blueprint measurement onto the global scale. Repeated component geometry such as 5,
7, 9, 11, 13, 26, 38, or a 1.5 px selected border gets a semantic name in
`apps/mobile/src/ui/tokens/`. A value with one call site remains local to that route/component.
Text-scale E2E checks at 200% and 310% make these pixel decisions behavioural, not cosmetic.

## Interaction and motion

The touch contract sets a 44×44 minimum target. The implemented `Pressable` uses four generated
press scales: row `0.988`, button `0.98`, small button `0.9`, and icon `0.82`. Icon feedback also
enforces the 44×44 visual floor; every interactive element uses this primitive.

The token set declares 11 animations, 9 transitions, 5 easing functions, and a reduced-motion
outcome for information-bearing motion. Most are not wired yet. When implementing one, preserve the
named duration/easing and its reduced-motion result; do not assume importing `motion` produces
animation by itself.

## Extending the system

1. Start from the relevant blueprint screen and the authored design-system/component reference.
2. Reuse an existing semantic token. Add a package token only when the value crosses components or
   native targets; add a mobile component token for repeated exact geometry; keep one-off geometry
   local.
3. Never add colour literals in app code. Add source JSON, generator support, contrast pairings,
   tests, and regenerated TS/Swift/Kotlin together.
4. Put a domain-free shape in `src/ui/primitives/`; put a reusable shape that accepts domain types
   in `src/ui/components/`; keep a one-screen block local to its route.
5. Pass learner-facing copy into components from `src/lib/copy.ts`. Preserve Spanish language,
   checked/value semantics in native and flat web forms, press feedback, and 44 px targets.
6. Add the learner-visible route/state to E2E coverage when the component enables new behaviour,
   then run `pnpm check` and `pnpm test:e2e`.

The generated tokens, component-level metrics, implementation, and documentation must land in one
coherent change. A token that no component can consume, or a component that bypasses the token front
door, is unfinished system work.

The remaining-screen interaction kit — Reanimated token playback, sheet/press physics, warming /
beat / un-blur / `popIn`, and practice/chat composites extracted at two call sites — is
[plan 100](../../plans/100-ui-design-system.md). Fonts, dark theme and haptics stay plan 57;
workbench coverage stays plan 80; spine/sheet pull laws stay plan 93.
