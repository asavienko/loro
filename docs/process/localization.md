# Localization and learning languages

**Implemented foundation (F-08, plan 87):** bundled English, Bulgarian and Russian UI; Spanish,
Bulgarian and Russian starter catalogs; language selection and separate course state. New linguistic
content awaits bilingual review. Device persistence still depends on plan 59. Audio, ASR and DSP
capabilities remain unavailable until their native implementations and language validation land.

## Language choices

| Native language / UI | Learning languages                                        |
| -------------------- | --------------------------------------------------------- |
| English (`en`)       | Spanish (`es-ES`), Bulgarian (`bg-BG`), Russian (`ru-RU`) |
| Bulgarian (`bg`)     | Spanish, Russian                                          |
| Russian (`ru`)       | Spanish, Bulgarian                                        |

The UI follows the native language. The welcome screen offers both choices before starter packs.
Languages is also reachable from Today's switcher. Settings edits are staged until Save; an invalid
matching pair cannot be saved. A first visit to another course asks for starter packs; returning to
a course preserves its collection, daily set, session and progress. Changing native language changes
catalog meanings and UI, never rewrites personal translations or resets progress. Personal meanings
retain their original language label. The activity streak remains shared across courses.

New installs detect a supported device locale, otherwise English. Explicit choices win. Existing
learners migrate as English → Spanish. An unavailable learning language is an error, never a silent
Spanish fallback.

## Interface translations

`apps/mobile/src/lib/i18n/` contains bundled `en.json`, `bg.json`, `ru.json` resources and the
synchronous i18next + react-i18next + i18next-icu runtime. expo-localization supplies the initial
language. `copy.ts` is the typed adapter: getters and functions resolve messages at access time;
React consumers subscribe with `useLocale()`. Shared components receive translated props.

- Semantic keys, named parameters, ICU plurals, no concatenated message fragments.
- `Intl` formatting follows the native/UI language; logical day keys remain language-independent.
- CI requires identical keys and interpolation arguments. English is the emergency UI fallback.
- Translations are bundled, so reading them requires no network.
- Preserve the no-shame tone, structural emoji and the effort progression as a group.
- Dense rows must accommodate expansion and Cyrillic at 200% and 310% text scale.
- Target text uses `lang="target"`; the text primitive resolves the active target locale. Native
  `accessibilityLanguage` and the explicit web `lang` attribute are both set.

## Content and service contracts

`@loro/core` owns language identities, supported pairs and the neutral catalog/teaching types.
`@loro/content` exposes `loadLearningCatalog(targetLocale, nativeLanguage)`. Each target phrase has
stable identity, `targetText`, and `translations` keyed by native language. Respelling, coaching,
glosses and contextual explanations belong to the native/target pair. Existing English → Spanish
teaching is retained; unsupported pair-specific teaching is absent.

The original Spanish JSON and `loadCatalog()` remain legacy adapters for v1 APIs and authoring
tools. New catalog access rejects unsupported pairs. Existing Spanish IDs are unchanged; Bulgarian
and Russian IDs are prefixed by target locale. Each target has 31 starter phrases, sharing pack
membership and stable theme keys. Display labels are localized; counts derive from membership.

`/v1/content/v2/{manifest,diff,pack}` accepts `target` and `native`, returning neutral field names
and explicit locale metadata. `/v1/content/{manifest,diff,pack}` retains the original
Spanish/English wire shape. AI scene requests accept `nativeLanguage` and `targetLocale`; the
current Spanish-only stub rejects other pairs rather than returning the wrong language.

## Persistence and release gates

Migration 2 preserves existing IDs, progress and outbox data. Legacy physical `own_es`/`own_en`
columns are storage compatibility names; new input/view APIs use neutral names. Own phrases record
their target and meaning language. `languagePair` has one LWW policy so concurrent settings cannot
produce an unsupported hybrid pair. Frozen daily sets key on user, target and local day.
`course_session` stores device-local resume metadata, independently of syncable phrase progress.

The running app still uses the existing in-memory store. Plan 59 must wire these repositories into
transactional hydration/write-through and prove device relaunch/offline behavior. This feature is
not a claim that device persistence has shipped.

New translations carry `pending-bilingual-review`. Review must cover meanings, naturalness,
register, gendered forms, cultural substitutions and UI tone before production release. No machine
or structural test constitutes bilingual approval. Optional unreviewed pronunciation teaching stays
absent. Production audio/ASR/DSP support remains separately gated per language.

Future languages require reviewed content and capability validation, not just another UI JSON file.
Spanish UI, English as a target, full courses and RTL-language release validation are deferred.

Before shipping multilingual courses, run `pnpm --filter @loro/content check:release`. It
intentionally rejects the pending review status; structural CI remains usable while linguistic
review is pending.
