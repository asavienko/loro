# Testing strategy

This is both an inventory and an extension contract. “Current” means a test exists and runs;
“required when added” prevents planned native, persistence and backend work from landing with only
web or in-memory evidence.

---

## Current automated layers

| Layer                      | Command                                     | Current evidence                                                 |
| -------------------------- | ------------------------------------------- | ---------------------------------------------------------------- |
| Workspace unit/integration | `pnpm test`                                 | 432 JS/TS tests across core, mobile, API, content and tokens     |
| Rust unit/parity           | `pnpm core-rs:test`                         | 125 inline unit tests plus 6 tests in `tests/parity.rs`          |
| Fast repository gate       | `pnpm check`                                | lint, typecheck, both test sets, content, a11y/copy and contrast |
| Browser E2E                | `pnpm test:e2e`                             | 61 Playwright tests over every implemented route/state           |
| Production export smoke    | `pnpm test:e2e:bundle`                      | `@smoke` flows against a fresh Expo web export                   |
| Build proof                | mobile `bundle`; API `build` then readiness | CI-only additions to the local fast gate                         |

There is no React Native Testing Library suite, Maestro suite, device-farm execution, DSP recording
golden corpus, scheduler simulation, native contract test, or global coverage threshold today.
Workflows that mention some of those are scaffolds; see [ci-cd.md](ci-cd.md).

## What the current tests actually cover

### Rust core

Almost all Rust tests are inline `#[cfg(test)]` in `src/`. They cover ASR text matching, calendar
and streak rules, deterministic selection/ranking, FSRS helpers, ladder rules, notification policy,
HLC/merge semantics and deterministic DSP helpers. `tests/parity.rs` is the only integration test;
it checks six calendar/effort fixtures. It does **not** execute generated Swift, Kotlin and WASM
bindings against one another.

`benches/core_benches.rs` exists and CI runs Criterion. No checked-in comparison baseline currently
makes “greater than 10% regression” an enforced assertion. `tests/golden.rs`, `tests/sim.rs` and a
recording corpus do not exist.

### Shared TypeScript and mobile

`packages/core` tests domain rules, engine selection/recording, merge-field policy and the
driver-agnostic SQLite schema/repositories/outbox. Mobile tests cover the clock, copy ownership,
catalog/store views, `applyDelta`, practice-engine integration and persistence against Node's real
SQLite driver.

This proves repository semantics against SQLite, not on-device hydration: `apps/mobile` has no
op-sqlite driver yet, and the running app store remains in memory.

### API

API tests cover the ten current HTTP endpoints, sync guards and merge classes through the built
WASM, content responses, problem details and the stub AI scene path. They run against an in-memory
sync repository. Auth, Postgres tenant isolation, anonymous claim/sign-in merge, two-device
partition/reconvergence and 30-day offline replay are not implemented or tested.

### Playwright web E2E

`apps/mobile/e2e/states.ts` is the learner-visible state manifest. The route-coverage, accessibility
and text-scale suites consume it, so a new state must be added there in the same change. Current
coverage includes screen behaviour, navigation and cross-screen rollups, both day keys and multi-day
progression, axe, keyboard interaction, 44 px targets, and 200%/310% text scale. The suite has an
enforced eight-minute global timeout and runs serially in a phone-sized Chromium viewport.

The production-export suite runs only the `@smoke` subset. It proves that representative flows load
from shipped web assets; it is not a second full behaviour run.

Web E2E cannot prove:

- native audio, microphone/ASR, widgets, notifications or interruption handling;
- on-device SQLite hydration, force-quit resume or real airplane-mode operation;
- iOS/Android rendering, battery, thermals, frame rate, VoiceOver or TalkBack;
- `accessibilityLanguage` or `accessibilityHint`, which react-native-web does not forward.

`check:lang` scans source for the first missing browser signal. The second remains a native review
obligation.

## Gates for extending the app

Tests land with the behaviour they protect, not in a later hardening pass.

| Change                           | Required evidence in the same change                                                                                                               |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| New learner route or state       | Unit/integration coverage where logic lives; a `states.ts` row; update `functional-spec.md` and `screen-catalog.md`; `pnpm check`; `pnpm test:e2e` |
| Behaviour-preserving UI refactor | Existing Playwright expectations unchanged and green                                                                                               |
| New practice engine              | Shared conformance suite plus selection/sequencing cases; all writes flow through `ProgressDelta`/`applyDelta`                                     |
| New persistence driver           | Run the repository contract against that driver; migration and cold-hydration tests; force-quit/resume device flow                                 |
| Sync persistence/auth            | Two-device partition/reconvergence, anonymous claim with overlapping data, tenant isolation and 30-day replay                                      |
| Native module                    | JS/native contract tests, both-platform device flow, denial/interruption/background cases and resource-release checks                              |
| Audio/DSP scoring                | No PCM exposed to JS; real recording golden corpus; documented stability threshold; native-speaker validation before learner scores ship           |
| FSRS scheduling                  | Complete `review()` implementation; published/reference fixtures; boundary/property tests; native/WASM/TS parity before any interval is shown      |
| Widget/notification              | Deep-link and offline lifecycle device flows; scheduler policy tests including quiet hours and no missed-day shame                                 |
| New syncable field               | Merge class in `fieldPolicy.ts`, Rust merge semantics and API/WASM coverage                                                                        |
| Content                          | `pnpm content:validate`, schema/reference tests, native Spanish review and human listening for audio                                               |

When native behaviour first lands, add Maestro (or the selected device runner) to CI in the same
work, remove the corresponding “not covered” statement here, and make the device job real before
calling the feature complete.

## Manual gates

Manual checks activate only when the underlying feature exists, then remain release gates:

- real-device audio interruption and routing matrix on both platforms;
- airplane-mode cold launch and force-quit resume;
- VoiceOver and TalkBack on changed screens;
- animation frame-rate, battery, thermal and long-session soak checks;
- widget/Live Activity lifecycle and offline playback;
- native-speaker score validation for pronunciation/prosody.

Until a feature exists, report the gate as **not applicable — not implemented**, never as passed.

## Coverage policy

There is no percentage threshold. CI uploads any produced `coverage/` directories, but Vitest is not
currently configured to generate them by default. Tests are required around consequences and
boundaries: merge classes, migrations, learner-visible states, engine conformance, privacy and
native lifecycle. A test should fail when the promised behaviour breaks.

Generated token and UniFFI output is not hand-tested; generators are tested and CI regenerates the
outputs and fails on drift.
