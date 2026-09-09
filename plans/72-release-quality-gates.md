# Release quality gates: accessibility, performance, localization, and complete testing

- **Requirement IDs:** M2 accessibility/performance/offline release criteria, `F-08`, Q-10, Q-13,
  Q-14
- **Milestone:** M2
- **Status:** 🟡 Browser state/a11y/text-scale, geometry, bundle and i18n checks exist. Native
  matrices, full pseudo-locale layout sweeps and measured budgets remain; 58 enables device
  harnesses, Q-14 blocks peak sign-off and 87 owns bilingual sign-off.
- **Depends on:** 58 device harness; 57 visual APIs; owning feature acceptance slices as they land.
  This shared harness is not a prerequisite to finish every feature before work starts.
- **Reviewed:** 2026-09-09 against `aafa61f`; current source, tests and retained review records
  inspected. This plan refresh supplies no new runtime, device or deployment acceptance.
- **Priority:** 9; start alongside priority 1 and grow with each feature.

Previous starting point: [archived snapshot](archive/2026-09-08/72-release-quality-gates.md).

## Verified starting point

`apps/mobile/e2e/` covers current states, rendering geometry and bundle availability;
`apps/mobile/src/lib/i18n/` has en/bg/ru ICU resources and parity checks. No native
accessibility/performance matrix is demonstrated. Rust simulation and parity targets exist under
`packages/core-rs/tests/` and run through the local Rust gate. GitHub Actions remains disabled;
`.github/workflows-disabled/` contains historical references, not active release enforcement. This
plan owns the remaining native, content-release and measured-budget gate wiring. Normal `pnpm check`
already runs native collector fixtures, and `ci:local` already runs the dedicated pseudo-locale
server/suite. `@loro/content check:release` verifies exact-material review evidence but is not
invoked by `ci:local`; distinguish draft-development CI from approved-content release enforcement
rather than requiring pending human sign-off for every development change.

## Outcome

Release claims are measured on native devices and production bundles. Every route/state has
semantic, text-scale, localization, performance, and recovery coverage; critical domain properties
have simulation/property/golden tests.

## Implemented slice — development pseudo-locale (2026-09-09)

- Generated `en-XA` UI fixture preserves ICU arguments, select/plural structure and interpolated
  learning text. The explicit development flag enables it; production ignores the flag.
- Generator drift and ICU structure are checked by the normal mobile unit gate. Focused i18n,
  pseudo-locale and missing-PluralRules regression tests pass (11 tests).
- The opt-in browser smoke covers expanded-copy onboarding, Today's horizontal fit and Add's
  interactive mode controls/horizontal fit. This is a harness slice, not all-state clipping or
  native acceptance; see
  [localization](../docs/process/localization.md#development-pseudo-locale-f-08-plan-72).
- Native matrices, long-content/text-scale pseudo sweeps, locale date coverage and measured budgets
  remain. Q-14 and plan 87's bilingual evidence still own their existing sign-off gates.

## Remaining work

1. [ ] Resolve Q-14 and define native screen-reader announcement/focus behavior for the Refrain
       peak. Complete VoiceOver/TalkBack, switch/keyboard, contrast, touch target, reduced motion,
       language, caption/transcript, and 200%/310% text passes.
2. [ ] Extend the implemented pseudo-locale with full state/text-scale and locale-aware date/number
       coverage; audit all seven pairs, native accessibilityLanguage and translated copy. Include
       plan 87's content release check in release CI without recreating language
       selection/resources.
3. [ ] Measure cold launch, navigation, list frame time, JS/native memory, bundle size, DB, sync,
       audio, ASR, DSP, and battery on named device floors with scale fixtures and regression
       budgets.
4. [ ] Wire the owning plans' simulation/property/golden, persistence, blueprint, native-device,
       permission, migration, offline, two-device and production-bundle suites into an honest
       release matrix. Plans 60/68/77 own their domain harnesses; this plan owns shared enforcement
       and explicit setup gates where a required implementation is still missing.
5. [ ] Make each feature own its states/tests; keep this plan focused on shared harnesses, matrices,
       dashboards, flake budgets, and release enforcement.
6. [ ] Publish an auditable release checklist with evidence links and documented tool limitations.

## Acceptance criteria

- Every shipped surface in the 23-screen design catalog, plus built utilities, and every manifest
  state pass applicable automated and native manual gates.
- Browser-only props/ARIA are not accepted as proof of native accessibility.
- Cold launch/airplane/audio/speech/sync budgets are measured, not estimated.
- Pseudo-locale and long-content fixtures find clipping without altering any target-language catalog
  content.
- CI fails on missing state ownership, generated drift, critical golden/property regressions, or
  budget regression beyond approved tolerance.

## Delivery order and gates

1. Start alongside priority 1. Extend the existing dedicated pseudo-locale smoke to the applicable
   state/text-scale and locale date/number matrix; retain the separate normal-locale server and
   production-disable case. Device runners come from 58, feature assertions from their owning plans.
   Add retained per-artifact pass/fail/blocked evidence with links and explicit missing
   prerequisites; do not rebuild the collector fixture or pseudo command wiring.
2. Derive the release pair matrix from the supported registry and reviewed release set. Seven pairs
   are the current baseline; plan 90 must extend fixtures when English lands. New language support
   does not imply reviewed content or native speech availability.
3. Wire exact-digest `check:release` into the approved content/release path with 61/87; prove
   missing, stale, mutated or incompletely approved records block release while draft development
   remains testable. Existing validator regression tests already cover payload identity and
   reviewer-language coverage. Separate harness completion from feature/release sign-off. Enforce
   Q-14 peak review, 87 bilingual evidence and applicable physical-device gates without making
   unrelated work depend on them. Run checks locally; preserve the disabled GitHub Actions policy.

## Out of scope

Feature implementation, production alerting, new target-language implementation (plan 90 owns
English; this plan consumes its approved pair matrix), and a meaningless global coverage percentage.
