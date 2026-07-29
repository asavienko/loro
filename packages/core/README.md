# @loro/core

Shared TypeScript domain model. **Used by both `apps/mobile` and `apps/api`** — that sharing is the
main reason we chose React Native
([ADR-0001](../../docs/architecture/adr/0001-cross-platform-react-native-expo.md)).

A wire protocol defined twice in two languages diverges, and the divergence shows up as a learner
losing their phrase library.

## Layout

```
src/
├── index.ts              # public surface
├── domain/               # the vocabulary of the product
│   ├── phrase.ts         # Phrase, PhraseState, Difficulty, Tag, LadderRung
│   ├── trip.ts
│   ├── progress.ts
│   └── ids.ts            # branded id types
├── engines/              # the PracticeEngine contract + conformance suite
│   ├── types.ts
│   └── conformance.ts    # every engine must pass this
├── sync/
│   ├── hlc.ts            # hybrid logical clock types
│   ├── fieldPolicy.ts    # ← EVERY syncable field declares its merge class here
│   └── types.ts
├── api/                  # Zod schemas for every endpoint — client AND server
│   ├── auth.ts
│   ├── sync.ts
│   ├── content.ts
│   ├── ai.ts
│   └── errors.ts
├── db/                   # Drizzle schema (one definition, two dialects)
│   ├── schema.sqlite.ts
│   └── schema.pg.ts
└── testing/              # fixtures and fakes
    ├── fixtures.ts       # seedFixture (the blueprint's LORO_SEED), largeFixture, …
    └── fakeClock.ts
```

## The two things that matter most here

### 1 · `sync/fieldPolicy.ts`

Every syncable field declares a merge class. A test fails if any field lacks one, which turns "added
a field without thinking about sync" from a subtle data-loss bug into a build failure.

See [sync-protocol.md](../../docs/architecture/sync-protocol.md#per-field-lww).

### 2 · `engines/conformance.ts`

The suite every practice engine must pass. It's how **rule 5** — every engine maintains every
progress signal, including ones it doesn't display — is enforced rather than merely intended.

See [practice-engines.md](../../docs/architecture/practice-engines.md#conformance).

## Rules

- **No platform imports.** No `react`, no `react-native`, no `@nestjs/*`, no `node:*`. This package
  runs in both an app and a server.
- **No I/O.** Types, schemas, and pure functions only.
- **Reproducible maths belongs in `@loro/core-rs`**, not here
  ([ADR-0002](../../docs/architecture/adr/0002-shared-rust-core.md)). If two platforms could
  disagree about a number, it's computed in Rust.
