# 0023 · End-to-end tests run the whole app headless in Node

- **Status:** Accepted
- **Date:** 2026-10-09
- **Deciders:** the owner (conversation of 2026-10-09)

## Context

The app's tests were unit tests of `src/shared` (`node:test` through `tsx`): the state machine,
selectors, persistence, content and the API client. Nothing exercised a screen, a sheet, navigation
or the way they hand work to the store, the playback driver, the content cache and the API. The
browser end-to-end, storybook and workbench suites of the earlier app were removed on 2026-09-30,
and the owner asked for end-to-end tests that cover every user interaction and run quickly without a
browser.

## Decision

- **Jest with Expo's preset (`jest-expo`) and React Native Testing Library render the real app in
  Node**: expo-router with every route in `app/`, every screen and sheet, the store, the learner's
  state machine and the Rust core. A test launches the app, taps and types by what is on screen (the
  learner's copy, the seeded content) and asserts what the learner sees, what the phone saved and
  what the server was sent. The suite lives in `apps/mobile/e2e/`
  (`pnpm --filter @loro/mobile e2e`).
- **Only what is under the platform modules is faked.** Jest resolves modules as Metro does for iOS
  (`e2e/resolver.js` mirrors `metro.config.js`'s `NATIVE` map), so `src/platform/*` runs; below it
  sit fakes for the API (an in-memory server answering `fetch` and `XMLHttpRequest` with the paths,
  bodies and problem codes of `apps/api`), expo-audio (players on fake time that report lengths and
  ends as the native one does), and the phone's dialogs, share sheet, notifications, Keychain and
  provider sign-in page. AsyncStorage is its official in-memory mock.
- **The Rust core is its WASM build** (`packages/core-rs/browser`), the same core behind the same
  `core_call` boundary the web uses; the LoroCore native module can't load in Node. Every number on
  screen still comes from the real model.
- **Time is fake.** Each launch starts at a fixed moment and `advance(ms)` runs what is due, so a
  phrase's pauses, the rating window or a week away take no real time.
- **A request the fake API can't answer fails the test**, so the fake keeps up with the app rather
  than letting it see a 404 the real server would never send.

### Rejected

- **Playwright against the web build.** Needs a browser, starts a bundler and is slow; it runs the
  web's platform modules (IndexedDB, HTML audio) rather than the phone's, and was what the removed
  suites did.
- **Detox or Maestro on a simulator or emulator.** The real native layer, but minutes per run, a
  device or simulator per machine, and flaky timing for a loop built on silences.
- **Testing the store and API without rendering.** Fast, but misses exactly what was untested: the
  screens, sheets, navigation and their wiring.
- **Running the real API in-process.** It needs PostgreSQL; a disposable database per test file
  would cost seconds per file and couple the app's suite to the server's migrations. The API keeps
  its own tests against PostgreSQL.
- **`node:test` for the new suite too.** React Native's sources need Babel transforms and module
  mocks that Jest and `jest-expo` already provide; the unit tests stay on `node:test`.

## Consequences

- Native audio, the lock screen, background behaviour, real network and physical-device behaviour
  are still unproven by the suite; physical-device acceptance remains a release gate
  ([ci-cd.md](../../process/ci-cd.md)).
- The fake API is a second implementation of the API's contract to keep in step. A route the app
  starts calling fails the suite until the fake answers it; a change in the API's replies has to be
  made in `e2e/fakes/` too.
- Views that measure themselves get a phone-sized layout from the harness, since the test renderer
  has none; animations run with reduced motion.
- Jest, `jest-expo` and React Native Testing Library are development dependencies of the app.
