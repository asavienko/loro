# Runtime design system: fonts, motion, haptics, themes, and remaining inventory

- **Requirement IDs:** `F-05`, `F-06`, `LB-25`…`LB-28`
- **Milestone:** M1/M2
- **Status:** Not started
- **Depends on:** plan 53 ✅ generated-token completion; plan 55 fidelity findings

## Outcome

The authored type and motion system becomes real at runtime. Shared components cover repeated
behavior, not one-use markup, and accent/dark/reduced-motion behavior comes from one typed theme.

## What already exists

Color/layout tokens, UI primitives/components/tokens directories, composition-oriented routes, and
color-literal enforcement are implemented. Plan 53 owns generation/parity of authored type, motion,
layout, and control tokens. This plan consumes that output and does not regenerate it independently.

## Work

1. License/bundle/load the specified sans and italic serif fonts; hold splash only for required
   startup assets and prove fallback behavior.
2. Implement shared runtime motion primitives, reduced-motion substitutions, press feedback, numeric
   tabular figures, and route transitions from generated tokens.
3. Add a small haptic port with platform availability and accessibility policy; never couple haptic
   success to practice outcome.
4. Implement runtime accent selection and dark theme with contrast checks for every generated theme,
   including scrims and selected overlays.
5. Complete only the repeated primitives/components proven by the current and next v1 screens; add a
   component gallery for states and theme/text-scale inspection.
6. Add drift/static gates for fonts, generated token consumption, reduced motion, and forbidden
   literal mirrors.

## Acceptance criteria

- Both fonts render on iOS/Android/web or use a documented accessible fallback.
- Motion/haptic behavior follows availability and reduced-motion settings.
- Every accent/dark combination passes contrast checks; learner numbers do not jitter.
- Component gallery covers default/pressed/disabled/loading/error/long-copy states.

## Out of scope

Plan-53 generator work, one-off screen components, Skia lab drawings, and product behavior changes.
