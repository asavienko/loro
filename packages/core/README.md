# @loro/core

Shared TypeScript domain model. **Used by both `apps/mobile` and `apps/api`** — that sharing is the
main reason we chose React Native
([ADR-0001](../../docs/architecture/adr/0001-cross-platform-react-native-expo.md)).

A wire protocol defined twice in two languages diverges, and the divergence shows up as a learner
losing their phrase library.

## Layout

The `api/` Zod schemas now describe current, planned and gated-draft wire surfaces, with inferred
types and generated OpenAPI. Import them explicitly through `@loro/core/api/current`, `/target`, or
`/draft`; they are not exported from the domain root. Auth, sync and content-query Nest controllers
consume the shared schemas; remaining migration limits are in
[the contract guide](../../docs/architecture/api-contracts.md). Persistence remains raw SQL against
`SqlDriver`; no Drizzle schema exists.
[ADR-0003’s amendment](../../docs/architecture/adr/0003-offline-first-sqlite-sync.md#amendment--2026-07-30--handwritten-sql-on-the-client-no-orm)
records the client choice and its costs; Drizzle remains the server’s choice.

```
src/
├── index.ts              # the public surface — imported by BOTH apps
├── api/                  # current/target/draft Zod contracts + operation registries
├── api-tooling/          # build-time OpenAPI generation; no runtime exports
├── domain/               # the vocabulary of the product
│   ├── phrase.ts         # PhraseState, CatalogPhrase, Difficulty, Tag, LadderRung
│   ├── calendar.ts       # day keys and streaks — TS mirror; UniFFI exports exist, JS still uses this
│   └── ids.ts            # branded id types + UUIDv7 generation (injected entropy)
├── engines/              # the PracticeEngine contract and its implementations
│   ├── types.ts          # the contract, and where ProgressDelta declares rule 5
│   ├── common.ts         # ← `universalDelta` + `canonicalReviewDelta` (rule 5 / FSRS)
│   ├── conformance.ts    # every engine must pass this
│   ├── stream/           # hands-free listening
│   ├── refrain/          # the Daily Refrain — the v1 hero
│   ├── speak.ts          # on-device production
│   └── review.ts         # explicit-grade review boundary
├── sync/
│   ├── fieldPolicy.ts    # ← EVERY syncable field declares its merge class here
│   └── syncableColumns.ts # SQL ↔ wire names consumed by mobile persist/sync
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

## Current implementation boundary

This package currently implements Stream, Refrain, Speak and Review. The other `EngineId` values are
contract reservations. Mobile constructs the implemented engines in its store layer and talks to
Rust through the generated WASM/UniFFI facade (`rustCoreFacade`). TypeScript Refrain helpers remain
for fixtures only; production numbers come from the crate. Do not add a second FSRS or ranker in
TypeScript ([ADR-0002](../../docs/architecture/adr/0002-shared-rust-core.md)).

Persistence contracts and repositories live here. The running app writes native OP-SQLite or browser
SQLite through `apps/mobile/src/data/` before rendering. `openMemoryPersistence()` is the
web-capable implementation of these contracts, not a stand-in for device storage.

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

The suite requires every signal to be classified as `maintains` or `exempt`, checks that
declarations match actual writes, and covers deterministic/read-only planning, idempotent
`record()`, honest latency, monotonic rungs, empty plans, and termination of closed sessions. It
does not apply deltas to persistence, simulate interruption/relaunch, or prove the correctness of an
FSRS algorithm.

See [practice-engines.md](../../docs/architecture/practice-engines.md#conformance).

## Rules

- **No platform imports.** No `react`, no `react-native`, no `@nestjs/*`, no `node:*`. This package
  runs in both an app and a server.
- **No ambient or platform-specific I/O.** Domain/engine code is pure; persistence code operates
  only through an injected `SqlDriver` or the in-memory implementation.
- **Reproducible maths belongs in `@loro/core-rs`**, not here
  ([ADR-0002](../../docs/architecture/adr/0002-shared-rust-core.md)). If two platforms could
  disagree about a number, it's computed in Rust.

## Extending safely

1. Add a headless engine under `src/engines/<id>/` and export it from `engines/index.ts`; do not add
   platform, store, or presentation dependencies.
2. Build every delta with `universalDelta`, classify every `PROGRESS_SIGNALS` entry in the shared
   conformance suite, then add engine-specific selection, sequencing, and evaluation tests.
3. Keep learner-visible maths behind `LoroCoreFacade`. If the Rust function or binding is missing,
   implement that boundary under plan 60 rather than adding another TypeScript algorithm.
4. Wire persistence and the route in their owning layers. An engine returning a delta is not proof
   that `applyDelta`, local storage, resume, or E2E behavior is correct.
