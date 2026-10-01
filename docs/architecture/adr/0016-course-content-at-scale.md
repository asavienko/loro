# 0016 · Plan, write and ship course content at 10,000 phrases per course

- **Status:** Accepted
- **Date:** 2026-10-01
- **Deciders:** the owner (request and decisions of 2026-10-01, plan
  [112](../../../plans/112-course-content-at-scale.md))

## Context

The owner asked for at least 10,000 phrases per course, A1 to C2, covering topics, situations,
grammar, vocabulary, aspects and tenses (CC-01). There are seven courses, so 70,000 phrases. Today
there are 146 phrases in 36 sets, and the whole delivery path assumes that size:

- `packages/content/v2/` is a handful of JSON files that `apps/api/scripts/build.mjs` inlines into
  the API bundle.
- `GET /v1/library/pack` returns a whole course, notes and note translations included, versioned by
  a hash of the body; any change re-downloads it.
- The app keeps each pack as one AsyncStorage string (`shared/api/contentCache.ts`), rewritten
  whole. Android reads values above about 2 MB unreliably, and the web's localStorage holds about 5
  MB.
- A phrase with its notes and their translations is about 5 KB, so 10,000 phrases are about 50 MB
  per course.

The content has to be written by a model (Q-23 has no reviewers yet) and voiced by ElevenLabs
(Q-15), both of which cost money per phrase.

## Options considered

### A · Grow the files and the pack as they are

No new code, but the pack would be 50 MB, re-downloaded on any change and impossible to keep in
AsyncStorage; the API bundle would carry hundreds of MB of JSON.

### B · Generate content on demand at runtime

The server already writes decks with DeepSeek. Nothing would be committed or reviewed before a
learner saw it, coverage could not be measured, and every learner would see different phrases for
the same set.

### C · Content in a separate store or Git LFS

Keeps the repository small, but loses line diffs for review and ties `pnpm check` to a second
system. Worth it only once size or churn demands it.

### D · Planned, offline-written, sharded content; split delivery (chosen)

A syllabus drives an offline writer; accepted content is committed as JSONL shards; the API serves
an index, level shards and per-set notes; the app keeps each in its own file.

## Decision

- **Levels A1–C2** in every schema, contract and screen.
- **Syllabus first.** `packages/content/v2/syllabus/` and `taxonomy/` name each course's topics,
  situations, grammar points and vocabulary bands; a committed plan of slots drives generation; a
  committed coverage report measures the result.
- **Offline writer.** DeepSeek V4.1 Flash on Fireworks (OpenRouter fallback,
  [ADR-0015](0015-open-model-providers.md)) runs from a CLI in `apps/api/src/authoring/`, outside
  the server bundle, with a request cache, a budget ceiling, resumable slots, deterministic checks
  and a model judge. Its output is marked unreviewed until sampled native review passes (Q-23).
- **Full richness, notes apart.** Every phrase keeps translations, word glosses and all three notes
  in every interface language. Notes are stored and served apart from phrases.
- **Sharded JSONL in Git.** `v2/courses/<lang>/<level>/<topic>.*` and `v2/notes/...`, one record per
  line; compiled by `build:course` into `dist/course/`, which the API reads from `LORO_CONTENT_DIR`.
  Raw model output, caches and logs are never committed; `content:validate` enforces a size budget.
- **Stable ids.** Shipped ids are listed in `v2/ids.lock` and never disappear except through
  `renamedPhraseIds`.
- **Split delivery.** `GET /v1/library/course/:lang` (index), `.../phrases/:level` (immutable level
  shard) and `.../notes/:setId` (one set's notes in the learner's language); the pack becomes the
  learner's personal content. Older builds get a legacy pack capped to the original sets.
- **App storage.** One file per shard through `expo-file-system` on native and IndexedDB on the web;
  AsyncStorage keeps no content.
- **Pre-rendered audio.** A budgeted backfill renders clips level by level, targets first; clip
  bytes move to S3 before PostgreSQL holds 2 GB of them.

## Consequences

### Good

- A course can grow to any size without a learner downloading it all; a content change costs only
  the shards it touches.
- What is taught is decided and measured, not left to what a model happens to write.
- Content stays diffable and reviewable in the same repository as the code that checks it.

### Bad — accepted deliberately

- The repository grows by roughly 70–90 MB packed, and each regeneration adds churn.
- A set's notes need a connection the first time it is opened.
- The writer's Bulgarian, Russian, Polish and Czech are unproven; until review, 70,000 phrases carry
  an "unchecked" label.
- Audio for every prompt language costs thousands of dollars; prompts render by demand.

### Revisit if…

- The packed repository passes 200 MB, or content churn makes code review hard: move content to its
  own repository with versioned bundles.
- The pilot's native sample finds more than 5% critical errors in a language: change the writer for
  that language.
- Learners routinely open notes offline before a set's first open: ship notes with the level shards.
