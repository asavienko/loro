# Testing strategy

This is both an inventory and an extension contract. “Current” means a test exists and runs;
“required when added” prevents planned native, persistence and backend work from landing with only
web or in-memory evidence.

---

## Current automated layers

| Layer                      | Command                            | Current evidence                                                                              |
| -------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------- |
| Workspace unit/integration | `pnpm test`                        | JS/TS tests; API Postgres suites skip unless `LORO_TEST_DATABASE_URL` is set                  |
| API PostgreSQL gate        | `bash scripts/ci-auth-postgres.sh` | Isolated schema for auth/sync/rate-limit/repository/migration cases; not part of `pnpm check` |
| Rust unit/parity           | `pnpm core-rs:test`                | 169 unit/integration cases, including scheduler reference parity                              |
| Fast repository gate       | `pnpm check`                       | lint, typecheck, both test sets, content, a11y/copy and contrast; no PostgreSQL               |
| Browser E2E                | `pnpm test:e2e`                    | 155 Playwright tests over 71 implemented states                                               |
| Production export smoke    | `pnpm test:e2e:bundle`             | `@smoke` flows against a fresh Expo web export                                                |
| Build proof                | `pnpm ci:local`; `pnpm apk:local`  | Local bundles, API image/readiness and a separate Android APK gate                            |

There is no React Native Testing Library suite, Maestro suite, device-farm execution, DSP recording
golden corpus or global coverage threshold today. Native acceptance remains a separate evidence
matrix; see [persistent practice](persistent-practice.md) and [ci-cd.md](ci-cd.md).

## What the current tests actually cover

### Rust core

Almost all Rust tests are inline `#[cfg(test)]` in `src/`. They cover ASR text matching, calendar
and streak rules, deterministic selection/ranking, FSRS helpers, ladder rules, notification policy,
HLC/merge semantics and deterministic DSP helpers. Integration tests cover calendar/effort parity,
FSRS reference vectors and scheduler simulation. Mobile boundary tests execute the shipped WASM. The
automated local gate does **not** execute a physical Swift/Kotlin/WASM device parity matrix.

`benches/core_benches.rs` exists and CI runs Criterion. No checked-in comparison baseline currently
makes “greater than 10% regression” an enforced assertion. `tests/sim.rs` now exercises scheduling;
`tests/golden.rs` and a recording corpus do not exist.

### Shared TypeScript and mobile

`packages/core` tests domain rules, engine selection/recording, merge-field policy and the
driver-agnostic SQLite schema/repositories/outbox. Mobile tests cover the clock, copy ownership,
catalog/store views, `applyDelta`, practice-engine integration and persistence against Node's real
SQLite driver.

The runtime uses OP-SQLite on device and durable SQL.js snapshots in browsers. Tests cover both
preview schema upgrades, checkpoint/attempt atomicity, owner-scoped outboxes, rollback and reload.
Node/browser coverage does not replace physical-device upgrade and process-death acceptance.

### API

The current contract registry has 25 operations. API tests cover Google/Apple/email identity, legacy
account/session upgrades, refresh rotation/replay, device/tenant isolation, durable sync
receipts/cursors, WASM merge, content, problem details and stub AI. Disposable PostgreSQL tests run
the actual HTTP controllers and transactions when `LORO_TEST_DATABASE_URL` is set; they skip in
`pnpm check` and `pnpm --filter @loro/api test` otherwise. `bash scripts/ci-auth-postgres.sh` and
`pnpm ci:local` create that isolated database. Physical two-device partition/reconvergence, long
offline histories and production provider/load acceptance remain separate release gates.

### Playwright web E2E

`apps/mobile/e2e/states.ts` is the learner-visible state manifest. The route-coverage, accessibility
and text-scale suites consume it, so a new state must be added there in the same change. Current
coverage includes screen behaviour, navigation and cross-screen rollups, both day keys and multi-day
progression, axe, keyboard interaction, 44 px targets, and 200%/310% text scale. The suite has an
enforced twelve-minute global timeout and runs serially in a phone-sized Chromium viewport. The
integrated 155-test/71-state suite reached its former eight-minute limit after 149 passing tests.
The two whole-manifest text-scale sweeps have two-minute per-test budgets; ordinary tests retain 90
seconds. Every state and layout assertion remains in the gate.

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
