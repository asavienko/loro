# The whole-project SOLID / KISS / DRY refactor

- **Requirement IDs:** cross-cutting; carries `F-05`, `F-06` (the design system's "all tokens, ~20
  core components") and the layer rules in
  [`mobile-app.md`](../docs/architecture/mobile-app.md#layers)
- **Milestone:** M1
- **Size:** L, split into three waves of file-disjoint work
- **Status:** 🟡 In progress, started 2026-07-30.
- **Depends on:** nothing. **Overlaps, and lands part of:**
  - [48-app-shell-failure-states-and-input](48-app-shell-failure-states-and-input.md) **§3 and §3a**
    — the `rgba()` lint gap, the six hardcoded literals, and the duplicate `Pill` at
    `stream.tsx:337`. That plan already diagnosed all of it; this one executes that section. Its §1
    (`ErrorBoundary`, pending states), §2 (keyboard handling), and virtualisation are **not**
    touched — they add behaviour, and this plan changes none.
  - [34-design-system-completion](34-design-system-completion.md) — this plan builds the
    `src/ui/tokens/` and `src/ui/components/` directories that plan assumes, and its §6 lint item,
    but delivers neither the motion layer nor the full ~20-component inventory.

## The invariant that makes this safe

**Behaviour does not change.** The contract with the gate:

- `apps/mobile/e2e/**` is **read-only for every agent**, including `states.ts`. `git diff --stat` on
  that directory must be empty at the end. The suite was **61/61 green** at baseline (`pnpm check`
  23/23, `pnpm test:e2e` 61/61, verified 2026-07-30 before the first edit) and must be 61/61 green
  after, with the specs byte-identical. That is the whole proof.
- Learner-facing strings move into a copy module **byte-for-byte** — including `&apos;`, `¡`, `¿`,
  `→`, `↓`, `·`, and every emoji. The E2E suite matches on many of them by accessible name.
- Unit tests may be adjusted where a module was split or a signature moved. They may **not** be
  weakened to accommodate a behaviour change.
- Anything that would change a number a learner sees, an FSRS interval, a merge outcome, or an API
  response shape is **out of scope** — see "Deliberately not done" below.

## Current state

Verified by reading the tree on 2026-07-30. The design system is in good shape at the bottom and
unravels at the top: `src/ui/theme.ts` (123 lines) and `src/ui/primitives.tsx` (487) are
token-driven and carefully documented, while the eight route files under `apps/mobile/app/` (2,813
lines) hand-roll layout, re-implement primitives that already exist, and hold both copy and domain
logic inline.

Five findings that set the shape of the work:

1. **`accent.tint` already exists and is hardcoded five times** — diagnosed in
   [48](48-app-shell-failure-states-and-input.md) §3 and confirmed still true, at lines that have
   since moved. The generated token `accents.coral.tint` is exactly `rgba(191,87,34,0.07)`
   (`packages/design-tokens/out/tokens.ts:177`), and that literal is pasted into
   `app/index.tsx:209`, `app/add.tsx:480`, `app/onboarding.tsx:222`, `app/phrase/[id].tsx:209`, and
   `app/practice/stream.tsx:215`. The colour-literal lint rule only matches **hex**
   (`eslint.config.mjs:152`), so five copies of a real token are invisible to the gate — and they
   are a latent theming bug: the accent is learner-selectable under `F-05`, and these five stay
   coral.
2. **`rgba(26,24,21,0.42)`** (`app/add.tsx:363`) is the sixth literal, `surface.device` at 42% — a
   modal scrim. Unlike the other five it has **no token at all**, so one is added to
   `tokens/color.json`. (48 §3 assumed all six mapped to existing tokens; five of them do.)
3. **The lint config already names the directories this refactor needs.** `eslint.config.mjs:147`
   exempts `apps/mobile/src/ui/tokens/**` from the colour-literal rule, and the layer-boundary
   message at `:92` points a domain-aware component at `src/ui/components`. Neither directory exists
   yet. The intended structure was declared before it was built.
4. **The empty-state / bottom-action-bar / stat-row blocks are duplicated across screens**, and
   `practice/refrain.tsx` contains two copies of the centred empty state (`:195-222`, `:229-290`)
   plus an inline re-implementation of the `StatTile` primitive (`:262-277`). `stream.tsx:337`
   defines a second, incompatible `Pill` beside the real one at `primitives.tsx:242` — 48 §3a parked
   this for "34's refactor", and this is that refactor.
5. **Domain logic sits in route files.** `cloze()` at `practice/refrain.tsx:530-566` is the clearest
   case, alongside the `MODE_CUE` / `MODE_ICON` / `MODES` tables at `:53-71`.

## Where things go

Grounded in what `eslint.config.mjs` already declares, so no lint config has to be loosened:

| New home                    | Holds                                                                | Why there                                                                        |
| --------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `src/lib/copy.ts`           | Every learner-facing string, as a nested const object                | `lib/` is the leaf layer, so `store/` **and** `ui/` **and** `app/` may import it |
| `src/ui/tokens/`            | Component-level sizing/colour tokens not in the generated set        | Already lint-exempted from the colour-literal rule (`:147`)                      |
| `src/ui/primitives/` (dir)  | The domain-free primitives, split out of `primitives.tsx`            | `index.ts` re-exports, so `from '../src/ui/primitives'` keeps resolving          |
| `src/ui/components/`        | Composites that know what a phrase is (`PhraseRow`, `EmptyState`, …) | The layer-rule message at `:92` names this directory                             |
| `src/store/` (split)        | The store, decomposed by responsibility                              | Public API frozen — 8 route files import it                                      |
| `packages/core/src/domain/` | `cloze()`, the Refrain mode metadata                                 | Cross-platform domain logic, not render logic                                    |

**`src/lib/copy.ts` is the one file every screen depends on**, so it lands first and alone.

## The three waves

Waves exist because parallel agents must never share a file. Every agent owns a disjoint set of
paths; the wave boundary is where a consumer needs its dependency's real API.

**Wave 1 — foundations** (must land before any screen is touched)

1. `src/lib/copy.ts` — the copy catalog, extracted byte-for-byte from all 8 routes + `ToastHost`.
   Also the toast strings currently inline in `store/index.ts:240,252,274-278,297,302`.
2. `src/ui/tokens/` + `tokens/color.json` scrim + `theme.ts` re-export. Regenerate the design tokens
   with the package's own generator — never hand-edit `out/`.
3. `src/ui/primitives/` split, and the new domain-free primitives the screens keep hand-rolling.
4. `src/ui/components/` — the domain-aware composites, built against Wave 1.2 and 1.3.

**Wave 1b — independent trees** (runs concurrently with Wave 1; shares no file with it)

5. `apps/api/` — controller boilerplate, the AI provider seam, the error factory.
6. `packages/core-rs/` — module split, named constants, shared test scaffolding.
7. `packages/core/` internals — `persistence/sqlite.ts` (603 lines) decomposition, the engine
   progress-signal helper. **Public API additive-only.**
8. `apps/mobile/src/store/` + `src/lib/` — decomposition behind a frozen public API, and the
   `LoroCoreFacade` at `store/index.ts:405-443` extracted to its own module.

**Wave 2 — the eight screens**, one agent per file, consuming Wave 1's real API.

## Acceptance criteria

- `pnpm check` green (23 tasks) and `pnpm test:e2e` **61/61**.
- `git diff --stat apps/mobile/e2e/` is empty.
- No `rgb()` / `rgba()` / `hsl()` literal anywhere under `apps/mobile/{app,src}` except
  `src/ui/tokens/`, and `eslint.config.mjs` extended to enforce that — the rule that would have
  caught finding 1.
- No learner-facing string literal left in `apps/mobile/app/**`.
- No numeric style literal in `apps/mobile/app/**` that isn't a token reference.
- Every route file's default export composes named components; none is a monolith.

## Deliberately not done

- **The fake maths in `store/index.ts:405-443` stays as-is.** `fsrsReview` invents intervals
  (`grade === 1 ? 0.007 : …`), `clozeMask` returns a fixed `[1]`, and `streamRank` reimplements
  ranking in TS — all of which `packages/core-rs` is supposed to own
  ([ADR-0002](../docs/architecture/adr/0002-shared-rust-core.md)). Fixing it changes numbers the
  learner sees, so it is out of bounds here; that is
  [05-fix-shared-maths-duplication](05-fix-shared-maths-duplication.md)'s job. This refactor only
  **moves** the facade to its own module, where the next plan can replace it in one file.
- The motion layer and the remaining component inventory —
  [34-design-system-completion](34-design-system-completion.md).
- The 13 unbuilt screens, the native modules, and the on-device SQLite driver.
