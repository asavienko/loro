# Runtime design system: fonts, motion, haptics, themes, and remaining inventory

- **Requirement IDs:** `F-05`, `F-06`, `LB-25`…`LB-28`
- **Milestone:** M1/M2
- **Status:** 🟡 Runtime accent, text-scale and reduced-motion inspection exist. Fonts, dark theme,
  haptics, motion and production state APIs remain; font provenance is still needed, while completed
  plan 55 no longer blocks work.
- **Depends on:** 53/55 completed; 58 for device proof; 71 consumes durable theme settings; 80
  consumes production specimens.
- **Reviewed:** 2026-09-07 against merged baseline `2d9e8c3`.

## Verified starting point

`apps/mobile/src/ui/ThemeProvider.tsx`, `themeContext.ts`, `runtimeStyles.ts` and accent-aware
primitives already provide the inspection seam. Plan 84 supplies responsive/reflow fixes.
`apps/mobile/src/dev-tools/specimenContract.ts` still marks loading and forced pressed/focused
states pending. Workbench delivery belongs to 80; this plan supplies the real component APIs.

## Outcome

The authored type and motion system becomes real at runtime. Shared components cover repeated
behavior, not one-use markup, and accent/dark/reduced-motion behavior comes from one typed theme.

## What already exists

Color/layout tokens, UI primitives/components/tokens directories, composition-oriented routes, and
color-literal enforcement are implemented. Plan 53 owns generation/parity of authored type, motion,
layout, and control tokens. A typed runtime provider now supplies generated accent selection,
text-scale inspection, and system/explicit reduced-motion state; current accent-aware primitives
consume it, and reduced motion suppresses press scaling. Learner routes still default to Coral and
have not been migrated for learner-selectable themes.

## Remaining work

1. [ ] License/bundle/load the specified sans and italic serif fonts; hold splash only for required
       startup assets and prove fallback behavior.
2. [ ] Implement shared runtime motion primitives, reduced-motion substitutions, press feedback,
       numeric tabular figures, and route transitions from generated tokens.
3. [ ] Add a small haptic port with platform availability and accessibility policy; never couple
       haptic success to practice outcome.
4. [ ] Connect the existing accent provider to learner settings and add dark theme with contrast
       checks for every generated theme, including scrims and selected overlays.
5. [ ] Complete only the repeated primitives/components proven by the current and next v1 screens;
       supply production loading/pressed/focused APIs to the existing plan-80 gallery, including
       Cyrillic and long translated copy. Do not create another gallery.
6. [ ] Add drift/static gates for fonts, generated token consumption, reduced motion, and forbidden
       literal mirrors.

## Acceptance criteria

- Both fonts render on iOS/Android/web or use a documented accessible fallback.
- Motion/haptic behavior follows availability and reduced-motion settings.
- Every accent/dark combination passes contrast checks; learner numbers do not jitter.
- Component gallery covers default/pressed/disabled/loading/error/long-copy states.

## Out of scope

Plan-53 generator work, one-off screen components, Skia lab drawings, and product behavior changes.
