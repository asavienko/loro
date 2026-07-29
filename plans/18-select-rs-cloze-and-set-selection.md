# `select.rs`: the cloze mask and priority-ordered set selection

- **Requirement IDs:** `LB-03`, `LB-24`, `P3-04`
- **Milestone:** M2
- **Size:** M

## Current state

Two `todo!`s in `packages/core-rs/src/select.rs`, both load-bearing for the v1 hero loop:

```rust
// select.rs:124 — cloze_mask; the todo! is at :125
todo!("M2: select the most informative content word, never a function word")

// select.rs:137 — select_refrain_set; the todo! is at :142
todo!("M2: priority-ordered selection; see docs/architecture/scheduling.md")
```

Both have stand-ins in TypeScript that are worse than absent:

- `apps/mobile/src/store/index.ts:311` — `clozeMask: () => [1]`. Always blanks the second token. For
  `Me pone un cortado, por favor` that blanks **`pone`**, which is fine by accident; for
  `¿Dónde está el baño?` it blanks `está`; for `Un cortado, por favor` it blanks `cortado` — the one
  content word — and for `No, gracias` it blanks `gracias`. So Cloze mode is a coin flip between
  "teaches the phrase" and "asks the learner to guess a function word", and the learner cannot tell
  which they got.
- `packages/core/src/engines/refrain/index.ts` has a TS `selectRefrainSet` that the store calls
  (`store/index.ts:271`). It works, but it is a second implementation of a number the Rust crate is
  supposed to own ([fix-shared-maths-duplication.md](05-fix-shared-maths-duplication.md)).

## Why the cloze mask is not a small detail

Cloze is one of the six Refrain modes (`RefrainMode`, `select.rs:47`) and the modes are the whole
pedagogical argument: "six reps of one phrase are six different cognitive events — imitation,
synchrony, compression, **generation**, translation, free recall"
(`packages/core/src/engines/refrain/index.ts:10–11`, and again in Rust at `select.rs:44`). Cloze
_is_ the generation event. Blanking `por` instead of `cortado` turns generation into a grammar quiz,
and the effort-dropping display (`effort_label`, `automaticity`) then reports progress on the wrong
task.

## The work

### 1. Cloze mask selection

Needs linguistic signal the content pipeline is already specified to produce
(`docs/product/content-model.md` — `words`, `syl`, and the rich fields). Two tiers:

- **Authored** — the content pipeline marks the informative token(s) per phrase. Best quality, and
  the content lead can fix a bad one without an app release (ADR-0009). This should be the primary
  path.
- **Derived** — a Spanish function-word stop list (articles, prepositions, pronouns, common
  auxiliaries, `por favor` as a unit) plus a preference for the longest remaining token and the one
  carrying the phrase's semantic weight. Deterministic, no ML, testable.

Non-obvious requirements:

- **Never blank a fixed politeness formula.** `por favor`, `gracias`, `perdón` — blanking these
  tests nothing and reads as broken.
- **Multi-token blanks** for phrases where the informative unit is two words (`de avena`,
  `la cuenta`). `PromptSpec.clozeMask` is `readonly number[]` so the shape already allows it.
- **Stability.** The same phrase must blank the same token every time, or the learner cannot tell
  whether they improved. Seeded by phrase id, not by rep index.
- **Short phrases.** A two-token phrase where one token is a function word has exactly one legal
  blank; a one-token phrase has none, so Cloze must be **skippable** and the engine must substitute
  a different mode rather than showing an empty prompt.

### 2. Priority-ordered set selection

`docs/architecture/scheduling.md:185` ("choosing today's set") is the spec. Implement it in Rust
with the priority order it defines and the properties the Refrain depends on:

- **Frozen for the day.** "You always see today" — the set is chosen once
  (`store/index.ts:266 ensureRefrainSet`). Selection must therefore be a pure function of
  `(phrases, day, size, seed)` so re-running it produces the same set, which is also what makes it
  testable and what lets the widget compute it without JS.
- **Size from daily minutes** — `refrain_set_size` already implements 3/5/8 (`select.rs:34`).
- **Never all-new or all-old.** A set of five brand-new phrases is six reps of unfamiliar material
  and feels punishing; a set of five graduated ones is busywork. The mix is a pedagogical parameter
  — put it behind a flag with a documented default.
- **Graduated phrases leave rotation** (`LOCK_IN_DAYS_TO_GRADUATE = 4`), but the set must still fill
  when the library is smaller than the set size. A library of two phrases yields a set of two, not
  an error.
- **Trip mode reweights** toward the trip's phrase set (`TripContext.phraseIds`,
  `packages/core/src/engines/types.ts:170`).

### 3. Delete the TS copies, keep a parity mirror

Per [fix-shared-maths-duplication.md](05-fix-shared-maths-duplication.md): Rust is canonical, the TS
mirror is generated-fixture-tested, and `clozeMask: () => [1]` is removed rather than improved.

## Acceptance criteria

- No `todo!` in `select.rs`.
- Every catalog phrase has a cloze mask that blanks a content word; asserted across the whole
  catalog as a test, not sampled.
- The same phrase always blanks the same token(s).
- A one-token phrase reports "no legal cloze" and the engine substitutes another mode.
- `por favor` / `gracias` are never blanked.
- Set selection is deterministic for a fixed `(phrases, day, size, seed)`.
- A 2-phrase library produces a 2-phrase set; a 500-phrase library produces the configured size with
  the documented new/old mix.
- Trip mode biases the set toward trip phrases.
- Rust and TS mirrors agree on every fixture.

## Tests

- A catalog-wide test: for all 31 phrases (and later 600), the mask is non-empty, indices are in
  range, and no masked token is in the stop list. This one test is worth more than any unit case.
- Table tests for the awkward shapes: one token, two tokens, all function words, punctuation-heavy.
- Determinism test: same inputs, 100 runs, identical output.
- Set-selection property tests: size correctness, no duplicates, graduated excluded, small-library
  behaviour.

## Out of scope

Learner-authored cloze ("blank the word I keep missing"). Interesting, and it depends on per-token
error data that does not exist yet.
