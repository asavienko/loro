# The native toolchain: prebuild, dev client, and EAS — the unblocker

- **Requirement IDs:** `AS-01`…`AS-06`, `P5-06`, `F-03`
- **Milestone:** M1 — **blocks every audio, speech, widget, and persistence plan**
- **Size:** M

## Why this is first

`CLAUDE.md` states the situation exactly:

> `expo run:ios` / `run:android` need a toolchain that isn't set up here — full Xcode or the Android
> SDK, plus a first `expo prebuild` (there is no `apps/mobile/ios` or `android/`). Until then: web,
> or Expo Go on a device, **which still works only because no custom native module is installed
> yet.**

Every one of these plans installs a custom native module and therefore ends Expo Go compatibility:

- [audio-playback-module.md](11-audio-playback-module.md) — `expo-audio`, background audio
- [asr-speech-module.md](12-asr-speech-module.md) — platform speech recognisers
- [sqlite-persistence-and-outbox.md](10-sqlite-persistence-and-outbox.md) — `op-sqlite`
- [labs-pronunciation-and-prosody.md](27-labs-pronunciation-and-prosody.md) — the UniFFI binding to
  `core-rs`
- [widgets-and-notifications.md](30-widgets-and-notifications.md) — WidgetKit / Glance targets

So this plan is not infrastructure housekeeping; it is the prerequisite that decides whether half
the product can be built at all. It is also the plan that turns "a green build proves less than
usual" (`CLAUDE.md`) into a build that proves something.

## The work

### 1. Prebuild, and decide what gets committed

`npx expo prebuild` generates `apps/mobile/ios/` and `android/`. Two viable postures:

- **CNG (continuous native generation)** — `ios/`/`android/` stay gitignored and regenerate; all
  native config lives in `app.config.ts` and config plugins. Cleanest, and matches the repo's
  "generated files are fixed by fixing the generator" convention.
- **Committed native projects** — needed if a target requires hand-editing Xcode project settings
  that no plugin covers.

**Recommend CNG**, with any hand-edit expressed as a config plugin under `apps/mobile/plugins/`. The
widget targets are the one thing that may force a committed project — decide when that plan starts,
not before, and record the decision as an ADR either way.

### 2. Config plugins for the things that need native edits

- Microphone usage description (`NSMicrophoneUsageDescription`) with copy that matches the on-device
  promise the app prints (`Loro.dc.html:1281`) — a vague permission string next to a specific
  privacy claim reads as a contradiction.
- Speech recognition usage description (`NSSpeechRecognitionUsageDescription`).
- Background audio mode (`UIBackgroundModes: audio`) for the hands-free stream.
- Android: `RECORD_AUDIO`, foreground service type for playback, `POST_NOTIFICATIONS`.

Each plugin needs a test — `expo prebuild --clean` then assert the generated `Info.plist` /
`AndroidManifest.xml` contains the entry. A plugin that silently stops applying is very hard to
notice.

### 3. The UniFFI bridge, actually wired

`packages/core-rs` builds for host and WASM today, and `bindings/` is committed and drift-checked.
The missing half is an Expo module that links the Rust static library (iOS `.a` / xcframework,
Android `.so` per ABI) and exposes the generated bindings to JS.

- Build script per target ABI: `aarch64-apple-ios`, `aarch64-apple-ios-sim`,
  `aarch64-linux-android`, `armv7-linux-androideabi`, `x86_64-linux-android`.
- Cache aggressively in CI (`Swatinem/rust-cache` is already configured for the core job).
- A round-trip smoke test on device — the M0 exit criterion "a trivial function round-trips" was
  signed off against the _bindings_, not against a device. Close that gap.

### 4. Dev client and EAS

`apps/mobile/eas.json` exists. Add profiles for `development` (dev client, simulator + device),
`preview` (internal distribution), and `production`. Then:

- Document the split in `apps/mobile/README.md`: **web** for fast screen iteration (no native),
  **dev client** for anything touching audio, mic, database, or widgets. And state plainly that Expo
  Go stops working — someone will otherwise spend a day on it.
- `docs/process/onboarding.md` gains a real "day one on native" path with prerequisites (Xcode
  version, Android SDK, JDK, Rust targets) and expected times.

### 5. CI

`.github/workflows/mobile-build.yml` exists. Extend it to run `expo prebuild --clean` and compile
**both** platforms on PRs that touch native config, plugins, or `core-rs`. The current `bundle` job
proves Metro resolves and Hermes accepts the JS; it cannot catch a broken plugin, a missing ABI, or
a linker error. Those are exactly the failures that block a release day.

Keep it path-filtered — a full native build on every docs PR is not worth the minutes.

### 6. Keep the web target alive

Web is currently the fastest way to see the screens and that is genuinely valuable. Every native
module needs a web fallback that is either a working shim (in-memory database) or an honest
`unavailable` (mic, ASR) — which the engine contract already models via `Availability`
(`packages/core/src/engines/types.ts:219`). Add a CI check that the web bundle still builds after
each native module lands.

## Acceptance criteria

- `expo prebuild --clean` from a clean clone produces buildable iOS and Android projects.
- A dev-client build installs on a physical iPhone and a physical Pixel and boots the app.
- A `core-rs` function round-trips over UniFFI **on both devices**.
- All permission strings and background modes appear in the generated native manifests, asserted by
  test.
- CI compiles both platforms when native inputs change.
- `npx expo start --web` still runs every screen with documented fallbacks.
- `onboarding.md` gets a new engineer to a running dev client, and someone who has never done it
  follows the doc successfully.

## Tests

- CI runs `expo prebuild --clean` in a clean checkout, then compiles an iOS simulator target and an
  Android emulator target for every native-input change.
- A manifest/config test asserts the generated permission strings, URL schemes, background modes,
  deployment targets, and pinned Android NDK version.
- Device smoke tests call one deterministic `loro-core` function through UniFFI on a physical iPhone
  and Pixel and record the device/OS pair in `qa-device-matrix.md`.
- The web bundle runs with native modules unavailable and exercises each documented fallback; no
  native package is imported eagerly on web.
- Regenerating UniFFI bindings and native projects twice produces no second diff.

## Risks

- **macOS-only iOS builds.** CI needs a macOS runner for the iOS job (minutes cost); note it in
  `docs/process/ci-cd.md`.
- **Rust + Android NDK** is the most brittle part of the chain. Pin the NDK version in the plugin
  and in CI.
- **Expo SDK upgrades** regenerate native projects; with CNG that is a feature, with committed
  projects it is a merge conflict. Another argument for CNG.

## Out of scope

Store submission and signing (`docs/process/ci-cd.md`, release plan).
