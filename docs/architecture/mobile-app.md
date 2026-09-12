# Mobile app architecture

The Expo / React Native app: what runs now, the boundaries already enforced, and the architecture
new work is extending toward.

---

## Implementation status

The Expo Router app implements eight learner screens plus Languages, Account, More, Settings and the
shell. SQLite backs progress and course resume; generated Rust handles scheduling and merge. Local
Expo modules provide foreground device TTS/on-device ASR. Postgres auth/sync is optional for
practice. Native projects are generated from app configuration; see
[runtime evidence](../process/persistent-practice.md).

| Area                  | Implemented now                                                                                             | Target                                                                          |
| --------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Routes                | Today, onboarding, Add, phrase detail, Stream, Speak, Refrain, Progress, Languages, Account, More, Settings | The remaining blueprint routes, trips, labs, and Run                            |
| Domain and engines    | Domain contracts plus Stream/Refrain/Speak engines in `@loro/core`                                          | All engines behind the same `PracticeEngine` contract                           |
| App state             | Repository projections in Zustand; durable writes commit to SQLite first                                    | SQLite as durable truth; Zustand only for resumable sessions                    |
| Persistence           | OP-SQLite on device, durable SQL.js on web; transactional repositories and outbox                           | Physical-device upgrade/process-death acceptance                                |
| Rust core             | Generated WASM/UniFFI runtime bridge with reference parity                                                  | Full iOS and device-floor acceptance                                            |
| Native capabilities   | Local Expo modules provide foreground TTS and strictly on-device ASR                                        | Audio, speech, ASR, DSP, notifications, purchases, and widgets through wrappers |
| Automated UI coverage | Playwright on Expo Web, driven through learner-visible interactions                                         | Keep web coverage and add native/device suites for native behavior              |

“Target” in this document is a constraint for extension work, not evidence that a folder, package,
or capability already exists.

## Current dependency shape

The directories on disk are:

```
apps/mobile/
├── app/                  Expo Router routes and root layout
├── src/
│   ├── store/            Zustand state, actions, selectors, engine adapters
│   ├── data/             native/browser SQLite drivers, hydration, repositories and sync
│   ├── auth/             OAuth ports (PKCE / provider handoff)
│   ├── services/         account-sync coordinator
│   ├── ui/
│   │   ├── primitives/   domain-free reusable controls and layout
│   │   ├── components/   reusable composites that may accept domain types
│   │   └── tokens/       component geometry not covered by generated tokens
│   └── lib/              copy, clock, IDs, account session and formatting
├── scripts/              source-level accessibility and copy checks
├── e2e/                  Playwright web tests and the state manifest
├── assets/
└── app.config.ts

packages/core/             domain types, engines, persistence, sync policy
packages/content/          bundled phrase catalog
packages/design-tokens/    generated design tokens
packages/core-rs/          authoritative cross-platform maths and DSP
```

The practical dependency flow is:

```
app routes / root shell
        │
        ├── src/store ── @loro/core engines and domain contracts
        │                    └── generated Rust WASM/UniFFI bridge
        ├── src/ui/components ── @loro/core domain types only
        ├── src/ui/primitives
        └── src/lib
```

Routes currently contain screen-specific hooks and named components. This is intentional: a block
with one call site stays local. On its second call site, move a domain-free component to
`src/ui/primitives/`, or a domain-aware composite to `src/ui/components/`. Shared components take
values and callbacks; they do not reach into the store or own learner copy. `ToastHost` is the one
current shell adapter that reads both store and copy.

ESLint enforces the boundaries for the folders that exist, plus colour-literal, clock,
secure-storage, and copy ownership rules. Do not create empty target folders merely to resemble the
diagram below; create a layer when real implementation needs the boundary, and add its lint rule in
the same change.

<a id="layers"></a>

## Target layers

The intended dependency direction remains one-way:

```
app/          routes: navigation and screen composition
  ↓
features/     screen view models and screen-level reusable components
  ↓
domain/       app use cases around core contracts
  ↓
data/         device persistence, repositories, outbox, API adapters
  ↓
platform/     narrow wrappers over native audio, speech, Rust, notifications, widgets

ui/ and lib/ are leaves: reusable rendering and pure helpers
@loro/core is shared headless domain/engine/persistence code
```

Practice engines do **not** move into mobile feature code. They stay headless in `@loro/core`, with
platform and data capabilities supplied through `EngineContext`. The current adapter is
`src/store/engines.ts`; it reads the committed repository projection without changing an engine's
public contract.

When the feature layer becomes useful, routes should compose it rather than contain view-model
logic. That migration is incremental: move a coherent screen concern only when it is shared or the
route can no longer remain a readable composition. Do not perform a folder-only rewrite.

<a id="navigation"></a>

## Current routes and navigation

Expo Router typed routes are enabled in `app.config.ts`. The route files on disk are:

| Route               | Current behavior                                                                |
| ------------------- | ------------------------------------------------------------------------------- |
| `/`                 | Today; redirects to `/onboarding` until the durable `onboarded` flag is true    |
| `/onboarding`       | Six in-route steps; seeds selected catalog packs into the store                 |
| `/add`              | Discover and Browse states plus an in-route tagging sheet                       |
| `/phrase/[id]`      | Phrase signals and edits; includes an honest unknown-ID state                   |
| `/practice/stream`  | Daily wave: today's frozen `refrainSet`, listed under “This wave”               |
| `/practice/refrain` | Targeted six-rep drill (`?phrase=` / menu `?filter=hard` / untargeted `?wave=`) |
| `/practice/speak`   | On-device recognition or offline reveal; truthful engine progress               |
| `/account`          | Optional email sign-in, sync status and sign-out                                |
| `/languages`        | Native/target selection with durable independent course state                   |
| `/more`             | Grouped destination list for built surfaces                                     |
| `/settings`         | Durable visual and analytics preferences                                        |
| `/progress`         | Mastery, ladder, streak, and tag rollups derived from store rows                |
| `/music`            | Phrase-songs garnish via More; picker, lyric review, style confirm, fixtures    |
| `/listen-export`    | Listening companion; generate, cache and in-app listen (share after Q-22)       |
| `/dev/tokens`       | Developer workbench / token inspection (dev-only)                               |

`_layout.tsx` owns the native stack, headers, safe-area provider, app-wide day rollover, and toast
host. Practice session routes spread `PRACTICE_SESSION_STACK_OPTIONS` (`gestureEnabled` and
`fullScreenGestureEnabled` false) so NAV-04 cannot be defeated by iOS 26's default full-screen
dismiss. An active Refrain intercepts stack `GO_BACK` and Android Back into Pause · End it here ·
Keep going. Switcher replace / dismissTo still leave so menu hard-filter stays live. Stream consumes
Android Back so the wave cannot be abandoned; it does not reuse the Refrain exit copy because Stream
has no Today resume row. The Add tagging sheet is currently component state inside `/add`, not a
route-level modal. Only the onboarding redirect and the links made by these screens are implemented.
Trip-conditional home routing, universal-link mapping, notification links, and persistent audio
across navigation are targets for the capabilities that require them.

The target navigation shell is the route-rendered system in `Navigation.dc.html:40–499` and its six
required states at `Navigation.dc.html:512–873`. Its Root, Push, Session, Flow, and Sheet classes,
spine, switcher, named cold-entry exit, resumability, single active escape, honest empty sets, and
travelling transport are one route model rather than screen-local conventions. The Open chat and
Message inspector routes shown in `Loro Chat.dc.html:95–449` consume that shell when implemented;
the chat prototype's phrase “no chrome” describes its quiet conversation body, not an exemption from
the global navigation contract.

### Adding a route

1. Find its states and logic in the blueprint through
   [screen-catalog.md](../design/screen-catalog.md), and reconcile them with the durable product
   spec.
2. Add all learner-facing and accessibility text to `src/lib/copy.ts`.
3. Compose the route from named local blocks and existing primitives. Promote code only when it has
   a second use.
4. Put selection, sequencing, and evaluation in an `@loro/core` engine or domain function, not in
   press handlers.
5. Register the screen in `_layout.tsx` when it needs explicit stack options.
6. Add every learner-visible state to `e2e/states.ts`; add focused behavior tests to the matching
   Playwright spec. The route coverage test rejects a route with no state.
7. Run `pnpm check`, `pnpm test:e2e`, and the mobile `bundle` command.

Conversation routes add one further boundary: durable thread text, draft text, translations,
corrections, and ASR transcripts remain local/private by default. They do not enter the ordinary
sync outbox or analytics queue. A live chat coordinator may send a bounded text context to the
guarded provider endpoint, but no route or coordinator may accept recorded audio bytes, paths, or
handles. Playback uses the production audio capability and arbitrary chat lines use approved
on-device speech; browser `speechSynthesis` is blueprint fixture behavior only
(`Loro Chat.dc.html:514`).

<a id="state"></a>

## State: current and migration target

### Current

`src/store/state.ts` declares one `AppData` object containing onboarding answers, settings, phrase
rows, toast and selection state, practice-day history, and the frozen Refrain set. `store.ts` wraps
slice `set` and `api.setState` so SQLite + outbox commit **before** the projection publishes
([ADR-0012](adr/0012-state-management.md)). Reloading hydrates from the device or browser database;
a process kill does not wipe committed progress. Physical-device upgrade and force-quit acceptance
remain a separate gate.

Actions are split by concern under `src/store/slices/`. Derived reads live in selectors and view
helpers. Two boundaries are already important:

- Practice outcomes enter through `applyDelta` only. The engine produces a `ProgressDelta`; the
  store applies increment, absolute, and monotonic semantics in one implementation.
- Calendar reads use the injected `Clock`. `new Date()` is restricted to `src/lib/clock.ts`, and
  `localDay()` and `streakDay()` are deliberately different keys.

The mobile engine context wraps the committed phrase projection in an asynchronous
`PhraseRepository`. `active()` / `due()` use the domain helpers (`isActive` / `isDue`); eligibility
parity is asserted in `eligibility.test.ts`.

### Target

| Tier      | Holds                                                                    | Mechanism                                               |
| --------- | ------------------------------------------------------------------------ | ------------------------------------------------------- |
| Durable   | phrases, settings, schedules, practice days, Refrain days, trips, outbox | SQLite repositories and observable/read-through queries |
| Session   | active plan, current item, revealed words, engine phase                  | Zustand, checkpointed at transitions                    |
| Ephemeral | focus, open sheet, toast, scroll, animation values                       | React state or Reanimated shared values                 |

Every durable mutation must update SQLite and append its outbox operation in one transaction before
the store publishes. The UI reads that committed projection; it must not require a manual refresh or
await the network before accepting a write. Hydration needs an explicit loading state so first paint
never mistakes “not loaded” for an empty learner library.

Remaining work is acceptance, not a second store:

1. Force-quit resume, migration, offline, and outbox evidence on a real native build.
2. Live native queries only if OP-SQLite reactivity is needed at ~2 000 phrases **and** a web
   equivalent exists ([ADR-0012](adr/0012-state-management.md)).
3. Do not delete the Zustand phrase projection as cleanup.

## Engines and authoritative numbers

`StreamEngine` and `RefrainEngine` are implemented in `@loro/core` and exercised through their
headless contract and conformance suite. Mobile injects rows, clock, settings, flags, seed, and a
`LoroCoreFacade`.

`src/store/coreFacade.ts` is the production `rustCoreFacade` over the generated WASM/UniFFI bridge.
`jsCoreFacade` is an alias of that facade, not a JavaScript stand-in. New cross-platform maths
belongs in `packages/core-rs`. Learner-visible scores, latency, intervals, and contours stay absent
or `null` until a real measurement or binding exists — never estimated.

A practice screen follows this write path:

```
learner attempt
    → engine.record(attempt, context)
    → ProgressDelta
    → store/repository applyDelta
    → derived screen state
```

No route computes a progress field directly. Every engine classifies every `ProgressDelta` signal as
maintained or explicitly exempt so changing engines does not silently discard learner progress.

## Rendering: implemented and planned

Current screens use React Native `ScrollView`, `View`, text, pressables, generated design tokens,
and shared UI primitives. Reanimated and Gesture Handler are installed, but installation is not
evidence that a specific effect runs off the JS thread. FlashList and Skia are not installed.

In particular, the current Refrain warming card selects a band colour during React render and
reduces authored gradient bands to a solid fallback. UI-thread colour interpolation, a real
gradient, and device-floor frame measurements are still target work.

Use these rules as new rendering capabilities land:

- Lists must first have measured evidence that `ScrollView` is insufficient before introducing a
  virtualized-list dependency; the long-library target is 2,000 phrases.
- Anything continuously animated while audio plays belongs on the UI/native thread.
- Skia charts need a visible textual summary and must not be introduced before the dependency and
  native build exist.
- Spanish text uses the project text primitive's `lang="es"` path; source scanning covers the
  browser gap where React Native Web drops `accessibilityLanguage`.
- Tap targets, colour tokens, text scaling, and learner copy are build rules, not cleanup tasks.

## Native capability boundary

The intended native surface is not present yet:

```
modules/loro-audio/       playback, capture, routing, interruptions, lock screen
modules/loro-speech/      on-device ASR and device TTS
modules/loro-core/        UniFFI wrapper around loro-core
targets/ios-widget/       WidgetKit / ActivityKit
targets/android-widget/   Glance
```

When these land, app code imports narrow TypeScript wrappers under `src/platform/`, never generated
bindings or vendor APIs directly. Wrappers own capability detection and documented degradation
paths, so a route can render a supported/unavailable state without branching on operating-system
details.

Recorded audio never crosses the JS boundary. `stopRecording()` returns an opaque handle; native
code passes that handle to the Rust core and releases it after scoring. No analytics, sync, debug,
or error-reporting API accepts PCM or a path to it.

Audio playback state belongs to the audio capability rather than a screen so it can survive route
changes and sheets. That is a target invariant; the current app has no playback implementation.

<a id="errors"></a>

## Errors and degradation

The target domain convention is `Result<T, DomainError>` for expected failures, with exceptions at
I/O and native boundaries. The current routes do not yet implement a general domain error model or
route-level error boundaries, so add those with the first real fallible boundary rather than
assuming they exist.

| Class       | Example                                        | Required handling                                            |
| ----------- | ---------------------------------------------- | ------------------------------------------------------------ |
| Expected    | no phrases due, microphone permission declined | A normal screen state                                        |
| Degradable  | ASR unavailable, catalog audio absent          | The documented real fallback; never a fake score             |
| Recoverable | transient sync failure, locked database        | Local success plus retry/backoff                             |
| Fatal       | corrupt database, failed migration             | Honest recovery screen and diagnostics without learner audio |

A recoverable service failure must not discard an active session, and no message blames the learner.
Record degradations with non-sensitive context sufficient to distinguish device limitations from
code defects.

## Testing and extension contract

Unit tests cover the mobile store, clocks, copy ownership, core engines, persistence interfaces, and
real SQLite statements through the Node driver. The browser suite covers the behavior that can
actually run today.

`e2e/states.ts` is the learner-visible state manifest. Click helpers (`enter`, `doOneRep`, `lockIn`,
markers) live in `e2e/helpers/`; account mocks stay in `accountFlow.ts`. `route-coverage.spec.ts`
proves every route has an owner and every declared route exists; accessibility and text-scale suites
enter the same states by clicking as a learner would. A new state belongs in the manifest in the
same coherent change as the implementation.

```bash
nvm use 22
pnpm check
pnpm test:e2e
pnpm --filter @loro/mobile bundle
```

The bundle command is an iOS Expo export: it proves Metro resolution and production bundle emission,
not native compilation or runtime correctness. Browser E2E does not cover microphone, audio
sessions, SQLite hydration, process-death resume, airplane mode, notification delivery, or widgets.
Add those tests when the corresponding native capability exists, and run audio and speech checks on
physical hardware.

The extension rule is simple: documentation may describe the destination, but every implementation
claim must be backed by a route, dependency, adapter, or test that exists in the repository today.
