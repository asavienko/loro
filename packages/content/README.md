# @loro/content

The content the server owns. It has two parts:

- **`v2/` — the app's seed.** Loro's phrase sets, their phrases and notes, the topics, the phrase
  bank and the languages. The API's `library` module seeds them into PostgreSQL and serves them as
  packs; the app ships none of it ([the library](../../docs/architecture/library.md)).
- **`es-ES/`, `translations/` and the bundled topic suggestions — the first app's content.** They
  serve the API's older `/v1/content`, phrase-suggest and `/v1/music` routes, which the current app
  does not call.

It also holds helpers the API uses: music style packs, roleplay scenes and audio duration.

## The app's seed: `v2/`

| File                                       | What                                                                |
| ------------------------------------------ | ------------------------------------------------------------------- |
| `phrases.json`, `sets.json`, `topics.json` | Loro's sets and their phrases (es-ES, bg-BG, en-GB, ru-RU courses)  |
| `note-translations.json`                   | The notes' Bulgarian and Russian versions                           |
| `bank.json`, `bank-note-translations.json` | The phrase bank "Make a set" draws on without an AI writer          |
| `languages.json`                           | The languages offered: which a course teaches, which the app speaks |
| `icons.json`                               | The icon names the app can draw, so a writer only picks one it has  |
| `meta.json`                                | The seed's version, its review notes and renamed phrase ids         |

The API reads them through `@loro/content/v2` (`src/v2.ts`). Their shapes are the app's
(`apps/mobile/src/shared/content/schema.ts`): the app's unit tests validate every file
(`src/shared/content/validate.ts`) and load them as the packs the API would serve
(`content/fixture.ts`). `src/v2.test.ts` holds `languages.json` equal to `@loro/core`'s library
languages. `meta.json` records what still awaits native review.

## The Spanish catalog: `es-ES/`

`es-ES/` holds 31 phrases, 5 scenarios, the `scenario_next` graph edges, 12 packs (3 of them empty
drafts) and 4 drop schedules, with JSON Schemas in `schema/`. `loadCatalog()` returns it and rejects
any other language. `loadLearningCatalog(targetLocale, nativeLanguage)` projects it onto the seven
pairs of `@loro/core`'s `supportsPair`, with starter translations and labels from `translations/`;
pairs other than English → Spanish are marked `pending-bilingual-review`. Import `@loro/content/fs`
only from Node authoring code.

```bash
pnpm content:validate                                   # errors fail; warnings are expected
pnpm --filter @loro/content validate --only packs,refs  # chosen checks, comma-separated
pnpm --filter @loro/content validate --strict           # warnings fail too (fails today)
pnpm content:gap-priority                               # what to author next
pnpm content:render --dry-run --all                     # TTS render estimate (Node only)
```

The package's tests (`pnpm --filter @loro/content test`, part of `pnpm check`) fail on any
validation error. The validator currently reports 48 warnings: missing audio, unfilled packs and
schedules that deal draft packs.

| Check                     | What it enforces                                                                                                             |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `schema`                  | Every phrase against `schema/phrase.schema.json`                                                                             |
| `packs`                   | `promisedCount` and visible `sub` match membership; warns below `targetCount` and for drafts                                 |
| `refs`                    | Phrase references from packs and scenarios, pack references from drops, `deprecated_by`                                      |
| `audio`                   | Warns when audio is absent; errors on a malformed SHA-256                                                                    |
| `prosody`                 | 14 F0 points when present; valid syllable stress and duration                                                                |
| `duplicates`              | No duplicate ids or duplicate case-insensitive Spanish text                                                                  |
| `stress`                  | A respelling marks at least one stressed syllable in capitals                                                                |
| `length`                  | A1/A2 phrases have at most eight words                                                                                       |
| `theme`, `emoji`, `words` | The shared theme set, one grapheme emoji, spoken forms for punctuated word fragments                                         |
| `scenarios`               | Warns outside four to six phrases                                                                                            |
| `drops`, `draftDrops`     | A review-only final day and unique days; warns when a schedule deals a draft pack                                            |
| `graph`                   | Edge ends resolve, `(from, to, relation)` is unique, no stored `same_theme`, no cross-locale edge, `prerequisite` is acyclic |

Phrase ids are immutable: a changed meaning gets a new id, and the old row stays resolvable with
`deprecated_by`. Update every pack, scenario and drop reference in the same change.

`content:enrich` and `content:publish` have no implementation. The bilingual review export and its
release gate are described in [`reviews/`](reviews/README.md).
