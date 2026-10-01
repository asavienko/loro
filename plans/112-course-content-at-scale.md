# Course content at scale: 10,000 phrases per course, A1–C2

- **Requirement IDs:** `CC-01` (10,000 phrases per course across A1–C2, measured by the coverage
  report), `CC-02` (levels A1–C2, and the learner chooses where to start), `CC-03` (notes download
  per set and stay offline once fetched), `CC-04` (machine-readable provenance and review status,
  shown honestly); also `F-03`, `AS-01`, `AI-06`, `LIB-01`
- **Milestone:** Course content
- **Status:** — Ready to start. Phase 0 (infrastructure, no new content) comes first; nothing is
  generated until the pilot's gate (phase 1) is defined and its keys and budget are in place.
- **Owner request, 2026-10-01:** "at the end I want to get at least 10 000 phrases for each language
  in all languages with different difficulty covering the different topics levels, aspects, words,
  rules, situations, times"
- **Owner decisions, 2026-10-01:** levels A1–C2; every phrase keeps its glosses and all three notes,
  translated into every interface language, but notes leave the pack and download per set; DeepSeek
  V4.1 Flash on Fireworks writes the content as an offline script, and its output is marked
  unreviewed; ElevenLabs clips are pre-rendered by a budgeted, resumable backfill, level by level.
  Recorded in [ADR-0016](../docs/architecture/adr/0016-course-content-at-scale.md).
- **Depends on:** plan [106](106-connected-app.md) (the library, packs and speech), plan
  [111](111-open-model-providers.md) (the DeepSeek transport).

## Outcome

Each of the seven courses (es-ES, bg-BG, en-GB, en-US, ru-RU, pl-PL, cs-CZ) teaches at least 10,000
phrases, 70,000 in all, graded A1 to C2 and planned before they are written: a syllabus per language
names its topics and situations, grammar points (tenses, aspects, moods, cases, constructions,
registers) and vocabulary by band, and a committed coverage report shows how much of it the phrases
cover. Every phrase has its translations into the interface languages, word glosses and the three
notes; a learner downloads a course's phrases by level and a set's notes when they open it, so the
app stays fast and works offline. Every clip is rendered before anyone plays it. Nothing claims a
native speaker checked what none has.

Today each course has about 20 phrases (146 in 36 sets, 3 topics, A1 and A2 only), and every layer
assumes that size: the pack is one AsyncStorage string per course, rewritten whole, whose version
hashes the whole body; the API bundles `@loro/content`'s JSON into `dist/main.js`; the seed deletes
and re-inserts every Loro row with an O(n²) lookup; the content rules are O(n²) and live in the app;
the phrase id pattern allows 99 ids per prefix; every Loro set gets a song; Explore and Home render
every set without virtualization. One phrase is about 2 KB plus 0.6 KB of English notes and 2.7 KB
of note translations, so 10,000 phrases are about 50 MB per course and 370 MB in all as JSON.

## Decisions

- **The syllabus decides what is written.** Generation fills slots in a committed plan built from
  the syllabus, not open-ended prompts; the coverage report measures the result against the same
  syllabus.
- **Difficulty is structure, vocabulary and register, not length.** Every phrase stays sayable in
  one breath (P3-01): at most 110 characters, and 7 to 14 words by level.
- **Sharded JSONL in Git, compiled outside the API bundle.** Content stays reviewable and diffable
  in this repository; the API reads a compiled bundle from disk. Raw model output, caches and logs
  are never committed. A size budget in `content:validate` keeps the repository honest (ADR-0016
  says when content moves to its own repository).
- **Index, level shards and per-set notes.** The pack splits into a small course index, one
  immutable phrase shard per level without notes, and one notes response per set in the learner's
  language. The app stores each in its own file (IndexedDB on the web), never AsyncStorage.
- **Ids never vanish.** FSRS progress and learners' sets reference Loro phrases by id; a shipped id
  stays forever or is renamed through `renamedPhraseIds`, enforced by `v2/ids.lock`.
- **The writer is offline.** DeepSeek runs from a CLI with a cache, a budget ceiling and resumable
  slots; the server never generates course content at runtime.
- **Rules beat the model where rules exist.** Spanish IPA comes from `transcribeSpanish`, Bulgarian
  from `transcribeBulgarian` where `knownStress` covers every word; Polish and Czech have fixed
  stress and can gain transcribers the same way. Model IPA is flagged and reviewed first.
- **Every number stays real.** Counts in Explore come from the index; the level choice is the
  learner's own pick, with no estimated placement score.

## Scope

### 1. Curriculum

New under `packages/content/v2/`:

- `taxonomy/topics.json` (replaces `topics.json`): about 36 topics shared by all courses, from
  greetings, eating out, shopping and health to work, media, politics, law, negotiation,
  storytelling, idioms and debate. Each has 4–8 situations (about 220), localized into every
  interface language, with an icon, a tone and the levels it fits. `eating-out`, `getting-around`
  and `everyday` keep their ids.
- `taxonomy/functions.json`: about 40 communicative functions (request, apologise, complain, hedge,
  narrate, speculate…). Tags become an open vocabulary checked against it, replacing the 7-value
  enum.
- `syllabus/<lang>.json`: phrase targets, word bounds and topic weights per level, the curated song
  sets, and a grammar inventory of 60–110 points
  `{id, level, kind: tense|aspect|mood|case|construction|register|evidential, rule, minPhrases, prerequisites}`.
  Each language has its own:
  - **es-ES:** ser/estar; perfecto vs indefinido; imperfecto; subjunctive, present and imperfect;
    si-clauses; periphrases; por/para; clitics; se.
  - **bg-BG:** the definite article; clitic doubling; да-constructions; aspect pairs; aorist and
    imperfect; future in the past; renarrative, conclusive and dubitative moods; the counting form.
  - **ru-RU:** six cases staged by level; aspect; verbs of motion; numeral government; short
    adjectives; -ся; impersonal constructions; participles and gerunds from C1.
  - **pl-PL / cs-CZ:** seven cases staged by level; aspect; verbs of motion; the vocative; numeral
    government; Polish virile forms and Czech conditional (bych/bys); participles from C1.
  - **en-GB / en-US:** tenses and aspect; the present perfect (British and American usage apart);
    modals; conditionals 0–3 and mixed; passive; reported speech; question tags; phrasal verbs by
    band; inversion and clefts. Spelling and vocabulary follow each variety.
- `syllabus/vocab/<lang>.tsv`: lemma, part of speech and CEFR band. Only derived bands are
  committed, with attribution in `syllabus/SOURCES.md`; licences are settled under Q-25. Oxford 3000
  and the English Vocabulary Profile are not used.
- `plan/<lang>.json`: the generated, committed manifest, one slot per set
  `{setId, level, topic, situation, grammarFocus[2–3], lemmaTargets[~15], functions[], count: 12, slotHash}`.
  A greedy allocator brings every grammar point to its `minPhrases` at its level and back again at
  later levels.

Per course:

| Level | Phrases | Sets (≈12 each) | Max words |
| ----- | ------- | --------------- | --------- |
| A1    | 1,500   | ≈125            | 7         |
| A2    | 2,000   | ≈167            | 9         |
| B1    | 2,500   | ≈208            | 11        |
| B2    | 2,000   | ≈167            | 14        |
| C1    | 1,400   | ≈117            | 14        |
| C2    | 600     | ≈50             | 14        |

About 834 sets per course, 5,840 in all.

### 2. Data model

- **Levels A1–C2 everywhere:** `LevelSchema` in `packages/core/src/api/library.ts`, `setSchema` in
  `apps/mobile/src/shared/content/schema.ts`, `apps/api/src/library/library.types.ts`,
  `apps/mobile/src/shared/api/library.ts`, `nav/routes.ts`, `LEVELS` in `ExploreScreen.tsx`,
  `V2Set.level` in `packages/content/src/v2.ts`, level names in `src/shared/copy/`. The database
  column is text; the OpenAPI specs are regenerated.
- **Ids:** legacy ids stay. New phrase ids are `<lang2>-<7 base32>`, a hash assigned once and never
  recomputed; set ids `set-<lang2>-<level>-<situation>[-n]`; `v2/ids.lock` lists every shipped id.
- **New fields:** a set gains `situation`, `grammarFocus[]`,
  `provenance {writer, provider, run, promptVersion}` and `song?`; a phrase gains `grammar[]`,
  `functions[]` and `lemmas[]`. Review status is joined at build time from `v2/reviews/<lang>.jsonl`
  and sent as `review` on the wire.
- **Source layout** (replaces `phrases.json`, `sets.json` and `note-translations.json`):

  ```
  v2/courses/<lang>/<level>/<topic>.sets.json
  v2/courses/<lang>/<level>/<topic>.phrases.jsonl   (no notes)
  v2/notes/<lang>/<level>/<topic>.jsonl             ({id, notes, noteTranslations})
  ```

- **Loader:** `packages/content/src/v2.ts` keeps `V2_CONTENT` for small consumers, built by a new
  `loadV2Content({ notes?, langs? })` that reads files with `fs`. `build:course` compiles the shards
  into `dist/course/<lang>.ndjson.gz` and a `manifest.json` with a hash per course and level. The
  API reads them from `LORO_CONTENT_DIR`; `apps/api/scripts/build.mjs` stops inlining course JSON.

### 3. Generation (offline, DeepSeek on Fireworks)

In `apps/api/src/authoring/`, which `main.ts` never reaches, so the server bundle never carries it.
It reuses `textModel(budget)` (`apps/api/src/integrations/models.ts`: Fireworks, then OpenRouter,
JSON-schema answers), the wording of `phrasesPrompt()` and `notesBrief()` (`library/writers.ts`),
the transcribers and rules in `library/notes/`, and the validators exported by `@loro/content`.
Scripts: `author:plan`, `author:estimate`, `author:run`, `author:status`, `review:export`,
`review:import`, `audio:backfill`.

A slot (one set) is accepted only when every stage passes:

1. **Phrases:** 15 candidates for 12 places, each with translations, glosses, icons, register,
   claimed grammar ids, lemmas and functions, plus the set's title and subtitles. An avoid-list of
   sibling and bank text keys prevents repeats.
2. **English notes:** mnemonic, grammar (grounded in the claimed point's rule) and pronunciation.
   Rule transcribers replace model IPA where they cover the phrase; otherwise `ipaSource: 'model'`.
3. **Note translations** into every interface language but the phrase's own, one call per set.
4. **Judge:** naturalness, faithfulness, level fit, grammar claim, glosses. On everything in the
   pilot, sampled afterwards; two failures reject a phrase, one sends it to review.

Deterministic checks (`packages/content/src/v2/checks/`): the schema; word and character bounds per
level; the script (Latin or Cyrillic); glossed words present in the phrase; text-key duplicates
across course and bank, and near-duplicates (token Jaccard ≥ 0.8); at least 85% of lemmas at or
below the level's band; grammar ids known and at or below the set's level; the IPA character set;
icons in `icons.json`; a safety blocklist.

`author:run --lang --level --stage --limit-usd --concurrency 6` caches every request by prompt hash
in a gitignored `.cache/authoring/` (a rerun spends nothing), retries with backoff on
`rate_limited`, `capacity` and `timeout`, keeps full logs locally and commits a summary
`v2/runs/<runId>.json`. Prices live, dated, in `authoring/pricing.json`.

**Estimate:** about 5,840 sets × 4 calls ≈ 24k calls and 400M tokens; at today's assumed Fireworks
prices about $300–900, and about 40 hours of wall time at concurrency 6, spread across phases.

### 4. Validation at scale

- `phraseSchema`, `setSchema`, `contentProblems`, `bankProblems` and `textKey` move from
  `apps/mobile/src/shared/content/schema.ts` to `packages/content/src/v2/`, and both rule functions
  become O(n) with maps from phrase to set, topic and theme. The app keeps type-only wire types; its
  `content.test.ts` checks its fixture and the wire shape.
- `content:validate --only v2` streams the shards: schema, cross-file rules, `ids.lock`, the
  repository size budget and the checks above. It stays in `pnpm check`, under 10 s for 70k phrases.
- `pnpm content:coverage` writes `v2/coverage/<lang>.{md,json}` (committed, drift-checked): phrases
  per level against target; each grammar point against `minPhrases`; tense, aspect, mood and
  register counts; lemma use per band; topics × levels; review status and IPA source.
  `--gate phaseN` runs in `ci:local`.

### 5. Delivery

API: migration `018_course_artifacts` (precompressed blobs, `content_hash` on `library_phrases` and
`library_sets`) and three routes:

| Route                                                  | Contents                                                         | Per course, gzip       |
| ------------------------------------------------------ | ---------------------------------------------------------------- | ---------------------- |
| `GET /v1/library/course/:lang`                         | Index: sets, phrase ids, real counts per level, taxonomy, review | ≈80 KB                 |
| `GET /v1/library/course/:lang/phrases/:level?v=`       | One immutable level shard, without notes                         | 0.5–1 MB; ≈5 MB in all |
| `GET /v1/library/course/:lang/notes/:setId?v=&native=` | One set's notes, English plus the learner's language             | ≈5 KB                  |

`/v1/library/pack?shape=2` becomes the learner's personal pack plus `course.version`. Older builds
(no `shape`) get the legacy pack, limited to sets marked `legacy`, so their AsyncStorage value stays
small.

App:

- **Storage:** `src/shared/api/contentStore.ts` (IndexedDB on the web) and
  `src/platform/contentStore.ts` (`expo-file-system`, already a dependency; a `NATIVE` entry in
  `metro.config.js`), one key per shard; `loro.content.pack.<lang>` is migrated once and removed.
- **Install:** `src/shared/content/index.ts` installs index, shards, notes and personal pack
  incrementally, keeping `phraseById`, `setById`, `phraseIdsByCourse` and `setIdsByLevel`.
- **Notes:** `Phrase.notes` becomes optional behind `ensureNotes(setId)`; the notes sheet shows a
  loading state, and calm copy offline.
- **What downloads:** always the index; the learner's level and the one above; every level holding a
  set they started; other levels when opened; a set's notes when it is opened, and the next set's
  ahead. A content change downloads only the shards whose versions changed.

### 6. API seed

In `apps/api/src/library/library.service.ts` (`seed`, `seedPhrases`, `seedAlbums`): read the
compiled bundle; upsert by `content_hash` in batches of 1,000 (`jsonb_to_recordset`, `ON CONFLICT`)
and delete only ids that have gone; register speech in bulk with `registerSpeechMany` (`speech.ts`);
rebuild only changed artifacts; index `library_sets(origin, target_lang, level)`. Songs only for
sets marked `song: true`, at most 20 per album. Targets: a cold seed under 90 s, a no-change reseed
under 2 s.

### 7. App performance and UX

- **Explore:** `FlatList` grids and lists; level chips A1–C2; topic → situation → sets; counts from
  the index.
- **Search:** a lazily built token-prefix index per installed shard, debounced; notes searched only
  where downloaded.
- **Home "Not started":** at most 6 recommended sets at the learner's level, then "See all".
- **Selectors** (`src/shared/state/selectors.ts`, `catalog.ts`) walk the phrases the learner has
  touched through the indexed maps, not the whole course; a test proves old and new selectors give
  identical numbers on a synthetic 10k course.
- **Level choice:** "Where to start" in onboarding and Settings, stored as `profile.startLevel`
  (last writer wins, declared in `merge.ts` and `sync-protocol.md`).

### 8. Audio backfill

`pnpm --filter @loro/api audio:backfill --lang --level --max-chars --max-usd --concurrency 3 --dry-run`,
a separate esbuild entry run in the API container on EC2. `renderAndStore()` is extracted from
`SpeechService` so the route and the backfill share one path; the backfill has its own usage key and
ceiling. Order: level, set, phrase; targets first, then prompts by how many learners use each
interface language. It skips rows with `audio_id`, and backs off on 429.

**Cost:** targets alone are about 70k clips, 3.5M characters, roughly $600–800; with every prompt
language about 400k clips, 18M characters, $2,700–4,000. A1 and A2 targets are about a quarter of
the first figure; the pilot about $25. **Storage:** speech moves to `mp3_44100_64`, with the format
in the `?v=` hash; clip bytes move from PostgreSQL to S3 (content-addressed) before passing 2 GB.

### 9. Native review (Q-23)

`v2/reviews/<lang>.jsonl` holds
`{phraseId, contentHash, reviewer, date, verdict: ok|fixed|reject, fields, comment}`; an edit makes
a review stale. Stratified acceptance sampling per course and level: 5% of each batch, at least 60
phrases; a batch passes at 3% or fewer critical errors, otherwise its topic gets a full review or is
regenerated. Model IPA and judge flags come first. A set shows as reviewed only when all its phrases
are; otherwise it carries "Written by AI. No native speaker has checked it." in every interface
language.

## Phases

Every commit leaves `pnpm check` green. Content lands one course and level per commit
(`content(content): A2 Spanish, 2,000 phrases (CC-01)`) with its coverage report, never with code.

0. **Infrastructure, no new content.**
   - 0a. This plan, ADR-0016, the `CC-*` requirements, Q-25 and the notes on Q-15, Q-21 and Q-23.
   - 0b. Levels A1–C2 and the contracts.
   - 0c. The 146 phrases migrated to shards; loader, build, O(n) validators, `ids.lock`, taxonomy,
     seven syllabi, vocabulary bands, coverage report.
   - 0d. API: migration 018, the diff seed, artifacts, the three routes, `shape=2`, the legacy cap,
     curated albums.
   - 0e. App: content store, shards, lazy notes, levels and level choice, virtualized Explore, the
     Home cap, indexed selectors.
   - 0f. The authoring CLI and the backfill, tested against a fake `StructuredTextModel` and the
     stub TTS.
   - 0g. A synthetic 10k-per-course fixture, generated in tests, never committed, benchmarked in
     `ci:local`.
1. **Pilot: 500 A1 phrases per course.** The judge on everything; about 100 per course to a native
   reviewer; prompts and checks tuned. Go/no-go: at most 5% critical errors, at most 25%
   deterministic rejects, cost within the estimate. Pilot audio.
2. **A1 and A2 to 3,500 per course,** with their audio and coverage gate `phase2`.
3. **B1 and B2 to 8,000 per course;** clip storage on S3.
4. **C1 and C2 to 10,000 per course;** the final coverage gate, and Q-23 sampling complete at every
   level.

## Verification

- **Phase 0:** `pnpm check` and `pnpm ci:local` (contracts and OpenAPI drift,
  `library.postgres.test.ts` extended for the diff seed and artifacts); synthetic benchmarks
  (validation under 10 s, cold seed under 90 s, reseed under 2 s, index under 100 KB gzip); old and
  new selectors agree; the web build on IndexedDB; an old build's pack stays small; shard install
  and Home render times on an Android development build.
- **Phase 1:** run summaries (cost, rejects), native verdicts imported, coverage `phase1`, A1 audio
  heard on a device, notes readable in airplane mode after opening a set.
- **Phases 2–4:** each phase's coverage gate; validation time and the size budget; seed time on EC2;
  shard sizes recorded in `docs/architecture/library.md`; backfill totals within the ceiling; the
  Q-23 pass rate; learner state against the 3.8 MB sync cap for a learner who touched 10k phrases.

## Risks

- **Repository size:** about 370 MB of JSONL, roughly 70–90 MB packed, plus regeneration churn.
  Never commit raw output; enforce the size budget; move content to its own repository when ADR-0016
  says.
- **DeepSeek in Bulgarian, Russian, Polish and Czech:** aspect, cases, renarrative forms and stress
  are the weak spots. The judge, the pilot gate, language-specific checks and stratified native
  sampling answer them.
- **IPA:** Spanish exact by rule, Bulgarian where `knownStress` covers the phrase; English, Russian,
  Polish and Czech flagged for review until transcribers exist.
- **Audio cost** grows with every prompt language; targets go first, prompts by demand.
- **Licences of frequency lists:** Q-25.
- **Bank collisions:** where the course and the bank share a phrase, the course wins and the bank
  phrase is replaced.
- **Older app builds:** the legacy pack cap keeps them working.
