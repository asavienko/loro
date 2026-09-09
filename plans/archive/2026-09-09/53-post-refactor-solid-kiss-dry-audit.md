# Post-refactor SOLID / KISS / DRY integrity pass

- **Requirement IDs:** cross-cutting; `F-05`, `F-06`, plus the mobile layer rules in
  [`mobile-app.md`](../../../docs/architecture/mobile-app.md#layers)
- **Milestone:** M1
- **Size:** M, split into behavior-preserving, independently reversible commits
- **Status:** ✅ Implemented 2026-07-30 with one coordinator and three parallel agents. The frozen
  implementation baseline was `5258228`; `apps/mobile/e2e/**` remained byte-identical. Final proof:
  `pnpm check` **23/23**, browser E2E **61/61**, production-export smoke **3/3**, mobile iOS export,
  API production build, generated-output drift checks, and scoped formatting all pass. The global
  formatter is presently obscured by a concurrent, unrelated roadmap/design import in the shared
  worktree; no Plan 53 implementation file is among its findings.
- **Depends on:** [52-solid-kiss-dry-refactor](../2026-07-30/52-solid-kiss-dry-refactor.md) ✅
- **Coordinates with:** [05](../2026-07-30/05-fix-shared-maths-duplication.md),
  [18](../2026-07-30/18-select-rs-cloze-and-set-selection.md),
  [34](../2026-07-30/34-design-system-completion.md),
  [39](../2026-07-30/39-security-hardening-api.md),
  [47](../2026-07-30/47-typography-motion-and-haptics.md), and
  [50](../2026-07-30/50-interface-integrity-defects.md)

## Why this is a follow-up, not a replay

[Plan 52](../2026-07-30/52-solid-kiss-dry-refactor.md) already centralized mobile copy, split the UI
and store, decomposed persistence, installed API provider/repository seams, named Rust constants,
added tests, and held the E2E suite byte-identical. Repeating that exercise would replace working,
focused code with speculative abstractions and violate KISS.

The new audit found four residual, behavior-preserving seams worth fixing:

1. **Presentation copy still leaks into domain code.** `rerateToast()` embeds English in
   `packages/core/src/engines/stream/index.ts`; Refrain mode/effort labels live in both
   `packages/core/src/engines/refrain/index.ts` and `packages/core-rs/src/select.rs`; and
   `apps/mobile/src/store/slices/phrases.ts` duplicates strings already present in
   `apps/mobile/src/lib/copy.ts`.
2. **Token sources are ahead of generated output.** The design-token loader reads `type.json` and
   `motion.json`, but the generator emits only colour, spacing, radii, and shadows. Typography,
   press scales, tap sizes, gutters, and sheet geometry are then restated in mobile theme/component
   token files.
3. **A few canonical collections remain duplicated.** Mastery order/counting is repeated between
   mobile selectors and the Progress route; browse themes are separately enumerated in the route and
   copy catalog; and the identical diacritic-folding stage appears in Add search and ASR
   normalization.
4. **One dependency-inversion seam is bypassed.** `createAppStore` accepts dependencies, while
   `engineContext()` reads the module store and `deviceClock` directly. That makes the future native
   persistence/core swap harder to test than it needs to be.

The audit also confirmed that most large route files now compose named, route-local components.
Moving one-use components merely to shorten a file would add prop surfaces without reuse.

## Invariants

This is a behavior-preserving refactor.

- Capture `IMPLEMENTATION_BASE=$(git rev-parse HEAD)` before the first implementation commit.
- `apps/mobile/e2e/**`, including `states.ts`, is read-only. At every wave boundary:

  ```bash
  git diff --exit-code "$IMPLEMENTATION_BASE" -- apps/mobile/e2e
  ```

- Learner-visible bytes, accessible names, API response shapes, persistence outcomes, FSRS
  intervals, ranks, cloze masks, and Rust/TS calculations do not change.
- Unit tests may move with modules or gain cases. Assertions are not weakened to fit a refactor.
- Generated files are changed only through their generators and receive their own reviewed diff.
- A component is extracted only with at least two real call sites. A one-use block stays local to
  its route.
- A design pattern is introduced only when the change names the variation/dependency problem, shows
  why a plain function or data table is insufficient, and proves unchanged behavior.

## What “all text, components, and tokens” means here

- **Text:** learner-facing presentation wording has one mobile owner in `src/lib/copy.ts`. Core/Rust
  returns semantic keys or states, never English. Catalog content remains in `@loro/content`.
- **Tokens:** visual constants come from generated design tokens or named component tokens. The
  generator must emit already-authored typography, motion, layout, and control values before
  consumers migrate.
- **Components:** repeated UI is reusable. Route-specific composition remains local. Components are
  not tokens; tokens are the values components consume.

This interpretation preserves the project rule that a screen composes but does not manufacture a
global component API for every JSX block.

## Pattern applicability register

The requested patterns are evaluated, not force-installed.

| Pattern                 | Decision for this pass             | Evidence / rule                                                                                                             |
| ----------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Strategy                | Keep                               | `PracticeEngine` already supplies interchangeable loop algorithms.                                                          |
| Command                 | Keep existing shape                | `ProgressDelta` + `applyDelta` is the practice-write command; the outbox queues durable writes. No command-class hierarchy. |
| Observer                | Keep framework implementation      | Zustand subscriptions already provide observation. Do not wrap them.                                                        |
| State                   | Use semantic unions/tables         | Refrain modes and effort bands are data-driven states. Do not convert them to classes.                                      |
| Adapter                 | Keep and extend only at boundaries | `SqlDriver`, WASM merge, and the future native core/SQLite bridges are real interface translations.                         |
| Facade                  | Keep                               | `LoroCoreFacade` is the narrow boundary over platform-owned maths.                                                          |
| Factory Method          | Use a plain factory                | Add `createEngineContext(store, deps, core)` while retaining the zero-argument production wrapper.                          |
| Composite               | Already inherent                   | React composition is sufficient; no extra composite abstraction.                                                            |
| Decorator               | Framework-only                     | Nest decorators remain; no new behavioral wrapper is justified.                                                             |
| Chain of Responsibility | Not applicable                     | Two validation checks do not justify a handler chain; plan 39 will use Nest guards/pipes.                                   |
| Iterator                | Not applicable                     | Native JS/Rust iterators already hide collection representation.                                                            |
| Mediator                | Not applicable                     | Store/actions and injected ports already coordinate dependencies.                                                           |
| Memento                 | Not applicable                     | Persistence/outbox is not undo-state history; the toast undo closure is sufficient.                                         |
| Template Method         | Not applicable                     | `PracticeEngine` Strategy avoids inheritance and is easier to test.                                                         |
| Visitor                 | Not applicable                     | Exhaustive unions and ordinary functions are simpler for current domain records.                                            |
| Bridge                  | Not applicable yet                 | Native modules are absent; introduce a bridge only with their owning plans.                                                 |
| Flyweight               | Not applicable                     | No measured memory pressure or repeated heavyweight object state.                                                           |
| Proxy                   | Not applicable                     | No access-control/lazy-loading boundary needs a substitute object.                                                          |
| Abstract Factory        | Not applicable                     | There is not yet a family of native/web implementations to construct together.                                              |
| Builder                 | Not applicable                     | Current value objects are small and validated by types/factories.                                                           |
| Prototype               | Not applicable                     | Object spread and explicit factories already make copies visibly.                                                           |
| Singleton               | Reject                             | Global access would weaken dependency injection and test isolation.                                                         |

## Workstream 1 — presentation/domain boundary

Land the semantic contract before changing consumers.

1. Replace `rerateToast()` with no core presentation export. The mobile store reads
   `copy.toast.difficulty[difficulty]` directly.
2. Split Refrain semantics from wording:
   - core owns mode IDs, rates, gates, prompt types, thresholds, and effort-band identity;
   - mobile copy owns mic labels and effort text;
   - Rust returns semantic values where bindings expose the same concept.
3. Move difficulty, tag, and mastery labels out of `src/ui/theme.ts` into `copy.ts`; keep only
   colours/icons/geometry in theme metadata. Pass labels into leaf UI components so
   `src/ui/components` remains unable to import copy.
4. Deduplicate repeated atoms inside `copy.ts` (`Add phrases`, navigation labels, `reps today`,
   `Undo`) with private constants while preserving the public lookup shape and exact bytes.
5. Add a static ownership check for learner-facing literals outside `copy.ts`. The allowlist must
   distinguish catalog data, tests, diagnostics, route IDs, semantic keys, and accessibility source
   checks. It must not be a regex that makes ordinary identifiers illegal.

Tests: update core tests to assert semantic results, add copy lookup coverage for every semantic
key, and keep all learner-visible E2E assertions unchanged.

## Workstream 2 — generated-token completion

This lands the generator part of plans 47/34 without implementing motion, theming, or new visuals.

1. Extend `packages/design-tokens/src/tokens.ts` types so the complete authored `type`, `motion`,
   and relevant `layout` sections survive loading and validation.
2. Extend `generate.ts` to emit typed TypeScript, Swift, and Kotlin values for typography, motion,
   touch targets, gutters, progress sizes, and sheet geometry.
3. Add generator tests for completeness and cross-target parity. Generated output must drift when a
   source token changes and remain stable otherwise.
4. Replace byte-for-byte-equivalent mirrors in `apps/mobile/src/ui/theme.ts` and `src/ui/tokens/`.
   Name irregular blueprint values rather than rounding them onto a scale.
5. Leave runtime accent switching, dark theme, animation behavior, fonts, haptics, and missing
   inventory components to plans 34/47. Update those plans' stale current-state notes after this
   work lands.

No rendered value changes in this workstream. A visual correction, even an obvious one, is routed to
its behavior-owning plan.

## Workstream 3 — canonical domain collections

1. Add an exhaustive `MASTERY_BUCKETS` order and pure bucket-count helper in `@loro/core`; derive
   both mobile selectors and Progress rendering from it.
2. Put the browsable-theme key set at the content/domain boundary and make route filtering and copy
   lookups exhaustive over that set. A content rename must fail typecheck or validation, not render
   an empty tile.
3. Extract only the identical Unicode diacritic-fold step used by Add search and ASR normalization.
   Speech normalization retains its punctuation/token rules; search retains its matching rules.
4. Add focused parity tests before deleting either duplicate.

Do not fold wave display times into engine settings here. Their current two-source behavior is a
known correctness issue owned by plan 50.

## Workstream 4 — engine composition seam

1. Introduce `createEngineContext(store, deps, core)` as a pure factory.
2. Retain the existing zero-argument production wrapper so route call sites and behavior remain
   stable.
3. Make clock, repository/store reads, RNG, and core facade explicit inputs in tests.
4. Do not alter `jsCoreFacade`; plan 05 owns its fabricated intervals, fixed cloze mask, ranking,
   and TS/Rust authority changes.

The outcome is dependency inversion with fewer hidden globals, not a container or service locator.

## Workstream 5 — API/content KISS cleanup

This workstream is file-disjoint from the mobile/core contract work and can run in parallel.

1. Prove which declared API/core dependencies have no source or build-time consumer. Remove only
   proven-unused packages in an isolated lockfile commit; do not remove a dependency required by a
   pending generated binding or build script.
2. Precompute the immutable catalog phrase lookup used by the content controller instead of
   rebuilding it per pack request.
3. Preserve controller responses and problem documents byte-for-byte.
4. Route shared Zod schemas and malformed-request handling to plan 39. Adding runtime validation is
   a behavior change and does not belong in this pass.

Do not add Chain of Responsibility, proxy, builder, or base repository classes. The provider,
repository, WASM adapter, composition root, and problem catalog are already appropriately split.

## Correctness findings explicitly out of scope

Refactoring must not smuggle in fixes that change data or learner behavior.

| Finding                                                                | Owner                                                                                            |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Stream rank, cloze mask, `matchTokens`, and TS/Rust maths authority    | Plan 05                                                                                          |
| Refrain selection and graduated-phrase eligibility                     | Plan 18, after its current-state section is updated                                              |
| Phrase/settings upserts wiping HLC metadata or resurrecting tombstones | Add a focused local-persistence correctness plan; plan 06 is API sync and is not a precise owner |
| `refrain_day.waves` omitted by repository types and persisted as `[]`  | Same focused local-persistence correctness plan                                                  |
| Sync cursor/scoping                                                    | Plan 06                                                                                          |
| Missing API runtime schemas/validation                                 | Plan 39                                                                                          |
| Mastery chart, wave time, and other interface-integrity defects        | Plan 50                                                                                          |
| Runtime motion, fonts, haptics, accent switching, dark theme           | Plans 47 and 34                                                                                  |
| Missing native audio, ASR, SQLite driver, and 13 screens               | Their existing feature plans                                                                     |

As part of the plan/documentation commit, correct plan 52's coarse statement that all seven deferred
findings belong to 05/06/50. Findings 6–8 landed; the table above owns the remainder.

## Four-slot agent execution

Use one coordinator plus three agents. Agents never edit the same file in the same wave.

### Wave 0 — baseline and contracts (coordinator)

- Capture `IMPLEMENTATION_BASE`, full verification output, generated-output hashes, and E2E tree
  hash.
- Finalize semantic keys and generated-token names against every consumer before publishing them.
- Commit shared contracts first. Plan 52 records that renaming a shared UI API after seven consumers
  adopted it caused avoidable rewrites.

### Wave 1 — parallel, disjoint ownership

| Slot        | Ownership                                                     | Work                                                                    |
| ----------- | ------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Coordinator | `packages/core` public semantic contracts, integration        | Merge contract, maintain audit register, resolve cross-package types.   |
| Agent A     | `apps/mobile/src/lib`, `src/ui`, `src/store`, then routes     | Copy ownership and engine-context consumer migration. E2E is read-only. |
| Agent B     | `packages/design-tokens` and generated outputs                | Loader/generator/parity tests; no mobile consumer edits in this wave.   |
| Agent C     | `apps/api`, `packages/content`, dependency manifests/lockfile | API/content KISS cleanup and exact response tests.                      |

### Wave 2 — consumers and canonical collections

- Coordinator lands core mastery/theme/normalization contracts.
- Agent A migrates mobile consumers and removes duplicates.
- Agent B migrates mobile token consumers only after Agent A has finished its shared UI files, or
  receives a disjoint explicit file list.
- Agent C runs API production build/readiness verification and reviews dependency output.

### Wave 3 — independent review and final proof

- Rotate reviewers: no agent approves only its own workstream.
- Run the full matrix below, compare hashes/diffs, update plan status and affected plan
  current-state notes with observed results.
- Commit docs/results separately from implementation.

## Commit sequence

Every commit includes the requirement ID in its body and leaves `pnpm check` green.

1. `docs(docs): plan the post-refactor integrity pass`
2. `refactor(core): expose semantic presentation states`
3. `refactor(mobile): centralize remaining learner copy`
4. `refactor(tokens): generate the complete authored token set`
5. `refactor(core): canonicalize shared domain collections`
6. `refactor(mobile): inject the engine context dependencies`
7. `refactor(api): remove proven dependency and lookup waste`
8. `docs(docs): record the verified integrity pass`

Split a commit further if generated output or a lockfile would obscure its intent. Do not combine a
behavior defect with these commits.

## Verification matrix

Start with Node 22 and Cargo visible:

```bash
nvm use 22
export PATH="$HOME/.cargo/bin:$PATH"
```

Run at baseline, each wave boundary, and final:

```bash
pnpm check
pnpm format:check
pnpm test:e2e
pnpm test:e2e:bundle
pnpm --filter @loro/mobile bundle
git diff --exit-code "$IMPLEMENTATION_BASE" -- apps/mobile/e2e
```

Area-specific gates:

```bash
pnpm --filter @loro/core test
pnpm --filter @loro/api test
pnpm --filter @loro/api build
pnpm core-rs:test
pnpm core-rs:build
```

When token or Rust binding sources change, regenerate with the owning package command, review the
generated diff, and run the same clean-tree drift command CI uses. The final report records task and
test counts rather than copying old counts forward.

The browser suite cannot prove native audio, microphone, device SQLite, or real offline behavior;
none exists today and none is changed by this plan.

## Implementation record

- `60c75d5` centralizes presentation semantics, canonical mastery/themes/text folding, injected
  engine construction, mobile copy, the exception-free copy gate, and TS/Rust effort parity.
- `20ee201` emits complete authored typography, motion, touch, gutter, progress, and sheet token
  families for TypeScript, Swift, and Kotlin, then migrates byte-equivalent mobile consumers.
- `369305b` precomputes catalog lookup, locks controller bytes with tests, and removes dependencies
  proven unused by source, builds, and the full gate.
- `c51ce21` closes conditional, logical, concatenated, array, and template-expression gaps found by
  the independent review of the copy gate.
- `f555b42` names the two established React Native oversized line boxes. Their authored web ratios
  deliberately remain unmigrated because doing so would change rendered pixels.

The generated asymmetric sheet corner geometry also remains unused because the current screen uses
24/24 while the authored token is 24/28. That visual correction belongs to the runtime design-system
plan; this behavior-preserving pass does not silently move it.

## Acceptance criteria

- `pnpm check` and every applicable verification command above pass.
- All 61 existing E2E tests pass and `apps/mobile/e2e/**` is byte-identical to
  `IMPLEMENTATION_BASE`.
- No learner-facing presentation English remains in core, Rust, store actions, theme metadata, or
  route files; documented content/diagnostic/semantic-key exceptions pass the static gate.
- Typography, motion, and relevant layout/control source tokens are emitted for TypeScript, Swift,
  and Kotlin; mobile mirrors are removed only where values are identical.
- Mastery buckets, browse-theme keys, and shared diacritic folding each have one canonical source
  and focused tests.
- Engine context construction is injectable without changing its production call surface.
- API responses and persistence outcomes are unchanged; no correctness defect from the out-of-scope
  table is silently fixed.
- Each newly introduced pattern is justified in the register; no inheritance tree, singleton,
  service locator, or speculative component extraction lands.
- The rebuilt active roadmap records Plan 53 as the generated-token dependency for plan 57 and the
  adapter/context dependency for persistence plan 54. Superseded plans 34, 47, and 52 remain
  byte-preserved in the dated archive rather than being rewritten as current plans.

## Failure and rollback strategy

Each workstream is a separate commit and retains the old public wrapper until all consumers migrate.
If E2E text, accessibility names, generated values, API snapshots, or persistence tests differ,
revert the responsible commit rather than updating expectations. If a proposed cleanup cannot prove
byte-for-byte or semantic equivalence, route it to a focused behavior plan and leave this plan
green.
