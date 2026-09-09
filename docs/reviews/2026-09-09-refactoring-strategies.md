# Refactoring strategies for shipped code — 2026-09-09

**Reviewed:** 2026-09-09. **Branch:** `main`. **HEAD:** `382507c66b4eb2be9bedb60bbe1eea30d13b0c35`.
**Requirements:** structural cleanup of existing implementation (F-02/F-03/F-04, P3-20/P3-25,
NAV-\*, ADR-0002/0003/0006), not product completion.

**Disposition: document only.** This review does not implement the refactors, does not open a
numbered plan, and does not claim whole-plan acceptance. Device, bilingual, provider and remaining
learner-screen work stay with their owners in [plans/README.md](../../plans/README.md).

The store, engine contract, handwritten SQL and generated Rust bridges are already the right shape.
The expensive debt is **dual ownership of numbers and maps**, **practice routes that live beside
those contracts**, and **docs that still describe an earlier backend**. A rewrite of `features/` or
a second maths layer would make the next fifteen screens harder, not easier.

---

## Context and method

Inspected the tree at HEAD: largest TypeScript/Rust modules, engine/store/persistence call sites,
API composition, contract registries, and architecture docs that disagree with `AppModule`. Evidence
is file size, duplicated literals, and callers — not roadmap vibes.

**In scope:** code that already runs — eight learner routes plus Languages/Account/More/Settings,
Zustand slices, SQLite drivers, `@loro/core` engines/persistence/sync/contracts, `core-rs`, Nest
auth/sync, content adapters, `pnpm check` / `ci-local` drift gates, Playwright state helpers.

**Out of scope (not refactoring):** unimplemented screens 9–23, widgets, DSP quality, production
audio cache, billing, live Claude, bilingual reviewer evidence, physical-device/iOS acceptance,
account export/erasure. Those are unfinished plans, not cleanup.

No similar review existed under `docs/reviews/`; this file is the first inventory of this kind.

---

## Executive recommendations

Do these, in this order. Everything else is opportunistic or must wait.

1. **Seal dual TS/Rust Refrain numbers and the stale `fakeRepository` eligibility rule** so tests
   cannot go green on a copy the production facade no longer uses.
2. **Stop re-authoring weaker OpenAPI schemas in `current.ts`.** Import `common.ts` / `content.ts` /
   `ai.ts` (or generate current ops from them) so the implemented document cannot drift from the
   shared validators.
3. **Give Stream cursor and Refrain session start typed store actions.** Raw `useApp.setState` is
   the hole the 469-line store split already closed everywhere else.
4. **One phrase column map next to `FIELD_POLICY`.** SQL names, wire camelCase and merge classes
   currently live in three files; a fourth field will miss one.
5. **Rename the two live API auth surfaces and share JWKS verification.** `IdentityProvider` means
   two different types in adjacent files; `/me` and `/auth/me` return different shapes.
6. **Correct architecture-doc drift** (`backend.md` still says in-memory sync; `mobile-app.md` omits
   `/more` and `/settings`; calendar comments still deny UniFFI) so the next change is not planned
   against a ghost inventory.
7. **Split `learner.ts` / `sync.ts` and the Postgres test harness along existing seams** before plan
   68 lifecycle work lands more cases in the same blobs.
8. **Drive Speak through the shared `SpeakEngine` + `plan()`**, matching Refrain. Do **not** wire
   `StreamEngine.plan()` until hands-free audio exists — that `plan()` expands listen reps the
   current rating UI does not render.

---

## How to read the inventory

| Bucket                    | Meaning                                                                   |
| ------------------------- | ------------------------------------------------------------------------- |
| **Refactor now / soon**   | Concrete, existing code; a small PR; low collision with remaining screens |
| **Refactor as you touch** | Extract or rename in the same change that already owns the file           |
| **Do not refactor yet**   | Would collide with an unfinished plan, a gate, or a non-negotiable        |
| **Not refactoring**       | Missing product, not structural debt                                      |

Priorities: **P0** silent-drift or contract risk; **P1** makes the next owned feature safer; **P2**
hygiene.

---

## Inventory

### 1. Dual TS/Rust Refrain maths + test fakes — P0, refactor now

**What is wrong.** Production Refrain/Today call `rustCoreFacade` → `coreCall` →
[`packages/core-rs/src/bridge.rs`](../../packages/core-rs/src/bridge.rs) (`automaticity`,
`refrain_set_size`, `mode_for_rep`, …). Identical formulas remain exported from TypeScript and are
what `fakeCore()` binds:

```99:127:packages/core/src/engines/refrain/index.ts
/** Set size from the learner's daily-minutes answer. */
// These pure helper exports remain for API compatibility and deterministic fixtures.
// Production engines obtain the corresponding values from the canonical core facade.
export function refrainSetSize(dailyMinutes: number): number {
  if (dailyMinutes <= 5) return 3
  if (dailyMinutes <= 10) return 5
  return 8
}
// ...
export function automaticity(repsToday: number, target: number): number {
  if (target <= 0) return 0
  return Math.min(100, Math.round((repsToday / target) * 100))
}
```

Rust: [`select.rs`](../../packages/core-rs/src/select.rs) `automaticity` 47–56, `refrain_set_size`
61–67, `mode_for_rep` 93–102, `model_rate_for_mode` 107–114, `beat_ms_for_mode` 119–124,
`effort_state` 144–156. `fakeCore()` wires the TS copies
([`testing/index.ts`](../../packages/core/src/testing/index.ts) 182–187).
[`engines.test.ts`](../../packages/core/src/engines/engines.test.ts) still asserts the TS helpers
directly (automaticity/set size/mode, ~488–527).

`fakeRepository` still has the eligibility bug the store adapter already documented as fixed:

```140:141:packages/core/src/testing/index.ts
    active: () => Promise.resolve(snapshot.filter((p) => !p.learned)),
    due: (at) => Promise.resolve(snapshot.filter((p) => p.srs !== null && p.srs.due <= at)),
```

Domain rule ([`phrase.ts`](../../packages/core/src/domain/phrase.ts) 287–299): `isActive` also
requires `graduatedAt === null`; `isDue` also requires `!learned`. SQL matches
([`phrase.ts`](../../packages/core/src/persistence/sqlite/phrase.ts) 285–293). The store adapter
uses the domain helpers ([`engines.ts`](../../apps/mobile/src/store/engines.ts) 50–68). Production
`orderStream` sends `active: isActive(phrase)` into Rust candidates
([`coreFacade.ts`](../../apps/mobile/src/store/coreFacade.ts) 29–38). A leftover Rust `order_stream`
over `PhraseState` still filters only `!learned` ([`rank.rs`](../../packages/core-rs/src/rank.rs)
125–128) — unused by the WASM candidate path, but the same class of drift.

**Why it matters.** Engine unit tests can pass while Rust changes. A graduated phrase can re-enter a
test plan the way it once re-entered production Stream.

**Strategy.** Point `fakeRepository.active/due` at `isActive` / `isDue`. Stop exporting parallel
algorithms from TS; keep `selectRefrainSet(core, …)` as the thin `core.selectRefrainSet` wrapper it
already is ([`refrain/index.ts`](../../packages/core/src/engines/refrain/index.ts) 177–184). Move
numeric assertions onto the facade (WASM in CI, or a fake that _calls_ documented fixtures, not a
second implementation). Align `rank.rs` `order_stream` with `isActive` or delete the PhraseState
overload if only candidates remain. Keep `effortState` / `warmBand` in TS only if they stay
presentation-neutral keys with a single numeric source (`ctx.core.automaticity`).

**Sequence.** One core PR; no generated OpenAPI. Run `@loro/core` tests and `packages/core-rs`
units. **Blast radius:** `engines/refrain`, `testing/index.ts`, `engines.test.ts`, possibly
`rank.rs`. **Do not** reimplement FSRS in TS; `fakeCore().fsrsReview` is an explicit test double
(`testing/index.ts` 192–203) and should stay labelled as such, not “canonical”.

---

### 2. `current.ts` redefines weaker schemas — P0, refactor now

**What is wrong.** Shared contracts already exist. The implemented OpenAPI registry re-authors
looser copies used as the public document:

| Schema   | Shared (strict)                                                                            | `current.ts` (weaker)                         |
| -------- | ------------------------------------------------------------------------------------------ | --------------------------------------------- |
| Problem  | [`common.ts`](../../packages/core/src/api/common.ts) 76–94, status/code coupled            | 69–75, no `superRefine`, `type` is any string |
| Manifest | [`content.ts`](../../packages/core/src/api/content.ts) 36–47 (`resource_base`, SHA assets) | 94–113, no `resource_base`                    |
| Pack     | `content.ts` 57–68 promised-count refine                                                   | 121–126, no refine                            |
| Scene    | [`ai.ts`](../../packages/core/src/api/ai.ts) 20–62 (3 options, provenance)                 | 127–150, optional `best`, no length bounds    |

`currentOperations` spreads `learningContentOperations(ProblemSchema)` with **this** ProblemSchema
([`current.ts`](../../packages/core/src/api/current.ts) 176–179). Target imports the shared
`ProblemSchema` ([`target.ts`](../../packages/core/src/api/target.ts) 9). Runtime auth/sync still
import **`@loro/core/api/target`** for types (`apps/api/src/auth/auth.service.ts`,
`sync.service.ts`, `auth.controller.ts`).

[`api-contracts.md`](../architecture/api-contracts.md) contradicts itself: L77–79 say the current
registry omits the three v2 catalog routes; L203–204 say they are registered (28 ops). The code
spreads them (finding: L178–179).

`LocaleSchema = z.literal('es-ES')` in `common.ts` 43 is the **legacy** catalog/AI locale. v2
learning-content correctly uses `TARGET_LOCALES`
([`learning-content.ts`](../../packages/core/src/api/learning-content.ts) 7–11). Do not “fix” legacy
content/AI to multilingual as a cleanup — that is plan 61/76 migration.

**Why it matters.** Generated `openapi.current.json` can document a different surface than target
validators and Nest parsers. The next contract change will be applied to the wrong schema.

**Strategy.** `current.ts` should import Problem/Health/Manifest/Diff/Pack/Scene from the shared
modules, or a generator should emit current ops from those modules. Keep current vs target as
**operation lists and status**, not forked Zod. Runtime should import `account` / `oauth` / `sync`,
not `target`, once the types are identical. Fix the L77–79 sentence in `api-contracts.md` in the
same change.

**Sequence.** Contract PR: `pnpm contracts:generate` + `pnpm contracts:check` +
`contracts.e2e.test.ts`. **Blast radius:** `packages/core/src/api/*`, committed OpenAPI JSON, API
controllers that parse current schemas. **Do not** install target AI/content middleware, change
legacy `/content/*` behaviour, or widen `LocaleSchema` as a drive-by.

---

### 3. Practice routes beside the engine/store contracts — P0/P1

The store split is already done ([`store/index.ts`](../../apps/mobile/src/store/index.ts) documents
the former 469-line module; slices compose in [`store.ts`](../../apps/mobile/src/store/store.ts)
102–108). Routes still punch holes in `AppActions`.

#### 3a. Raw `setState` for Stream cursor and Refrain begin — P0, refactor now

```59:61:apps/mobile/app/practice/stream.tsx
  const setCursor = (streamCursor: number): void => {
    useApp.setState({ streamCursor })
  }
```

Refrain plans through `refrainEngine.plan`, then writes `refrainResume` with `useApp.setState`
([`refrain.tsx`](../../apps/mobile/app/practice/refrain.tsx) 388–401) and toasts via
`useApp.getState().showToast` (405). The refrain slice owns clear/complete
([`slices/refrain.ts`](../../apps/mobile/src/store/slices/refrain.ts)) but not “begin planned
session”. `AppActions` has no `setStreamCursor` / `beginRefrainSession`
([`types.ts`](../../apps/mobile/src/store/types.ts) 29–82).

**Why.** `createAppStore` wraps persistence around slice `set`. Ad-hoc `setState` skips that
contract and is how cursor/session and checkpoints diverge.

**Strategy.** Add `setStreamCursor` on the practice or UI slice. Add
`beginRefrainSession(plan, wave)` / keep checkpoint writes on the refrain slice. The hook only calls
actions.

**Blast radius:** `stream.tsx`, `refrain.tsx`, `slices/*`, `types.ts`, refrain/Today E2E. **Do not**
change wave lock behaviour or resume identity.

#### 3b. Speak bypasses `plan()` — P1, refactor now / as you touch Speak

[`speak.tsx`](../../apps/mobile/app/practice/speak.tsx) constructs a private `new SpeakEngine()`
(L18), filters `isActive` locally (25), and hand-builds a one-item `SessionHandle` (121–140) before
`speakEngine.record`. [`SpeakEngine.plan`](../../packages/core/src/engines/speak.ts) 28–44 already
emits the same item shape. Store exports `streamEngine` but not `speakEngine`; mobile routes never
call `streamEngine` (only [`engines.ts`](../../apps/mobile/src/store/engines.ts) 112 and
`index.test.ts`).

**Strategy.** Export `speakEngine` from `engines.ts`. Plan once per course/queue; `record` against
that session; drive the cursor from the handle like Refrain. Keep reveal/skip non-production (engine
already returns `{ phraseId }` when not produced).

**Blast radius:** `speak.tsx`, `engines.ts`, `e2e/speak.spec.ts`. **Do not** invent latency or mark
reveal as spoken success.

#### 3c. Do not wire `StreamEngine.plan()` yet

[`StreamEngine.plan`](../../packages/core/src/engines/stream/index.ts) 41–76 expands each phrase by
`repeatTarget` into listen items. The Stream **screen** is still a rating/browse surface
(`setDifficulty`, comment at `stream.tsx` 7–8: manual navigation until native playback). Ranking
already goes through Rust (`streamRank` 62–71). Calling `plan()` now would change the UI model
without audio.

**Do not refactor yet** — plan 62 (native playback / hands-free). Until then, typed cursor (3a) is
the Stream cleanup. Leave the `streamEngine` export as the intended seam; do not delete it as dead
code.

---

### 4. Phrase / sync field maps in three places — P1, refactor soon (before the next syncable field)

**What is wrong.**

1. SQL snake_case list: `PHRASE_COLUMN_NAMES`
   [`packages/core/src/persistence/sqlite/phrase.ts`](../../packages/core/src/persistence/sqlite/phrase.ts)
   48–88.
2. Wire camelCase → SQL: `PHRASE_COLUMNS`
   [`apps/mobile/src/data/sync.ts`](../../apps/mobile/src/data/sync.ts) 47–84.
3. Merge classes: `FIELD_POLICY.user_phrase`
   [`packages/core/src/sync/fieldPolicy.ts`](../../packages/core/src/sync/fieldPolicy.ts) 49–103.

Plus `userPhraseValues` in [`api/sync.ts`](../../packages/core/src/api/sync.ts). `sync.ts` also
reimplements `firstRow` / `readText` (29–36) instead of core `driver.ts` helpers, with `SyncError`
vs `Error`.

Two `SyncEntity` types: policy includes `trip` / `trip_drop` / `trip_phrase` (`fieldPolicy.ts`
32–44); wire `fieldsByEntity` does not (`api/sync.ts` 248–259). That is **plan 69 / Q-07**, not a
map to collapse — but the name collision should be documented at both sites.

**Strategy.** One module next to `fieldPolicy` that lists phrase (and settings) **syncable** fields
with SQL name + merge class. SQL `PHRASE_COLUMN_NAMES` can be derived or drift-checked against it.
Keep per-table `ON CONFLICT` upserts — do **not** write a generic upsert helper (column ownership is
the point; `INSERT OR REPLACE` is already gone, surviving only as comments).

**Blast radius:** core persistence, `fieldPolicy.test.ts`, mobile `sync.ts` / `learner.ts`
`phraseFields` (46–67). **Do not** add trip entities to the wire as a cleanup.

---

### 5. API auth naming, twin JWKS, two `/me` reads — P1, refactor as you touch auth

Both pairs are live in [`app.module.ts`](../../apps/api/src/app.module.ts) 36–44, 58–67:

| File                      | Role                                              |
| ------------------------- | ------------------------------------------------- |
| `auth/auth.service.ts`    | Account/session engine (555 lines)                |
| `auth/service.ts`         | Browser OAuth handoff (`OAuthFlowService`)        |
| `auth/auth.controller.ts` | Direct Google/Apple/email + `GET /me`             |
| `auth/controller.ts`      | PKCE start/callback/exchange + `GET /auth/me`     |
| `auth/auth.guard.ts`      | Bearer → principal                                |
| `auth/guard.ts`           | `AuthBoundaryGuard` (blocks AI when auth on)      |
| `auth/module.ts`          | Not a Nest `@Module` — lifecycle/`buildAuth` only |

`GET /me` returns `{ user, device_id }`
([`auth.controller.ts`](../../apps/api/src/auth/auth.controller.ts) 119–128). `GET /auth/me` returns
a bare `User` ([`controller.ts`](../../apps/api/src/auth/controller.ts) 105–110). Two JWKS +
`jwtVerify` paths: [`auth.providers.ts`](../../apps/api/src/auth/auth.providers.ts) 7–50 vs
[`provider.ts`](../../apps/api/src/auth/provider.ts) 7–118. Same type name `IdentityProvider` means
a string union in one file and an OAuth interface in the other.

**Strategy.** Rename files to `oauth-flow.service.ts` / `oauth.controller.ts` /
`auth-boundary.guard.ts` (or `auth/oauth/`). One JWKS helper used by native ID-token and code
exchange. Keep both `/me` shapes until a contract revision explicitly aliases them — do not silently
unify responses. Optional later: Nest `AuthModule` imported by `AppModule` (today the whole API is
one `@Module`).

**Blast radius:** API auth, OpenAPI paths (unchanged if decorators stay), account E2E. **Do not**
register Anthropic, add billing, or merge client SQLite with Postgres schemas.

---

### 6. Architecture docs vs code — P0, refactor now (docs-only PR is valid)

[`backend.md`](../architecture/backend.md) L10–16 still says learning data does not connect to
Postgres and the module map omits `auth/`. The seam table (L36) still lists `InMemorySyncRepository`
as current. Code:

```68:69:apps/api/src/app.module.ts
    { provide: DATABASE, useClass: PostgresDatabase },
    { provide: SYNC_REPOSITORY, useClass: PostgresSyncRepository },
```

Memory sync is a **test adapter** (`sync.repository.memory.ts`, used by `sync.service.test.ts` and
contract e2e). Redis/MinIO/workers remaining unimplemented is still true — only the Postgres claim
is stale.

[`mobile-app.md`](../architecture/mobile-app.md) route table (112–125) omits `/more` and
`/settings`, which exist on disk and are `built` in
[`navigation.ts`](../../apps/mobile/src/lib/navigation.ts) 36–37. ESLint already mentions
`src/features` / `src/engines` folders that are not on disk
([`eslint.config.mjs`](../../eslint.config.mjs) 82–120) — that matches the **target** layer diagram,
not a missing rewrite.

[`calendar.ts`](../../packages/core/src/domain/calendar.ts) L15 still says “The app has no UniFFI
bridge yet”. UniFFI exports `streak_day_for` today; production JS still uses the TS mirror via
`streakDayFor` in [`clock.ts`](../../apps/mobile/src/lib/clock.ts) 23, 61–62. Parity fixtures
(`calendar.fixtures.json`, `core-rs/tests/parity.rs`) keep the two honest. The JSON WASM `bridge.rs`
does **not** dispatch calendar methods (HLC is bridged: `hlc_tick` / `hlc_receive`).

[`persistence.test.ts`](../../apps/mobile/src/data/persistence.test.ts) L39: “HLC, which has no JS
bridge yet” — stale; [`lib/core.ts`](../../apps/mobile/src/lib/core.ts) 32–45 calls `hlc_tick`.

[`store/index.ts`](../../apps/mobile/src/store/index.ts) L19: `coreFacade.ts` is a “TEMPORARY JS
stand-in”. [`coreFacade.ts`](../../apps/mobile/src/store/coreFacade.ts) L116–117:
`jsCoreFacade = rustCoreFacade` with no JS fallback.

**Strategy.** Patch those sentences to match HEAD. Keep the TypeScript calendar until widgets need
the native function (plan 70) — deleting it now is not required; lying about UniFFI is. **Do not**
unify `apps/api/src/common/clock.ts` with mobile `clock.ts` (API file already explains it is not
`@loro/core` `Clock`).

---

### 7. Oversized modules to split along existing seams — P1, as you touch

| Module                                                                                       | Lines | Split (keep behaviour)                                                                                                                                    |
| -------------------------------------------------------------------------------------------- | ----: | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`apps/mobile/app/add.tsx`](../../apps/mobile/app/add.tsx)                                   |  1024 | Colocate `ImportPhrases` + `useSuggestions` / `useAddDraft` next to the route. Leave `ThemeGrid` / `TaggingSheet` until a second caller.                  |
| [`apps/mobile/app/practice/refrain.tsx`](../../apps/mobile/app/practice/refrain.tsx)         |   868 | Move `useRefrainSession` with 3a. Do **not** promote `WarmingCard` (Q-14 / one call site).                                                                |
| [`apps/mobile/src/lib/copy.ts`](../../apps/mobile/src/lib/copy.ts)                           |  1376 | Section files (`copy/today.ts`, …) re-exported so `copy.*` paths stay stable for E2E. Strings already live in `src/lib/i18n/`.                            |
| [`apps/mobile/src/data/sync.ts`](../../apps/mobile/src/data/sync.ts)                         |   738 | Column maps (item 4); apply vs push/pull.                                                                                                                 |
| [`apps/mobile/src/data/learner.ts`](../../apps/mobile/src/data/learner.ts)                   |   476 | Load vs commit vs `phraseFields`.                                                                                                                         |
| [`apps/mobile/src/data/persistence.test.ts`](../../apps/mobile/src/data/persistence.test.ts) |  1299 | Eligibility block (~401–488) as its own file; keep one adversarial history.                                                                               |
| [`apps/mobile/src/lib/account/client.ts`](../../apps/mobile/src/lib/account/client.ts)       |   414 | Session vs vault vs refresh under `lib/account/`. `src/auth/` is the OAuth port — not a duplicate.                                                        |
| [`apps/api/src/auth/auth.service.ts`](../../apps/api/src/auth/auth.service.ts)               |   555 | Collaborators behind the same Nest provider when editing sign-in/claim.                                                                                   |
| [`scripts/ci-local.mjs`](../../scripts/ci-local.mjs)                                         |  1067 | `inventory` / `jobs` / `workspace` / `main` as already-exported helpers. Do not change the job graph. `ci-local.test.mjs` already treats it as a library. |

**WAVES triplication — P0-small, do now.** Identical `['morning', 'midday', 'evening']` in
`app/index.tsx` 80–81, `practice/refrain.tsx` 73–74, `_layout.tsx` 31. Times are already
`PRODUCTION_WAVE_TIMES` in `engines.ts` 96. Helpers already live in
[`lib/waves.ts`](../../apps/mobile/src/lib/waves.ts). Export `PRODUCTION_WAVES` next to the times.

**Practice empty-state copy-paste — P2, as you touch.** `stream.tsx` 77–91 and `speak.tsx` 29–39
share `copy.stream.empty`. A route-local helper taking labels; not a store-aware component.

**Postgres tests — P1, as you touch auth/sync tests.** Same `CREATE SCHEMA` +
`LORO_TEST_DATABASE_URL` + `describe.skipIf` in `auth.postgres.test.ts` (494), `auth.test.ts`,
`http.test.ts`, `auth-sync.postgres.test.ts`, `sync.postgres.test.ts` (405). Extract
`apps/api/src/testing/postgres-schema.ts`. Share phrase/envelope fixtures between
`sync.service.test.ts` (819) and `sync.postgres.test.ts`. Keep the memory repository; move it under
`sync/testing/` so it cannot look production-ready.

**E2E `states.ts` (763) — as you touch new screens.** Manifest + helpers (597–763) in one file. Move
`doOneRep` / `lockIn` to `e2e/helpers/`; keep `STATES` as the single row that buys a11y, text-scale
and coverage. `accountFlow.ts` is the mock owner, not a duplicate.

**Do not** extract Today `DayRow` / `NavRail` ahead of plans 56/81. **Do not** split `navigation.ts`
(313) — it is the declaration table for planned surfaces.

---

### 8. Generated artifacts and remaining dual maths — P1/P2

**Healthy (do not “fix”).** UniFFI Swift/Kotlin under `packages/core-rs/bindings/`; iOS consume
symlinks; WASM embed check; tokens `design-tokens/out/`; `pnpm contracts:check`.
`checkGeneratedDrift` in `ci-local.mjs` 307–321 is git porcelain on those trees.

**Weaker than contracts:** UniFFI has no regenerate-and-diff `--check` analogous to WASM
`embed-wasm.mjs --check` (comment in core-rs `build.sh`). Tighten when touching the generator, not
as a standalone rewrite.

**Calendar TS mirror:** keep + update comments (item 6). Deleting `domain/calendar.ts` waits on
widgets calling UniFFI directly (plan 70) and on adding calendar to the JSON `bridge.rs` if JS
should stop mirroring.

**Content `checks.ts` vs `multilingual.ts`:** not duplicated logic. `checks.ts` (323) validates
on-disk Spanish; `multilingual.ts` adapts with hardcoded `cafe1` exceptions (36–42). Mechanical
gates do not run on the transformed catalogs — structural at the package boundary, but bilingual
review (plan 87) owns acceptance. Do not delete the cortado exception as cleanup.

**Driver savepoints ×3:** `driver.opsqlite.ts` 24–39 and `driver.node.ts` 28–31 are the same
nested-transaction scaffold; web (`driver.web.ts`) is legitimately different (localStorage
snapshot). Extract a tiny `withSavepoints(run)` used by native/node only — P2, as you touch drivers.

**FSRS `record` triplication — P2.** Speak 66–79, Refrain 271–315, Review 155–162 all do
`reviewGrade` → `fsrsReview` → algorithm check → `universalDelta` + `srs`. Extract
`canonicalReviewDelta(...)` in `engines/common.ts` when adding the next engine. Do not merge the
engines.

---

## Sequencing

```
now, parallel:
  A. fakeRepository + seal TS Refrain numbers     (core / core-rs tests)
  B. current.ts import shared schemas             (contracts:generate/check)
  C. backend.md + mobile-app routes + stale comments
  D. PRODUCTION_WAVES + typed setStreamCursor / beginRefrainSession

then, can overlap:
  E. Speak plan() wiring                          (after D’s action pattern)
  F. phrase column map next to fieldPolicy        (before any new sync field)
  G. rename API auth files + shared JWKS          (when next touching auth)

as you touch:
  add.tsx import extract · copy.ts sections · learner/sync split
  Postgres test harness · ci-local.mjs modules · canonicalReviewDelta

must wait:
  StreamEngine.plan()          → plan 62 audio
  features/ folder rewrite     → second call site or unreadable route
  delete TS calendar           → plan 70 widgets + bridge dispatch
  trip SyncEntity on the wire  → Q-07 / plan 69
  Nest AuthModule split        → optional with G, not a prerequisite
  WarmingCard → ui/components  → Q-14 / second engine
```

A–D do not share files. E depends on D. F should land before plan 68 adds fields. G should not
silently change `/me` JSON.

---

## Explicit non-goals

- Rewriting the app into `features/` / `domain/` / `platform/` folders. The target diagram in
  [`mobile-app.md`](../architecture/mobile-app.md) is incremental: move a concern when it is shared
  or the route is no longer readable. ESLint already reserves those paths.
- A second TypeScript FSRS, ranker, or merge. Rust owns those numbers (ADR-0002).
- Generic SQL upsert / ORM. Handwritten `ON CONFLICT` and column ownership stay.
- Unifying mobile `clock.ts` with API `ServerClock`, or SQLite DDL with Postgres auth/sync DDL.
- Registering Anthropic, enabling billing, workers, Redis, CDN, widgets, DSP, or screens 9–23.
- Deleting `ReviewEngine` as dead code — it is the P3-30 boundary; the screen is unfinished (plan
  75).
- Changing learner-facing copy keys, token geometry, or E2E locators “while we are in there”.
- Hand-editing generated bindings or `design-tokens/out/`.

---

## Looks like debt, is unfinished plan work

| Surface                                                                  | Owner    | Why it is not a cleanup                                                                 |
| ------------------------------------------------------------------------ | -------- | --------------------------------------------------------------------------------------- |
| `ReviewEngine` unwired in `store/engines.ts`                             | 75       | Engine shipped; Review route is planned in `navigation.ts`                              |
| `EngineId` includes prosody / roleplay / run                             | 76/77/78 | ADR-0006 contract                                                                       |
| Trip entities in `FIELD_POLICY` / `draft.ts`                             | 69, Q-07 | Draft on purpose; not on `target`                                                       |
| `StreamEngine` unused by the Stream route                                | 62       | Hands-free listen `plan()` vs current rating UI                                         |
| Dual FSRS algorithm IDs (`FSRS_ALGORITHM` vs `LEGACY_PREVIEW_ALGORITHM`) | 60       | Provenance/migration, not two schedulers                                                |
| Anthropic `integrations/` unregistered                                   | 76/86    | Explicit; comments that say “one line in app.module” should be toned down, not executed |
| `select.rs` 652 / `scheduler.rs` 546 / `merge.rs` 716                    | 60       | Complexity in the right crate                                                           |
| `Workbench.tsx` 714                                                      | 80       | Dev-only specimen host                                                                  |
| Multilingual `pending-bilingual-review` + `cafe1` exceptions             | 87       | Linguistic acceptance                                                                   |
| `sync.ts` size / OS background sync / export                             | 68/67    | Lifecycle remaining                                                                     |
| Independent content packs / SHA `content.ts` target schemas              | 61       | Delivery not refactor                                                                   |
| `ci-local.mjs` calling other scripts                                     | 72       | Orchestration, not duplication                                                          |

---

## What is already healthy

- Store slices + `applyDelta` as the only progress writer; phrase flags stay in `slices/phrases.ts`.
- One device `Date` owner (`apps/mobile/src/lib/clock.ts`) with ESLint.
- Engine `common.ts` (`universalDelta`, `availableWhenActive`) and conformance.
- SQL in `@loro/core` persistence; mobile injects `SqlDriver`. No live `INSERT OR REPLACE`.
- Eligibility parity tests for memory/SQL/store (`persistence.test.ts` ~414–488).
- Merge: TS `fieldPolicy` + Rust `merge.rs`.
- Audio: `audioSpeech.ts` → controller → `bridge` / `bridge.native` — layers, not copies.
- Core: `lib/core.ts` JSON call → WASM/UniFFI; `jsCoreFacade` is an alias.
- `auth/` vs `lib/account/` on mobile — OAuth ports vs session/vault.
- `ToastHost` store+copy imports — documented shell exception (`mobile-app.md`).
- Generated tokens/bindings committed and porcelain-checked.

---

## Open questions

1. Should `GET /auth/me` remain a distinct User-only read, or is it an accidental twin of `GET /me`?
   Contract change, not a rename.
2. When calendar moves to `bridge.rs` / UniFFI for JS, does widget native code call UniFFI directly
   (plan 70) so the TS module can be deleted rather than kept as a third copy?
3. Is `LocaleSchema = es-ES` frozen for legacy content/AI until those routes are migrated, or should
   the name become `LegacyLocaleSchema` now to stop multilingual work from importing it by mistake?

---

## Inspection limits

Not a device, security, or linguistic certification. Native module bodies
(`LoroAudioSpeechModule.swift` / `.kt`, `LoroCoreModule`) were not line-reviewed; they look like
thin bridges and stay owned by plans 58/62/63. DSP Rust (`dsp/*`) was treated as gated, not as
cleanup. OpenAPI JSON was not diffed path-by-path against every Nest decorator. Scenario overlap
between the 819-line sync service tests and 405-line Postgres tests was sampled via shared fixtures,
not case-mapped. Live `/me` vs `/auth/me` against the deployed gateway was not exercised.
