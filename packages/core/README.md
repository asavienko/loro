# @loro/core

The shared TypeScript domain model, the API's wire contracts and the sync field policy. `apps/api`
and `packages/content` import it. The app (`apps/mobile`) does not: its behaviour lives in
`apps/mobile/src/shared` and it calls the Rust core directly.

## Layout

```
src/
├── index.ts         # the root export: domain, field policy, languages, lyrics, listening
├── domain/          # phrase and FSRS state types, languages and pairs, ids, text folding,
│                    #   phrase-suggest limits, lyric validation and music plans, calendar
├── listening/       # listening-asset identity and batches
├── sync/
│   ├── fieldPolicy.ts      # the merge class of every field the /v1/sync API stores
│   └── syncableColumns.ts  # wire names, SQL names and merge classes in one list
├── api/             # Zod schemas: current, target and draft operation registries
└── api-tooling/     # OpenAPI generation (build time only)
```

The `api/` schemas are not exported from the root. Import them by subpath: `@loro/core/api/current`,
`/target`, `/draft`, `/account`, `/oauth`, `/sync`, `/library`, `/catalog` or `/chat-topic` (see
`package.json`). `current` is the implemented surface, `target` the stable planned one and `draft`
the gated one; `target` never imports `draft`. See
[the API contract](../../docs/architecture/api.md).

## Generated OpenAPI

```bash
pnpm contracts:generate   # writes docs/architecture/openapi.current.json and openapi.target.json
pnpm contracts:check      # fails when they differ from the schemas (part of pnpm check)
```

The library routes the app uses are typed in `api/library.ts` but are not in either spec.

## Shared fixtures

`domain/calendar.fixtures.json`, `effort.fixtures.json` and `core-boundary.fixtures.json` are also
read by `packages/core-rs/tests/parity.rs`. `domain/calendar.ts` mirrors `core-rs/src/calendar.rs`,
and both sides assert the same fixtures, so keep them even where no TypeScript caller remains.

## Merge classes

Every field the HLC sync API stores declares a merge class in `sync/fieldPolicy.ts` (`lww`, `max`,
`latest-review`, `append-only`, `tombstone`), and `fieldPolicy.test.ts` fails if one is missing. The
app's own progress merge declares its classes in `apps/mobile/src/shared/state/merge.ts` instead.
See [the sync protocol](../../docs/architecture/sync-protocol.md).

## Rules

- No platform imports: no `react`, `react-native`, `@nestjs/*` or `node:*`.
- No I/O: types, schemas and pure functions only.
- A number two platforms could disagree about is computed in `@loro/core-rs`, not here
  ([ADR-0002](../../docs/architecture/adr/0002-shared-rust-core.md)). `domain/calendar.ts` is the
  one mirror, held to Rust by the shared fixtures.

```bash
pnpm --filter @loro/core test        # vitest
pnpm --filter @loro/core typecheck
```
