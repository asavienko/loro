# UI localization scaffolding (and why it is not the same as a new language)

- **Requirement IDs:** `F-08`-adjacent; Q-13
- **Milestone:** M3+ (scaffolding earlier is cheap; translation later)
- **Spec:** `docs/process/localization.md`
- **Size:** M (scaffolding) · L per locale

## Two different problems, deliberately separated

`docs/process/localization.md` makes the distinction and it is the important part of this plan:

1. **UI localization** — the app's chrome in the learner's language. Loro's learners are English
   speakers learning Spanish today; a Spanish learner whose first language is German needs German
   chrome.
2. **A new target language** — teaching Italian instead of Spanish. That is content, linguistics,
   voice talent, and DSP reference data. `es-419` (Latin American Spanish) is the cheap version
   because `variants[]` is already in the phrase schema, "which is what keeps this cheap later"
   (Q-13).

They share almost no work. Conflating them is how a project commits to one and delivers neither.

## Current state

Every string is hardcoded in TSX. `apps/mobile/app/practice/refrain.tsx` alone has `MODE_CUE`,
`MODE_ICON`, and inline copy; `apps/mobile/src/lib/format.ts` returns English labels from
`difficultyLabel` and `tagLabel`; the store returns English toast copy inline
(`apps/mobile/src/store/index.ts:191–197`, `213`, `218`). There is no i18n library and no string
catalogue.

## Why scaffold now even though translation is later

Retrofitting i18n across 21 screens is far more expensive than building it in. And two of this app's
copy rules are _already_ i18n concerns:

- **The Spanish/English rule.** `docs/design/copy-and-tone.md` has rules for which language appears
  where. Spanish content is **not** UI copy and must never be localized — a phrase is the thing
  being taught. That distinction has to be structural (two different string sources), not a
  convention someone remembers.
- **`lang="es-ES"` on Spanish text** is already CI-enforced
  (`pnpm --filter @loro/mobile check:lang`). That gate is, in effect, an i18n boundary check that
  already exists. Build on it.

## The work

### 1. Extract strings, with the content/UI boundary enforced

Pick a library (`i18next` / `expo-localization`, or `Intl`-based if the needs are simple) and
extract every UI string into a catalogue. Then the rule that matters: **Spanish learner-facing
content never enters the UI catalogue.** Two sources, and a lint rule or a check that a phrase's
`es` text is never passed through the translation function.

Toast copy in the store (`store/index.ts`) needs care — the store is not a UI layer, and moving copy
there was already a small layering smell. Either the store returns a message _key_ and the UI
resolves it, or the copy moves to the UI. The former is cleaner and is what makes the toast
translatable.

### 2. The things that break in other languages

Not the strings — the layout and the formatting:

- **Length.** German and Spanish UI text runs 20–40% longer than English. The blueprint's cards are
  tight, and this interacts directly with dynamic type
  ([accessibility-wcag-pass.md](35-accessibility-wcag-pass.md) §2). Test both together.
- **Pluralisation and gender** — languages with more than two plural forms break naïve `count === 1`
  logic. Use the library's plural support rather than a ternary.
- **Number, date, and duration formatting** — `Intl`, not string concatenation. `formatInterval` and
  `formatLatency` (`src/lib/format.ts`) both build strings by hand today.
- **RTL** — if any RTL locale is ever a target, layout direction has to be considered from the
  start. If not, say so explicitly rather than leaving it undecided.
- **Sorting and search** — locale-aware collation for the library, which matters once someone has
  500 phrases.

### 3. A pseudo-locale, in CI

The highest-value single item here. A pseudo-locale that lengthens every string by 40% and brackets
it (`[Añádír fráse……]`) makes truncation, hardcoded strings, and layout breakage visible **without a
translator**. Add a CI screenshot pass or a component-test run under the pseudo-locale, and most
localization bugs are caught before any locale is committed to.

### 4. Then a real locale

Only once the scaffolding holds. Translation workflow, review, and the ongoing cost of every new
string — `localization.md` should end up describing a process someone can follow.

## Acceptance criteria

- No hardcoded UI string in `apps/mobile`; a lint rule enforces it.
- Spanish learner content is structurally separated from the UI catalogue, and a check prevents it
  being translated.
- The pseudo-locale runs in CI; truncation and layout breakage fail the build.
- Plurals, dates, numbers, and durations go through `Intl` or the library, never string
  concatenation.
- Largest dynamic type × pseudo-locale: nothing clips, nothing unreachable.
- `check:lang` still passes and the i18n boundary is consistent with it.
- Q-13's separation (UI localization vs `es-419`) is reflected in the docs so the two are never
  scoped together by accident.

## Tests

- The pseudo-locale CI pass.
- Plural tests for a language with three plural forms.
- A test that a phrase's Spanish text passed to the translation function fails.
- Formatting tests under several locales.

## Risks

- **Committing to a locale before the scaffolding holds** means retranslating. Scaffolding first,
  always.
- **Ongoing cost** — every new string is a translation task forever. That is an argument for doing
  this when there is a reason (a market, a partner), not speculatively. The scaffolding is cheap;
  the locales are not.

## Out of scope

`es-419` and new target languages — content work, deferred by Q-13, and tracked in
`localization.md`.
