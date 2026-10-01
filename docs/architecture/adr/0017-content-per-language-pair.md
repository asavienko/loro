# 0017 · Course content is written per language pair, in batches, and never rewritten unasked

- **Status:** Accepted; amends the "Offline writer", "Sharded JSONL" and "Split delivery" decisions
  of [ADR-0016](0016-course-content-at-scale.md)
- **Date:** 2026-10-02
- **Deciders:** the owner (decisions of 2026-10-02, plan
  [112](../../../plans/112-course-content-at-scale.md))

## Context

ADR-0016 decided that a syllabus drives an offline DeepSeek writer, that content is committed as
JSONL shards and that the API serves an index, one shard per level and per-set notes. Its plan wrote
every phrase with all its translations in one call, stored a phrase's six locales on one line, and
shipped a level shard carrying every locale.

The owner then asked for the work to proceed in small batches, each for chosen language pairs (a
target course for one or more interface languages) and chosen topics, with a brief per set saying
which words to use, which to avoid and what to mention; for accepted phrases never to be regenerated
without an explicit request; and for a missing interface language to be written without regenerating
the others. The review of plan 112 also found that its `<lang2>` ids collide for en-GB and en-US,
that a learner who works through 10,000 phrases outgrows the 3.8 MB progress cap, that the lemma and
grammar checks trusted the model's own claims, and that the all-pairs near-duplicate check could not
meet the validation time budget.

## Options considered

### A · One call per set writes every language (ADR-0016's plan)

Fewest calls, but a new interface language means rewriting the set, the diff touches every
language's text, and nothing can be shipped to one language before all are done.

### B · One record per phrase holding all locales, filled incrementally

Additive, but every language's addition rewrites the same lines, so a diff for Polish shows up in
the file that holds the Spanish and the Russian; a merge conflict between two batches is likely.

### C · One file per interface language, stages per pair, work derived from the content (chosen)

A phrase is written once with English as the pivot; each further language is a separate stage that
writes its own file. What remains to be done is computed from the committed content, so a rerun
spends nothing and a rewrite needs an explicit command.

## Decision

- **Language pairs and batches.** Content is written per pair (course × interface language), in
  batches defined in `packages/content/v2/batches/` or by CLI selection (course, levels, topics,
  situations, sets, languages, stages, budget). A batch is the unit of a commit, a coverage report
  and a review sample.
- **English is the pivot.** The `phrases` stage writes the target with its en-GB and en-US
  translation and glosses (one interface language); `translate` and `notes-translate` stages write
  one further language each, from target and English, into `<topic>.<lang>.jsonl` and
  `notes/…/<topic>.<lang>.jsonl`. No stage writes another stage's file.
- **A brief per set.** The committed slot carries `scene`, `speakers`, `register`, `grammarFocus`,
  `functions`, `mustUse`, `shouldUse`, `avoid {lemmas, themes, textKeys}`, `mention`,
  `doNotMention`, `variety` and `notesHints`; a person may edit it (`edited: true`) and the planner
  then never overwrites it. The brief is in the prompt, hashed into `provenance.briefHash`, and
  checked after writing (`mustUse` hit rate, `avoid` absence, `doNotMention` by the judge).
- **The script carries the context.** DeepSeek has no memory between calls or reruns and is a
  smaller model, so a pure, versioned function assembles every request from the committed files
  (brief, grammar rule and examples, words to use and avoid, accepted sibling phrases, hand-written
  examples in the output shape, the schema) within a fixed token budget; the answer is parsed,
  scored and repaired by code. Variety comes from the inputs (distinct `mustUse` sets, grammar
  combinations and a per-slot variation card), not from sampling.
- **No regeneration without a request.** The state of a slot is derived from the content: a stage is
  done when its output exists and passes the schema. `author:run` fills gaps only. Rewriting is
  `author:regenerate` with a stage, an explicit set or phrase selection and a `--reason`, recorded
  in the run summary; it bypasses the request cache. A stale brief, a new prompt version, a new
  model or a judge flag are reported, never acted on.
- **Regenerated phrases get new ids; old ids are retired.** `ids.lock` records
  `retired, replacedBy`; the course hides the retired phrase and the learner's progress on it is
  kept. Renaming (`renamedPhraseIds`) is for the same sentence under a new id only.
- **Course codes.** Ids use `es bg en us ru pl cs`; set ids are unique across courses.
- **Delivery per pair.** The index, the level shards and the notes take `native=`; a set is
  published to a language only when complete in it (`locales[]`, derived at build), and a shipped
  language is never withdrawn.
- **Real lemmas, claimed grammar.** `lemmas[]` come from a lemmatizer (Stanza, CLASSLA for
  Bulgarian) at authoring time; grammar points count as claimed until the judge confirms them, and
  the coverage report shows both.
- **Near-duplicates by MinHash/LSH**, confirmed by token Jaccard; validation is cached per shard by
  content hash.
- **The progress log compacts.** Old entries fold into a per-phrase FSRS snapshot by a pure step
  declared in `sync-protocol.md`; every on-screen number still derives from snapshot plus log.
- **Review threshold.** One: a batch passes at 5% or fewer critical errors in a stratified sample
  (60 phrases under 1,200, 5% above, plus every flagged phrase), per language; judge agreement with
  native verdicts is measured and the judge is replaced below 80%.

## Consequences

### Good

- A pair can ship as soon as it is complete; adding a language is a diff of new files only.
- Two batches for different languages or topics never conflict in Git.
- Money is spent once per output; a rerun is free, and every rewrite has a written reason.
- The brief makes what a set teaches a decision in the repository, not a property of the model.

### Bad — accepted deliberately

- About three model calls more per set than writing every language at once (+15–25% cost).
- English is always written, even for a pair that does not need it, because the later stages and the
  judge read it.
- A phrase that was wrong and is rewritten disappears from the course for the learner who learned
  it; their progress on the retired id stays in their log.
- More files (one per language per topic per level): about 60,000 at full size.

### Revisit if…

- A batch regularly needs the same brief edits by hand: move the edit into the planner.
- The per-pair shards are too many for the content store on a device: merge locales per level again
  and accept the larger download.
- The retired-id rule leaves learners with many vanished phrases: offer a "replaced by" link in the
  app.
