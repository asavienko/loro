# English default and selectable content language

- **Requirement IDs:** `F-08`, `P2-03`, `P2-31`
- **Milestone:** M1/M2
- **Status:** 🟡 Shared sync language validation now derives from the existing domain registry,
  including course-day keys and catalog tombstones. English target/default integration remains
  blocked on canonical dialect confirmation; catalog release also needs bilingual review.
  Configuration readers, English catalog, bootstrap/onboarding defaults and migration remain.
- **Depends on:** 87 existing language contracts, selector, and course isolation; 85 API contracts;
  59 for durable device storage; 61 for independently delivered catalogs and ElevenLabs assets.
- **Reviewed:** 2026-09-09 against checkout `42f4d57`; source/plan review only, no new device or
  deployment acceptance.

Previous starting point: [archived snapshot](../2026-09-08/90-default-english-content-language.md).

**Archive disposition (2026-09-09):** Archived at user request after implemented slices landed. The
partial status and remaining acceptance criteria are retained; archival does not mark this plan
complete. The roadmap index continues to track its unfinished scope.

## Outcome

`CONTENT_LANG` defaults to English when unset, and users can select the content language through the
existing Languages screen. Explicit saved selections take precedence over installation defaults.
Existing course progress and personal translations survive the change.

## Current evidence and interpretation

- `apps/api/.env.example` declares `CONTENT_LANG=es-ES`; no current source reader consumes it.
- `packages/core/src/domain/languages.ts` supports native/UI `en`, `bg`, `ru` and learning targets
  `es-ES`, `bg-BG`, `ru-RU`. English is not currently a target course.
- `apps/mobile/app/languages.tsx` already selects native and target languages. Plan 87 owns the
  existing course isolation and translated UI; extend these seams rather than adding a second
  selector.
- Confirmed user decision: content language means the language of the phrases being learned,
  independently of UI/native language. English becomes a selectable target course and the default
  content language; this does not change the language of UI, translations, or explanations.

## Work

1. Specify `CONTENT_LANG` semantics in the durable language/configuration docs and update `F-08` for
   the agreed behavior. Propose canonical English content locale `en-US` (confirm dialect), accept
   `en` as an alias, and normalize to the canonical locale. Default only absent/blank configuration;
   reject unsupported explicit values with an actionable configuration error.
2. Define one supported-content-language registry shared by configuration, content tooling, API
   contracts, and app selection. Remove hard-coded Spanish defaults only where they represent a
   default; preserve explicit Spanish content identities and existing API compatibility adapters.
3. Implement the actual configuration reader and precedence: explicit request/CLI selection, then
   persisted learner selection where applicable, then configured default, then English. A server
   environment variable does not automatically reach Expo: define a public bootstrap/build setting
   and a bundled English offline default, validate both, and keep server credentials private. A
   deployment default must never silently switch an existing learner's active course.
4. Resolve English-native/English-content behavior explicitly. The existing same-language exclusion
   prevents `en` → English; preserve that rule unless product explicitly changes it. When the
   English default is incompatible, show a required choice among supported courses instead of
   silently selecting Spanish, changing the native language, or saving an invalid pair. Document
   this exception to default selection in onboarding and acceptance tests.
5. Add an English starter catalog and reviewed translations for supported native languages, with
   stable phrase/course IDs and proper locale metadata. Extend loaders, search, API schemas,
   generated contracts, validators, and reference mappings. Do not present English translations of
   Spanish phrases as an English course without catalog review.
6. Extend the existing Languages screen and onboarding with translated labels, selected state,
   validation, and save/cancel behavior. Changing selection refreshes catalog/search/practice
   content together and retains isolated progress/resume state for every course. Native/UI language
   changes remain a separate user choice; they never overwrite personal meanings.
7. Reuse plan-59 repositories and plan-87 atomic language-pair policy. Migrate missing legacy
   selections from their known existing course (Spanish for existing legacy English/Spanish data),
   not the new fresh-install default. Prevent late responses or practice deltas from crossing
   courses.
8. Extend plan 61's ElevenLabs voice mapping for English only after dialect, voice, licensing, and
   pronunciation review. Keep unsupported audio/ASR/DSP capabilities disabled; text course selection
   does not require or imply working speech synthesis.
9. Update environment examples, configuration docs, onboarding guidance, catalog-authoring commands,
   and inventory documentation after implementation. Explain restart/rebuild requirements and give
   verified examples for English default and explicit alternative language selection.

## Acceptance and verification

- Missing/blank `CONTENT_LANG` resolves to English; `en` normalizes consistently; explicit supported
  values work and unsupported values fail validation. Saved learner selections override defaults.
- A fresh supported non-English-native learner receives English content by default. An incompatible
  native/content pair requires an explicit valid selection; English UI remains independent.
- Existing learners keep their course, progress, personal meanings, and resume state. Switching away
  and back does not reseed; stale requests and deltas cannot update another course.
- API, content commands, app bootstrap, bundled offline content, and displayed selection agree on
  language. English text never receives Spanish voice metadata by fallback.
- Add meaningful configuration, catalog, migration, course-isolation, and contract tests. Add each
  new learner-visible state to `apps/mobile/e2e/states.ts` and cover default selection, overrides,
  invalid pairs, switching, accessibility, and text scaling in learner E2E.
- Run `pnpm check`, `pnpm test:e2e`, and production bundle checks. Require bilingual content review
  before release; device relaunch/offline persistence proof stays gated on plan 59.

## Implemented slice — 2026-09-09

- Sync phrase fields, settings, Refrain days and catalog tombstones derive supported language enums
  from `NATIVE_LANGUAGES` / `TARGET_LOCALES`; course-day keys use `isTargetLocale`. The app, catalog
  loader and sync contracts now share the existing registry rather than separate sync allowlists.
- Contract conformance covers the native/target matrix, all supported target boundary shapes,
  same-language exclusion, malformed course dates and legacy date-only Refrain keys.
- This is a behavior-preserving prerequisite for work item 2. It does not add an English locale,
  configuration reader, default selection, catalog or audio mapping. The generated wire contracts
  remain unchanged (`pnpm contracts:check` passed). Canonical English dialect remains an explicit
  decision gate.
- Focused sync language/provenance suites passed (10 tests). Integrated `pnpm check` and learner E2E
  remain required for delivery of the combined worktree; this slice adds no learner-visible state.

## Delivery order and gates

1. Record the canonical English dialect before freezing locale IDs, catalog identities or voice
   mappings. Keep the confirmed English-default decision; `en-US` remains a proposal until
   confirmed.
2. Deliver shared registry/configuration/API contracts first, then the reviewed starter and app
   default/selection integration. Reuse the existing durable course state, including legacy
   migration.
3. Extend 87/72's supported-pair review/test matrix in the same change. English-native learners
   still choose a different target; existing learners keep saved selections. Text implementation
   does not wait for generated audio, whose release remains with 61/62 and Q-15.

## Out of scope

Implementing this plan during its authoring, changing saved environment values now, replacing the UI
localization system, enabling live speech, or treating a language switch as progress reset.

## Integration record

Authored locally as plan 88 before refreshing main. Main already assigned 88 to AWS testing and 89
to sign-in, so this plan is published as 90. Existing assigned plan numbers are preserved.

## Post-main review and archive disposition — 2026-09-09

The [review at `de81744`](../../../docs/reviews/2026-09-09-post-main-plan-review.md) records this
plan's current contribution, remaining work and gates. [Delivered slices](IMPLEMENTED-SLICES.md) are
retained in the archive; this plan remains incomplete. Earlier verification is dated evidence, not
acceptance of the current combined branch.
