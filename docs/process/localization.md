# Localization

Two completely different problems that get confused with each other:

|                                                                | Effort | v1                        |
| -------------------------------------------------------------- | ------ | ------------------------- |
| **UI localization** — translating Loro's interface             | Weeks  | Prepared for, not shipped |
| **A new target language** — teaching French instead of Spanish | Months | No                        |

The first is a translation project. The second is a product.

---

## UI localization

English-only in v1, but every string goes through ICU message format from day one. Retrofitting i18n
into 21 screens is far more expensive than doing it now.

### Setup

```
apps/mobile/src/i18n/
├── index.ts              # i18next + expo-localization
├── en.json               # the source
└── <locale>.json         # translations
```

```ts
t('refrain.lockedIn.title') // "Locked in for today"
t('stream.toast.difficult') // "Difficult — repeats more, comes back sooner"
t('progress.mastery.count', { count: 12 }) // plural-aware
t('trip.countdown.daysToGo', { days: 12 })
```

### Rules

1. **No string literals in components.** Lint-enforced.
2. **Keys are semantic paths**, not English text — `refrain.lockedIn.title`, not
   `Locked_in_for_today`.
3. **ICU plurals from the start.** `{count, plural, one {# phrase} other {# phrases}}`. Spanish,
   Polish, and Arabic all disagree with English here.
4. **No string concatenation.** One message with placeholders, always — word order differs by
   language.
5. **Numbers and dates through `Intl`**, never hand-formatted.
6. **Allow for 40% expansion.** German and Finnish are long, and the blueprint's rows are tight.
7. **RTL-ready layout** — logical properties (`start`/`end`), never `left`/`right`.

### Three things that are not UI strings

This is the distinction that makes Loro's i18n unusual, and getting it wrong would break the
product.

**Spanish content is content, not UI.** `es`, `en`, `resp`, glosses, examples, hooks all live in
`packages/content`, keyed by language pair. They are never touched by UI translation.

**The Spanish celebrations stay Spanish.** _"¡Hola! I'm Loro"_, _"¡Hecho!"_, _"¡Escena
completada!"_, _"¡BIENVENIDO A MADRID!"_ are target-language content used as emotional punctuation
([`../design/copy-and-tone.md`](../design/copy-and-tone.md#5--spanish-first-for-feeling-english-for-meaning)).
A German UI still says _"¡Hecho!"_, then explains in German.

**The pronunciation coaching is language-pair-specific.** _"Say 'ba-nyo'"_ only helps an English
speaker; _"the double rr needs a real roll"_ assumes the learner's L1 lacks a trill. Every fix
template is keyed by `(target_language, ui_language)` and needs re-authoring per pair, not
translating
([`../architecture/prosody-dsp.md`](../architecture/prosody-dsp.md#5--feedback-selection)).

### Translator notes

Three cases need explicit notes, or a translator will get them wrong:

1. **The effort ladder** — _"warming up" → "getting smoother" → "quick & smooth" → "instant &
   smooth"_ is a **progression**, not four independent strings. It ships as a group with a note to
   preserve the escalation.
2. **The tone rules** — no shaming, no unspecific praise, no exclamation marks in chrome
   ([`../design/copy-and-tone.md`](../design/copy-and-tone.md#what-we-never-write)). A translator
   producing _"Toll gemacht!"_ has broken a product rule.
3. **Emoji are structural**, not decorative. They carry row identity and must not be dropped or
   substituted.

### Candidate UI locales, in order

`es` (learners often prefer a Spanish UI) · `de` · `fr` · `pt-BR` · `it` · `ja` · `ko`.

**`es` first is counter-intuitive but right:** intermediate learners frequently switch the UI to
their target language, and it's also the cheapest quality check — a Spanish UI with bad Spanish is
immediately obvious.

---

## Adding a target language

Teaching French instead of Spanish is a **project**, not a configuration change. The architecture is
ready; the linguistic and content work is not.

### What's already language-agnostic

| Ready                             | Why                                                                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Data model                        | `lang` on every phrase; catalog files per locale ([`../architecture/data-model.md`](../architecture/data-model.md)) |
| All five practice engines         | Selection and sequencing have no Spanish in them                                                                    |
| FSRS, ladder, automaticity        | Language-independent                                                                                                |
| Sync, offline, trips              | Unaffected                                                                                                          |
| Design system, motion, components | Unaffected                                                                                                          |
| DSP pipeline **structure**        | F0, MFCC, DTW are language-agnostic                                                                                 |
| Content pipeline **structure**    | Render, extract, validate, publish                                                                                  |

### What is not

| Needed per language                      | Effort     | Notes                                                                                                                    |
| ---------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------ |
| **~600 phrases, authored and reviewed**  | 6–10 weeks | The bulk of it. Needs a native content lead                                                                              |
| Themes, scenarios, packs, drop schedules | 2 weeks    | Culturally specific — a French café interaction differs from a Spanish one                                               |
| A TTS voice, evaluated and chosen        | 1 week     | One voice, forever ([content-authoring.md](content-authoring.md#4--render-and-extract))                                  |
| **Syllabification + stress rules**       | 2–4 weeks  | Spanish is regular; French elision and liaison are not. This is the hard one                                             |
| IPA mapping and respelling conventions   | 2 weeks    | `resp` is for an English-speaker's eye and differs entirely per language                                                 |
| **Pronunciation coaching templates**     | 2 weeks    | Per `(target, ui)` pair. Requires phonetic expertise                                                                     |
| ASR availability check                   | 1 week     | On-device support varies by language and platform ([ADR-0005](../architecture/adr/0005-on-device-asr-cloud-fallback.md)) |
| Roleplay prompt + 24 fallback scenes     | 2 weeks    |                                                                                                                          |
| DSP re-validation with native speakers   | 2 weeks    | The ≥80% agreement gate, again ([`../architecture/prosody-dsp.md`](../architecture/prosody-dsp.md#validation))           |
| Store listings, screenshots, ASO         | 1 week     |                                                                                                                          |

**Realistic total: 4–6 months per language**, dominated by content authoring and the phonetic work.

### The cheap one: `es-419`

Latin American Spanish is a _variant_, not a new language:

- Same syllabification, stress, and IPA machinery.
- Same coaching templates.
- Same ASR support.
- **Needs:** a variant voice, ~200 phrase substitutions (`el cortado` → `el café con leche`,
  `vosotros` → `ustedes`, `coger` → `tomar`), and variant-specific scenarios.

**Realistic total: 4–6 weeks**, and it's probably a larger market than `es-ES`. This is the first
localization to do, and it's why `variants[]` is already in the phrase schema
([`../product/content-model.md`](../product/content-model.md#enrichment-fields--optional-but-they-carry-most-of-the-value)).

### Sequencing

If we do this, the order should be:

1. **`es-419`** — cheapest, largest incremental market, proves the variant machinery.
2. **UI localization** to `es` and one other — proves the i18n pipeline at low risk.
3. **One new target language** (probably French or Italian — regular-ish phonology, large learner
   base).

Attempting step 3 before steps 1 and 2 would mean discovering the pipeline's language assumptions
the expensive way.

---

## Right-to-left

Not needed for any candidate language, but layout is written RTL-ready anyway because retrofitting
it is expensive:

- Logical properties (`marginStart`, `paddingEnd`), never `left`/`right`
- No direction-dependent icons except where genuinely directional (the `‹` back chevron flips; `♪`
  doesn't)
- Charts and contours **do not flip** — a pitch contour reads left-to-right as _time_, in every
  language
- Text alignment via `start`/`end`

The chart rule is worth noting: time flows left-to-right universally in data visualisation, and
mirroring a pitch contour would make it wrong rather than localised.
