# CLAUDE.md

Guidance for Claude Code working in this repository.

## What this is

**Loro** — a mobile app (iOS + Android) that teaches Spanish by the phrase.

Early implementation. **What exists:** the docs, 8 of the blueprint's 21 screens in
`apps/mobile/app/`, an API with 10 endpoints over an in-memory store, the Rust core, the design
tokens, a 31-phrase catalog, and the local persistence layer (schema, migrations, repositories,
outbox — driver-agnostic and tested against real SQLite). 419 JS/TS tests, 130 Rust tests, and 61
browser E2E tests pass. **What doesn't:** the native modules (audio, speech, ASR, widgets), the
on-device SQLite driver, and the other 13 screens — so nothing runnable today exercises audio or the
microphone, which is half of what this app is, and the app store is still in memory.

## Keep this file current

This file is loaded into context on every session, so a stale line here misleads every session that
follows. When you find it wrong — or make it wrong — fix it in the same change, the same way a doc
that disagrees with the blueprint gets fixed.

Update it when the state above changes (screens land, native modules appear, persistence is wired),
when a command in **Running and testing** stops being true, when a path in **Where things live**
moves, when a convention or non-negotiable changes, or when an open question is resolved.

Keep it short. Long-form belongs in `docs/`; this file points at it.

## Read these first

- [`README.md`](README.md) — orientation and the reading order
- [`docs/README.md`](docs/README.md) — the full documentation index
- [`docs/architecture/overview.md`](docs/architecture/overview.md) — **the ten rules**

## The design blueprint is the source of truth

```
Language Learning by Phrases/Loro.dc.html    # 3,629 lines: 21 interactive screens + all logic
Language Learning by Phrases/screenshots/    # rendered stills
```

It is an executable spec, not a mockup. Every phone in it is interactive; each screen has a
`DCLogic` class whose `renderVals()` is a complete view model.

- **When a doc and the blueprint disagree, the blueprint wins.** Fix the doc.
- **Don't edit the blueprint.** It's the authored artefact. Intended-design changes go in `docs/`.
- [`docs/design/screen-catalog.md`](docs/design/screen-catalog.md) maps all 21 screens to their line
  ranges, logic classes, screenshots, and specs. Start there when working on a screen.

## The three non-negotiables

A change that violates one of these is reverted, not discussed.

1. **Recorded audio never leaves the device.** The prosody screen prints this promise to the learner
   (`Loro.dc.html:1281`), so it is a technical requirement. PCM stays in native memory and is passed
   to `loro-core` by handle; no JS API returns audio bytes.
   ([ADR-0011](docs/architecture/adr/0011-analytics-and-privacy.md))
2. **Every number shown to a learner is real.** Latency is measured or `null` — never estimated.
   Scores come from real signal processing. No simulated values, not even behind a flag.
   ([learning-model.md](docs/product/learning-model.md#where-the-blueprints-numbers-came-from--and-what-is-real))
3. **No screen shames a missed day.** This constrains the notification scheduler and the widget, not
   just copy. ([copy-and-tone.md](docs/design/copy-and-tone.md))

The blueprint prototypes several numbers with fake data (a seeded PRNG for pronunciation scores at
`3068`/`3079`, a formula for latency at `3377`, a linear contour blend at `3158`). Those are
prototype-only and **must not** be carried into the app — see the divergence table at the end of
[`docs/design/screen-catalog.md`](docs/design/screen-catalog.md).

## Conventions

- **Requirement IDs** (`P2-04`, `LB-25`) from [`docs/product/prd.md`](docs/product/prd.md) go in
  branches, commits, and PRs.
- **Blueprint citations** look like `Loro.dc.html:1404–1538`.
- **Commits**: Conventional Commits with the scope list in `commitlint.config.cjs`. See
  [`docs/process/git-workflow.md`](docs/process/git-workflow.md).
- **Commit in meaningful chunks as the work progresses, not one big drop at the end.** Make each
  commit one coherent change — a bug fixed with its test, a schema with its migration, a doc
  corrected — each with its own requirement ID and each leaving `pnpm check` green on its own. A
  plan is usually several commits, not one: land the shared contract, then the implementation, then
  the docs. This matters more than usual here because PRs are squash-merged
  ([git-workflow.md](docs/process/git-workflow.md)), so the branch's commits are the only place the
  reasoning survives at that granularity — and because a change spanning `core-rs`, `core`, and
  `mobile` at once is one that cannot be reverted in pieces when it turns out to be wrong. Don't mix
  a refactor into a fix, and don't let generated output (bindings, tokens) ride along in a commit
  that isn't about regenerating it.
- **Plans live in `plans/`, numbered.** One markdown file per plan: a two-digit number, then
  kebab-case named for the topic — `plans/60-association-suggestions.md`. The numbers run
  consecutively in [`plans/README.md`](plans/README.md)'s recommended order, 01–51 today (49 is
  vacant); a new plan takes the next free number and gets a row in that README. **Numbers are never
  reused** — a gap is left rather than backfilled, so a link written against a number can't come to
  mean a different plan. Not in `docs/`: that holds the durable spec. Not in a temp directory either
  — a plan you can't find again is a plan you rewrite. Name the requirement ID inside the plan so it
  ties back to the branch and the PR.
- **A plan records its own status, and is kept rather than deleted.** Put a `**Status:**` line in
  the plan's header block when work starts, and mark its row in
  [`plans/README.md`](plans/README.md): `✅` implemented, `🟡` partly, nothing for not started. A
  `🟡` must say what is left **and what blocks it**. Plans stay on disk after shipping — their
  verified "current state" notes and code citations are the record of why the code looks the way it
  does, and deleting that means the next session re-derives it. **Implemented so far: 01, 02, 04,
  07, 51, 52. Partly: 10, 20, 23, 37.** Read each plan's status for what remains and what blocks it.
  [52](plans/52-solid-kiss-dry-refactor.md) also carries a register of **ten defects it found and
  deliberately did not fix** — read it before "cleaning up" anything it names, because each one
  changes a number, a merge outcome, or a planning decision.
- **`pnpm check`** is the single command that must pass — lint, typecheck, test, content validation.
- **Keep E2E coverage in step with functionality while developing it.** Add or adjust the
  learner-visible behavior in `apps/mobile/e2e/` in the same coherent change as the functionality,
  and run `pnpm test:e2e` before committing. **A new learner-visible STATE gets a row in
  `apps/mobile/e2e/states.ts` in the same change** — that manifest is what the accessibility,
  text-scale and coverage-guard suites all read, so one row buys all three, and
  `route-coverage.spec.ts` fails if a route has no state. A behavior-preserving refactor should keep
  the existing E2E expectations unchanged and green; change expectations only when the intended
  product behavior changes.
- **Layer boundaries in the app are lint-enforced**, not conventional
  ([mobile-app.md](docs/architecture/mobile-app.md#layers)). If an import fails lint, you're
  crossing a boundary.
- **No colour literals.** Use design tokens; they encode the accessibility rules (`accentInk` for
  text, never `accent`). The lint rule catches hex, `rgb()`/`rgba()`/`hsl()` **and** named CSS
  colours — `transparent` is the one permitted keyword. `accent.tint` is the selected-state overlay
  and `surface.scrim` the sheet backdrop; both were hardcoded six times before the rule saw them.
- **No learner-facing string literal in `apps/mobile/app/**`.** Every one lives in
  [`src/lib/copy.ts`](apps/mobile/src/lib/copy.ts), interpolated ones as functions with named
  parameters. It sits in `src/lib/` because that is the leaf layer, so `store/` (which raises
  toasts) and `ui/` and `app/` can all import it. **The E2E suite matches ~110 of these strings by
  accessible name or visible text**, so a reworded string is a failing suite, not a cosmetic change.
- **A screen composes; it does not draw.** Route files hold named sub-components and hooks; anything
  with two or more call sites belongs in `src/ui/primitives/` (domain-free) or `src/ui/components/`
  (may take domain types, never the store, never `copy`). A block with ONE call site stays local to
  its route — a component used once is not reuse.
- **Name a magic number; never round it.** The screens use values that are not on the `space` scale
  (5, 7, 9, 11, 13, 26, 38, 88). Snapping one to the nearest step moves pixels, and
  `text-scale.spec.ts` reads the result at 200% and 310%.
- **Generated files are committed and drift-checked** — `packages/design-tokens/out/` and the UniFFI
  bindings. Never hand-edit them; fix the generator.
- **One clock, one `new Date()`.** `apps/mobile/src/lib/clock.ts` is the only file allowed to
  construct a date, and ESLint enforces it. Read the day from `clock.localDay()` or
  `clock.streakDay()` — they are
  [two different keys](docs/architecture/scheduling.md#two-day-keys-not-one) and picking the wrong
  one is a correctness bug, not a style choice.
- **Practice outcomes are written only through `applyDelta`.** A screen calls `engine.record(...)`
  and hands the `ProgressDelta` to the store; nothing else writes a progress field. Which fields are
  increments, which absolute, and which monotonic is declared on `ProgressDelta`
  (`packages/core/src/engines/types.ts`) and implemented once in `apps/mobile/src/store/state.ts`.

## Running and testing

**Use Node 22.** The repo pins it (`.nvmrc`, `engines`), and `pnpm` is installed only under that
version — a shell on any other Node has no `pnpm` at all, which reads as "the repo is broken" rather
than "wrong Node". Run `nvm use 22` first, every time. `cargo` lives in `~/.cargo/bin` and may also
be off PATH.

```bash
pnpm check                          # the gate: 23 turbo tasks, all green today
pnpm test:e2e                       # 61 tests: every route and state, the clock, a11y, text scale
pnpm test:e2e:bundle                # the @smoke subset against the production web export
pnpm --filter @loro/api dev         # :3000 — no Docker, no keys, no database
pnpm --filter @loro/mobile bundle   # proves the app compiles; needs no simulator
npx expo start --web                # from apps/mobile — fastest way to see the screens
```

- **The API needs no Docker.** Persistence isn't wired — the sync store is an in-memory `Map` and AI
  is stubbed (`AI_PROVIDER=stub`), so skip `dev:up` unless you're building the repository layer.
  `/v1/health/ready` returns 503 if the WASM merge is missing, which is the check worth watching.
- **`expo run:ios` / `run:android` need a toolchain that isn't set up here** — full Xcode or the
  Android SDK, plus a first `expo prebuild` (there is no `apps/mobile/ios` or `android/`). Until
  then: web, or Expo Go on a device, which still works only because no custom native module is
  installed yet.
- **The browser E2E suite protects the current web behavior, not missing native behavior.** The five
  hand-checks in [`onboarding.md`](docs/process/onboarding.md) — audio, mic, the warming card,
  offline, sync — have no implementation behind them to check. CI runs `pnpm test:e2e` as a separate
  required job; it is intentionally not hidden inside the fast `pnpm check` command because Chromium
  is a one-time local install.
- **Two accessibility props never reach a browser**, so a green E2E run says nothing about them:
  react-native-web's allowlist forwards neither `accessibilityLanguage` (hence no `lang="es-ES"` in
  the DOM) nor `accessibilityHint`. `check:lang` is the gate for the first, which is why it scans
  source. Conversely, react-native-web ignores NESTED `accessibilityState` / `accessibilityValue`
  entirely — `src/ui/primitives.tsx` therefore sets the flat `aria-*` form as well, and the header
  there explains why. Check any new accessibility prop against `createDOMProps`; silence is the
  failure mode.
- **`packages/core-rs` tests are almost all inline `#[cfg(test)]`.** The one integration file is
  `tests/parity.rs` (the calendar cross-language check). The others named in
  [`testing-strategy.md`](docs/process/testing-strategy.md) (`sim.rs`, `merge.rs`, `golden/`) don't
  exist, so don't assume a scheduling or DSP change is covered.
- **`cargo` is off the PATH that `pnpm`/`turbo` see.** `pnpm check` looks green while the four
  `@loro/core-rs` tasks are cache hits, then fails with `cargo: command not found` the moment a Rust
  file changes. Run `export PATH="$HOME/.cargo/bin:$PATH"` first.
- **Two docs run ahead of the code.** `onboarding.md` §3 says to run `db:migrate` / `db:seed`, which
  aren't defined — [`apps/api/README.md`](apps/api/README.md) is the accurate one.
  `apps/mobile/README.md` lists `src/features/`, `src/engines/`, `src/domain/`, `src/data/`,
  `src/platform/`, `modules/`, and `targets/`; only `src/lib/`, `src/store/`, and `src/ui/` exist.

## Where things live

| Path                      | What                                                                      |
| ------------------------- | ------------------------------------------------------------------------- |
| `docs/`                   | All documentation — start at `docs/README.md`                             |
| `apps/mobile/`            | Expo / React Native app; routes in `app/`, design system in `src/ui/`     |
| `…/src/ui/primitives/`    | Domain-free components. Nothing here knows what a phrase is               |
| `…/src/ui/components/`    | Composites that take domain types. Never the store, never `copy`          |
| `…/src/ui/tokens/`        | Component geometry the generated tokens don't cover. Lint-exempt for hex  |
| `…/src/lib/copy.ts`       | **Every** learner-facing string. The E2E suite asserts ~110 of them       |
| `apps/mobile/e2e/`        | Playwright web E2E for every implemented route and cross-screen flow      |
| `apps/api/`               | NestJS backend                                                            |
| `packages/core/`          | Shared TS domain, engine contracts, API schemas — **used by app AND api** |
| `…/core/src/persistence/` | SQLite schema, migrations, repositories, outbox. Driver-agnostic          |
| `apps/mobile/src/data/`   | The SQL drivers. `driver.node.ts` (tests) today; op-sqlite needs plan 09  |
| `packages/core-rs/`       | Rust: FSRS, sync merge, ranking, DSP. All reproducible maths              |
| `packages/design-tokens/` | Tokens extracted from the blueprint + generators                          |
| `packages/content/`       | The Spanish catalog, schema-validated                                     |

## Things worth knowing before making changes

- **`packages/core-rs` owns every number that must be identical across platforms** — FSRS intervals,
  the sync merge, ranking, DSP scores. Two implementations of the sync merge would diverge and lose
  learner data ([ADR-0002](docs/architecture/adr/0002-shared-rust-core.md)).
- **Every syncable field needs a declared merge class** in `packages/core/src/sync/fieldPolicy.ts`.
  CI fails without one, because a missing class is a silent data-loss bug
  ([sync-protocol.md](docs/architecture/sync-protocol.md)).
- **The practice loop is a plug-in.** Five to seven engines implement one interface, and **every
  engine maintains every progress signal, including ones it doesn't display** (rule 5). Enforced by
  a conformance suite ([practice-engines.md](docs/architecture/practice-engines.md)).
- **Offline-first is not a feature.** The device is the source of truth; every write succeeds
  locally and appends to an outbox. No code path awaits the network
  ([offline.md](docs/architecture/offline.md)).
- **Content ships independently of the app.** A phrase fix needs no release
  ([ADR-0009](docs/architecture/adr/0009-content-pipeline-and-packs.md)).

## Open questions

Unresolved decisions with owners and dates:
[`docs/decisions/open-questions.md`](docs/decisions/open-questions.md). Two are currently blocking:
**Q-05** (who owns the practice-loop decision) and **Q-08** (pricing).

## Python

Per the global instruction: use `uv run python3 ...` and `uv add <pkg>`. Bare `python`/`pip` are
intentionally blocked. There is no Python in this project today; content tooling is TypeScript.
