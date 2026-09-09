# Runtime design system: fonts, motion, haptics, themes, and remaining inventory

- **Requirement IDs:** `F-05`, `F-06`, `LB-25`…`LB-28`
- **Milestone:** M1/M2
- **Status:** 🟡 Runtime accent, text-scale, reduced-motion and production control loading/focus
  states exist. Fonts, dark theme, haptics and motion remain; font provenance is still needed.
- **Depends on:** 53/55 completed; 58 for device proof; 71 consumes durable theme settings; 80
  consumes production specimens.
- **Reviewed:** 2026-09-09 against checkout `42f4d57`; source/plan review only, no new device or
  deployment acceptance.

**Archive disposition (2026-09-09):** Archived at user request after integration review. The partial
status and remaining acceptance criteria below are retained; archival does not mark this plan
complete. The roadmap index continues to track its unfinished scope.

## Verified starting point

`apps/mobile/src/ui/ThemeProvider.tsx`, `themeContext.ts`, `runtimeStyles.ts` and accent-aware
primitives already provide the inspection seam. Plan 84 supplies responsive/reflow fixes.
`apps/mobile/src/dev-tools/specimenContract.ts` now exercises loading and forced pressed/focused
states through real shared component APIs. Workbench delivery belongs to 80.

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

## Delivery order and gates

1. Retain the shipped production control states. Deliver fonts/fallbacks and motion/haptic ports as
   separate changes; font licensing and native availability must be recorded before use.
2. Define theme values with 71: this plan owns runtime visuals and contrast, while 71 owns durable
   preference storage. Existing state APIs already unblock 80; full dark-theme delivery does not.
3. Use 72's evolving native/reduced-motion harness and supply real specimens to 80 in each UI
   change. Keep peak-card design approval under Q-14 rather than resolving it through an incidental
   token edit.

## Out of scope

Plan-53 generator work, one-off screen components, Skia lab drawings, and product behavior changes.
