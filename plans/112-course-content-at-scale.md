# Course content at scale: 10,000 phrases per course, A1–C2, written pair by pair

- **Requirement IDs:** `CC-01` (10,000 phrases per course across A1–C2, measured by the coverage
  report), `CC-02` (levels A1–C2, and the learner chooses where to start), `CC-03` (notes download
  per set and stay offline once fetched), `CC-04` (machine-readable provenance and review status,
  shown honestly), `CC-05` (content is written in batches per language pair; accepted content is
  never rewritten without an explicit, recorded request, and adding a language adds to it without
  touching what exists); also `F-03`, `AS-01`, `AI-06`, `LIB-01`
- **Milestone:** Course content
- **Status:** 🟡 The `phrases`, `judge`, `translate` and `judge-translate` stages of the writer
  exist (`apps/api/src/authoring/`, 0f in part) and wrote three Spanish A1 sets, with Russian for
  all three, Polish for two and Bulgarian for one, and three Polish A1 sets with Russian, on
  2026-10-02 (see "Spike result" and "Spike result: pl-PL"). Left: the rest of phase 0 (0b, 0c, 0d,
  0e, 0g; the other stages, batches, status and regenerate of 0f) and the spike in the other five
  courses. Phase 1 (the pilot batch) is ⛔ until a native reader per pilot language is named (Q-23)
  and the first pairs and topics are chosen; the vocabulary bands (0c) wait on Q-25.
- **Owner request, 2026-10-01:** "at the end I want to get at least 10 000 phrases for each language
  in all languages with different difficulty covering the different topics levels, aspects, words,
  rules, situations, times"
- **Owner decisions, 2026-10-01:** levels A1–C2; every phrase keeps its glosses and all three notes,
  translated into every interface language, but notes leave the pack and download per set; DeepSeek
  V4.1 Flash on Fireworks writes the content as an offline script, and its output is marked
  unreviewed; ElevenLabs clips are pre-rendered by a budgeted, resumable backfill, level by level.
  Recorded in [ADR-0016](../docs/architecture/adr/0016-course-content-at-scale.md).
- **Owner decisions, 2026-10-02:** content is written in small batches, each for chosen language
  pairs (target course × interface language) and chosen topics; every set has a brief that says
  which words to use, which to avoid, what to mention and what not to; accepted content is never
  regenerated unless explicitly asked; writing a missing interface language adds to the existing
  content and rewrites nothing else. Recorded in
  [ADR-0017](../docs/architecture/adr/0017-content-per-language-pair.md).
- **Depends on:** plan [106](106-connected-app.md) (the library, packs and speech), plan
  [111](111-open-model-providers.md) (the DeepSeek transport).

## Outcome

Each of the seven courses (es-ES, bg-BG, en-GB, en-US, ru-RU, pl-PL, cs-CZ) teaches at least 10,000
phrases, 70,000 in all, graded A1 to C2 and planned before they are written: a syllabus per language
names its topics and situations, grammar points (tenses, aspects, moods, cases, constructions,
registers) and vocabulary by band; every set has a brief; a committed coverage report shows how much
of the syllabus the phrases cover and for which interface languages. The content grows one batch at
a time (a course, some interface languages, some topics, a level), and a batch already written is
left alone by every later one. Every phrase has its translations and word glosses in the interface
languages it has been written for, and the three notes in each; a learner downloads a course's
phrases by level in their own language and a set's notes when they open it, so the app stays fast
and works offline. Every clip is rendered before anyone plays it. Nothing claims a native speaker
checked what none has.

Today each course has about 20 phrases (146 in 36 sets, 3 topics, A1 and A2 only), and every layer
assumes that size: the pack is one AsyncStorage string per course, rewritten whole, whose version
hashes the whole body; the API bundles `@loro/content`'s JSON into `dist/main.js`; the seed deletes
and re-inserts every Loro row with an O(n²) lookup; the content rules are O(n²) and live in the app;
the phrase id pattern allows 99 ids per prefix; every Loro set gets a song; Explore and Home render
every set without virtualization; the learner's progress log only grows, against a 3.8 MB sync cap
(`MAX_PROGRESS_BYTES`). One phrase is about 2 KB plus 0.6 KB of English notes and 2.7 KB of note
translations, so 10,000 phrases are about 50 MB per course and 370 MB in all as JSON.

## Decisions

- **The syllabus decides what is written.** Generation fills slots in a committed plan built from
  the syllabus, not open-ended prompts; the coverage report measures the result against the same
  syllabus.
- **Every set has a brief.** The slot carries the scene, the speakers and register, the words that
  must appear (`mustUse`), the words and themes that must not (`avoid`), the grammar to show with
  its rule, what to mention (facts, culture, variety) and what not to mention (`doNotMention`). The
  brief is human-editable, part of the prompt, hashed into provenance, and checked after writing.
- **Content is written per language pair, in batches.** A batch names a course, one or more
  interface languages, topics and a level, and a budget. A phrase is written once in its target
  language with English as the pivot; each further interface language is a separate, additive stage
  that fills only what is missing. A course is published to an interface language only for the sets
  complete in it.
- **Accepted content is never regenerated without an explicit request.** Which stages a slot still
  needs is derived from the committed content, never from a state file; a rerun fills gaps and
  spends nothing on what exists. Rewriting takes `--regenerate <stage> --reason "…"` with an
  explicit set or phrase selection, bypasses the request cache, and is recorded in the run summary.
  A changed brief marks its slot _stale_ in `author:status`; it never regenerates by itself.
- **Difficulty is structure, vocabulary and register, not length.** Every phrase stays sayable in
  one breath (P3-01): at most 110 characters, and 7 to 14 words by level.
- **Sharded JSONL in Git, one file per interface language, compiled outside the API bundle.**
  Content stays reviewable and diffable in this repository; adding a language adds files and edits
  none. The API reads a compiled bundle from disk. Raw model output, caches and logs are never
  committed. A size budget in `content:validate` keeps the repository honest (ADR-0016 says when
  content moves to its own repository).
- **Index, level shards per language pair, and per-set notes.** The pack splits into a small course
  index for the learner's language, one immutable phrase shard per level and interface language
  without notes, and one notes response per set in the learner's language. The app stores each in
  its own file (IndexedDB on the web), never AsyncStorage.
- **Ids never vanish, and courses have codes.** Course codes are `es bg en us ru pl cs` (en-GB and
  en-US are different courses and must not collide). FSRS progress and learners' sets reference Loro
  phrases by id; a shipped id stays forever or is renamed through `renamedPhraseIds`, enforced by
  `v2/ids.lock`. A regenerated phrase gets a new id and the old one is **retired** (kept in
  `ids.lock` with `replacedBy`, hidden from the course, progress untouched), because a learner's
  memory of one sentence is not their memory of another.
- **The writer is offline.** DeepSeek runs from a CLI with a cache, a budget ceiling and resumable
  slots; the server never generates course content at runtime.
- **The script carries the context; the model remembers nothing.** DeepSeek is a smaller model with
  no memory between calls or reruns, so a pure function builds every request from the committed
  files: the brief, the grammar rule with examples, the words to use and to avoid, the phrases
  already written nearby, hand-written examples of the exact output shape, and the schema. The same
  inputs always produce the same bytes; two slots never produce the same request because each slot's
  brief and variation card differ. Nothing is left to what the model "knows" about the course.
- **Rules beat the model where rules exist.** Spanish IPA comes from `transcribeSpanish`, Bulgarian
  from `transcribeBulgarian` where `knownStress` covers every word; Polish and Czech have fixed
  stress and can gain transcribers the same way. Lemmas come from a real lemmatizer at authoring
  time, not from the model's say-so. Model IPA is flagged and reviewed first.
- **Every number stays real.** Counts in Explore come from the index; the level choice is the
  learner's own pick, with no estimated placement score; the coverage report counts a grammar point
  as _claimed_ until the judge confirms it.

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
- `taxonomy/blocklist.json`: themes and words no set may use (per language, with the reason), plus
  the per-level list of what A1–A2 avoid (slang, profanity, politics, brand names, prices in a
  currency other than the course's).
- `syllabus/<course>.json`: phrase targets, word bounds and topic weights per level, the curated
  song sets, and a grammar inventory of 60–110 points
  `{id, level, kind: tense|aspect|mood|case|construction|register|evidential, rule, example, minPhrases, prerequisites}`.
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
    band; inversion and clefts. Spelling and vocabulary follow each variety. Whether en-US is
    written from scratch or adapted from en-GB is Q-26.
- `syllabus/vocab/<course>.tsv`: lemma, part of speech and CEFR band. Only derived bands are
  committed, with attribution in `syllabus/SOURCES.md`; licences are settled under Q-25. Oxford 3000
  and the English Vocabulary Profile are not used. Until Q-25 is settled the planner runs with the
  topic word lists alone and the band check is reported, not enforced.
- `plan/<course>/<level>/<topic>.json`: the generated, committed manifest, one slot per set. The
  allocator (`author:plan`) is idempotent: it adds slots that are missing, never rewrites a slot
  that exists, and never touches a brief a person edited (`brief.edited: true`). A greedy pass
  brings every grammar point to its `minPhrases` at its level and back again at later levels.

**The slot and its brief:**

```jsonc
{
  "setId": "set-es-a1-cafe-counter",
  "level": "A1",
  "topic": "eating-out",
  "situation": "cafe-counter",
  "count": 12,
  "song": false,
  "brief": {
    "edited": true,
    "scene": "A customer orders at the counter of a Madrid café in the morning; the barista answers.",
    "speakers": ["customer", "barista"],
    "register": "neutral; usted from the customer, tú is not used at A1",
    "grammarFocus": ["es-present-regular", "es-poner-request"],
    "functions": ["request", "ask-price", "thank"],
    "mustUse": ["café", "cortado", "con leche", "cuenta", "para llevar", "azúcar", "tostada", "…"],
    "shouldUse": ["por favor", "gracias", "¿cuánto es?"],
    "avoid": {
      "lemmas": ["desayunar", "camarero"],
      "themes": ["alcohol", "tipping amounts"],
      "textKeys": "siblings",
    },
    "mention": [
      "Spaniards ask for the bill; it is not brought unasked.",
      "A 'cortado' is espresso with a dash of milk; keep the word, do not translate it.",
    ],
    "doNotMention": ["prices in pesetas", "vosotros forms", "regional words (e.g. 'bocata')"],
    "variety": null,
    "notesHints": ["mnemonic: 'cortado' = cut (the espresso is cut with milk)"],
  },
  "briefHash": "…",
}
```

`mustUse` (about 12–15 lemmas) comes from the topic's word list at or below the level's band, minus
lemmas already placed at this level; `avoid.lemmas` are lemmas above the band and lemmas already
covered three times at this level; `avoid.textKeys: "siblings"` resolves at run time to the text
keys of the same topic and level only (the near-duplicate check covers everything else);
`doNotMention` is free text for the writer and the judge. `briefHash` covers the whole brief; a
mismatch with `provenance.briefHash` on the written set is what `author:status` reports as _stale_.

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
- **Six locales, five interface languages.** Translations, glosses and note translations are keyed
  by locale (`en-GB`, `en-US`, `bg-BG`, `ru-RU`, `pl-PL`, `cs-CZ`); en-GB and en-US are one
  interface language (`en`) and are always written together by the English stage. A phrase carries
  no translation into its own language (an English course has `bg ru pl cs`). Estimates below count
  four or five languages per phrase accordingly.
- **Ids:** legacy ids stay. New phrase ids are `<code>-<7 base32>`, a hash assigned once and never
  recomputed; set ids `set-<code>-<level>-<situation>[-n]`, unique across all courses; `v2/ids.lock`
  lists every shipped id with its status (`live`, `renamed → id`, `retired, replacedBy id`).
- **New fields:** a set gains `situation`, `grammarFocus[]`,
  `provenance {writer, provider, model, run, promptVersion, briefHash}`, `locales[]` (the interface
  languages it is complete in, derived at build) and `song?`; a phrase gains `grammar[]` (claimed),
  `grammarConfirmed[]` (by the judge), `functions[]`, `lemmas[]` with `lemmaSource`, and
  `ipaSource`. Review status is joined at build time from `v2/reviews/<course>.jsonl` and sent as
  `review` on the wire.
- **Source layout** (replaces `phrases.json`, `sets.json` and `note-translations.json`); one file
  per interface language so that adding a language adds files and changes none:

  ```
  v2/plan/<course>/<level>/<topic>.json                 slots and briefs
  v2/courses/<course>/<level>/<topic>.sets.json         sets: ids, structure, provenance, English title/subtitle
  v2/courses/<course>/<level>/<topic>.phrases.jsonl     phrases: target, register, icons, grammar, lemmas,
                                                        functions, en-GB and en-US translation and glosses
  v2/courses/<course>/<level>/<topic>.<lang>.jsonl      one interface language (bg, ru, pl, cs): set title and
                                                        subtitle, phrase translation and glosses
  v2/notes/<course>/<level>/<topic>.en.jsonl            {id, notes} in English
  v2/notes/<course>/<level>/<topic>.<lang>.jsonl        {id, notes} in one interface language
  v2/runs/<runId>.json                                  run summaries (cost, counts, rejects, reasons)
  v2/batches/<name>.json                                batch definitions (see §3)
  v2/reviews/<course>.jsonl                             native verdicts (§9)
  v2/ids.lock
  ```

- **Loader:** `packages/content/src/v2.ts` keeps `V2_CONTENT` for small consumers, built by a new
  `loadV2Content({ notes?, courses?, langs? })` that reads files with `fs`. `build:course` compiles
  the shards into `dist/course/<course>/<level>.<lang>.ndjson.gz`,
  `dist/notes/<course>/<setId>.<lang>.json.gz` and a `manifest.json` with a hash per artifact. The
  API reads them from `LORO_CONTENT_DIR`; `apps/api/scripts/build.mjs` stops inlining course JSON.

### 3. Generation (offline, DeepSeek on Fireworks)

In `apps/api/src/authoring/`, which `main.ts` never reaches, so the server bundle never carries it.
It reuses `textModel(budget)` (`apps/api/src/integrations/models.ts`: Fireworks, then OpenRouter,
JSON-schema answers), the wording of `phrasesPrompt()` and `notesBrief()` (`library/writers.ts`),
the transcribers and rules in `library/notes/`, and the validators exported by `@loro/content`.
Scripts: `author:plan`, `author:estimate`, `author:run`, `author:status`, `author:regenerate`,
`review:sample`, `review:export`, `review:import`, `audio:backfill`.

**Stages.** A slot is complete for a language pair when every stage below is accepted for it. Each
stage is a separate, cacheable unit keyed by `(setId, stage, lang?)`, and each writes only its own
file:

| Stage             | Per        | Writes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Calls |
| ----------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `phrases`         | set        | 15 candidates for 12 places: target, register, icons, grammar claims, functions, English (en-GB and en-US) translation and glosses, English title and subtitle                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 1     |
| `lemmas`          | set        | `lemmas[]` from the lemmatizer (no model call)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 0     |
| `notes`           | set        | English mnemonic, grammar (grounded in the point's rule) and pronunciation; rule IPA where a transcriber covers the phrase, else `ipaSource: 'model'`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | 1     |
| `judge`           | set        | one answer per phrase to fixed questions (natural, English, level, grammar claim, glosses, brief, duplicate of); a wrong phrase, a brief violation or a duplicate is rejected on its own, two other failures reject, one failure or an awkward answer sends it to review. Runs before the set is written; its rejects go back into the repair round; verdicts on the kept phrases go to `v2/reviews/<code>.jsonl` as `judge:<model>`. `--stage judge` alone reviews written sets the same way, shards untouched                                                                                                                                                                                                      | 1     |
| `translate`       | set × lang | the set's subtitle, and each phrase's line and one gloss per word in one interface language, from target and English, under a gloss convention shared with the judge (exact article glosses per language; a gloss explains the target word in its own form); the code aligns the answer by phrase number and the glosses by position, checks the script of the line and of every gloss (most letters, so «wifi» may stay; never an English gloss) and the length. Lines the checks and the judge accept are kept between rounds; only the rest go back, with the problems named, at most three rounds; the file (`<topic>.<lang>.jsonl`, `kind: set` and `kind: phrase` lines) is written only when every line is in | 1     |
| `notes-translate` | set × lang | the three notes in one interface language                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | 1     |
| `judge-translate` | set × lang | faithfulness, naturalness, register and the glosses of one language's lines, the same way as `judge`, on everything from the first batch; a wrong or unfaithful line is rejected on its own and goes back into the translate round; a gloss the judge calls wrong, or a loose, awkward or off-register line, is a review flag (the spike showed the judge rejecting glosses that follow the convention); verdicts on kept lines go to `v2/reviews/<code>.jsonl` with the interface language as `lang`. `--stage judge-translate` alone reviews written language files, untouched                                                                                                                                     | 1     |

English is the pivot: every later stage reads the target and its English. The `translate` stages for
`bg ru pl cs` never touch `phrases.jsonl`; the English stage never touches `<lang>.jsonl`.

Deterministic checks (`packages/content/src/v2/checks/`) run after `phrases` and again at
validation: the schema; word and character bounds per level; the script (Latin or Cyrillic); glossed
words present in the phrase; text-key duplicates across course and bank, and near-duplicates (§4);
at least 85% of lemmas at or below the level's band (reported only until Q-25); grammar ids known
and at or below the set's level; `mustUse` hit rate ≥ 80% and every `avoid.lemmas` absent; blocklist
themes absent; the IPA character set; icons in `icons.json`.

**Lemmatizer.** `apps/api/src/authoring/lemmatize.py`, run through `uv run`, wraps Stanza (es, ru,
pl, cs, en) and CLASSLA (bg); it runs once per written set and writes `lemmas[]` with
`lemmaSource: 'stanza' | 'classla'`. The model's own lemma list is not stored. `pnpm check` never
runs Python: validation only checks the committed lemmas against the bands.

**Building a request.** `apps/api/src/authoring/prompt/` holds one pure function per stage,
`build<Stage>Request(slot, context) → { system, messages, schema, cacheKey }`, where `context` is
read from disk before the call and nothing is fetched during it. The system prompt is a versioned
template per stage and target language (`prompts/<stage>.<course>.v<N>.md`; `promptVersion` goes
into provenance). The user message is assembled from fixed blocks in a fixed order, each with a
token budget so the whole request stays at about 3–4k tokens:

| Block            | Source                                                                                                                                                                                            | Budget      |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| Task             | the stage, the count (15 candidates for 12), the level's word and character bounds, the script                                                                                                    | fixed       |
| Scene            | `brief.scene`, `speakers`, `register`, `variety`, `mention`, `doNotMention`                                                                                                                       | ≈200 tokens |
| Variation card   | derived from `hash(setId)`: time of day, mood, the sub-moment of the situation (from the taxonomy's list), which three `mustUse` words anchor the first phrases, the order of speech acts         | ≈60 tokens  |
| Grammar to show  | each `grammarFocus` point: its `rule` and `example` from the syllabus, and how many of the 12 phrases must use it                                                                                 | ≈250 tokens |
| Words to use     | `mustUse` and `shouldUse` with their English gloss and part of speech from the vocabulary file, so the model sees the sense meant                                                                 | ≈200 tokens |
| Words not to use | `avoid.lemmas`, blocklist themes, and lemmas the level has already covered three times                                                                                                            | ≈150 tokens |
| Already written  | the target text of every accepted phrase in the same topic and level (siblings), newest first, capped at 60; the model is told these exist and must not be repeated or paraphrased                | ≤900 tokens |
| Examples         | 3 hand-written phrases of this course at this level from the 146 (or the nearest level), shown in the exact output shape, chosen by `hash(setId)` from the pool so slots see different examples   | ≈450 tokens |
| Format           | the JSON schema, and numbered rules the schema cannot express (glosses cover every word of the phrase in order; `uses` lists the `mustUse` words each phrase contains; English in both varieties) | ≈300 tokens |

The response schema is strict and small:
`{ title, subtitle, phrases: [{ target, en_GB, en_US, register, words: [{ w, gloss_en }], grammar: [], functions: [], uses: [], icons: [] }] }`.
It asks for one thing per call, never two languages, and asks the model to echo what the code will
check (`uses`, `grammar`, token-aligned `words`), so the check is a comparison, not a judgement.
Requests run at a fixed low temperature with the provider's `seed` where honoured (both added as
optional fields of `StructuredRequest`); reproducibility across reruns comes from the request cache,
not from the provider.

**Different sets without memory.** Diversity is a property of the inputs, not of sampling: the
planner gives every slot of the same situation a different `mustUse` set (words are assigned once
per level, round-robin over the situation's slots), different `grammarFocus` combinations and a
different variation card; the request shows the slot its accepted siblings; and the near-duplicate
check rejects what slips through. Two slots in the same situation therefore ask different questions
of the model even though the model has never seen the other's answer.

**Handling a weaker model.** Every answer is parsed and checked by code, never trusted:

1. Parse against the schema; on a parse failure, retry once with the parser's error appended as an
   assistant/user exchange (the cache key includes the attempt number).
2. Run the deterministic checks per candidate; keep the best 12 of 15 by a fixed score (`mustUse`
   coverage, grammar focus present, lemma band, length, no near-duplicate), tie-broken by position.
3. If fewer than 12 pass, send one **repair** call listing only the failing candidates, each with
   the specific rule it broke and the sibling it duplicated, asking for replacements; at most two
   repair calls per slot, then the slot is left absent and marked `needs-brief` in `author:status`
   with its rejects in `.cache/authoring/attempts/<setId>.json`.
4. A rerun of a slot that failed earlier reads that attempts file and adds a "previous attempt,
   rejected because…" block, so the model does not repeat the same mistake; the attempts file is
   never committed and is cleared when the slot is accepted.

Each `build*Request` function has a snapshot test (`prompt/__snapshots__/`): the request for a
fixture slot is committed as text, so a change to a template or a block is reviewed as a diff, and a
determinism test proves that the same slot and context give identical bytes twice.

**What `author:run` does.** It derives the work from the committed content and the plan:

1. Select slots: `--course`, `--level`, `--topic` (repeatable, or `all`), `--situation`, `--set`,
   `--max-sets N`, or `--batch <name>` (a file in `v2/batches/`, flags override its fields).
2. Select stages: `--lang en,ru` picks the interface languages; `--stage phrases,notes,translate,…`
   restricts the stages (default: all stages the selected pairs need).
3. For each slot and stage, skip what the content already has (a stage is _done_ when its output is
   present and passes the schema); run the rest in dependency order, `--concurrency 6`.
4. Write accepted output straight into the shards (a Git diff is the review); write rejects, raw
   responses and logs to the gitignored `.cache/authoring/`.
5. Stop at `--limit-usd`; print and commit a summary to `v2/runs/<runId>.json` (`--dry-run` prints
   the plan and the estimate without a call).

A rerun of the same command spends nothing: requests are cached by prompt hash in
`.cache/authoring/`, and done stages are skipped before any request is built. Retries with backoff
on `rate_limited`, `capacity` and `timeout`. Prices live, dated, in `authoring/pricing.json`.

**Regeneration is explicit.**
`author:regenerate --stage <stage> [--lang xx] --set <id>|--phrase <id> [--set …] --reason "…"` is
the only way to rewrite accepted output. It requires a selection (no `all`), salts the cache key
with the run id, and records the reason, the old and the new ids in the run summary. Regenerating
`phrases` retires the old ids (`ids.lock`: `retired, replacedBy`), regenerating any other stage
keeps them. `author:run` itself never rewrites: not for a stale brief, a new prompt version, a new
model or a failed judge; those show up in `author:status` as _stale_, _judge-flagged_ or _outdated
prompt_ for a person to decide on.

**Batches.** `v2/batches/<name>.json`:

```json
{
  "name": "es-a1-eating-out-en-ru",
  "course": "es-ES",
  "langs": ["en", "ru"],
  "levels": ["A1"],
  "topics": ["eating-out", "getting-around"],
  "maxSets": 6,
  "limitUsd": 5,
  "owner": "…",
  "note": "First pilot batch; the brief for set-es-a1-cafe-counter was edited by hand."
}
```

A batch is the unit of a commit
(`content(content): es-ES A1 eating-out, 72 phrases for en and ru (CC-01)`), of a coverage report
and of a review sample. The first batches are chosen by the owner (a course, one or two interface
languages, two or three topics, A1); a later batch may add languages to the same sets
(`--lang pl --stage translate,notes-translate`) and touches nothing else.

**Estimate:** per set, 3 English-side calls plus 3 per further interface language: with four
languages per course about 15 calls, so about 88k calls and 500M tokens for 70,000 phrases; at
today's assumed Fireworks prices about
$400–1,100 across every phase, and about 60 hours of wall
time at concurrency 6. A pilot batch of 6 sets for two languages is about 60 calls and under $2.
`author:estimate` recomputes these from the selected slots and `pricing.json`.

### 4. Validation at scale

- `phraseSchema`, `setSchema`, `contentProblems`, `bankProblems` and `textKey` move from
  `apps/mobile/src/shared/content/schema.ts` to `packages/content/src/v2/`, and both rule functions
  become O(n) with maps from phrase to set, topic and theme. The app keeps type-only wire types; its
  `content.test.ts` checks its fixture and the wire shape.
- `content:validate --only v2` streams the shards: schema, cross-file rules, `ids.lock`, the
  repository size budget, each set's `locales[]` consistency (a language is complete or absent,
  never half) and the checks above. Results are cached per shard by content hash in a gitignored
  `.cache/validate/`, so an unchanged shard is not reread; it stays in `pnpm check`, under 10 s for
  70k phrases with a cold cache.
- **Near-duplicates** use MinHash over word 3-grams with LSH banding, so the cost is linear in
  phrases; candidate pairs are confirmed with token Jaccard ≥ 0.8. No all-pairs comparison.
- `pnpm content:coverage` writes `v2/coverage/<course>.{md,json}` (committed, drift-checked):
  phrases per level against target, per interface language; each grammar point against `minPhrases`,
  claimed and confirmed apart; tense, aspect, mood and register counts; lemma use per band;
  `mustUse` hit rate; topics × levels × languages; review status and IPA source.
  `--gate <batch|phaseN>` runs in `ci:local`.

### 5. Delivery

API: migration `018_course_artifacts` (precompressed blobs, `content_hash` on `library_phrases` and
`library_sets`) and three routes, each per language pair:

| Route                                                    | Contents                                                                                              | Per pair, gzip                 |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------ |
| `GET /v1/library/course/:lang?native=`                   | Index: the sets complete in `native`, phrase ids, real counts per level, taxonomy in `native`, review | ≈80 KB                         |
| `GET /v1/library/course/:lang/phrases/:level?native=&v=` | One immutable level shard: target, `native` translation and glosses, no notes                         | 0.3–0.6 MB; ≈3 MB for a course |
| `GET /v1/library/course/:lang/notes/:setId?native=&v=`   | One set's notes in `native`                                                                           | ≈3 KB                          |

`native` is an interface locale; `en-US` falls back to `en-GB` text only where a field has no
`en-US` value, and the response says so. `/v1/library/pack?shape=2` becomes the learner's personal
pack plus `course.version`. Older builds (no `shape`) get the legacy pack, limited to sets marked
`legacy`, so their AsyncStorage value stays small.

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
  ahead. A content change downloads only the shards whose versions changed; a change of interface
  language downloads that language's shards for the installed levels.
- **Sets a learner started that later lose their language** cannot happen: a shipped language is
  never removed (`ids.lock` and `locales[]` are both grow-only in validation).

### 6. API seed

In `apps/api/src/library/library.service.ts` (`seed`, `seedPhrases`, `seedAlbums`): read the
compiled bundle; upsert by `content_hash` in batches of 1,000 (`jsonb_to_recordset`, `ON CONFLICT`)
and delete only ids that have gone (retired ids are kept, hidden); register speech in bulk with
`registerSpeechMany` (`speech.ts`); rebuild only changed artifacts; index
`library_sets(origin, target_lang, level)`. Songs only for sets marked `song: true`, at most 20 per
album. Targets: a cold seed under 90 s, a no-change reseed under 2 s.

### 7. App performance and UX

- **Explore:** `FlatList` grids and lists; level chips A1–C2; topic → situation → sets; counts from
  the index for the learner's language.
- **Search:** a lazily built token-prefix index per installed shard, debounced; notes searched only
  where downloaded.
- **Home "Not started":** at most 6 recommended sets at the learner's level, then "See all".
- **Selectors** (`src/shared/state/selectors.ts`, `catalog.ts`) walk the phrases the learner has
  touched through the indexed maps, not the whole course; a test proves old and new selectors give
  identical numbers on a synthetic 10k course.
- **Level choice:** "Where to start" in onboarding and Settings, stored as `profile.startLevel`
  (last writer wins, declared in `merge.ts` and `sync-protocol.md`).
- **Progress log compaction.** The learner log is grow-only (`merge.ts`) against
  `MAX_PROGRESS_BYTES = 3.8 MB`; at about 80 bytes an entry a learner who works through 10k phrases
  passes it near 45k reviews. Entries older than the phrase's current FSRS state needs are folded
  into a per-phrase snapshot `{phraseId, memory, lastReviewed, count}` by a pure `compact(state)`
  step; the merge treats snapshots as last-writer-wins by `lastReviewed` and the remaining log as
  the union it is today. Every number on screen still derives from the snapshot plus the log
  (non-negotiable 2); declared in `sync-protocol.md`.

### 8. Audio backfill

`pnpm --filter @loro/api audio:backfill --course --level --lang --max-chars --max-usd --concurrency 3 --dry-run`,
a separate esbuild entry run in the API container on EC2. `renderAndStore()` is extracted from
`SpeechService` so the route and the backfill share one path; the backfill has its own usage key and
ceiling. Order: targets of the selected batch first, then prompts for the batch's interface
languages by how many learners use each. It skips rows with `audio_id`, and backs off on 429.

**Cost:** targets alone are about 70k clips, 3.5M characters, roughly
$600–800; with every prompt
language about 350k clips, 16M characters, $2,400–3,600. A pilot batch is
a few dollars. **Storage:** speech moves to `mp3_44100_64`, with the format in the `?v=` hash; at
about 20 KB a clip the first 24k phrases with their prompts already pass 2 GB, so clip bytes move
from PostgreSQL to S3 (content-addressed) in phase 2, before the first full-level backfill.

### 9. Native review (Q-23)

`v2/reviews/<course>.jsonl` holds
`{phraseId, lang, contentHash, reviewer, date, verdict: ok|fixed|reject, fields, comment}`, where
`lang` is the target or the interface language checked; an edit makes a review stale.
`review:sample --batch <name>` draws a stratified sample (by grammar point and topic) of a batch's
phrases **and** their translations in each language of the batch, and `review:export` writes it as a
spreadsheet; `review:import` reads the verdicts back. Sample size by batch size (`review:sample`
prints the table): 60 phrases for batches under 1,200, 5% above, and every judge-flagged or
model-IPA phrase on top. One threshold everywhere: a batch passes at **5% or fewer critical errors**
(for n = 60, at most 3); otherwise its topic is fully reviewed or its sets regenerated with a
recorded reason. The pilot also measures how often the judge agrees with the native verdicts; below
80% agreement the judge moves to a different provider (OpenRouter, a non-DeepSeek model) before
phase 2. A set shows as reviewed for a language only when all its phrases are in that language;
otherwise it carries "Written by AI. No native speaker has checked it." in every interface language.

## Phases

Every commit leaves `pnpm check` green. Content lands one batch per commit with its coverage report,
never with code. Infrastructure that content needs (0c, 0f) comes before infrastructure that
learners need (0d, 0e), so the writer can be proven early.

0. **Infrastructure, no new content.**
   - 0a. This plan, ADR-0016/0017, the `CC-*` requirements, Q-25, Q-26 and the notes on Q-15, Q-21
     and Q-23.
   - 0b. Levels A1–C2 and the contracts.
   - 0c. The 146 phrases migrated to the per-language shards (their `provenance` records the hand
     authoring); loader, build, O(n) validators with the shard cache, MinHash near-duplicates,
     `ids.lock` with course codes, taxonomy, blocklist, seven syllabi, the planner with briefs, the
     coverage report. The vocabulary bands land when Q-25 allows; the planner runs without them.
   - 0f. The authoring CLI (stages, selection, batches, status, regenerate, cache, budget), the
     request builders with their templates, snapshot and determinism tests, the repair loop, the
     lemmatizer, `review:sample/export/import` and the backfill, tested against a fake
     `StructuredTextModel` and the stub TTS; a test proves that a rerun issues no request, that
     adding a language leaves every other file byte-identical, and that two slots of one situation
     build different requests.
   - 0s. **Writer spike** (as soon as 0c and 0f run): 2 sets per course, English only, with the
     judge, about $3; read by whoever is at hand per language. Answers whether DeepSeek's Bulgarian,
     Russian, Polish and Czech are usable before the delivery work starts; if not, the writer for
     that language changes here (ADR-0016's "revisit if").
   - 0d. API: migration 018, the diff seed, artifacts, the three per-pair routes, `shape=2`, the
     legacy cap, curated albums.
   - 0e. App: content store, per-pair shards, lazy notes, levels and level choice, virtualized
     Explore, the Home cap, indexed selectors, log compaction.
   - 0g. A synthetic 10k-per-course fixture, generated in tests, never committed, benchmarked in
     `ci:local`.
1. **Pilot batches.** ⛔ until the owner names the first pairs and topics and a native reader per
   language. Each: one course, one or two interface languages, two or three topics, A1, about 6 sets
   (72 phrases); the judge on everything; the full `review:sample`; briefs edited by hand where the
   output misses. Go/no-go per batch: at most 5% critical errors, at most 25% deterministic rejects,
   cost within the estimate, judge agreement measured. Pilot audio.
2. **Grow the pilot pairs** topic by topic through A1 and A2, then add interface languages to the
   written sets with `translate` stages only; audio per batch; clip storage on S3; coverage gate
   `phase2` (3,500 per pilot course, every pilot language complete).
3. **The remaining courses and languages** to A2, then every pair through B1 and B2; coverage gate
   `phase3` (8,000 per course).
4. **C1 and C2 to 10,000 per course;** the final coverage gate, and Q-23 sampling complete at every
   level and language.

## Spike result (2026-10-02, es-ES A1, three sets; Russian, Polish, Bulgarian)

`author:run --course es-ES --level A1 --topic eating-out` with the three slots in
`v2/plan/es/A1/eating-out.json`, DeepSeek V4.1 Flash on Fireworks (temperature 0.3 to write, 0 to
judge):

- **Writing:** one call per set, about 18 s, ≈2,000 input and ≈2,400 output tokens; 12 of 12 places
  filled with 92–100% of the must-use words. The checks rejected 4 of 31 candidates in the first two
  sets: a false `uses` claim, a bank duplicate (`bank-clothes-es-05`), two 8-word phrases at A1. A
  rerun issued no request; the second slot's request listed the first set's phrases under "already
  written", and the sets share no phrase.
- **Judging the first two sets after the fact** (`--stage judge`, 24 phrases, 2 calls, ≈1,900 input
  tokens each): it found exactly what a reader had found by eye: «¿Nos pone dos té con hielo?»
  (wrong, fix «dos tés»), «Perdone, ¿me trae una servilleta?» as a duplicate of «¿Me trae una
  servilleta, por favor?», and «¿Nos sentamos en una mesa?» as awkward. Those verdicts are in
  `v2/reviews/es.jsonl`; the two shards were not touched (the fix is for `author:regenerate`).
- **The third set, judged before writing:** round 0 gave 15 passing candidates (92% coverage); the
  judge rejected two («¿Se queda con el cambio? Gracias.» wrong; «¿Nos cobra por separado? Gracias.»
  a duplicate) and flagged two; the repair round, told the rejects and the missing words, filled the
  places (100% coverage) and the second judge pass rejected nothing. 4 calls, ≈8,800 input and
  ≈5,800 output tokens, about $0.005 at the assumed prices.
- **Bugs the spike found in the checks, fixed:** verb lemmas (`cobrar`, `invitar`, `quedarse`) never
  matched their conjugated forms, so 13 correct phrases were rejected as false claims
  (`containsLemma` now matches infinitive stems with the e→ie, o→ue, e→i changes; the lemmatizer
  stage will replace this); a full set short of coverage could never improve, because every new
  candidate was "not needed" (`makeRoom` now frees the places whose words others cover); a prior
  attempt's `needed` assumed phrases survive between runs (they do not; only accepted sets are
  written).
- **Policy settled by what was seen:** a phrase the judge calls wrong, a brief violation or a
  duplicate is rejected on its own; a learner must never be handed a wrong sentence with a flag on
  it. The judge is the same model as the writer for now; the pilot measures its agreement with
  native verdicts (§9).
- **Translating** (`--stage translate --lang ru`, then `--lang pl,ru` for one set): one call per set
  and language, ≈1,300 input and ≈600 output tokens. The alignment check sent 3 of 3 Russian answers
  back once (a Latin word in the line, «wifi», «contactless», and once 6 glosses on 7 words); every
  repair aligned; Polish aligned at once. The second run skipped Russian as already translated and
  wrote only `eating-out.pl.jsonl`; `phrases.jsonl` and `sets.json` were byte-identical before and
  after (checked by hash).
- **What the alignment check cannot see, read by eye:** the Russian lines are weaker than the
  Spanish. Two are ungrammatical («Вы нам два сока, пожалуйста?» has no verb), several glosses are
  literal or shifted («наличными» on «en», «я имею» on «tengo»), and the English «the» was left as
  the gloss of «la» and «el» (the check now refuses an English gloss and the prompt says to gloss an
  article by its role). Polish keeps Spanish words it should not («kawę solo», «piję solo»,
  «tostady»). Roughly one line in five needs a native's fix: the `judge-translate` stage, which the
  plan had as "sampled after the pilot", has to run on everything from the first batch, as `judge`
  does, and the pilot's native sample must include translations (it does, §9). The files written are
  left as they are: fixing them is `author:regenerate`'s job, not a rerun's.
- **Judging the translations** (`--stage judge-translate --lang ru,pl` on the files above, 4 calls):
  3 ok / 9 reject on the first Russian set, 3 / 9 on the Polish one, 10 / 2 and 4 / 8 on the other
  Russian sets, in `v2/reviews/es.jsonl` with the interface language as `lang`. It found the line
  errors a reader had found («Вы нам два сока», «kawę solo», «tostady», «croissant» → «rogalik») and
  many gloss errors (shifted glosses, English left in). The files stayed as written.
- **The judge in the translate loop,** Bulgarian for the first set and Polish for the other two:
  - The first attempt oscillated: each repair round re-asked the whole set, fixed the named glosses
    and undid earlier fixes. Translate now keeps the lines the checks and the judge accept and
    re-asks only the rest (as `phrases` keeps its chosen candidates).
  - Writer and judge fought over glosses they had never been given a convention for (an article in
    Polish; the form of an adjective). One `glossConvention(course, lang)` text, with the exact
    article gloss per language, now goes into both prompts. With it, Bulgarian for the first set and
    Polish for the paying set passed first time (12/12 aligned, 12/12 ok, 2 calls each).
  - The judge still rejected glosses that follow the convention to the letter («dos = dwa», «una =
    (rodzajnik nieokreślony)»), deterministically at temperature 0, so the set could never close. A
    gloss verdict is now a review flag, not a rejection; only a wrong or unfaithful line (or two
    failures) rejects. Gloss accuracy is the native sample's to confirm.
  - About 2 calls per set and language when the first answer passes, up to 6 when it does not; the
    budget ceiling and the three-round cap bound a disagreement.
- The output is in
  `v2/courses/es/A1/eating-out.{sets.json,phrases.jsonl,ru.jsonl,pl.jsonl,bg.jsonl}` (36 phrases,
  the new layout, not yet read by the loader or shipped), the verdicts in `v2/reviews/es.jsonl`, the
  run summaries in `v2/runs/`.

## Spike result: pl-PL (2026-10-02, A1 eating-out, three sets; Russian)

`author:run --course pl-PL --level A1 --topic eating-out --lang ru` with the three slots in
`v2/plan/pl/A1/eating-out.json` (café counter, ordering at a restaurant, paying), the same model and
settings as the Spanish spike:

- **The checks needed Polish.** `containsLemma` matched Spanish stems only, so «kawa» never found
  «kawę» and «rachunek» never found «rachunku». Polish now matches each word by its stems
  (`polishStems`: a verb without its infinitive ending, «-ować» also on «-uj-»; a noun or adjective
  without its final vowel; a fleeting e dropped; a softening «i» dropped), after the same folding
  that joins ś/s, ż/z, ó/o, ę/e. Irregular verbs («wziąć» → «wezmę», «mieć» → «mam») are not found,
  so a brief does not list them as must-use words.
- **Writing and judging:** the café and paying sets were written in one or two rounds (92–93%
  coverage). The restaurant set failed twice, as `needs-brief`. Its must-use «zamówić» kept
  producing «Czy pani może zamówić…?» (wrong; the judge's fix was «przyjąć zamówienie»), and six
  must-use words about one order (soup, «dnia», pierogi, water, «niegazowana», «bez mięsa») forced
  near-duplicates the judge rejected each round. The brief, never written, was changed: «zamówić»
  went to `avoid`, «zupa dnia» and «woda niegazowana» became units, and kotlet, sałatka and deser
  spread the set. The next run wrote it in one round.
- **Read by eye:** «Czy sok jest na wynos?» (awkward, flagged by the judge) and «Zapłacę razem,
  dobrze?» for "I'll pay for both of us" (should be «Zapłacę za nas» or «Ja stawiam»; not flagged)
  are weak. The Russian lines read naturally but carry two errors the judge passed: «pierogi» →
  «пироги» (should be «вареники»), and «kotlet» → «котлета», a false friend (a Polish kotlet is a
  breaded cutlet). Most Russian review flags are the gloss convention again («mlekiem = молоко»,
  nominative by rule). Both are for `author:regenerate` and the native reader, not a rerun.
- **Cost:** 26 calls over three runs, ≈56,000 input and ≈30,000 output tokens, about $0.03 at the
  assumed prices. Output in `v2/courses/pl/A1/eating-out.{sets.json,phrases.jsonl,ru.jsonl}` (36
  phrases), verdicts in `v2/reviews/pl.jsonl`, summaries in
  `v2/runs/spike-pl-a1-eating-out-ru*.json`.

## Worked example: a first batch

```bash
nvm use 22 && export PATH="$HOME/.cargo/bin:$PATH"
pnpm --filter @loro/api author:plan --course es-ES --level A1 --topic eating-out,getting-around
#   writes v2/plan/es/A1/{eating-out,getting-around}.json; edit briefs by hand, set "edited": true
pnpm --filter @loro/api author:estimate --batch es-a1-eating-out-en-ru          # calls, tokens, $
pnpm --filter @loro/api author:run --batch es-a1-eating-out-en-ru --dry-run
pnpm --filter @loro/api author:run --batch es-a1-eating-out-en-ru --limit-usd 5
pnpm --filter @loro/api author:status --course es-ES                            # done / missing / stale / flagged
pnpm check && pnpm content:coverage --gate es-a1-eating-out-en-ru
git add packages/content/v2 && git commit -m "content(content): es-ES A1 eating-out, 72 phrases for en and ru (CC-01)"

# Later: Polish for the same sets. Touches only *.pl.jsonl files; a rerun of the line above spends nothing.
pnpm --filter @loro/api author:run --course es-ES --level A1 --topic eating-out,getting-around --lang pl

# Only on request: rewrite one set's phrases (new ids; the old ones are retired, progress kept).
pnpm --filter @loro/api author:regenerate --stage phrases --set set-es-a1-cafe-counter \
  --reason "native review: 4 of 12 unnatural; brief tightened"
```

## Verification

- **Phase 0:** `pnpm check` and `pnpm ci:local` (contracts and OpenAPI drift,
  `library.postgres.test.ts` extended for the diff seed and per-pair artifacts); synthetic
  benchmarks (validation under 10 s cold, cold seed under 90 s, reseed under 2 s, index under 100 KB
  gzip); old and new selectors agree; compaction keeps every on-screen number identical on a
  synthetic 50k-entry log; the authoring tests for "rerun issues no request", "adding a language
  changes no other file", "same slot, same bytes" and "sibling slots, different requests"; the
  request snapshots reviewed; the web build on IndexedDB; an old build's pack stays small; shard
  install and Home render times on an Android development build.
- **Spike:** the two sets per course read by a speaker of each language; a written verdict per
  language in `v2/runs/`.
- **Phase 1:** run summaries (cost, rejects, reasons), native verdicts imported, judge agreement,
  coverage per batch, pilot audio heard on a device, notes readable in airplane mode after opening a
  set, a second interface language added to a pilot batch with a diff that touches only its files.
- **Phases 2–4:** each phase's coverage gate; validation time and the size budget; seed time on EC2;
  shard sizes recorded in `docs/architecture/library.md`; backfill totals within the ceiling; the
  Q-23 pass rate per language; learner state against the 3.8 MB sync cap for a learner who touched
  10k phrases, with compaction.

## Risks

- **Repository size:** about 370 MB of JSONL, roughly 70–90 MB packed, plus regeneration churn.
  Never commit raw output; enforce the size budget; `ci:local` reports the packed size; move content
  to its own repository when ADR-0016 says (200 MB packed).
- **DeepSeek in Bulgarian, Russian, Polish and Czech:** aspect, cases, renarrative forms and stress
  are the weak spots. The spike, the judge, the pilot gate, language-specific checks and stratified
  native sampling answer them.
- **The judge grading its own family:** measured against native verdicts in the pilot; swapped if
  agreement is under 80%.
- **IPA:** Spanish exact by rule, Bulgarian where `knownStress` covers the phrase; English, Russian,
  Polish and Czech flagged for review until transcribers exist.
- **Half-written pairs:** a set is published to a language only when complete in it; validation
  rejects a set half-translated.
- **Audio cost** grows with every prompt language; targets go first, prompts by demand; S3 before
  the first full level.
- **Licences of frequency lists:** Q-25; the planner runs without bands until then.
- **Bank collisions:** where the course and the bank share a phrase, the course wins and the bank
  phrase is replaced.
- **Older app builds:** the legacy pack cap keeps them working.
