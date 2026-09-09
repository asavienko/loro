# @loro/mobile

The Loro app — iOS and Android, Expo / React Native.

Architecture: [mobile-app.md](../../docs/architecture/mobile-app.md) · Stack rationale:
[ADR-0001](../../docs/architecture/adr/0001-cross-platform-react-native-expo.md)

## What's here

Eight of the v1.1 design package's 23 learner screens, plus the app shell — the demonstrable core
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
| `practice/speak`   | On-device speech or offline word reveal                                     |
| `languages`        | Native and learning language selection                                      |
| `account`          | Optional Google/Apple/email sign-in and sync status                         |
| `_layout`          | Router shell + toast host                                                   |

The other 15 learner screens — chat, the prosody and pronunciation labs, the Run, trips, settings —
are authored. The original 21 are in [screen-catalog.md](../../docs/design/screen-catalog.md); plan
79 owns registration of the two v1.1 chat screens.

## Run it

```bash
pnpm --filter @loro/mobile bundle       # no simulator: prove the app compiles
pnpm test:e2e                           # all implemented routes/states through Expo Web
pnpm test:e2e:workbench                 # dev-only tokens and component inspection contract
cd apps/mobile && npx expo start --web  # fastest way to inspect current screens
```

### Android emulator

```bash
pnpm --filter @loro/mobile android
```

This installs **Loro Development** (`app.loro.android.dev`) and starts Metro. Keep the command
running while using that debug build; it intentionally has no embedded JavaScript bundle. For an
emulator installation that must open without Metro, build and install **Loro Preview** with
[`pnpm apk:local`](../../docs/process/local-apk.md). The preview is the separately identified,
bundled release variant used for standalone acceptance.

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

Native `ios`/`android` projects are generated with Expo prebuild and ignored in Git. Local modules
autolink from `modules/`. The core/audio/SQLite modules require a native development build. See
[persistent practice setup and validation](../../docs/process/persistent-practice.md).

Test native audio and speech on hardware: simulators do not faithfully reproduce audio sessions,
microphone behaviour, routing, lock-screen playback, or interruptions.

`bundle` runs an iOS `expo export`. It proves that Metro can resolve and emit the production bundle,
which catches failures that `typecheck` cannot see. It does not compile a native project, exercise
Hermes on a device, or prove that an Expo Module links.

Setup: [onboarding.md](../../docs/process/onboarding.md).

The browser suites live in [`e2e/`](e2e/README.md). Run `pnpm test:e2e:install` once per machine;
the tests then start Expo themselves and exercise the learner-visible flow or the isolated
development workbench. They complement, rather than replace, native device checks.

## Current shape

```
app/                  eight learner routes, Languages/Account utilities and root layout
src/store/            committed repository projections, actions and engine adapters
src/data/             native/browser SQLite, hydration, repositories and sync
src/ui/primitives/    domain-free controls and layout
src/ui/components/    reusable domain-aware composites
src/lib/              copy, clock, wave positions, IDs, and formatting helpers
packages/core/        domain types, Stream/Refrain/Speak engines, persistence, sync policy
```

The shared spine and switcher wrap built routes. Pull down on the spine to open the switcher; sheets
dismiss through their dedicated pull handle. Practice routes disable native back-swipe. Today owns
its root header, rail and day rows; other screens retain stack headers and a Today escape for cold
entries.

Routes currently own their screen-specific hooks and named components. Reuse moves downward:
domain-free pieces go in `src/ui/primitives/`, while a component used by multiple screens and typed
with `@loro/core` domain values goes in `src/ui/components/`. The latter never reads the store or
the copy catalog. `ToastHost` is the deliberate shell adapter that does both.

ESLint enforces the boundaries that have corresponding folders today, as well as the colour, clock,
secure-storage, and learner-copy rules. The fuller `features/domain/data/platform` layering in
[mobile-app.md](../../docs/architecture/mobile-app.md) is the migration target, not a description of
directories already present.

Practice engines live in `@loro/core` and are headless. Mobile assembles their `EngineContext` in
`src/store/engines.ts` from committed repository projections. `src/store/coreFacade.ts` calls the
canonical Rust implementation through embedded browser WASM or the native UniFFI module; the
compatibility name `jsCoreFacade` does not select an approximate JavaScript algorithm.

## Native modules and remaining platform work

```
modules/loro-core/          generated UniFFI core bridge
modules/loro-audio-speech/  foreground device TTS and on-device ASR
src/data/                  OP-SQLite adapter and browser SQLite adapter
```

Native playback uses installed offline voices. Recognition requires a platform-supported on-device
path for the selected language; otherwise Speak offers word reveal. Transcripts stay local, no API
returns PCM to JavaScript, and no recorded audio is uploaded. Latency remains `null` until measured
native onset detection exists. See [persistent practice](../../docs/process/persistent-practice.md).

Recorded-asset cache, background/lock-screen playback, retained-buffer DSP, widget targets and
notifications remain feature-plan work. The future recording API passes native buffer handles to
Rust, never bytes through JavaScript
([ADR-0011](../../docs/architecture/adr/0011-analytics-and-privacy.md)). Android compilation and an
offline emulator persistence/reveal smoke do not establish installed voice/model quality or
physical-device speech acceptance. Full iOS native validation remains gated on an available Xcode
SDK.

## State ownership

| Tier          | Holds                                                          | Mechanism                                                |
| ------------- | -------------------------------------------------------------- | -------------------------------------------------------- |
| **Durable**   | phrases, ratings, tags, schedules, course/day state and outbox | SQLite transaction before publishing a render projection |
| **Session**   | resumable practice checkpoint and transitions                  | SQLite; current projection in Zustand                    |
| **Ephemeral** | sheet open, toast, scroll, animation values                    | React state / Zustand / Reanimated                       |

Startup migrates and hydrates all courses before learner routes render. Native uses OP-SQLite; web
uses SQL.js with atomic local-storage snapshots and an exclusive tab lock. A failed commit or
corrupt database shows recovery and retains the original data. Phrase removal and its 2.6-second
Undo window are durable; expired removals become tombstones. Practice never waits for account or
network access.

## The checks that block merge

```bash
pnpm ci:local                           # full local gate, including browser suites
pnpm check                              # fast lint, types, unit tests, content and static a11y
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
6. **Consume real capability state.** Core, SQLite and foreground speech have platform ports;
   widgets, notifications, DSP and background audio still need their owning feature integration.
   Keep an honest unavailable state until a capability exists; never fabricate a score or delay.

Every phrase row still opens phrase detail. The warming card is also still the performance canary,
but today its band colour is selected during a React render and gradient bands fall back to a solid
colour. The target is a measured UI-thread transition after Reanimated/Skia work lands; do not cite
the current screen as evidence that animation or 60 fps has been implemented.

## Language selection (F-08)

Choose native and learning languages on the welcome page or through Today → switcher → Languages.
English/Bulgarian/Russian UI follows the native choice; Spanish/Bulgarian/Russian starter courses
keep separate durable collections, daily sets and resume state. Each target has 31 phrases. New
translations are pending bilingual review. Forward migrations support language settings, sessions
and sync reconciliation; plans 59/94 wire hydration and transactional writes. Physical-device
acceptance of all seven pairs remains in plan 87.

Use `src/lib/copy.ts` for reactive localized copy and `useLearningCatalog()` for the selected pair.
`src/lib/i18n/` bundles all translations; screens subscribe with `useLocale()`. A target text uses
`lang="target"`. New translated states belong in the E2E manifest, including expanded/Cyrillic copy.
To avoid another checkout's dev server, set `LORO_E2E_PORT=8095 pnpm test:e2e` from the root.

## Optional Account utility

`/account` offers Google/Apple and email/code sign-in through the switcher, real API readiness and
sync status. Native refresh credentials use SecureStore; browser sessions stay in page memory. An
installation binds to its verified account before uploading progress; sign-out retains local
learning state. Foreground/connectivity/write events trigger bounded outbox retries. Account
export/erasure, rescue UI and OS background sync remain future work.
[Configuration, provider setup and release boundaries](../../docs/architecture/google-apple-auth.md).
