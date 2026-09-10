# Whole-project improvement assessment — 2026-09-09

**Reviewed:** 2026-09-09. **Branch:** `main`. **HEAD:** `706858ceadd59fb317ed687d7160136b53bdebd9`.
**Status note:** Items 1–3 (ADR-0012, ADR-0008, leftover item C docs) landed after this snapshot.
**Requirements:** identify what to refactor, which tools and libraries to use, and which practices
to follow (F-02/F-03/F-04, ADR-0001–0014), without completing product plans or claiming
device/release acceptance.

**Disposition: document only** when written. A–G and the ADR amendments landed afterwards. Remaining
executable hygiene, Field/ListRow extracts, snippets and UniFFI `--check` are
[plan 100](../../plans/100-hygiene-reuse-and-tooling.md). This review still does not implement
refactors, install packages, or archive remaining-work owners. Device, bilingual, provider and the
fifteen unbuilt learner screens stay with [plans/README.md](../../plans/README.md).

Two companions already exist and remain authoritative in their narrower scopes:

| Companion                                                                        | Owns                                                                                      |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| [Refactoring strategies](2026-09-09-refactoring-strategies.md)                   | Shipped-code A–G sequence. Those items landed in `706858c`. Do not redo them.             |
| [Native libraries and approaches](2026-09-09-native-libraries-and-approaches.md) | Expo/RN keep-vs-adopt-vs-avoid for touch, speech, persistence, notifications and widgets. |

This file is the **whole-project** answer: every package, the ADRs versus HEAD, tools outside Expo,
and the practices that are enforced versus merely written down.

---

## Executive answers

### What should be refactored

The store slices, engine contract, handwritten SQL, generated Rust bridges and A–G cleanup are
already the right shape. Do **not** rewrite `features/`, replace Expo, add a client ORM, or grow a
second maths layer.

The expensive remaining debt is **decisions and docs that still describe an earlier system**, plus a
few contract/import holes A–G left on purpose or only half-closed:

1. **Amend ADR-0012** to the write-through Zustand projection that actually shipped. There is no
   `useLiveQuery` in the tree. The ADR's sample is a Drizzle live query, which ADR-0003 later banned
   on the client. Treating the current store as a failed live-query migration would send the next
   fifteen screens into the wrong rewrite.
2. **Amend ADR-0008** the same way ADR-0003 was amended: the API uses `pg` + handwritten SQL, not
   Drizzle, and Redis is intentionally unprovisioned (plan 88). Installing those as cleanup would
   add a third schema language for no sync-correctness gain.
3. **Finish the doc-inventory pass** that A–G called item C. `backend.md` and the mobile route table
   were patched; [`mobile-app.md`](../architecture/mobile-app.md) §State still says a process kill
   loses all data and that `coreFacade.ts` is a JS stand-in, and its layer table omits live
   `src/auth/` and `src/services/`; [`onboarding.md`](../process/onboarding.md) opens by denying
   native modules and SQLite that §4–6 then describe as present;
   [`overview.md`](../architecture/overview.md) still lists "Postgres 16 + Drizzle".
4. **Stop importing `@loro/core/api/target` from production account/sync clients.** Auth/sync
   schemas already live in `account.ts` / `sync.ts`. Target remains the roadmap document.
5. **Keep current Manifest/Pack as documented weaker envelopes** until plan 61 ships `resource_base`
   and checksums. Do not "fix" them to the target schemas as cleanup. Do parse legacy `/content/*`
   responses with the current Zod envelopes so egress matches OpenAPI.
6. **Checkpoint Speak session the way Refrain does**, or document it as explicitly ephemeral.
   `speak.tsx` still holds `SessionHandle` in `useState`, so a remount drops mid-phrase work.
7. **Split the remaining oversized routes as you touch them** (`account.tsx`, Today, onboarding,
   Progress). Do not extract one-call-site cards (WarmingCard, ThemeGrid, ChoiceRow).

Everything else that looks like debt is an unfinished plan, a named gate, or a dual that must stay
(TS calendar until plan 70, both `/me` shapes until a contract revision, `StreamEngine.plan()` until
recorded audio).

### What tools and libraries should be used

**Keep the decided stack.** React Native + Expo SDK 54, Zustand, OP-SQLite + sql.js, NestJS 11 +
Postgres 16 + `pg`, Rust/`loro-core` via UniFFI and WASM, Zod 4 shared contracts, custom token
generator, Ajv 2020-12 content checks, pnpm 9 + Turborepo, Vitest, Playwright, local
`pnpm ci:local`.

**Adopt next only with a named owner:** `expo-haptics` behind a named policy, keyboard-controller
with plan 56 input work, Maestro under plans 58/72, `expo-notifications` with plan 70, Skia with
plan 77, FlashList when catalogs outgrow `ScrollView`. Install Expo modules with `npx expo install`.
Pin `react-native-worklets` at 0.5.1.

**Do not adopt:** Flutter/SwiftUI+Compose rewrites; Redux/MobX/Jotai/TanStack Query for learner
state; Tamagui/NativeBase/NativeWind; client Drizzle/Prisma/Watermelon/PowerSync; `ts-fsrs`;
`expo-speech` / `expo-av` as the production graph; cloud ASR; Style Dictionary / Tokens Studio;
Supabase/Firebase; Passport; Redis/BullMQ/CDN in this testing phase; GitHub Actions as a required
gate.

### What practices and approaches should be followed

Follow the rules that lint and CI already enforce: layer imports, no colour literals, one device
`Date`, no `Math.random` in engines, no AsyncStorage credentials, copy ownership, merge-class
coverage, generated-artifact drift, conventional commits, Gitleaks, `states.ts` rows with
learner-visible behaviour.

Follow the architectural habits that made A–G cheap: compose routes and extract at the second call
site; write progress only through `applyDelta`; commit SQLite + outbox before publishing Zustand;
drive practice through `engine.plan()` only when the UI matches that plan; keep Rust as the only
reproducible maths; treat Playwright as web evidence, not device evidence.

Stop treating stale "Current" paragraphs as inventory. When a change makes an architecture sentence
false, patch it in the same PR. Do not create empty `features/` / `domain/` / `platform/` folders to
resemble the target diagram.

---

## Context and method

Inspected the tree at `706858c`: package manifests and lockfile-facing versions, largest
TypeScript/Rust modules, ESLint/Turbo/Husky gates, ADR text versus `AppModule` / `store.ts` /
`database.ts`, contract entry points, and the two companion reviews. Evidence is file existence,
imports, line counts and ADR wording — not roadmap vibes and not a new device run.

**In scope:** every buildable package, the decided toolchain, enforced versus documented practices,
and structural debt in code that already runs.

**Out of scope (not this review):** implementing screens 9–23, widgets, DSP quality, production
audio, billing, live Claude, bilingual reviewer sign-off, physical-device/iOS acceptance, account
export/erasure. Those are unfinished plans.

No earlier `docs/reviews/` file answers the three questions together across mobile, core, Rust, API,
content, tokens and CI. The companions cover shipped-code cleanup and native packages only.

---

## Current stack — keep this

Pinned or workspace-declared at HEAD. Versions from package manifests, not a fresh lockfile
resolution pass.

| Layer            | Tooling already in tree                                                                                 | Why it stays                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Monorepo         | pnpm 9.12, Node 22, Turborepo 2, TypeScript 5.9, ESLint 9 flat, Prettier 3, Husky, commitlint, Gitleaks | ADR-0014. Atomic contract changes. `node-linker=hoisted` is the Metro tax.               |
| App              | Expo 54.0.36, RN 0.81.5, React 19.1, Expo Router 6, New Architecture on                                 | ADR-0001. Shares `@loro/core` with the API.                                              |
| Session state    | Zustand 5                                                                                               | ADR-0012's session tier. SQLite is durable truth; the store is the published projection. |
| Device DB        | `@op-engineering/op-sqlite` 18 + handwritten SQL in `@loro/core`                                        | ADR-0003 amendment. JSI, WAL, column-owned `ON CONFLICT`.                                |
| Browser DB       | sql.js 1.14                                                                                             | Same statements; atomic localStorage snapshot.                                           |
| Maths            | `packages/core-rs` (UniFFI 0.32, wasm-bindgen, serde). rust-version 1.88                                | ADR-0002. No I/O in the crate.                                                           |
| Contracts        | Zod 4 in `@loro/core/src/api/*`, generated OpenAPI, `current` / `target` / `draft`                      | One validator per endpoint.                                                              |
| API              | NestJS 11, Express platform, `pg` 8, jose 6                                                             | ADR-0008's Nest+Postgres decision. Drizzle/Redis are **not** installed.                  |
| Auth (client)    | expo-secure-store, expo-web-browser, expo-network                                                       | Native refresh vault; browser sessions stay in memory.                                   |
| Copy             | i18next + ICU + react-i18next over `src/lib/copy`                                                       | No learner-facing literals in `app/`.                                                    |
| Tokens           | Custom JSON → TS/Swift/Kotlin generator + contrast gate                                                 | ADR-0013. Blueprint is the source, not Figma.                                            |
| Content          | JSON catalogs, Ajv 2020-12, mechanical `checks.ts`, multilingual adapter                                | ADR-0009. Bundled snapshot + independent delivery target.                                |
| Speech           | Local Expo module `loro-audio-speech`                                                                   | ADR-0005/0007. On-device only; no PCM to JS.                                             |
| Tests            | Vitest 4, Playwright 1.62, axe, Rust `#[cfg(test)]` + parity, Criterion benches                         | Local CI. GitHub Actions disabled.                                                       |
| Secrets / deploy | SOPS + age, Docker Compose, EC2 scripts                                                                 | Encrypted env only. No managed Redis/CDN in the testing profile.                         |

`expo-font`, `react-native-reanimated` and `react-native-gesture-handler` are **installed**. Font
loading and app-source Reanimated/RNGH imports are not. That is unused capacity, not a missing
rewrite. Worklets stay pinned at 0.5.1.

---

## 1 · What should be refactored

### How to read this inventory

| Bucket                    | Meaning                                                               |
| ------------------------- | --------------------------------------------------------------------- |
| **Already landed**        | A–G and the 2026-09-10 extracts. Do not open a second pass.           |
| **Refactor now / soon**   | Existing code or docs; small PR; low collision with remaining screens |
| **Refactor as you touch** | Extract or rename in the change that already owns the file            |
| **Do not refactor yet**   | Collides with an unfinished plan, a gate, or a non-negotiable         |
| **Not refactoring**       | Missing product, not structural debt                                  |

Priorities: **P0** silent-drift or contract risk; **P1** makes the next owned feature safer; **P2**
hygiene.

### Already landed — do not redo

Verified at `706858c`. Details and blast radii stay in the
[refactoring-strategies](2026-09-09-refactoring-strategies.md) status tables.

- `fakeRepository` uses `isActive` / `isDue`. PhraseState `order_stream` is gone; candidates remain.
- TS Refrain formulae are not exported. `fakeCore()` binds `refrainFixtures.ts`. `fsrsReview` stays
  a labelled test double.
- `current.ts` imports shared Problem/Health/Diff/Scene. Implemented Manifest/Pack stay local weaker
  envelopes.
- `PRODUCTION_WAVES`, `setStreamCursor`, `beginRefrainSession`. App-source `useApp.setState` remains
  only in store tests.
- `speakEngine` export; Speak plans through the engine.
- `syncableColumns.ts` next to `FIELD_POLICY`; SQL drift-checked.
- Auth files renamed; `jwks.ts` shared. No Nest `AuthModule`. Both `/me` shapes kept.
- Add extract, `useRefrainSession`, `copy/` sections, learner/sync splits, eligibility harness, API
  Postgres test helper, `ci-local/` modules, `canonicalReviewDelta`, empty-practice helper, account
  types/credentials, auth session/claim collaborators, `e2e/helpers`, `withSavepoints`,
  `previewNativeLanguage`.

### 1. ADR-0012 describes a store that was never built — P0, docs/decision now

**What is wrong.** ADR-0012 decides "Zustand for session state, live SQLite queries for everything
durable" and shows a Drizzle `useLiveQuery`. HEAD has **zero** `useLiveQuery` / `liveQuery` callers.
Durable rows live in `AppData.phrases` / per-course copies
([`state.ts`](../../apps/mobile/src/store/state.ts)).
[`store.ts`](../../apps/mobile/src/store/store.ts) wraps slice `set` so SQLite + outbox commit
**before** publication. That is a write-through projection, and it is the pattern that keeps web
sql.js and native OP-SQLite on one code path.

ADR-0003's 2026-07-30 amendment banned client ORMs. ADR-0012 was not amended. The sample cannot be
implemented without reversing that amendment.

[`mobile-app.md`](../architecture/mobile-app.md) contradicts itself: the status table correctly says
"Repository projections in Zustand; durable writes commit to SQLite first", then §State Current says
`store.ts` has no persistence and "Reloading or killing the process loses all of it", and §Engines
still calls `coreFacade.ts` a temporary JS stand-in.
[`index.ts`](../../apps/mobile/src/store/index.ts) already documents `jsCoreFacade` as an alias.

**Why it matters.** A contributor who believes ADR-0012 will try to delete the phrase array, add
Drizzle, or adopt TanStack Query — all three are the bugs the store split closed.

**Strategy.** Amend ADR-0012: durable truth is SQLite; Zustand holds the committed projection plus
session/ephemeral state; live native queries are a revisit if OP-SQLite reactivity is needed at ~2
000 phrases **and** a web equivalent exists. Patch the stale `mobile-app.md` paragraphs in the same
change. Do **not** implement `useLiveQuery` as cleanup. Do **not** add TanStack Query for learner
rows.

**Blast radius:** two docs. Behaviour unchanged.

### 2. ADR-0008 still names Drizzle and Redis — P0, docs/decision now

**What is wrong.** ADR-0008's Decision line is still "Postgres 16 with Drizzle, Redis 7…". The API's
only database dependency is `pg`. Schema is additive SQL in
[`database/schema.ts`](../../apps/api/src/database/schema.ts) and
[`auth.schema.ts`](../../apps/api/src/auth/auth.schema.ts). The native-libraries companion row
"Server Drizzle (API Postgres) — Keep" is therefore false at HEAD. Redis, BullMQ, MinIO and workers
remain unused, which plan 88's ADR-0008 amendment already accepts for testing.

**Why it matters.** The next backend PR will "add the missing ORM" and fork column ownership away
from the handwritten `ON CONFLICT` discipline that already exists on the client.

**Strategy.** Amend ADR-0008: NestJS + Postgres + `pg` + handwritten SQL is current; Drizzle is a
revisit if the server schema grows past roughly a dozen tables or operators need a migration runner.
Redis/BullMQ wait for a real rate-limit or queue owner (plans 76/86), not for tidiness. The
native-libraries server-Drizzle row is already corrected to `pg`. Also patch
[`overview.md`](../architecture/overview.md) L270 ("Postgres 16 + Drizzle"). Compose Redis/MinIO
stay unused scaffolds — comment them as future, do not wire them.

**Blast radius:** ADR-0008, `overview.md`. Do not install `drizzle-orm`.

### 3. Onboarding and mobile-app "Current" paragraphs still lie — P0, docs now

**What is wrong.** [`onboarding.md`](../process/onboarding.md) L3–5: seven screens; native audio,
speech, ASR, widgets and on-device SQLite "do not" exist. L53: no custom native module yet. L128:
`modules/` is only an intended extension point. L157: native run failure is "expected until modules
are added". The same file's §4–6 describe PostgreSQL accounts, OP-SQLite, and `loro-audio-speech`.
Test counts at L56 (432 JS / 131 Rust) are also behind
[testing-strategy.md](../process/testing-strategy.md) (799 JS / 169 Rust).

This is the leftover of refactoring item C, which patched `backend.md`, the mobile route table, and
calendar comments, then stopped.

**Strategy.** One docs PR: opening inventory, bootstrap claims, test counts, and the `modules/`
sentence. Keep the honest "browser E2E is not device acceptance" warning. Update `mobile-app.md`
§State/§Engines as in item 1, and add `src/auth/` (OAuth ports) and `src/services/` (account sync)
to the current-directory table. ESLint blocks for not-yet-created `engines/` / `domain/` stay as
target reservations — do not create empty folders.

**Blast radius:** `onboarding.md`, `mobile-app.md`, `overview.md`. No product behaviour.

### 4. Production clients still import `api/target` — P1, refactor soon

**What is wrong.** Item B said runtime should import `account` / `oauth` / `sync` once the types are
identical. Production still binds the roadmap entry:

| Caller                                                                 | Import                                                              |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------- |
| [`lib/account/client.ts`](../../apps/mobile/src/lib/account/client.ts) | `MagicLink*` / `SignInResponse` / `TokenResponse` from `api/target` |
| [`lib/sync/client.ts`](../../apps/mobile/src/lib/sync/client.ts)       | `MAX_SYNC_BYTES`, `PushOp` from `api/target`                        |
| [`lib/sync/codec.ts`](../../apps/mobile/src/lib/sync/codec.ts)         | `PushOpSchema` from `api/target`                                    |
| [`lib/sync/transport.ts`](../../apps/mobile/src/lib/sync/transport.ts) | target sync types                                                   |

Tests and `contracts.e2e.test.ts` may keep `target` for roadmap assertions.

**Why it matters.** A draft field added to target becomes importable on the hot sync path without a
current-registry change.

**Strategy.** Point production modules at `@loro/core/api/account` and `@loro/core/api/sync` (or
`current` re-exports). Leave target for planned-surface tests.

**Blast radius:** mobile account/sync clients and their tests. Do not enable draft operations.

### 5. `fakeCore().streamRank` is still a second formula — P1, as you touch stream tests

**What is wrong.** Refrain numbers now come from fixtures. `streamRank` / `repeatTarget` in
[`testing/index.ts`](../../packages/core/src/testing/index.ts) 173–181 still reimplement
[`rank.rs`](../../packages/core-rs/src/rank.rs) `stream_rank` / `repeat_target`. Production
`rustCoreFacade` already calls Rust.

**Strategy.** Same as Refrain: documented fixtures or a WASM-backed fake. Keep `fsrsReview`
labelled. Do this in the change that next edits stream ranking tests, not as a standalone rewrite.

### 5b. Speak session lives in React state — P1, as you touch Speak

**What is wrong.** Refrain checkpoints `refrainResume` through the store. Speak plans through
`speakEngine` (A–G item E) but keeps the handle in route `useState`
([`speak.tsx`](../../apps/mobile/app/practice/speak.tsx) 29). A remount or process death drops
mid-phrase reveal/heard state. ADR-0012's session tier is "Zustand, checkpointed at transitions".

**Strategy.** Add a speak-resume slice next to refrain, or write a one-line comment that Speak
session is ephemeral until a named plan owns interruption resume. Do not invent latency or mark
reveal as spoken success while doing it.

### 5c. Legacy content HTTP egress is unparsed — P1, as you touch content

**What is wrong.** [`content.controller.ts`](../../apps/api/src/content/content.controller.ts)
builds Manifest/Pack with local interfaces. Current Zod envelopes exist and are what OpenAPI
documents. Nest does not parse egress. Learning-content (v2) already consumes shared current
schemas.

**Strategy.** `ManifestSchema` / `PackSchema` from `current.ts` on the way out. Do not swap in
target `resource_base` checksums. Leave the missing service layer — the catalog is still a bundled
constant.

### 6. Oversized modules that survived the 2026-09-10 split — P1/P2, as you touch

Line counts at HEAD (generated bindings, `out/`, `target/` excluded):

| Module                                                                                          |           Lines | Split (keep behaviour)                                                               |
| ----------------------------------------------------------------------------------------------- | --------------: | ------------------------------------------------------------------------------------ |
| [`app/account.tsx`](../../apps/mobile/app/account.tsx)                                          |             881 | Colocate view-state machine / provider tiles next to the route. Leave until plan 67. |
| [`src/data/persistence.test.ts`](../../apps/mobile/src/data/persistence.test.ts)                |            1170 | Eligibility already extracted; split driver/recovery blocks only when adding cases.  |
| [`src/data/sync.test.ts`](../../apps/mobile/src/data/sync.test.ts)                              |             787 | Follows `sync.ts` (463) + apply/row. Split with the next syncable field.             |
| [`api/src/sync/sync.service.test.ts`](../../apps/api/src/sync/sync.service.test.ts)             |             806 | Fixtures already shared. Do not merge with the 398-line Postgres suite.              |
| [`app/index.tsx`](../../apps/mobile/app/index.tsx)                                              |             662 | Today. Do not extract `DayRow` / `NavRail` ahead of plans 56/81.                     |
| [`app/practice/refrain.tsx`](../../apps/mobile/app/practice/refrain.tsx)                        |             653 | Session hook landed. WarmingCard stays (Q-14).                                       |
| [`app/onboarding.tsx`](../../apps/mobile/app/onboarding.tsx)                                    |             574 | Step machine is one flow. Extract a step only at a second caller.                    |
| [`src/store/index.test.ts`](../../apps/mobile/src/store/index.test.ts)                          |             660 | Store contract tests. Split when a new slice would make the file unreadable.         |
| [`src/data/learner.test.ts`](../../apps/mobile/src/data/learner.test.ts)                        |             669 | Same.                                                                                |
| [`app/progress.tsx`](../../apps/mobile/app/progress.tsx)                                        |             508 | Rollups. No chart kit.                                                               |
| [`app/add.tsx`](../../apps/mobile/app/add.tsx)                                                  |             499 | Import/draft already extracted. ThemeGrid / TaggingSheet stay.                       |
| [`dev-tools/Workbench.tsx`](../../apps/mobile/src/dev-tools/Workbench.tsx)                      |             714 | Plan 80 specimen host.                                                               |
| [`core-rs` `merge.rs` / `select.rs` / `scheduler.rs`](../../packages/core-rs/src/sync/merge.rs) | 716 / 652 / 546 | Complexity in the right crate. Do not split for line count.                          |

`LocaleSchema = z.literal('es-ES')` in [`common.ts`](../../packages/core/src/api/common.ts) 43 is
the legacy catalog/AI locale. Rename to `LegacyLocaleSchema` when a multilingual change next imports
`common.ts`; do not widen it.

Account `client.ts` (455) still owns refresh + session in one class. Split when plan 67 adds
linking/export, not sooner.

### Must wait

Unchanged from the companions, rechecked at HEAD:

| Item                                               | Wait on                                         | Still true                                                      |
| -------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------- |
| `StreamEngine.plan()`                              | Plan 62 recorded / hands-free audio             | Stream route is still a rating surface (`stream.tsx` 381 lines) |
| `features/` folder rewrite                         | Second call site or unreadable route            | Folders do not exist; ESLint reserves the _target_ paths        |
| Delete TS `calendar.ts`                            | Plan 70 widgets + `bridge.rs` calendar dispatch | Comments now tell the truth; JS still mirrors                   |
| Trip `SyncEntity` on the wire                      | Q-07 / plan 69                                  | Policy has trips; `api/sync.ts` does not                        |
| Nest `AuthModule`                                  | Optional after a real second Nest module        | `AppModule` is still the only `@Module`                         |
| Unify `GET /me` and `/auth/me`                     | Contract revision                               | `{ user, device_id }` vs bare `User`                            |
| WarmingCard → `ui/components`                      | Q-14 / second engine                            | One call site                                                   |
| UniFFI regenerate-and-diff `--check`               | Next generator edit                             | WASM embed `--check` exists; UniFFI does not                    |
| Current Manifest/Pack → target                     | Plan 61 resource_base / checksums               | Local `z.looseObject` envelopes remain                          |
| Framework 400 / `INTERNAL` through `ProblemSchema` | Explicit error-catalog change                   | Status-coupled refine stays target-only                         |

### Not refactoring

| Surface                                            | Owner    | Why it is not cleanup                               |
| -------------------------------------------------- | -------- | --------------------------------------------------- |
| `ReviewEngine` unwired in the store                | 75       | Engine shipped; Review route is planned             |
| `EngineId` includes prosody / roleplay / run       | 76/77/78 | ADR-0006 contract                                   |
| Dual FSRS algorithm IDs                            | 60       | Provenance, not two schedulers                      |
| Anthropic `integrations/` unregistered             | 76/86    | Explicit seam; do not register as cleanup           |
| Multilingual `pending-bilingual-review` + `cafe1`  | 87       | Linguistic acceptance                               |
| Independent content packs / SHA target schemas     | 61       | Delivery, not refactor                              |
| Unused `expo-font` / Reanimated / RNGH app imports | 47/93/57 | Use when the animation, font or gesture task exists |
| `ci-local.mjs` orchestration                       | 72       | Job graph is the product                            |
| Fifteen unbuilt learner screens                    | catalog  | Product                                             |

---

## 2 · Tools and libraries

Legend: **keep** · **adopt next** (named owner) · **do not adopt** · **wait**.

The native Expo/RN matrix is not repeated row-by-row; see
[native-libraries](2026-09-09-native-libraries-and-approaches.md). This section covers the rest of
the project and the native rows that other layers must not contradict.

### Platform and product shape

| Item                       | Disposition                  | Why                                                                                                              |
| -------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| React Native + Expo SDK 54 | **Keep**                     | ADR-0001. Shared `@loro/core` with the API is the reason Flutter lost. New Architecture is already on.           |
| Local Expo Modules         | **Keep / extend**            | `loro-core`, `loro-audio-speech`. Next natives (audio graph, widgets) follow this shape, not the old bridge.     |
| Flutter / SwiftUI+Compose  | **Do not adopt**             | Doubles UI or splits the sync contract. Revisit only if Reanimated/Skia miss the 60 fps floor on a named screen. |
| EAS / Expo Go              | **Do not adopt** as required | Custom modules; `pnpm apk:local` is the Android preview. Expo Go cannot load them.                               |

### Language, repo, quality gates

| Item                                      | Disposition      | Why                                                                              |
| ----------------------------------------- | ---------------- | -------------------------------------------------------------------------------- |
| TypeScript 5.9 strict, ESLint 9, Prettier | **Keep**         | Layer, colour, clock and storage rules are the design system.                    |
| pnpm 9 + Turborepo                        | **Keep**         | ADR-0014. Stay hoisted until Metro resolves the isolated graph.                  |
| Isolated pnpm linker                      | **Wait**         | Metro cannot resolve it. Typecheck + `bundle` replace the phantom-dep guarantee. |
| Husky + commitlint + Gitleaks             | **Keep**         | Pre-commit fails closed if Gitleaks is missing.                                  |
| Biome / oxlint as ESLint replacement      | **Do not adopt** | Would drop the architectural `no-restricted-*` rules that are the point.         |
| Nx / Bazel                                | **Do not adopt** | Turbo's task list is short on purpose.                                           |

### Shared domain and contracts

| Item                             | Disposition      | Why                                                                                          |
| -------------------------------- | ---------------- | -------------------------------------------------------------------------------------------- |
| Zod 4 in `@loro/core`            | **Keep**         | One schema → TS type → OpenAPI. Do not add class-validator or io-ts.                         |
| current / target / draft         | **Keep**         | Operation lists and status, not forked validators — except the documented Manifest/Pack gap. |
| tRPC / GraphQL / oRPC            | **Do not adopt** | Offline-first + per-field merge is a document store of ops, not a query language.            |
| `ts-fsrs` / TS ranker / TS merge | **Do not adopt** | ADR-0002. `fakeCore().fsrsReview` is a test double.                                          |

### Rust core

| Item                                      | Disposition      | Why                                                                          |
| ----------------------------------------- | ---------------- | ---------------------------------------------------------------------------- |
| UniFFI + wasm-bindgen + serde             | **Keep**         | One crate, three targets. `unsafe` forbidden.                                |
| Clippy pedantic + rustfmt in `pnpm check` | **Keep**         |                                                                              |
| Criterion + proptest + insta              | **Keep**         | No checked-in bench baseline yet; do not invent a 10% gate without a corpus. |
| `panic = abort` in release                | **Do not adopt** | Breaks `cargo bench` and UniFFI `catch_unwind`. Documented in `Cargo.toml`.  |
| cxx / Neon / napi as a second FFI         | **Do not adopt** | UniFFI + WASM already cover device and server.                               |

### API and operations

| Item                                        | Disposition      | Why                                                                                                                                              |
| ------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| NestJS 11 + `@nestjs/platform-express`      | **Keep**         | ADR-0008. One `AppModule` is fine until a second module exists.                                                                                  |
| Fastify adapter rewrite                     | **Do not adopt** | No measured Express bottleneck. Offline-first traffic is small.                                                                                  |
| `pg` + handwritten SQL                      | **Keep**         | Matches client column-ownership. Schema is still small.                                                                                          |
| Drizzle / Prisma / Kysely on the **server** | **Wait**         | ADR-0008 named Drizzle; HEAD does not use it. Revisit at ~dozen tables or a real migration runner — then amend the ADR, do not silently install. |
| jose                                        | **Keep**         | ID-token and refresh verification. One JWKS helper already.                                                                                      |
| Passport / `@nestjs/jwt` / Better Auth      | **Do not adopt** | Custom refresh families and installation binding are the product.                                                                                |
| Redis, BullMQ, ioredis                      | **Wait**         | Plan 88 amendment: not in the testing host. Adopt when AI rate limits or workers have an owner.                                                  |
| Supabase / Firebase / PowerSync             | **Do not adopt** | Cannot run `loro-core` merge or per-field HLC classes.                                                                                           |
| pino / OpenTelemetry                        | **Wait**         | Plan 73/88 monitoring profile. `no-console` already forces a real logger later.                                                                  |
| SOPS + age + Compose + EC2 scripts          | **Keep**         | No plaintext `.env` commits. `scripts/ci-api-image.sh` before transfer.                                                                          |

### Content and tokens

| Item                                          | Disposition      | Why                                                                                                             |
| --------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------- |
| Custom token generator                        | **Keep**         | ADR-0013. Contrast is a build gate. Widgets need committed Swift/Kotlin.                                        |
| Style Dictionary / Tokens Studio / Figma sync | **Do not adopt** | Source of truth is the v1.1 blueprint, not a hosted file.                                                       |
| Ajv 2020-12 + `checks.ts`                     | **Keep**         | Mechanical catalog gates. Zod owns _wire_ contracts; Ajv owns _on-disk_ JSON Schema. That split is intentional. |
| CMS (Sanity, Contentful, Notion)              | **Do not adopt** | Catalog is versioned data with audio/prosody artefacts (ADR-0009).                                              |
| Multilingual adapter + `cafe1` exceptions     | **Keep**         | Plan 87 owns deletion after bilingual review.                                                                   |

### Mobile libraries the rest of the stack must respect

Summarised from the companion; do not contradict these in API or content work:

- **Keep:** `Pressable`, `usePullDown`+PanResponder, `Sheet`, OP-SQLite, sql.js, SecureStore,
  `loro-audio-speech`, Expo Router, Playwright web E2E, `native:evidence`.
- **Adopt next:** `expo-haptics` after `motion.md` policy; keyboard-controller with plan 56; Maestro
  locally under 58/72; RN Testing Library only for primitives.
- **Do not adopt:** Tamagui/NativeBase/gluestack/NativeWind; `expo-speech` / `expo-av` / Track
  Player; cloud ASR; client ORM; OneSignal/FCM for practice reminders; Detox/cloud farms as required
  libraries.
- **Wait:** Skia (77), FlashList (56), `expo-notifications` (70), WidgetKit/Glance module (70).

### Testing and CI

| Item                           | Disposition      | Why                                                                      |
| ------------------------------ | ---------------- | ------------------------------------------------------------------------ |
| `pnpm check` + `pnpm ci:local` | **Keep**         | Fast vs full local gates. GitHub Actions stays disabled.                 |
| Vitest                         | **Keep**         | One runner across packages.                                              |
| Playwright + axe + `states.ts` | **Keep**         | Learner-visible web. Cannot close speech, touch, or process-death.       |
| Coverage thresholds            | **Do not adopt** | They reward tests that miss geometry (`render.spec.ts` exists for that). |
| React Native Testing Library   | **Optional**     | Primitives only.                                                         |
| Maestro                        | **Adopt next**   | Plans 58/72, local YAML, artifacts the evidence script already retains.  |
| Codecov / cloud device farm    | **Do not adopt** | Violates local-CI policy as a _required_ library.                        |

---

## 3 · Best practices and approaches

### Already enforced — treat a violation as a revert

These are lint or CI, not reviewer memory:

| Practice                                                        | Gate                                               |
| --------------------------------------------------------------- | -------------------------------------------------- |
| Mobile layer imports (ui ↛ data/store; reserved target folders) | `eslint.config.mjs` `no-restricted-imports`        |
| No colour literals (hex, rgb/hsl, named CSS; `transparent` ok)  | `no-restricted-syntax` on `app/` + `src/`          |
| One `new Date()` (device)                                       | same, exempt `clock.ts`                            |
| No `toISOString().slice` for a local day                        | same                                               |
| No `Math.random` in engines/core                                | same                                               |
| No AsyncStorage for credentials                                 | `no-restricted-imports`                            |
| Copy ownership; no learner literals in `app/`                   | `check:copy`                                       |
| Contrast of generated tokens                                    | `check:contrast`                                   |
| `accessibilityLanguage` source presence                         | `check:lang`                                       |
| Every syncable field has a merge class                          | `fieldPolicy` tests                                |
| Phrase SQL ↔ wire ↔ merge stay one list                         | `syncableColumns` drift tests                      |
| Eligibility is one rule in domain, SQL and store                | `eligibility.test.ts`                              |
| Generated tokens / WASM embed / OpenAPI do not drift            | `pnpm check` / `contracts:check` / `check:browser` |
| Conventional commit type + scope                                | commitlint (requirement IDs are convention only)   |
| No staged secrets                                               | Gitleaks pre-commit (this hook is gitleaks-only)   |
| New learner-visible STATE gets an `e2e/states.ts` row           | route-coverage spec                                |

### Documented and followed in code

- Progress writes only through `applyDelta` / `ProgressDelta` classes (tests + review, not ESLint).
- `INSERT OR REPLACE` is gone; upserts name the columns they own and never touch `field_hlc` or
  `deleted_at`.
- Store actions wrap persistence; routes call named actions, not raw `setState`.
- Engines are headless in `@loro/core`; mobile injects `EngineContext`.
- Routes compose; a block with one call site stays local.
- Named magic numbers; do not snap 5/7/9/11/13/26/38/88 to the space scale.
- Recorded PCM never crosses to JS; latency is measured or `null`.
- Notifications/widgets must not shame a missed day (Rust planner already encodes the policy).
- `pnpm ci:local` is the full gate; do not re-enable GitHub Actions without an explicit policy
  change.

### Documented but stale — fix the doc, not the code

| Claim still in docs                                                | HEAD                                                                               |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| ADR-0012 live Drizzle queries; no phrase array in Zustand          | Amended: write-through projection; `phrases` in `AppData`                          |
| ADR-0008 Drizzle + Redis as current                                | Amended: `pg` + SQL; Redis unused                                                  |
| `mobile-app.md` process-kill loses store; JS `coreFacade`          | Patched: SQLite hydrate; Rust facade                                               |
| `onboarding.md` opening: no native modules / SQLite; seven screens | Patched: eight screens + utilities; modules exist; browser still cannot prove them |
| Native-libraries "Keep server Drizzle"                             | Corrected to `pg` + handwritten SQL                                                |
| `overview.md` "Postgres 16 + Drizzle"                              | Patched: server is `pg` + SQL                                                      |
| ADR-0001 "EAS gives us builds"                                     | Amended: local APK / disabled Actions. EAS is not the pipeline.                    |

### Approaches for the next screens and services

These extend the companions. They are how screens 9–23 and the remaining API seams stay cheap
**without** a rewrite.

1. **Compose the route; extract at two call sites.** Domain-free → `src/ui/primitives`. Domain
   types, never store/copy → `src/ui/components`. Do not pre-create `features/`.
2. **Drive practice through `engine.plan()` only when the UI matches the plan.** Speak already does.
   Stream waits on plan 62 audio. Review stays unwired until the Review route exists.
3. **One column map next to `FIELD_POLICY`.** A new syncable field (notification opt-out, widget
   snapshot pointer) updates `syncableColumns` first. No generic upsert helper.
4. **Store writes go through named actions.** Gestures and sheets call those actions. They are not a
   second store.
5. **One audio session, one clock, one delta path.** Screens subscribe to `audioSpeech`. They do not
   construct a second engine plus a JS player. Outcomes go through `applyDelta` only.
6. **Reanimated for animation, PanResponder for commit laws.** Move warming-card / press-scale /
   sheet `translateY` to worklets when that animation is the task. RNGH replaces PanResponder only
   inside `usePullDown` if devices prove the responder insufficient.
7. **Contracts: change the shared Zod module, regenerate, then implement.** Do not add a DTO
   interface. Do not tighten current Manifest/Pack to target as a drive-by.
8. **API: choose adapters in `AppModule`.** Memory repositories stay under `**/testing/`. Do not
   register Anthropic, billing, or Redis because a comment says it is "one line".
9. **Content: mechanical gates in `checks.ts`; humans own naturalness.** Do not delete pair-specific
   exceptions as cleanup. Ajv stays on disk JSON; Zod stays on the wire.
10. **Test what the change can prove.** Same PR: unit at the owner, `states.ts` for a new
    learner-visible state, Playwright for buttons/copy/44 px/310% text, `render.spec.ts` for a bar
    that states a number, `native:evidence` / later Maestro for finger, ASR, force-quit. Browser
    green is not device green.
11. **Install with the SDK.** `npx expo install`. Pin Worklets. Custom modules ⇒ no Expo Go. Never
    hand-edit `design-tokens/out/` or UniFFI bindings.
12. **Commit in coherent chunks** that each leave `pnpm check` green. A plan is several commits. PRs
    are squash-merged; the branch commits are the only granular record.
13. **Requirement IDs in branch, commit and PR.** Blueprint citations look like
    `Loro.dc.html:1404–1538`. Do not edit authored artifacts; when a doc disagrees, fix the doc.
14. **Update current-state sentences in the same change** that makes them true or false. That is how
    CLAUDE.md, architecture status callouts and this review stay usable.

### Review order (from [code-review.md](../process/code-review.md))

1. Does it teach the right thing?
2. The three non-negotiables (audio stays, numbers are real, no missed-day shame).
3. Layer and contract boundaries.
4. Tests at the owner, not a later hardening pass.
5. Style last.

---

## Sequencing

```
do not redo:
  A–G and the 2026-09-10 extracts (refactoring-strategies)

landed (docs/decision P0, this review):
  1. Amend ADR-0012 to write-through projection
  2. Amend ADR-0008 to pg + handwritten SQL; Drizzle/Redis as revisit
  3. Patch onboarding.md opening + mobile-app.md State/Engines
     (same class as leftover item C)

landed (P1 code, this review):
  4. Production account/sync import account + sync, not api/target
  5. Fixture-seal fakeCore.streamRank / repeatTarget
  6. Speak session documented as ephemeral until interruption resume
  7. Parse legacy /content egress with current Manifest/Pack Zod

landed with common.ts:
  8. `LegacyLocaleSchema` alias; `LocaleSchema` remains the legacy `es-ES` literal

as you touch:
  9. UniFFI --check when the generator is already in the diff
  account.tsx / persistence.test.ts / sync tests / Today / onboarding / Progress
  (extract only at a second call site)

must wait: table above
must not: section below
```

Do **not** open plan 97 for this list. Plan 97 is Discover reach.
[Plan 100](../../plans/100-hygiene-reuse-and-tooling.md) is the execution owner for leftover
as-you-touch hygiene, the Field/ListRow extracts, snippets and UniFFI `--check`. Items 1–8 of this
review are in the working tree. UniFFI `--check` is plan 100 slice 7.

Native-device library work (haptics, Maestro, keyboard-controller, notifications, Skia) proceeds
**in parallel** under its plan owners and must not share a PR with items 1–4.

---

## Explicit non-goals / do-not

Unless a later device or operational failure produces evidence against the ADRs, do **not**:

- Rewrite the app into `features/` / `domain/` / `platform/`, or abandon Expo.
- Replace Zustand with Redux, MobX, Jotai, Legend, Recoil, or TanStack Query for learner state.
- Implement ADR-0012's Drizzle `useLiveQuery` sample, or add a client ORM to "finish" it.
- Install Drizzle, Redis, BullMQ, Passport, or a CMS as cleanup.
- Adopt Tamagui, NativeBase, gluestack, NativeWind, Paper, Style Dictionary, or Tokens Studio.
- Adopt a second FSRS, a TS ranker, or a second merge.
- Unify SQLite DDL with Postgres auth/sync DDL, or mobile `clock.ts` with API `ServerClock`.
- Adopt cloud ASR, `expo-speech`, or `expo-av` as the production audio graph.
- Schedule notifications with JS timers or guilt copy; use remote push for practice reminders.
- Make GitHub Actions or a cloud device farm a required library.
- Hand-edit generated bindings or `design-tokens/out/`.
- Change learner-facing copy keys or E2E locators "while we are in there".
- Register Anthropic, enable billing, or widen `LocaleSchema` as a drive-by.
- Archive remaining-work plans because this review exists.

---

## What is already healthy

- Store slices + `applyDelta` as the only progress writer; persistence wraps `set`.
- One device `Date` owner with ESLint; two day keys kept distinct.
- Engine `common.ts` (`canonicalReviewDelta`, `availableWhenActive`) and conformance.
- SQL in `@loro/core`; mobile injects `SqlDriver`. Eligibility parity tests.
- Merge: TS `fieldPolicy` + `syncableColumns` + Rust `merge.rs`.
- Audio: `audioSpeech.ts` → controller → native bridge. Web bridge is `null` on purpose.
- Core: JSON `coreCall` → WASM/UniFFI; `jsCoreFacade` is an alias.
- API composition root in `AppModule`; memory sync under `sync/testing/`.
- Tokens and WASM committed and porcelain-checked; UniFFI bindings committed.
- Copy through ICU resources; E2E matches accessible names.
- Local CI policy, encrypted env, exact-image deploy check.

---

## Open questions

1. **Should ADR-0012 be amended to write-through projection, or should native-only live queries be
   scheduled under a later persistence plan?** Recommendation: amend now; revisit live queries only
   at the 2 000-phrase trigger already in the ADR. Web sql.js cannot offer the same subscription
   without a second mechanism.
2. **Should ADR-0008 drop Drizzle from the Decision line, or keep it as the named server revisit?**
   Recommendation: Decision = current (`pg` + SQL); Drizzle in Revisit if, like the client ORM
   amendment.
3. **`GET /auth/me` vs `GET /me`.** Still a contract question, not a rename
   ([refactoring-strategies](2026-09-09-refactoring-strategies.md#open-questions)).
4. **When calendar crosses UniFFI for JS** versus widget-native-only. Unchanged; plan 70 owns it.
5. **Haptic policy, PanResponder-vs-RNGH, Maestro-vs-`native:evidence`.** Unchanged; see the native
   companion.

---

## Inspection limits

Not a device, security, or linguistic certification. Native module bodies were not line-reviewed for
interruption completeness — plans 58/62/63 own that. DSP remains gated. OpenAPI JSON was not diffed
path-by-path against every Nest decorator. Lockfile versions were read from manifests and the native
companion's earlier resolution, not re-resolved here. Live `/me` versus `/auth/me` against the
deployed gateway was not exercised. Test-count figures in `onboarding.md` were compared to
`testing-strategy.md`, not re-run.

A–G landing claims and the must-wait list were rechecked at `706858c` (all 25 landed items hold; the
twelve must-wait items remain). DSP `todo!` macros stay plan-gated. Husky's pre-commit file runs
Gitleaks only; lint-staged is configured in `package.json` and is not that hook.

This review does not replace the A–G inventory or the native library matrix. If those files' HEAD
SHAs age, bump only their status tables; keep this file's three questions and the ADR amendment
recommendations until those amendments land.
