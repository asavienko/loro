# @loro/core

Shared TypeScript domain model and wire contracts, used by `apps/api` and `packages/content`. A wire
protocol defined twice in two languages diverges, and the divergence shows up as a learner losing
their phrase library.

The app (`apps/mobile`) does not import this package: its behaviour lives in
`apps/mobile/src/shared` and it reaches the Rust core directly. The old app's practice engines,
local SQLite persistence and their fixtures were removed with it; they remain in git history.

## Layout

The `api/` Zod schemas describe current, planned and gated-draft wire surfaces, with inferred types
and generated OpenAPI. Import them explicitly through `@loro/core/api/current`, `/target`, or
`/draft`; they are not exported from the domain root. Auth, sync and content-query Nest controllers
consume the shared schemas; remaining migration limits are in
[the contract guide](../../docs/architecture/api-contracts.md).

```
src/
├── index.ts              # the public surface
├── api/                  # current/target/draft Zod contracts + operation registries
├── api-tooling/          # build-time OpenAPI generation; no runtime exports
├── domain/               # the vocabulary of the product
│   ├── phrase.ts         # PhraseState, CatalogPhrase, Difficulty, Tag, LadderRung, isActive
│   ├── languages.ts      # native languages, target locales, supported pairs
│   ├── phraseReach.ts    # canonical phrase identity and the suggest route's limits
│   ├── lyrics.ts         # lyric validation for phrase songs
│   ├── lyric-plan.ts     # music styles and section planning
│   ├── calendar.ts       # day keys and streaks — TS side of the core-rs parity fixtures
│   └── ids.ts            # branded id types
├── listening/            # listening-class asset identity and batches
└── sync/
    ├── fieldPolicy.ts    # ← EVERY syncable field declares its merge class here
    └── syncableColumns.ts # one list of wire names, SQL names and merge classes
```

The `*.fixtures.json` files in `domain/` are also read by `packages/core-rs/tests/parity.rs`; keep
them even where no TypeScript caller remains.

## The thing that matters most here

### `sync/fieldPolicy.ts`

Every syncable field declares a merge class. A test fails if any field lacks one, which turns "added
a field without thinking about sync" from a subtle data-loss bug into a build failure.

See [sync-protocol.md](../../docs/architecture/sync-protocol.md#per-field-lww).

## Rules

- **No platform imports.** No `react`, no `react-native`, no `@nestjs/*`, no `node:*`.
- **No I/O.** Types, schemas and pure functions only.
- **Reproducible maths belongs in `@loro/core-rs`**, not here
  ([ADR-0002](../../docs/architecture/adr/0002-shared-rust-core.md)). If two platforms could
  disagree about a number, it's computed in Rust.
