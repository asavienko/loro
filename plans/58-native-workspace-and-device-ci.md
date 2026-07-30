# Native workspace, dev clients, bridges, and device CI

- **Requirement IDs:** `AS-01`…`AS-06`, `P5-06`, `F-03`, `F-09`
- **Milestone:** M1
- **Status:** Not started
- **Depends on:** plan 53 ✅ for final adapter/context seams

## Outcome

The repository can reproducibly build and test iOS and Android development clients with local Expo
modules, generated native projects, UniFFI bindings, device SQLite, permissions, and widget targets.

## Work

1. Decide and document CNG/prebuild ownership, committed-vs-generated native projects, minimum OS
   floors, signing boundaries, and local prerequisites.
2. Add idempotent config plugins and local Expo module skeletons for `loro-core`, SQLite, audio,
   speech, notifications/widgets, OCR, and purchases without implementing feature behavior.
3. Wrap generated UniFFI bindings behind typed platform ports; add checksum/drift verification and a
   harmless round-trip smoke call.
4. Create dev-client/EAS profiles and environment-safe configuration. Expo Go becomes an explicit
   unsupported path once native modules install.
5. Add iOS/Android compile jobs, native unit tests, a device/simulator smoke harness, and artifact
   retention; keep the web bundle job as a separate target.
6. Document first build, clean regeneration, common toolchain failures, and secrets/signing setup.

## Acceptance criteria

- Clean prebuild and native compilation succeed on supported CI runners and documented local hosts.
- Generated projects/plugins are reproducible and drift-checked.
- TypeScript can call a safe Rust smoke function without hand-editing bindings.
- Device tests can launch, seed state, exercise permissions, and collect logs/screenshots.

## Out of scope

Production persistence, playback, recognition, widgets, OCR, purchases, or store submission.
