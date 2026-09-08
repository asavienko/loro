# Mobile changes

In this reference, `src/` means `apps/mobile/src/`.

## Find the owning surface

Start with `docs/design/screen-catalog.md`, then the specific route and its existing E2E state. Use
`apps/mobile/src/lib/navigation.ts` for built destinations and the v1.1 Navigation artifact for
shell laws. Today owns its root header; other hubs have stack headers and a Today escape for cold
entry. Chat's older “no chrome” description does not exempt it from the shared shell. Check current
implementation before extending a route: authored screens, utility routes and the developer
workbench are distinct inventories.

Routes compose local named components and hooks. Two callers justify a shared primitive or domain
component; one caller normally stays in the route. Shared UI accepts translated/domain props and
does not import the store or `copy`. Engines return semantic states, with presentation labels mapped
through `apps/mobile/src/lib/copy.ts`. Layer and copy ownership are already lint-enforced; fix
ownership rather than adding an exception.

## Copy, language and layout

UI language follows the native language. Use bundled resources in `src/lib/i18n/`, the reactive copy
adapter, language contracts in `packages/core/src/domain/languages.ts`, and `loadLearningCatalog` in
`packages/content/src/multilingual.ts`. Use target-neutral text fields. Do not recreate translation
maps in a route or domain engine. Course progress and resume are separate; the streak is global.
Preserve the learner's selected pack order when loading content.

Read current language configuration before adding a pair. Historical seven-pair support and the
later English-target plan are different milestones; neither implies Polish is a supported course.
ElevenLabs was selected for cloud TTS, but voice review, licensing, generated assets and playable
offline audio remain separately evidenced work.

For raw ICU expressions on Android, inspect `src/lib/i18n/pluralRules.ts` and initialization order
first: bundled plural rules and locale data must initialize before ICU, including when Hermes has
partial `Intl` support. The archived fix has both missing-API and native-Hermes evidence. Browser
formatting alone is insufficient. Keep the existing native compatibility tests.

Use generated design tokens and named geometry. Preserve unusual dimensions; rounding them can
change dense layouts. Text uses `accentInk`; selected overlays use `accent.tint`. Grow time-label
columns and controls with text size instead of truncating or forcing fixed heights. Validate
Cyrillic, long labels, 200% and 310% scaling with the existing suites.

## Interaction and accessibility evidence

- A new learner-visible state belongs in `apps/mobile/e2e/states.ts`, including recovery,
  unavailable, completion and error states. It then participates in shared accessibility and
  text-scale sweeps.
- Extend an existing flow spec for behavior. Add charts/fills to `render.spec.ts`: legends and
  accessible numbers can pass while the actual bar has zero height.
- React Native Web does not forward every native accessibility prop. Check the existing
  `Pressable.tsx`, `bars.tsx` and source language guard before assuming browser assertions cover
  `accessibilityLanguage`/`accessibilityHint` or nested accessibility state/value props.
- Gestures supplement buttons/keyboard controls. Follow dedicated spine/sheet handles, vertical
  intent, cancellation and session back-swipe rules in `src/ui/primitives/usePullDown.ts` and route
  options. Mouse and touch need separate coverage; a pointer can leave a narrow handle before
  activation. Keep short, horizontal and cancelled drags inert.
- Wait for real sheet/dialog transitions before axe checks. A Metro reload during a suite can
  invalidate its fixtures; inspect the first failure and freeze edits before changing assertions.

## Workbench and native work

`src/dev-tools/` must render actual production tokens and components. Its controls should drive the
real theme/text-scale/motion seam; an unsupported state is labeled as such. Use the shared contrast
report, not a copied WCAG calculation. Its dedicated E2E suite and the production route
unavailability suite prove different things; unavailability does not prove bundle tree-shaking.

Before audio/speech work, read `docs/architecture/audio-speech.md` and inspect current
`apps/mobile/modules/` and platform adapters. Availability must reflect the real module, permission
and installed language. Reveal/skip must remain usable without reporting spoken success or invented
latency. Device TTS/reference downloads do not authorize recording upload. Full offline launch,
interruption, microphone and background behavior require the relevant native/device evidence.
