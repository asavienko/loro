# Multilingual app and Bulgarian/Russian starter courses

- **Requirement IDs:** F-08, F-02, P2-03, P2-31
- **Status:** 🟡 UI, language contracts, starter catalogs, course state, API and schema-2
  repositories implemented. Remaining: bilingual human review and production device
  hydration/write-through (blocked on plan 59).
- **Dependencies:** 59 for durable device storage; 58/62/63/77 for validated native speech
  capabilities.

## Outcome

Native/UI languages: English, Bulgarian, Russian. Targets: Spanish, Bulgarian, Russian, excluding
matching native/target languages. Seven supported pairs; one active course with independently
preserved progress. Bulgarian and Russian each have 31 starter phrases.

## Work

1. Typed language contracts, neutral content model and backward-compatible API.
2. Bundled i18next/ICU English, Bulgarian and Russian resources and reactive copy adapter.
3. Onboarding/settings language selection and isolated course state.
4. Persistence migrations and declared merge policies; integrate with plan 59 without a second
   persistence stack.
5. Starter translations with explicit bilingual-review status; no invented speech support.
6. Translation, migration, course-isolation, accessibility and E2E checks.

## Release gates

New translations require bilingual human review. Optional unreviewed pronunciation teaching is
absent. Device relaunch/offline proof depends on plan 59; browser tests cannot certify it. No audio,
ASR or DSP capability is enabled by this plan.

## Acceptance

All seven pairs support onboarding, browse/add, practice and progress. Native changes preserve
personal meanings and progress. Target changes preserve course state; returning never reseeds.
Existing English/Spanish IDs, outbox and progress survive migration. Run pnpm check, learner E2E and
the production bundle; add every new learner-visible state to the E2E manifest.

## Implemented decisions

- Seven pairs; first install detects supported device language, existing data defaults to en →
  es-ES.
- UI resources are bundled and ICU argument/key parity is tested. Copy getters read current locale.
- Existing Spanish source JSON and v1 API are compatibility adapters; neutral core types own new
  contracts.
- Saved personal meanings retain their original language; native changes never replace personal
  text.
- One active course; inactive snapshots preserve daily set, Stream cursor and Refrain session state.
- Late practice deltas apply to their owning course through applyDelta; activity days remain shared.
- Native/target settings use atomic languagePair LWW; course resume metadata is device-local.
- No additional storage stack. Production app remains in memory until plan 59 integrates the
  repositories.
- `pnpm --filter @loro/content check:release` rejects pending bilingual review. This is an expected
  release gate, not a failure of structural development checks.

## Verification

`pnpm check` passed all 23 tasks (477 JS/TS tests); all 90 learner browser E2E tests passed,
including seven language pairs, Cyrillic accessibility and 200%/310% text scaling. The production
Expo bundle and all four production web smoke tests passed. Bilingual sign-off and device
process-death/offline checks remain gated above.

## Integration record

This branch originally used plan 85. The combined roadmap already reserves 85 for API contracts and
86 for provider integrations, so multilingual work now uses 87. Integration preserves plan 54's
completed-wave writes, plan 55's onboarding level and remove undo, and plan 84's manual practice
without speech latency. Shared navigation reads translated labels when rendered. The combined checks
include course-scoped wave persistence and target sync language fields.
