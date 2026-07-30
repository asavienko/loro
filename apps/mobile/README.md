# @loro/mobile

The Loro app — iOS and Android, Expo / React Native.

Architecture: [mobile-app.md](../../docs/architecture/mobile-app.md) · Stack rationale:
[ADR-0001](../../docs/architecture/adr/0001-cross-platform-react-native-expo.md)

## What's here

Seven of the v1.1 design package's 23 learner screens, plus the app shell — the demonstrable core
loop:

| Route              | Screen                                                                      |
| ------------------ | --------------------------------------------------------------------------- |
| `onboarding`       | 6 steps; seeds a real stream from the catalog                               |
| `index`            | Today                                                                       |
| `add`              | Discover + Browse, and the tagging sheet where the connective thread starts |
| `practice/refrain` | Daily Refrain — the v1 hero loop, six reps with a warming card              |
| `practice/stream`  | The SRS stream                                                              |
| `phrase/[id]`      | One phrase: its signals, its history, its hooks                             |
| `progress`         | Mastery, ladder, and the rollup from those tags                             |
| `_layout`          | Router shell + toast host                                                   |

The other 16 learner screens — chat, the prosody and pronunciation labs, the Run, trips, settings —
are authored. The original 21 are in [screen-catalog.md](../../docs/design/screen-catalog.md); plan
79 owns registration of the two v1.1 chat screens.

## Run it

```bash
pnpm --filter @loro/mobile bundle       # no simulator: prove the app compiles
pnpm test:e2e                           # all implemented routes/states through Expo Web
pnpm test:e2e:workbench                 # dev-only tokens and component inspection contract
cd apps/mobile && npx expo start --web  # fastest way to inspect current screens
```

With the development server running, open `/dev/tokens` for the design-system workbench. It needs no
account, service, secret, or native module. The route is deliberately unavailable in a production
export and is never linked from learner navigation; `pnpm test:e2e:bundle` proves both properties.
That assertion is behavioral: because the route is statically imported, it does not claim that the
workbench's bytes are tree-shaken out of the export.

The workbench reads generated values from `@loro/design-tokens` and renders the production
components used by learner routes. When a value is wrong, edit its source under
`packages/design-tokens/tokens/` and regenerate the committed output with `pnpm tokens:build`—never
edit `packages/design-tokens/out/` by hand. When adding or changing a reusable component, add its
named states to the production specimen registry rather than creating a workbench-only lookalike.
Include default and relevant selected, disabled, loading, empty, error, long-copy, Spanish,
large-text, reduced-motion, and accent states. Then run the workbench suite; update its narrow
screenshot baseline with `pnpm test:e2e:workbench:update` only after visually reviewing the change.

Native `ios`/`android` projects and dev clients do not exist yet; plan 58 owns that substrate.

When native audio and speech arrive, test them on hardware: simulators do not faithfully reproduce
audio sessions, microphone behaviour, routing, lock-screen playback, or interruptions.

`bundle` runs an iOS `expo export`. It proves that Metro can resolve and emit the production bundle,
which catches failures that `typecheck` cannot see. It does not compile a native project, exercise
Hermes on a device, or prove that an Expo Module links.

Setup: [onboarding.md](../../docs/process/onboarding.md).

The browser suites live in [`e2e/`](e2e/README.md). Run `pnpm test:e2e:install` once per machine;
the tests then start Expo themselves and exercise the learner-visible flow or the isolated
development workbench. They complement, rather than replace, native device checks.

## Current shape

```
app/                  seven learner routes plus the root layout
src/store/            in-memory app state, actions, selectors, and engine adapters
src/data/             Node SQLite driver used only by persistence tests
src/ui/primitives/    domain-free controls and layout
src/ui/components/    reusable domain-aware composites
src/lib/              copy, clock, IDs, and formatting helpers
packages/core/        domain types, Stream/Refrain engines, persistence, sync policy
```

Routes currently own their screen-specific hooks and named components. Reuse moves downward:
domain-free pieces go in `src/ui/primitives/`, while a component used by multiple screens and typed
with `@loro/core` domain values goes in `src/ui/components/`. The latter never reads the store or
the copy catalog. `ToastHost` is the deliberate shell adapter that does both.

ESLint enforces the boundaries that have corresponding folders today, as well as the colour, clock,
secure-storage, and learner-copy rules. The fuller `features/domain/data/platform` layering in
[mobile-app.md](../../docs/architecture/mobile-app.md) is the migration target, not a description of
directories already present.

Practice engines already live in `@loro/core` and are headless. Mobile assembles their
`EngineContext` in `src/store/engines.ts`; the current repository adapter reads the Zustand phrase
array, and `src/store/coreFacade.ts` is a temporary JavaScript stand-in for the unwired Rust bridge.

## Native code (target; not present yet)

```
modules/loro-audio/     playback · capture · rate · routing · interruptions · lock screen
modules/loro-speech/    on-device ASR · device TTS
modules/loro-core/      UniFFI bindings for the Rust core
targets/ios-widget/     WidgetKit + ActivityKit
targets/android-widget/ Glance
```

`loro-audio` is the highest-skill work in the project
([ADR-0007](../../docs/architecture/adr/0007-audio-pipeline.md)). Its API has one property worth
understanding before touching it:

> **`stopRecording()` returns a `bufferId`, not bytes.** PCM stays in native memory and is handed to
> `loro-core` by handle. There is no JS API that returns audio, so the code to upload it does not
> exist and would have to be deliberately added to a native module.

That's how the on-screen privacy promise is kept structurally rather than by remembering not to
break it ([ADR-0011](../../docs/architecture/adr/0011-analytics-and-privacy.md)).

## State target — three tiers, no overlap

| Tier          | Holds                                       | Mechanism                             |
| ------------- | ------------------------------------------- | ------------------------------------- |
| **Durable**   | phrases, ratings, tags, schedules, trips    | SQLite, read through **live queries** |
| **Session**   | current rep, revealed words, engine phase   | Zustand, persisted per transition     |
| **Ephemeral** | sheet open, toast, scroll, animation values | React state / Reanimated              |

The schema, migrations, repositories, and outbox exist in `@loro/core` and are tested through the
Node driver against real SQLite. The running app does not open them: all app data, including
onboarding, phrases, progress days, and today's frozen Refrain set, lives only in Zustand and is
lost on reload. Plan 59 adds the device driver, hydration, repository-backed writes, and session
resume; only then does the three-tier table become true.

## The checks that block merge

```bash
pnpm check                              # lint, types, unit tests, content and static a11y
pnpm test:e2e                           # routes, states, flows, a11y and text scale
pnpm --filter @loro/mobile bundle       # Metro resolves a production iOS export
```

The mobile part of `pnpm check` includes `check:lang`, `check:chart-summaries`, `check:tap-targets`,
and `check:copy`. The browser suite is intentionally separate because it needs Chromium, but
learner-visible work is not complete until it is green.

Two more gates are specified but **not implemented**: bundle size against a committed baseline, and
Dynamic Type snapshots at five scale steps. Both need a baseline to compare against, so they land
with the first release build rather than now.

## Extend the app without creating a second architecture

1. **Open the blueprint.** `design/Language Learning by Phrases - V1.1/Loro.dc.html` is executable
   spec. Each screen's `DCLogic.renderVals()` is a complete view model, and the `sc-if` flags
   enumerate every visual state that exists.
   [screen-catalog.md](../../docs/design/screen-catalog.md) maps them.
2. **Add copy first.** Learner-facing text belongs in `src/lib/copy.ts`, including interpolated and
   accessibility strings. Route literals fail `check:copy`.
3. **Compose the route locally.** Keep one-use blocks as named components in the route. Promote a
   component only at its second call site, to `ui/primitives` if domain-free or `ui/components` if
   it accepts domain types.
4. **Keep practice logic headless.** Extend the contracts and engines in `@loro/core`; inject clock,
   repository, flags, and core maths through `EngineContext`. A route records an attempt and sends
   the resulting `ProgressDelta` through `applyDelta`—it never edits progress fields itself.
5. **Describe every state once.** Add each learner-visible state to `e2e/states.ts` in the same
   change. The manifest gives it route coverage, axe coverage, and 200%/310% text-scale coverage;
   add focused behavior assertions in the route's spec as well.
6. **Do not build against a future dependency.** Native audio, ASR, Rust bindings, device SQLite,
   Skia, widgets, and notifications need their planned substrate and platform wrappers first. Keep
   an honest unavailable state until the real capability exists; never fabricate a score or delay.

Every phrase row still opens phrase detail. The warming card is also still the performance canary,
but today its band colour is selected during a React render and gradient bands fall back to a solid
colour. The target is a measured UI-thread transition after Reanimated/Skia work lands; do not cite
the current screen as evidence that animation or 60 fps has been implemented.
