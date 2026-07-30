# @loro/core

Shared TypeScript domain model. **Used by both `apps/mobile` and `apps/api`** — that sharing is the
main reason we chose React Native
([ADR-0001](../../docs/architecture/adr/0001-cross-platform-react-native-expo.md)).

A wire protocol defined twice in two languages diverges, and the divergence shows up as a learner
losing their phrase library.

## Layout

What is actually here. The `api/` Zod schemas and the `db/` Drizzle schema this file used to promise
do not exist — the API defines its own shapes today, and persistence is raw SQL against the
`SqlDriver` interface, deliberately (see `persistence/driver.ts`).

```
src/
├── index.ts              # the public surface — imported by BOTH apps
├── domain/               # the vocabulary of the product
│   ├── phrase.ts         # PhraseState, CatalogPhrase, Difficulty, Tag, LadderRung
│   ├── calendar.ts       # day keys and streaks — mirrors core-rs until UniFFI lands
│   └── ids.ts            # branded id types + UUIDv7 generation (injected entropy)
├── engines/              # the PracticeEngine contract and its implementations
│   ├── types.ts          # the contract, and where ProgressDelta declares rule 5
│   ├── common.ts         # ← what every engine shares, incl. `universalDelta` (rule 5)
│   ├── conformance.ts    # every engine must pass this
│   ├── stream/           # hands-free listening
│   └── refrain/          # the Daily Refrain — the v1 hero
├── sync/
│   └── fieldPolicy.ts    # ← EVERY syncable field declares its merge class here
├── persistence/          # schema, migrations, repositories, outbox — driver-agnostic
│   ├── driver.ts         # the SqlDriver contract + row/query helpers
│   ├── tables.ts         # what the app needs from storage, as interfaces
│   ├── migrations.ts     # forward-only, append-only history
│   ├── memory.ts         # the web target's REAL storage, not a test double
│   └── sqlite/           # one module per table, plus the outbox's folding rules
└── testing/              # fixtures and fakes — no real clock, no real randomness
```

Persistence is exercised against real SQLite from `apps/mobile/src/data/persistence.test.ts`, which
is where `node:sqlite` lives; the tests in here are the parts that need no database.

## The two things that matter most here

### 1 · `sync/fieldPolicy.ts`

Every syncable field declares a merge class. A test fails if any field lacks one, which turns "added
a field without thinking about sync" from a subtle data-loss bug into a build failure.

See [sync-protocol.md](../../docs/architecture/sync-protocol.md#per-field-lww).

### 2 · `engines/conformance.ts`

The suite every practice engine must pass. It's how **rule 5** — every engine maintains every
progress signal, including ones it doesn't display — is enforced rather than merely intended.

Its partner is `engines/common.ts`. The suite catches an engine that forgot a signal;
`universalDelta` there makes forgetting hard in the first place, because `reps` and `latencyMs` are
required arguments. A new engine should build its `ProgressDelta` on top of it rather than from
scratch.

See [practice-engines.md](../../docs/architecture/practice-engines.md#conformance).

## Rules

- **No platform imports.** No `react`, no `react-native`, no `@nestjs/*`, no `node:*`. This package
  runs in both an app and a server.
- **No I/O.** Types, schemas, and pure functions only.
- **Reproducible maths belongs in `@loro/core-rs`**, not here
  ([ADR-0002](../../docs/architecture/adr/0002-shared-rust-core.md)). If two platforms could
  disagree about a number, it's computed in Rust.
