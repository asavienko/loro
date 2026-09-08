# Native workspace, dev clients, bridges, and device CI

- **Requirement IDs:** `AS-01`…`AS-06`, `P5-06`, `F-03`, `F-09`
- **Milestone:** M1
- **Status:** 🟡 CNG/prebuild ownership, local APK tooling, OP-SQLite and generated Rust/native
  speech modules are implemented. Full iOS compilation, physical-device harness coverage and
  production signing still require SDK/device/signing evidence.
- **Depends on:** 53 completed; no unfinished plan blocks native workspace setup.
- **Reviewed:** 2026-09-08 during plan-94 integration; release gates below remain explicit.

## Implemented scope

GitHub Actions stays disabled. `pnpm ci:local:native` retains local Rust target compilation;
`pnpm apk:local` / `pnpm apk:github` build/upload testing APKs from temporary committed snapshots.
Generated iOS/Android projects remain ignored. Local Expo modules autolink the generated UniFFI core
and native foreground audio/speech; OP-SQLite supplies the device driver. Expo Go cannot load these
custom modules. Generated bindings and embedded browser WASM have drift checks.

The implementation passed Android debug/release compilation, module packaging and an airplane-mode
emulator persistence/reveal smoke. Swift syntax/podspec and host UniFFI smoke passed, but full iOS
compilation needs the unavailable Xcode SDK. This evidence does not prove physical-device speech or
production signing. See [plan 94](94-persistent-practice-and-account-integration.md),
[persistent practice](../docs/process/persistent-practice.md) and
[APK setup](../docs/process/local-apk.md).

## Outcome

The repository can reproducibly build and test iOS and Android development clients with local Expo
modules, generated native projects, UniFFI bindings, device SQLite, permissions, and widget targets.

## Remaining work

1. [ ] Extend the local harness to clean iOS app compilation and supported device floors; retain
       reproducible prebuild, generated-binding and artifact checks.
2. [ ] Automate physical-device permissions, bridge, persistence, lifecycle and interruption checks
       with logs/screenshots; document required voice/model installation.
3. [ ] Validate minimum OS floors and clean regeneration on supported hosts. Add platform modules
       for widgets/OCR/purchases only with their owning feature.
4. [ ] Complete production signing/provisioning and environment-safe release profiles when store
       delivery is authorized. Local APK development signing is not production signing.

## Acceptance criteria

- Clean prebuild and native compilation succeed on supported CI runners and documented local hosts.
- Generated projects/plugins are reproducible and drift-checked.
- TypeScript can call a safe Rust smoke function without hand-editing bindings.
- Device tests can launch, seed state, exercise permissions, and collect logs/screenshots.

## Out of scope

Production persistence, playback, recognition, widgets, OCR, purchases, or store submission.
