# Complete bilingual review and multilingual release integration

- **Requirement IDs:** `F-08`, `F-02`, `P2-03`, `P2-31`
- **Milestone:** M1/M2 foundation and release acceptance
- **Status:** 🟡 Seven-pair UI/catalog/course/API and schema-2 foundations are implemented.
  Bilingual sign-off and device/release integration proof remain; human review gates linguistic
  release and 59 gates durable device evidence. No additional language-selection implementation is
  pending.
- **Depends on:** 59 for device hydration/write-through; 61 for reviewed content publication; 72 for
  release gates. Audio/ASR/DSP are separately owned by 58/62/63/77.
- **Reviewed:** 2026-09-07 against merged baseline `2d9e8c3`.

## Implemented scope — retain, do not rebuild

`packages/core/src/domain/languages.ts` defines native/UI languages en/bg/ru and targets
es-ES/bg-BG/ru-RU, excluding matching native/target languages: seven pairs. `src/lib/i18n/` and
`copy.ts` provide bundled i18next/ICU resources and reactive translation. Onboarding and Languages
selection, neutral targetText/translation views, 31-phrase starters per target, learning-content API
routes and backward-compatible English/Spanish routes are implemented.

`apps/mobile/src/store/languages.test.ts`, `src/data/languages.test.ts` and `e2e/languages.spec.ts`
cover pair validation, separate in-memory course progress/resume, late deltas, migration and browser
flows. Schema 2 already stores atomic languagePair, target-scoped Refrain days and device-local
course checkpoints. The running app still uses memory. `packages/content/src/releaseCheck.ts`
rejects pending bilingual review; every audio/ASR/scoring capability remains false.

## Remaining work

1. [ ] Arrange independent bilingual review of UI resources, starter translations and pair-specific
       teaching fields. Track reviewer, locale/pair, catalog/resource version, findings and sign-off
       in durable content records. Correct identified language issues with tests where behavior
       changes; never mark review complete from schema/key parity alone.
2. [ ] Supply reviewed starter artifacts to plan 61 and verify
       `pnpm --filter @loro/content check:release` passes only after actual sign-off. Do not weaken
       the release check to make the current pending corpus pass or silently activate unreviewed
       pronunciation teaching.
3. [ ] Verify plan 59's integration on devices: en→es-ES legacy migration, all seven pairs, active
       target restore, preserved inactive sessions, course switching during practice,
       native-language changes, own-meaning provenance, outbox writes and global streak preservation
       across relaunch. Plan 59 owns the driver and writes; this plan owns multilingual acceptance
       evidence.
4. [ ] Feed 72's release matrix with Cyrillic, plural/interpolation, date/number and 200%/310%
       cases, accessibilityLanguage on target text, wrong-pair rejection and preserved legacy API
       behavior.
5. [ ] For future features, require selected-pair content and explicit per-target capability checks.
       Plans 60–63 own Unicode matching, voices and ASR; 76/82 own reviewed AI/topic coverage; 77
       owns scoring evidence. Unsupported speech stays unavailable/reveal-only until its owner
       passes.

## Acceptance and archive condition

- Bilingual review is attributable to real reviewers and the exact shipped resource versions.
- All seven pairs pass the same local learning flow; returning to a course never reseeds it, native
  changes preserve personal meanings, and late outcomes affect their owning course only.
- Device restart/offline evidence is supplied by plan 59; browser tests are not substituted for it.
- Structural checks, learner E2E, production bundle checks and the content release gate pass for the
  approved release set. Native capabilities remain separately gated; completing this plan does not
  enable audio/ASR/DSP or commit full courses for every target.

Archive this plan after bilingual and multilingual device/release acceptance is complete. Keep
implementation in the owning feature plans so this acceptance plan does not create a second store,
localization runtime, API or persistence stack.

## Historical integration note

Multilingual work initially used 85 on its isolated branch. The merged roadmap reserves 85 for API
contracts and 86 for providers, so its stable number is 87. The merge preserves 54's wave writes,
55's onboarding/undo, and 84's manual practice without fabricated speech latency. Historical
477-test/90-E2E counts described the isolated branch, not the current integrated baseline.
