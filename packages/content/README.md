> **F-08:** `loadLearningCatalog(targetLocale, nativeLanguage)` now provides seven pairs with 31
> phrases per Spanish/Bulgarian/Russian target. New translations await bilingual review.
> `loadCatalog()` and the Spanish authoring pipeline below remain the v1 compatibility boundary.

# @loro/content

The bundled Spanish catalog: phrases, scenarios, authored graph edges, packs, and countdown drop
schedules. The package is usable by Metro, Node, and the browser and is validated in CI.

The long-term delivery model is independent content releases. **That publisher does not exist yet.**
Today the app and API consume the JSON snapshot bundled with this workspace, so a catalog change
still ships with code.

## Current inventory

Catalog version 1 currently contains:

- 31 `es-ES` phrases, 5 ordered scenarios, 15 `scenario_next` graph edges, 12 packs, and 4 drop
  schedules (3, 7, 12, and 20 days);
- 10 phrases with respellings, 1 with word glosses, and 2 with examples;
- no rendered audio, syllable timing, or native F0 references yet. When a clip exists it is a cloud
  `{uri, sha256, ms}` object (https, or local-authoring http). The device caches that URL; Listen
  export is the share option (Q-22);
- 3 empty draft packs (`local`, `pharmacy`, and `nightlife`).

The regular validator passes with 48 authoring warnings: 31 missing-audio warnings, 12 pack backlog
warnings, and 5 schedules that currently reference draft packs. `--strict` intentionally turns those
warnings into a failure.

## Layout and runtime entry points

```text
es-ES/
├── phrases.json       # catalogVersion + the 31 phrase records
├── scenarios.json     # ordered phrase arcs; order is meaningful
├── graph.json         # authored edges; seed is scenario_next only
├── packs.json         # visible promisedCount vs non-visible targetCount
└── drops.json         # schedules and the shared drop rules
schema/
├── phrase.schema.json # JSON Schema for an individual phrase
└── graph.schema.json  # JSON Schema for the authored edge list
src/
├── catalog.ts         # JSON imports; the cross-platform bundled snapshot
├── fs.ts              # Node-only disk loader for authoring tools
├── types.ts           # Catalog, phrase, pack, scenario, and drop types
├── checks.ts          # pure validation checks
├── render.ts          # Node-only catalog TTS pipeline; Metro must not import this
├── renderCli.ts       # pnpm content:render
├── catalogAudio.ts    # cloud https (or local-authoring http) identity only
├── audioDuration.ts   # container duration; never estimates from text
├── validate.ts        # validation CLI
└── index.ts           # public loadCatalog() and bundledCatalog exports
```

Import `loadCatalog` or `bundledCatalog` from `@loro/content` in cross-platform code. The package
only bundles `es-ES`; `loadCatalog()` rejects any other language rather than silently returning
Spanish. Import `@loro/content/fs` only from Node authoring code—Metro has no filesystem.

## Commands that work today

Use Node 22.

```bash
pnpm content:validate
pnpm content:gap-priority
pnpm --filter @loro/content validate --strict
pnpm --filter @loro/content validate --only packs,refs,drops
pnpm --filter @loro/content test
pnpm --silent --filter @loro/content review:export > /tmp/loro-review.json
pnpm content:render --dry-run --all
```

The package implements `content:render` (`src/render.ts`, Node-only). Stub and failed renders cannot
publish. Live ElevenLabs seed audio remains Q-15. `content:enrich` and `content:publish` are still
unimplemented.

The [bilingual review workflow](reviews/README.md) exports versioned UI and actual course material
with pending review records. Exporting is preparation, not linguistic approval.

## What validation actually enforces

| Check                     | Current behaviour                                                                                                            |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `schema`                  | Validates every phrase against `schema/phrase.schema.json`                                                                   |
| `packs`                   | Errors when `promisedCount` or visible `sub` differs from membership; warns below `targetCount` and for drafts               |
| `refs`                    | Resolves phrase references from packs/scenarios, pack references from drops, and `deprecated_by`                             |
| `audio`                   | Warns when audio is absent; errors on malformed SHA-256 values                                                               |
| `prosody`                 | Requires 14 F0 points when present and valid stress/duration values for syllables                                            |
| `duplicates`              | Rejects duplicate ids and duplicate case-insensitive Spanish text                                                            |
| `stress`                  | Requires a respelling, when present, to mark at least one stressed syllable in capitals                                      |
| `length`                  | Caps A1/A2 phrases at eight whitespace-delimited words                                                                       |
| `theme`, `emoji`, `words` | Enforces the shared theme set, one grapheme emoji, and spoken forms for punctuated word fragments                            |
| `scenarios`               | Warns outside the 4–6 phrase guideline                                                                                       |
| `drops`, `draftDrops`     | Requires a review-only final day and unique days; warns when a schedule deals a draft pack                                   |
| `graph`                   | Resolves edge ends, uniqueness of `(from,to,relation)`, no stored `same_theme`, no cross-locale pair, acyclic `prerequisite` |

Audio absence and incomplete authoring targets are warnings during early catalog construction, not
errors. Run with `--strict` when assessing release readiness.

## Extending the catalog safely

1. Add or edit source JSON in `es-ES/`; never generate a second in-app catalog.
2. Keep phrase ids immutable. A changed meaning gets a new id; the old row remains resolvable and
   points to its replacement with `deprecated_by`.
3. Update every pack/scenario/drop reference in the same change. Scenario order is the interaction
   arc, not a set.
4. Make `promisedCount` and `sub` describe membership that exists now. Use `targetCount` for the
   authoring goal; use `draft: true` only for an empty, non-onboarding pack.
5. Add or update validation tests for a new field or invariant, then run validation and package
   tests. A type alone is not runtime validation: the JSON Schema currently covers phrase rows,
   while the other files are protected by the checks and TypeScript snapshot assembly.
6. Obtain native `es-ES` review. Audio, once rendering exists, also needs a human listening pass.

Every new cross-platform consumer should read the bundled snapshot through this package. When the
independent publisher is implemented, preserve that snapshot as the offline install fallback and add
versioned/diff delivery around it rather than replacing it.
