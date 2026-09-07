# Native workspace, dev clients, bridges, and device CI

- **Requirement IDs:** `AS-01`…`AS-06`, `P5-06`, `F-03`, `F-09`
- **Milestone:** M1
- **Status:** 🟡 Local CI and an APK build/upload runner exist. Standalone preview uses temporary
  Expo prebuild output and development signing; native bridges, device harness and production
  signing remain. Those slices require the native substrate and real device/signing evidence.
- **Depends on:** 53 completed; no unfinished plan blocks native workspace setup.
- **Reviewed:** 2026-09-07 against merged baseline `2d9e8c3`.

## Verified starting point

GitHub Actions is disabled. `pnpm ci:local:native` retains local Rust target compilation and
`pnpm apk:local` / `pnpm apk:github` provide local Gradle APK builds and verified GitHub release
uploads. See [the APK guide](../docs/process/local-apk.md). Generated Android projects live only in
temporary committed snapshots; they are not maintained or committed in `apps/mobile/android`.
Preview signing uses the Expo development key and is not production signing. Custom native modules
and device-level bridge tests remain absent. Building an APK does not establish those capabilities.

## Outcome

The repository can reproducibly build and test iOS and Android development clients with local Expo
modules, generated native projects, UniFFI bindings, device SQLite, permissions, and widget targets.

## Remaining work

1. [ ] Decide and document CNG/prebuild ownership, committed-vs-generated native projects, minimum
       OS floors, signing boundaries, and local prerequisites.
2. [ ] Add idempotent config plugins and the Rust/SQLite bridge substrate needed next. Document
       extension points for audio, speech, widgets, OCR and purchases; add each module with its
       owning feature rather than preinstalling unused skeletons or gated SDKs.
3. [ ] Wrap generated UniFFI bindings behind typed platform ports; add checksum/drift verification
       and a harmless round-trip smoke call.
4. [ ] Create dev-client/EAS profiles and environment-safe configuration. Expo Go becomes an
       explicit unsupported path once native modules install.
5. [ ] Extend existing Rust target CI with real Expo app compilation, native bridge tests, a
       device/simulator smoke harness and artifact retention. Replace device-farm TODO success with
       executable checks or explicit setup gates; retain the separate web bundle job.
6. [ ] Document first build, clean regeneration, common toolchain failures, and secrets/signing
       setup.

## Acceptance criteria

- Clean prebuild and native compilation succeed on supported CI runners and documented local hosts.
- Generated projects/plugins are reproducible and drift-checked.
- TypeScript can call a safe Rust smoke function without hand-editing bindings.
- Device tests can launch, seed state, exercise permissions, and collect logs/screenshots.

## Out of scope

Production persistence, playback, recognition, widgets, OCR, purchases, or store submission.
