# @loro/mobile

The Loro app — iOS and Android, Expo / React Native.

Architecture: [mobile-app.md](../../docs/architecture/mobile-app.md) · Stack rationale:
[ADR-0001](../../docs/architecture/adr/0001-cross-platform-react-native-expo.md)

## What's here

8 of the blueprint's 21 screens — the complete core loop, and nothing beyond it:

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

The other 13 — the prosody and pronunciation labs, the Roguelike Run, trips, settings — are
specified in [screen-catalog.md](../../docs/design/screen-catalog.md) and not built.

## Run it

```bash
pnpm --filter @loro/mobile ios          # or android
pnpm --filter @loro/mobile ios --device # do this on day one
pnpm --filter @loro/mobile bundle       # no simulator: just prove it compiles
pnpm test:e2e                           # all implemented routes through Expo Web
```

**The simulator lies about audio sessions, microphone behaviour, and interruptions**, and those are
half of what this app does. Test on hardware.

`bundle` runs `expo export` — Metro resolution plus Hermes bytecode, which is what CI gates on. It
catches the resolution failures that `typecheck` cannot see, and it needs no simulator.

Setup: [onboarding.md](../../docs/process/onboarding.md).

The browser suite lives in [`e2e/`](e2e/README.md). Run `pnpm test:e2e:install` once per machine;
the tests then start Expo themselves and exercise the learner-visible flow at a phone viewport. They
complement, rather than replace, native device checks.

## Layers — enforced, not conventional

```
app/            routes (Expo Router). Screens compose features; no logic
src/features/   screen-level components + view models
src/engines/    practice engines — HEADLESS, unit-testable without a renderer
src/domain/     phrases · trips · progress · content · settings
src/data/       Drizzle schema · repositories · outbox · sync
src/platform/   native bridges: audio · speech · core · widgets · ocr
src/ui/         design system: tokens · primitives · components · charts
src/lib/        pure helpers
```

A layer may only import from layers below it, and an ESLint `no-restricted-imports` rule fails the
build otherwise. Two extra rules:

- **`src/ui/` imports nothing from above it.** A design-system component that knows what a phrase is
  belongs in `src/ui/components` (domain types only) or in `src/features`.
- **`src/engines/` never imports `react`, `react-native`, or `src/platform/`.** Engines receive
  capabilities through `EngineContext`. That's what makes the pedagogy testable without a simulator.

## Native code

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

## State — three tiers, no overlap

| Tier          | Holds                                       | Mechanism                             |
| ------------- | ------------------------------------------- | ------------------------------------- |
| **Durable**   | phrases, ratings, tags, schedules, trips    | SQLite, read through **live queries** |
| **Session**   | current rep, revealed words, engine phase   | Zustand, persisted per transition     |
| **Ephemeral** | sheet open, toast, scroll, animation values | React state / Reanimated              |

Durable state is **read, never mirrored**. There is no phrase array in a store, and no "refresh"
function. A write goes through a repository (row + outbox in one transaction) and live queries push
it to every subscriber — which is why re-rating a phrase in the stream instantly updates the
Progress histogram with no code connecting them
([ADR-0012](../../docs/architecture/adr/0012-state-management.md)).

## The checks that block merge

```bash
pnpm --filter @loro/mobile check:lang              # Spanish text carries lang="es-ES"
pnpm --filter @loro/mobile check:chart-summaries   # every chart has a visible text summary
pnpm --filter @loro/mobile check:tap-targets       # >= 44x44
pnpm --filter @loro/mobile bundle                  # Metro resolves; Hermes accepts
```

The first two matter most, because both are easy to forget on a new screen and both are invisible to
a sighted developer testing by hand.

Two more gates are specified but **not implemented**: bundle size against a committed baseline, and
Dynamic Type snapshots at five scale steps. Both need a baseline to compare against, so they land
with the first release build rather than now.

## Three things to know before writing a screen

1. **Open the blueprint.** `Language Learning by Phrases/Loro.dc.html` is executable spec. Each
   screen's `DCLogic.renderVals()` is a complete view model, and the `sc-if` flags enumerate every
   visual state that exists. [screen-catalog.md](../../docs/design/screen-catalog.md) maps them.
2. **Every list row that shows a phrase opens phrase detail.** No exceptions across the whole app —
   that consistency is what makes it feel like one object graph rather than 21 screens.
3. **The warming card is the canary.** The Refrain's colour transition _is_ the product's core
   feedback signal. It runs on the UI thread via Reanimated `interpolateColor`, never a re-render
   per band, and it's checked at 60 fps on the device floor every release.
