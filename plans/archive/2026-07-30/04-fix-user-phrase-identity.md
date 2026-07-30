# Fix phrase identity: the learner's row id is currently the catalog id

- **Requirement IDs:** `P2-09`, `P2-10`, `F-04`, `P2-30`
- **Milestone:** M1 — **must land before persistence or sync**
- **Size:** M
- **Status:** ✅ Implemented 2026-07-29 — UUIDv7 row ids from an injected source
  (`packages/core/src/domain/ids.ts`, `apps/mobile/src/lib/ids.ts`), dedupe on `phraseId`, undo by
  row id, and the `addOwnPhrase` seam. Two corrections to this plan: **step 5 was already done** —
  `fieldPolicy.ts` already declared the `own*` fields — and plain UUIDv7 left onboarding's
  batch-seeded ids **unordered**, because they share a millisecond, so `createIdGenerator` adds RFC
  9562's monotonic counter. `source` is `'custom'`, not `'own'`: that is what `PhraseSource`
  declares.

## The problem

`packages/core/src/domain/ids.ts:14` states the contract:

```ts
/** A learner's row id — uuid. NOT the catalog id. */
export type UserPhraseId = Brand<string, 'UserPhraseId'>
```

The store violates it. `apps/mobile/src/store/index.ts:55`:

```ts
id: userPhraseId(cat.id),
```

`userPhraseId` is an identity cast (`ids.ts:25`), so the brand compiles and the runtime value is the
catalog id. The dedupe guard at `store/index.ts:167` then compares a user id against a catalog id
and only works _because_ of the bug:

```ts
if (get().phrases.some((p) => p.id === catalogId)) return
```

Everything downstream inherits it: `toView` (line 82) looks the catalog row up by `p.phraseId`,
`removePhrase` filters `refrainSet` by the same string, and `phrase/[id].tsx` routes on it.

### Why it has to be fixed before persistence

1. **Own phrases have no id at all.** `PhraseState` carries `ownEs`/`ownEn`/`ownTheme`/`ownEmoji`
   (`toView`, lines 86–89) for learner-authored phrases, and `phraseId` is nullable for exactly that
   case — but `addPhrase` only accepts a `catalogId` and there is no code path that creates one.
   Import mode (`P2-09`, `P2-10`) and Capture (`P2-15`) cannot be built on top of this.
2. **The same catalog phrase cannot be held twice**, which is right today but wrong for the trip arc
   (a phrase can belong to a trip set _and_ the general stream with different state).
3. **Sync will collide.** With per-field LWW keyed on `${entity}:${entity_id}`
   (`apps/api/src/sync/sync.controller.ts:90`), two devices that both add `cafe1` produce the same
   `entity_id` and silently merge into one row with interleaved field values from two different add
   events. That is a data-loss class of bug, and it is invisible until two devices exist.
4. **Content ids are the content team's**, not the learner's. A catalog phrase that gets retired or
   re-split (`docs/process/content-authoring.md`) would orphan learner rows.

## The work

### 1. Generate real ids

Add `newUserPhraseId()` to `@loro/core` — a UUIDv7 (time-ordered, so it also sorts by add time,
which the Add screen wants anyway). Seed it from an injected id source, not `crypto.randomUUID()`
called at the point of use, because the engines contract forbids ambient nondeterminism
(`types.ts:183`) and the conformance suite makes `Math.random` throw
(`packages/core/src/testing/index.ts:5`).

### 2. Fix the dedupe guard

Compare on `phraseId`, not `id`:

```ts
if (get().phrases.some((p) => p.phraseId === catalogPhraseId(catalogId))) return
```

Keep the blueprint's "adding twice is a no-op" behaviour (`Loro.dc.html:3602`) for the _catalog_ add
path, and allow duplicates only where a future feature explicitly asks for one.

### 3. Add the own-phrase path

`addOwnPhrase({ es, en, theme?, emoji? })` → a `PhraseState` with `phraseId: null` and the `own*`
fields set, `source: 'own'`. This is the seam Import and Capture plug into; building it now costs
almost nothing and unblocks two later plans.

### 4. Route and select by row id

Audit every `===` on a phrase id. `phrase/[id].tsx`, `refrainSet`, `selectedId`, and
`catalogById.get(p.phraseId)` must each be unambiguous about which id kind they hold. The brands
make this a compile error once the casts stop being identity-shaped at the call sites — consider a
`--strict` narrowing pass where `catalogPhraseId()`/`userPhraseId()` are only ever called at the
boundary (parse/deserialise), never mid-logic.

### 5. Declare the fields for sync

`packages/core/src/sync/fieldPolicy.ts` needs `ownEs`, `ownEn`, `ownTheme`, `ownEmoji` with merge
classes (`lww` is right for all four). CI fails without them, which is the guard working.

## Acceptance criteria

- Every `PhraseState.id` is a generated UUIDv7; no catalog id appears as a row id.
- Adding the same catalog phrase twice is still a no-op.
- A learner-authored phrase round-trips through the store, the stream, and phrase detail.
- Two simulated devices adding `cafe1` produce two rows, and the merge does not interleave them.
- `refrainSet`, `selectedId`, and the detail route all resolve by row id.
- Field policy covers the `own*` fields; `pnpm check` green.

## Tests

- `packages/core/src/domain/phrase.test.ts` — id generation is unique and time-ordered.
- Store tests: dedupe by catalog id, own-phrase creation, remove-by-row-id.
- A sync test in `apps/api/src/sync/sync.e2e.test.ts` asserting two distinct rows from two devices.

## Out of scope

The Import UI and OCR Capture — they depend on this but are separate plans.
