# Native workspace, dev clients, bridges, and device CI

- **Requirement IDs:** `AS-01`…`AS-06`, `P5-06`, `F-03`, `F-09`
- **Milestone:** M1
- **Status:** 🟡 CNG/prebuild ownership, local APK tooling, OP-SQLite and generated Rust/native
  speech modules are implemented. Full iOS compilation, physical-device harness coverage and
  production signing still require SDK/device/signing evidence.
- **Depends on:** 53 completed; no unfinished plan blocks native workspace setup.
- **Reviewed:** 2026-09-09 against `aafa61f`; current source, tests and retained review records
  inspected. This plan refresh supplies no new runtime, device or deployment acceptance.
- **Priority:** 9; start alongside priority 1, not after priority 8.

**Archive disposition (2026-09-09):** Archived at user request after integration review. The partial
status and remaining acceptance criteria below are retained; archival does not mark this plan
complete. The roadmap index continues to track its unfinished scope.

## Implemented scope

GitHub Actions stays disabled. `pnpm ci:local:native` retains local Rust target compilation;
`pnpm apk:local` / `pnpm apk:github` build/upload testing APKs from temporary committed snapshots.
Generated iOS/Android projects remain ignored. Local Expo modules autolink the generated UniFFI core
and native foreground audio/speech; OP-SQLite supplies the device driver. Expo Go cannot load these
custom modules. Generated bindings and embedded browser WASM have drift checks.

`pnpm apk:local` resolves JDK 17 and an installed Android SDK on Linux (`~/Android/Sdk`, Debian
`openjdk-17`) as well as the existing macOS defaults. `pnpm native:evidence` uses that SDK's `adb`
when it is not already on `PATH`. A full emulator `logcat -d` can throw `ENOBUFS`; the collector
keeps recent lines and continues so plan 101 wave rows can still run. This does not replace device,
emulator or signing evidence.

`pnpm native:evidence` now captures a read-only, timestamped Android device evidence bundle under
the ignored local-build directory. `--platform ios` now collects Xcode version, booted simulator
metadata, installed-bundle presence and a verified PNG artifact, with explicit missing prerequisite
and ambiguous-device errors. The CLI requires a Git revision and a retained build file; it resolves
the revision locally and records the file's SHA-256 and byte size. Normal `pnpm check` runs
hardware-free collector fixtures. This identifies the reviewed bytes but does not verify the
installed binary. Correlating them with app build metadata and explicit scenario results remains
required. No new iOS runtime or physical-device acceptance is claimed. See the native evidence
section of [APK setup](../../../docs/process/local-apk.md).

The implementation passed Android debug/release compilation, module packaging and an airplane-mode
emulator persistence/reveal smoke. Swift syntax/podspec and host UniFFI smoke passed, but full iOS
compilation needs the unavailable Xcode SDK. This evidence does not prove physical-device speech or
production signing. See [plan 94](94-persistent-practice-and-account-integration.md),
[persistent practice](../../../docs/process/persistent-practice.md) and
[APK setup](../../../docs/process/local-apk.md).

## Outcome

The repository can reproducibly build and test iOS and Android development clients with local Expo
modules, generated native projects, UniFFI bindings, device SQLite, permissions, and widget targets.

## Remaining work

1. [ ] Extend the local harness to clean iOS app compilation and supported device floors; retain
       reproducible prebuild, generated-binding and artifact checks. `pnpm ios:local` now
       fail-closes on Linux and missing Xcode/CocoaPods/Rust simulator targets, and on a Mac retains
       an unsigned `iphonesimulator` `.app` zip under `.local-builds/ios/<commit>/`.
       `pnpm ios:evidence` chains that zip into `--execute-scenarios` (boot/install/launch). This
       host has not compiled that artifact. Production signing and physical iPhone floors remain.
2. [ ] Automate physical-device permissions, bridge, persistence, lifecycle and interruption checks
       with logs/screenshots; document required voice/model installation. Plan 101/93 wave-path rows
       (pointer, spine/sheet, Android Back, backdrop, and TalkBack `-at` variants) are declared on
       the evidence manifest. `pnpm native:evidence --execute-scenarios` drives them through adb +
       uiautomator after first-run onboarding when Today is missing. Linux emulator `emulator-5554`
       (AVD `loro-wave`, API 36) passed all twelve catalog rows on preview APK `d0a802591f75` with
       chrome plus the exact URL or gesture proof
       (`.local-builds/native-evidence/wave-101-emulator-v14/`, `physicalGateCount=0`), including
       phrase-detail Practice now → `?phrase=` and phrase-focus switcher → `?filter=hard`. An edge
       swipe opened Leave this wave? / Pause the wave; Android Back after Keep going opened the
       phrase-drill sheet. The NAV-04 row probes edge and mid-screen swipes, then Android Back on
       Stream (wave sheet) and phrase Refrain (practice sheet); iOS practice routes set
       `fullScreenGestureEnabled: false`. That is not physical-device, interruption, speech, or iOS
       proof. Missing device or matching evidence stays `unavailable` or `failed`. iOS
       `--execute-scenarios` drives pointer, spine/sheet, Leave-practice exit, and backdrop rows
       through simctl + idb with the same fail-closed chrome/URL/gesture gates. Android Back stays
       unavailable on iOS. That path may boot a Shutdown simulator and install a verified
       `loro-simulator-*.zip`. TalkBack `-at` rows stay unavailable even if VoiceOver looks enabled;
       ordinary idb taps are not AT proof. VoiceOver remains a physical-device gate. Missing
       Xcode/idb does not abort collection. A screenshot collector must not mark those rows passed.
3. [ ] Validate minimum OS floors and clean regeneration on supported hosts. Add platform modules
       for widgets/OCR/purchases only with their owning feature.
4. [ ] Complete production signing/provisioning and environment-safe release profiles when store
       delivery is authorized. Local APK development signing is not production signing.

## Acceptance criteria

- Clean prebuild and native compilation succeed on supported CI runners and documented local hosts.
- Generated projects/plugins are reproducible and drift-checked.
- TypeScript can call a safe Rust smoke function without hand-editing bindings.
- Device tests can launch, seed state, exercise permissions, and collect logs/screenshots.

## Delivery order and gates

1. Start alongside priority 1. Extend `native:evidence` and the local build harness with clean iOS
   build/launch and physical-device scenario execution; retain the current collector/fixture gate.
   Detect missing Xcode/SDK/device inputs explicitly; Android evidence is not iOS proof.
2. Use one evidence matrix with plans 59/60/63/68/87/93 and shared enforcement in 72. Each row
   records artifact revision and package digest/build correlation, device/OS, target language,
   scenario, result and retained evidence. `matrix.json` (`loro-wave-evidence-matrix/v1`) now
   records those fields plus `closesPhysicalGate`, which stays false on emulator/simulator passes.
   Missing SDK/model/device inputs must be marked blocked or unavailable, never passed. Link exact
   scenario results rather than treating a screenshot of the currently open app as execution
   evidence. Collect once and reference it from the feature owner; do not duplicate persistence or
   gesture implementations.
3. Keep development harness delivery separate from production signing/store work in 73. No cloud
   builds or GitHub Actions are required by this plan.

## Out of scope

Production persistence, playback, recognition, widgets, OCR, purchases, or store submission.

## Post-main review and archive disposition — 2026-09-09

The [review at `de81744`](../../../docs/reviews/2026-09-09-post-main-plan-review.md) records this
plan's current contribution, remaining work and gates. [Delivered slices](IMPLEMENTED-SLICES.md) are
retained in the archive; this plan remains incomplete. Earlier verification is dated evidence, not
acceptance of the current combined branch.
