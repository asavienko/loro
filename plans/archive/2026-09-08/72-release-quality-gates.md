> Historical snapshot archived on 2026-09-08 (F-04). Its starting point is superseded; unfinished
> work remains in [active plan 72](../2026-09-09/72-release-quality-gates.md). This is not a
> completion record.

# Release quality gates: accessibility, performance, localization, and complete testing

- **Requirement IDs:** M2 accessibility/performance/offline release criteria, `F-08`, Q-10, Q-13,
  Q-14
- **Milestone:** M2
- **Status:** 🟡 Browser state/a11y/text-scale, geometry, bundle and i18n checks exist. Native
  matrices, pseudo-locale and measured budgets remain; 58 enables device harnesses, Q-14 blocks peak
  sign-off and 87 owns bilingual sign-off.
- **Depends on:** 58 device harness; 57 visual APIs; owning feature acceptance slices as they land.
  This shared harness is not a prerequisite to finish every feature before work starts.
- **Reviewed:** 2026-09-07 against merged baseline `2d9e8c3`.

## Verified starting point

`apps/mobile/e2e/` covers current states, rendering geometry and bundle availability;
`apps/mobile/src/lib/i18n/` has en/bg/ru ICU resources and parity checks. No native
accessibility/performance matrix is demonstrated. `.github/workflows/nightly.yml` still calls
missing `tests/sim`; 60 must supply that test target, while this plan owns honest release-gate
wiring.

## Outcome

Release claims are measured on native devices and production bundles. Every route/state has
semantic, text-scale, localization, performance, and recovery coverage; critical domain properties
have simulation/property/golden tests.

## Remaining work

1. [ ] Resolve Q-14 and define native screen-reader announcement/focus behavior for the Refrain
       peak. Complete VoiceOver/TalkBack, switch/keyboard, contrast, touch target, reduced motion,
       language, caption/transcript, and 200%/310% text passes.
2. [ ] Extend the existing i18next/ICU runtime with a pseudo-locale and locale-aware date/number
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

## Out of scope

Feature implementation, production alerting, new target languages beyond the approved seven pairs,
and a meaningless global coverage percentage.
