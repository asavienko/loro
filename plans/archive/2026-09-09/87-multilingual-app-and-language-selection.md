# Complete bilingual review and multilingual release integration

- **Requirement IDs:** `F-08`, `F-02`, `P2-03`, `P2-31`
- **Milestone:** M1/M2 foundation and release acceptance
- **Status:** 🟡 Seven-pair UI/catalog/course/API and schema-2 foundations are implemented.
  Bilingual sign-off and all-pair physical-device/release proof remain; human review gates
  linguistic release and the device harness gates complete durability evidence. No additional
  language-selection implementation is pending.
- **Depends on:** 59 for device hydration/write-through; 61 for reviewed content publication; 72 for
  release gates. Audio/ASR/DSP are separately owned by 58/62/63/77.
- **Reviewed:** 2026-09-09 against `aafa61f`; current source, tests and retained review records
  inspected. This plan refresh supplies no new runtime, device or deployment acceptance.
- **Priority:** 9; start bilingual review alongside priority 1.

**Archive disposition (2026-09-09):** Archived at user request after implemented slices landed. The
partial status and remaining acceptance criteria are retained; archival does not mark this plan
complete. The roadmap index continues to track its unfinished scope.

## Implemented scope — retain, do not rebuild

`packages/core/src/domain/languages.ts` defines native/UI languages en/bg/ru and targets
es-ES/bg-BG/ru-RU, excluding matching native/target languages: seven pairs. `src/lib/i18n/` and
`copy.ts` provide bundled i18next/ICU resources and reactive translation. Onboarding and Languages
selection, neutral targetText/translation views, 31-phrase starters per target, learning-content API
routes and backward-compatible English/Spanish routes are implemented.

`apps/mobile/src/store/languages.test.ts`, `src/data/languages.test.ts` and `e2e/languages.spec.ts`
cover pair validation, separate durable course progress/resume, late deltas, migration and browser
flows. Forward migrations preserve atomic languagePair, target-scoped Refrain days and device-local
course checkpoints; native/browser hydration and writes are integrated.
`packages/content/src/releaseCheck.ts` rejects pending bilingual review. Runtime TTS/ASR
availability is checked on each device for the selected language; reviewed production assets and DSP
remain gated. Native EN/BG/RU plural formatting and scaled-text fixes from the Android preview are
retained.

## Review preparation delivered — 2026-09-09

`pnpm --silent --filter @loro/content review:export` exports all three bundled UI resources and
seven actual adapted course catalogs with material SHA-256 identifiers and pending reviewer records.
The [record workflow](../../../packages/content/reviews/README.md) preserves reviewer attribution,
findings, version changes and handoff expectations. `releaseCheck.ts` consumes the record named by
the current combined material digest. `reviewRecords.ts` recomputes retained payload hashes,
validates locale/course and combined identity, and requires declared reviewer languages covering
English plus the UI locale or both languages of a course. Mutation, stale-record and incomplete
approval regressions exist. The review directory currently contains no approved material record;
exporting and validator fixtures do not satisfy human or device acceptance.

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

## Delivery order and gates

1. Start reviewer coordination alongside priority 1 using the existing deterministic exporter.
   Assign coverage for all three UI locales and seven course pairs, retain actual findings/sign-off,
   and re-export changed material after fixes. Existing approvals cannot be copied to a new digest
   without reviewer confirmation. The validator/workflow is implemented; obtaining real evidence and
   integrating its release invocation with 61/72 are the next deliverables.
2. Keep the current seven-pair acceptance baseline explicit. Plan 90 owns adding English; extend
   this review matrix to the newly supported pairs only when that contract/catalog lands. Do not
   make all existing-pair sign-offs a prerequisite to implementing the English contract.
3. Hand approved artifacts to 61 and evidence to 72; use 59/58 for durability. Native capability
   checks remain per device/target and are not enabled by content sign-off.

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

## Post-main review and archive disposition — 2026-09-09

The [review at `de81744`](../../../docs/reviews/2026-09-09-post-main-plan-review.md) records this
plan's current contribution, remaining work and gates. [Delivered slices](IMPLEMENTED-SLICES.md) are
retained in the archive; this plan remains incomplete. Earlier verification is dated evidence, not
acceptance of the current combined branch.
