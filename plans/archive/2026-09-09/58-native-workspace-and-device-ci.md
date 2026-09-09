# Native workspace, dev clients, bridges, and device CI

- **Requirement IDs:** `AS-01`…`AS-06`, `P5-06`, `F-03`, `F-09`
- **Milestone:** M1
- **Status:** 🟡 CNG/prebuild ownership, local APK tooling, OP-SQLite and generated Rust/native
  speech modules are implemented. Full iOS compilation, physical-device harness coverage and
  production signing still require SDK/device/signing evidence.
- **Depends on:** 53 completed; no unfinished plan blocks native workspace setup.
- **Reviewed:** 2026-09-09 against checkout `42f4d57`; source/plan review only, no new device or
  deployment acceptance.

**Archive disposition (2026-09-09):** Archived at user request after integration review. The partial
status and remaining acceptance criteria below are retained; archival does not mark this plan
complete. The roadmap index continues to track its unfinished scope.

## Implemented scope

GitHub Actions stays disabled. `pnpm ci:local:native` retains local Rust target compilation;
`pnpm apk:local` / `pnpm apk:github` build/upload testing APKs from temporary committed snapshots.
Generated iOS/Android projects remain ignored. Local Expo modules autolink the generated UniFFI core
and native foreground audio/speech; OP-SQLite supplies the device driver. Expo Go cannot load these
custom modules. Generated bindings and embedded browser WASM have drift checks.

`pnpm native:evidence` now captures a read-only, timestamped Android device evidence bundle under
the ignored local-build directory; its fixture tests protect command construction and redaction.

The implementation passed Android debug/release compilation, module packaging and an airplane-mode
emulator persistence/reveal smoke. Swift syntax/podspec and host UniFFI smoke passed, but full iOS
compilation needs the unavailable Xcode SDK. This evidence does not prove physical-device speech or
production signing. See [plan 94](../../94-persistent-practice-and-account-integration.md),
[persistent practice](../../../docs/process/persistent-practice.md) and
[APK setup](../../../docs/process/local-apk.md).

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

## Delivery order and gates

1. Extend `native:evidence` and the local build harness with iOS build/launch and physical-device
   collection. Detect missing Xcode/SDK/device inputs explicitly; Android evidence is not iOS proof.
2. Use one evidence matrix with plans 59/60/63/68/87/93 and shared enforcement in 72. Each row
   records artifact revision, device/OS, target language, scenario, result and retained evidence.
   Collect once and reference it from the feature owner; do not duplicate persistence or gesture
   implementations.
3. Keep development harness delivery separate from production signing/store work in 73. No cloud
   builds or GitHub Actions are required by this plan.

## Out of scope

Production persistence, playback, recognition, widgets, OCR, purchases, or store submission.
