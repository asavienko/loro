# Release quality gates: accessibility, performance, localization, and complete testing

- **Requirement IDs:** M2 accessibility/performance/offline release criteria, `F-08`, Q-10, Q-13,
  Q-14
- **Milestone:** M2
- **Status:** Not started; peak-state sign-off blocked on Q-14
- **Depends on:** owning feature plans; begins incrementally with 57/58

## Outcome

Release claims are measured on native devices and production bundles. Every route/state has
semantic, text-scale, localization, performance, and recovery coverage; critical domain properties
have simulation/property/golden tests.

## Work

1. Resolve Q-14 and define native screen-reader announcement/focus behavior for the Refrain peak.
   Complete VoiceOver/TalkBack, switch/keyboard, contrast, touch target, reduced motion, language,
   caption/transcript, and 200%/310% text passes.
2. Add an i18n runtime/message catalog over the existing copy ownership, format dates/numbers with
   locale-aware APIs, enforce Spanish-content/UI-language separation, and gate a pseudo-locale.
3. Measure cold launch, navigation, list frame time, JS/native memory, bundle size, DB, sync, audio,
   ASR, DSP, and battery on named device floors with scale fixtures and regression budgets.
4. Add remaining Rust simulations/properties/goldens, component/live-persistence tests, blueprint
   fixtures, native Maestro/device flows, permissions, upgrade/migration, offline, two-device, and
   production-bundle suites.
5. Make each feature own its states/tests; keep this plan focused on shared harnesses, matrices,
   dashboards, flake budgets, and release enforcement.
6. Publish an auditable release checklist with evidence links and documented tool limitations.

## Acceptance criteria

- All 21 shipped surfaces and every manifest state pass applicable automated and native manual
  gates.
- Browser-only props/ARIA are not accepted as proof of native accessibility.
- Cold launch/airplane/audio/speech/sync budgets are measured, not estimated.
- Pseudo-locale and long-content fixtures find clipping without altering Spanish catalog content.
- CI fails on missing state ownership, generated drift, critical golden/property regressions, or
  budget regression beyond approved tolerance.

## Out of scope

Feature implementation, production alerting, translation to a named market before Q-13, and a
meaningless global coverage percentage.
