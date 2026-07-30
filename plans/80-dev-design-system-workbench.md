# Dev-only design-system and tokens workbench

- **Requirement IDs:** `F-05`, `F-06`, `LB-25`…`LB-28`; developer-only acceptance contract
- **Milestone:** M1
- **Status:** Not started
- **Depends on:** 53 ✅ generated-token completion; coordinates with 57 runtime design system

## Outcome

The development environment has a discoverable `/dev/tokens` page that renders the generated Loro
tokens and reusable component states from production code. It becomes the visual inspection surface
for theme, type, motion, text scale, reduced motion, and component drift, while remaining
unreachable and unadvertised in production builds.

## Current state and boundary

`@loro/design-tokens` already generates TypeScript, Swift, and Kotlin output, and completed plan 53
landed typography, motion, layout, and control generation. Plan 57 owns runtime fonts, themes,
motion, haptics, and reusable component implementation. This plan does not create a second token
source or duplicate the broad component-gallery work in plan 57: it builds the dev surface that
renders plan 57's production components and plan 53's generated values.

The authored reference is `Design System.dc.html`: Colour, Type, Space/radius/depth, Motion/touch,
Components, Navigation, Screens, Voice/icons, and Files. Its headline counts (245 tokens and 37
components) are design-package inventory, not values to hardcode into the app.

## Work

1. Add a typed dev-tools gate and `/dev/tokens` route. Local Expo/web development enables it by
   default; production export, release clients, deep links, and the learner menu resolve it as not
   found. Keep the route free of credentials, learner data, and privileged mutations even in dev.
2. Build the workbench outside `app/` so the route only composes it. Derive sections from generated
   exports and production component registries; never copy values out of the `.dc.html` or generated
   files into route-local literals.
3. Render searchable token rows for semantic name, resolved value, source group, and intended use:
   paper/ink/accent/status/hairlines, type, spacing/layout, radii, shadows, motion, touch, and
   navigation geometry. Show all accent themes side by side and flag failed contrast checks.
4. Render production components in explicit states: default, pressed/focused, disabled, loading,
   empty, error, selected, long copy, Spanish, 200%/310% text scale, reduced motion, and each
   accent. Reuse the state matrix plan 57 establishes rather than creating demo-only component
   variants.
5. Add device-size and safe-area controls for the authored 344×732 reference plus supported phone,
   tablet, and web widths. Controls change inspection context only; they never alter app settings.
6. Add a small navigation section for `Spine`, `ScreenHeader`, `SwitcherSheet`, `ExitSheet`,
   `ResumeStrip`, and `TransportStrip` once plan 81 provides them. Until then, the registry reports
   those entries as intentionally pending rather than drawing lookalikes.
7. Add developer documentation and a start command/link explaining how to reach the page, how to add
   a specimen, and which generated source to edit when a value is wrong.
8. Add a separate dev-workbench browser suite. Do not place this route in learner `STATES`; prove
   production route exclusion, token enumeration, theme/reduced-motion controls, keyboard access,
   overflow at large text, and screenshot baselines for a small stable subset.

## Acceptance criteria

- `nvm use 22 && pnpm --filter @loro/mobile start --web` exposes `/dev/tokens` with no service,
  account, native module, or secret.
- Every exported token is either rendered or explicitly classified as non-visual/internal; a drift
  test fails when an export silently disappears from the page.
- Specimens import the same components and tokens learner routes use. No workbench-only clone can
  satisfy coverage.
- The page is keyboard/screen-reader usable and remains legible at 200% and 310% text scale.
- Production bundle E2E proves `/dev/tokens` is unavailable and no learner menu links to it.
- `pnpm check`, the dev-workbench suite, and `pnpm test:e2e:bundle` pass.

## Commit sequence

1. `feat(mobile): gate the dev design-system route (F-05)`
2. `feat(mobile): render generated tokens and production specimens (F-05)`
3. `test(mobile): prove workbench coverage and production exclusion (F-06)`
4. `docs(mobile): document the tokens workbench (F-05)`

## Out of scope

Editing generated files by hand, replacing plan 57's runtime work, learner theme settings, visual
regression coverage for every permutation, and shipping a public Storybook or design documentation
site.
