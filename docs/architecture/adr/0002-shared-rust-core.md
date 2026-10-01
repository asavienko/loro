# 0002 · Put all reproducible maths in a shared Rust core

- **Status:** Accepted (updated 2026-09-30 for the current app)
- **Date:** 2026-07-28

## Context

Some numbers must be identical wherever they are computed. If iOS, Android and the web disagree
about an FSRS interval, the same phrase is due on different days on a learner's two devices. If a
client and the server disagree about a merge, progress is silently lost. Writing the same maths in
TypeScript, Swift and Kotlin guarantees that the copies drift.

## Decision

One Rust crate, `packages/core-rs` (`loro-core`), owns every number that must match across
platforms: FSRS scheduling, the HLC sync merge and ranking/selection. It is pure: no I/O, no clock
and no randomness except what is passed in.

- **iOS/Android:** the `LoroCore` Expo module (`apps/mobile/modules/loro-core`) over UniFFI.
- **Web:** the committed WASM browser build (`packages/core-rs/browser/`).
- **API:** a Node WASM build (`@loro/core-rs/wasm`, built by `pnpm core-rs:build`) runs the
  `/v1/sync` merge.

The app reaches the core through one JSON boundary, `core_call(method, input)`. The generated
bindings and browser build are committed and drift-checked; fix the generator, never the output. The
current app calls `fsrs_initialize` and `fsrs_review`.

## Consequences

- There is no JavaScript FSRS. A build without the native module (Expo Go) cannot schedule.
- The core is deterministic, so reference fixtures and a 365-day simulation run in `cargo test`.
- The stack has a third language, and native builds need `cargo-ndk` and the Rust targets.
- `cargo` must be on the PATH that `pnpm`/`turbo` see, or `@loro/core-rs` tasks fail.
- The crate also holds code the current app doesn't call (DSP, ASR matching, ladder, notifications)
  from the earlier app.
