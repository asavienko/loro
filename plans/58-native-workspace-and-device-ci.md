# Native workspace, dev clients, bridges, and device CI

- **Requirement IDs:** `AS-01`…`AS-06`, `P5-06`, `F-03`, `F-09`
- **Milestone:** M1
- **Status:** 🟡 Rust target CI and EAS configuration gates exist. Native projects, module bridge,
  dev clients and device harness remain; real EAS project/signing configuration is required for
  distribution, not for local design work.
- **Depends on:** 53 completed; no unfinished plan blocks native workspace setup.
- **Reviewed:** 2026-09-07 against merged baseline `2d9e8c3`.

## Verified starting point

`.github/workflows/core-rs.yml` uses cargo-ndk for Android and library-only native builds.
`mobile-build.yml` distinguishes missing EAS configuration from a successful build; device-farm
steps are still TODOs. `apps/mobile/ios`, `android` and custom native modules are absent. Rust
target compilation is not an Expo app or bridge smoke test.

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
