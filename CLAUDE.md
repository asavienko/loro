# CLAUDE.md

Guidance for Claude Code working in this repository.

## What this is

**Loro** — a mobile app (iOS + Android) that teaches Spanish, Bulgarian, and Russian by the phrase.

Early implementation. **What exists:** the docs, 7 of the v1.1 design package's 23 learner screens
plus the Languages and Account utilities and app shell in `apps/mobile/app/`, an API with 21
endpoints (in-memory learning sync and PostgreSQL accounts), the Rust core, the design tokens,
31-phrase Spanish/Bulgarian/Russian starter catalogs (new translations await bilingual review), and
the local persistence layer (schema, migrations, repositories, outbox — driver-agnostic and tested
against real SQLite), plus a dev-only generated token/component workbench. 602 JS/TS tests, 131 Rust
tests, and 132 distinct browser E2E tests cover the implemented behavior. **What doesn't:** the
native modules (audio, speech, ASR, widgets), the on-device SQLite driver, and the other 16 learner
screens — so nothing runnable today exercises audio or the microphone, which is half of what this
app is, and the app store is still in memory.

**The shared spine/switcher now wraps Today, Add, Progress, Stream, Refrain, and phrase detail.**
`src/lib/navigation.ts` declares the built hubs used by the switcher and Today's rail. Today owns
its root header and day-as-hairline-rows treatment; other routes retain their stack header with a
Today escape for cold entries. Onboarding keeps step-back navigation. More, ongoing work, durable
resume, session exits and travelling audio still belong to plans 56/59/62/64/81.

API contracts now live in `packages/core/src/api/` with current/target/draft entry points and
generated OpenAPI. `pnpm check` includes contract drift checks. They are not wired into Nest or the
mobile runtime; [the contract guide](docs/architecture/api-contracts.md) records that boundary.

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

## The v1.1 design package is the source of truth

```
design/Language Learning by Phrases - V1.1/Loro.dc.html          # original learner screens 1–21
design/Language Learning by Phrases - V1.1/Loro Chat.dc.html     # Open chat + Message inspector, 22–23
design/Language Learning by Phrases - V1.1/Navigation.dc.html    # shell/navigation laws for every screen
design/Language Learning by Phrases - V1.1/Design System.dc.html # authored visual reference
```

They are executable specs, not mockups. Every phone is interactive; learner screens have a `DCLogic`
class whose `renderVals()` is a complete view model.

- **Precedence is scoped.** `Loro.dc.html` owns screens 1–21; `Loro Chat.dc.html` owns screens
  22–23; `Navigation.dc.html` owns shared chrome and navigation laws across all 23. Its “spine on
  every screen” law supersedes Chat's earlier “no chrome” description: Chat excludes card/drill
  chrome inside the conversation, not the app shell. `Design System.dc.html` is the authored visual
  reference; reviewed runtime tokens may diverge only for recorded, tested accessibility reasons.
- **When a doc and the applicable authored artifact disagree, the artifact wins.** Fix the doc.
- **Don't edit the authored artifacts.** Intended-design changes go in `docs/`.
- [`docs/design/screen-catalog.md`](docs/design/screen-catalog.md) maps all 23 learner screens and
  indexes the shell and developer workbench separately. Start there when working on a screen.

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

- **`master` means `main`.** When someone refers to the `master` branch, interpret it as `main`
  for branch operations, including commits, pushes, and merges, without asking for clarification.
- **Never commit or push unencrypted environment files.** Real `.env`, `.env.*`, and `*.env`
  values stay local and gitignored. The only plaintext exception is `.env.example`, containing
  placeholders or non-secret local defaults. Run `pnpm env:encrypt` before committing API
  configuration; commit only SOPS-encrypted `secrets/*.enc.env`. Verify decryption matches the local
  values without printing them, and inspect staged paths before every commit. Never stage private
  age identities, use `git add -f` to bypass this rule, or include credentials in logs or commit text.

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
  kebab-case named for the topic — `plans/60-authoritative-core-maths.md`. The 2026-09-07 review
  leaves 30 active plans within 56–88; completed 54/55/79/84/85 are under
  `plans/archive/2026-09-07/` with compatibility symlinks. Plans 01–52 remain under
  `plans/archive/2026-07-30/`; completed 53 remains at its protected original path. The next new
  plan number is 90. A new plan takes the next free number and gets a row in
  [`plans/README.md`](plans/README.md). **Numbers are never reused** — a gap is left rather than
  backfilled, so a link written against a number can't come to mean a different plan. Not in
  `docs/`: that holds the durable spec. Not in a temp directory either — a plan you can't find again
  is a plan you rewrite. Name the requirement ID inside the plan so it ties back to the branch and
  the PR.
- **A plan records its own status, and is archived rather than deleted.** Put a `**Status:**` line
  in the plan's header block when work starts, and mark its row in
  [`plans/README.md`](plans/README.md): `🟡` in progress or partly implemented, `⛔` blocked by a
  named decision/evidence gate, `—` ready when dependencies pass, or `✅` implemented. A `🟡` must
  say what is left **and what blocks it**. Archived plans stay on disk as the verified record of why
  the code looks the way it does. The 2026-07-30 reset and legacy-to-active mapping are in
  [`plans/archive/2026-07-30/REVIEW.md`](plans/archive/2026-07-30/REVIEW.md). Plan 53 is a protected
  completed exception; do not edit or move it without explicit user direction.
- **`pnpm check`** is the single command that must pass — lint, typecheck, test, content validation.
- **Keep E2E coverage in step with functionality while developing it.** Add or adjust the
  learner-visible behavior in `apps/mobile/e2e/` in the same coherent change as the functionality,
  and run `pnpm test:e2e` before committing. **A new learner-visible STATE gets a row in
  `apps/mobile/e2e/states.ts` in the same change** — that manifest is what the accessibility,
  text-scale and coverage-guard suites all read, so one row buys all three, and
  `route-coverage.spec.ts` fails if a route has no state. A behavior-preserving refactor should keep
  the existing E2E expectations unchanged and green; change expectations only when the intended
  product behavior changes. **A semantic locator cannot see geometry** — a chart whose segments were
  0 px tall kept its legend, its counts and its summary and passed every suite — so a bar, a chart
  or a fill that states a number belongs in [`e2e/render.spec.ts`](apps/mobile/e2e/render.spec.ts),
  which measures the rendering against what the same page says in words. It is not a screenshot
  suite and must not become one.
- **Layer boundaries in the app are lint-enforced**, not conventional
  ([mobile-app.md](docs/architecture/mobile-app.md#layers)). If an import fails lint, you're
  crossing a boundary.
- **No colour literals.** Use design tokens; they encode the accessibility rules (`accentInk` for
  text, never `accent`). The lint rule catches hex, `rgb()`/`rgba()`/`hsl()` **and** named CSS
  colours — `transparent` is the one permitted keyword. `accent.tint` is the selected-state overlay
  and `surface.scrim` the sheet backdrop; both were hardcoded six times before the rule saw them.
- **No learner-facing string literal in `apps/mobile/app/**`.** Every one is accessed through
  [`src/lib/copy.ts`](apps/mobile/src/lib/copy.ts), backed by bundled resources in `src/lib/i18n/`,
  with named interpolation parameters. It sits in `src/lib/` because that is the leaf layer, so
  `store/` (which raises toasts) and `ui/` and `app/` can all import it. **The E2E suite matches
  ~110 of these strings by accessible name or visible text**, so a reworded string is a failing
  suite, not a cosmetic change.
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
- **A local write owns some columns and not others.** `upsert` never touches `field_hlc` (the
  merge's) or `deleted_at` (`softDelete`'s), so a stale write cannot resurrect a tombstone or erase
  another device's clocks. `INSERT OR REPLACE` is banned in `persistence/` for exactly this reason —
  it is a delete-then-insert, so every column the incoming row does not carry silently reverts to
  its default. Use `ON CONFLICT … DO UPDATE` over the columns the write owns, and there is
  [no ORM on the client](docs/architecture/adr/0003-offline-first-sqlite-sync.md#amendment--2026-07-30--handwritten-sql-on-the-client-no-orm).
- **Eligibility is one rule, not four.** `isActive` / `isDue` in
  `packages/core/src/domain/phrase.ts` decide what an engine may plan with. The SQL tables express
  the same rule as a `WHERE` clause, and `apps/mobile/src/data/persistence.test.ts` asserts every
  implementation returns the same ids.
- **Practice outcomes are written only through `applyDelta`.** A screen calls `engine.record(...)`
  and hands the `ProgressDelta` to the store; nothing else writes a progress field. Which fields are
  increments, which absolute, and which monotonic is declared on `ProgressDelta`
  (`packages/core/src/engines/types.ts`) and implemented once in `apps/mobile/src/store/delta.ts`.

## Running and testing

`pnpm local:up` decrypts the SOPS API environment and builds/starts the API and Expo web containers,
including WASM. `pnpm local:down` stops them. Optional data services use the `infra` Compose
profile; runtime storage is still in memory. See
[`local-development.md`](docs/process/local-development.md) for age identity setup.

**Use Node 22.** The repo pins it (`.nvmrc`, `engines`), and `pnpm` is installed only under that
version — a shell on any other Node has no `pnpm` at all, which reads as "the repo is broken" rather
than "wrong Node". Run `nvm use 22` first, every time. `cargo` lives in `~/.cargo/bin` and may also
be off PATH.

```bash
pnpm check                          # the gate: 23 turbo tasks, all green today
pnpm test:e2e                       # 128 learner tests: routes/states, clock, a11y, text scale
pnpm test:e2e:workbench             # 3 tests: dev-only tokens/component inspection surface
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
- **Native CI distinguishes implemented checks from setup gates.** Rust library builds use cargo-ndk
  for Android and compile only libraries for mobile targets. Existing Rust tests always run; the
  plan-77 golden harness runs once its test target exists. EAS builds require a real project ID and
  `EXPO_TOKEN`; unconfigured automatic builds skip, while explicit manual requests fail with the
  setup requirement. Browser and bundle gates remain required.
- **The browser E2E suite protects the current web behavior, not missing native behavior.** The five
  hand-checks in [`onboarding.md`](docs/process/onboarding.md) — audio, mic, the warming card,
  offline, sync — have no implementation behind them to check. CI runs `pnpm test:e2e` as a separate
  required job; it is intentionally not hidden inside the fast `pnpm check` command because Chromium
  is a one-time local install.
- **Two accessibility props never reach a browser**, so a green E2E run says nothing about them:
  react-native-web's allowlist forwards neither `accessibilityLanguage` (hence no `lang="es-ES"` in
  the DOM) nor `accessibilityHint`. `check:lang` is the gate for the first, which is why it scans
  source. Conversely, react-native-web ignores NESTED `accessibilityState` / `accessibilityValue`
  entirely — `src/ui/primitives/Pressable.tsx` and `src/ui/primitives/bars.tsx` therefore set the
  flat `aria-*` forms as well; `src/ui/primitives/index.ts` explains why. Check any new
  accessibility prop against `createDOMProps`; silence is the failure mode.
- **`packages/core-rs` tests are almost all inline `#[cfg(test)]`.** The one integration file is
  `tests/parity.rs` (the calendar cross-language check). The others named in
  [`testing-strategy.md`](docs/process/testing-strategy.md) (`sim.rs`, `merge.rs`, `golden/`) don't
  exist, so don't assume a scheduling or DSP change is covered.
- **`cargo` is off the PATH that `pnpm`/`turbo` see.** `pnpm check` looks green while the four
  `@loro/core-rs` tasks are cache hits, then fails with `cargo: command not found` the moment a Rust
  file changes. Run `export PATH="$HOME/.cargo/bin:$PATH"` first.
- **Onboarding still runs ahead of the code.** `onboarding.md` §3 names undefined `db:migrate` /
  `db:seed` commands and its tree includes target-only feature, domain, platform, module, and target
  directories. [`apps/api/README.md`](apps/api/README.md) and
  [`apps/mobile/README.md`](apps/mobile/README.md) are the accurate current inventories.

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
| `…/core/src/persistence/` | Schema, migrations, repositories, outbox. Handwritten SQL, no ORM         |
| `apps/mobile/src/data/`   | Node SQLite test driver today; plan 59 adds the on-device driver          |
| `packages/core-rs/`       | Rust: FSRS, sync merge, ranking, DSP. All reproducible maths              |
| `packages/design-tokens/` | Tokens extracted from the blueprint + generators                          |
| `packages/content/`       | The Spanish catalog, schema-validated                                     |

## Backend testing infrastructure

[Plan 88](plans/88-low-cost-backend-infrastructure.md) selects one Frankfurt EC2 instance with local
PostgreSQL and private S3 at a $25–35/month target. It is not provisioned. Shared access requires
66/67's persistence, auth and isolation; mobile sync has additional 59/68 gates. Do not add managed
dev/staging stacks, Redis, CDN or live providers to this phase. Start with
[environments](docs/process/environments.md) and the
[testing runbook](docs/runbooks/backend-testing.md). Plan 73 owns production decisions; plan 86 owns
provider adapters.

## Things worth knowing before making changes

- **`packages/core-rs` owns every number that must be identical across platforms** — FSRS intervals,
  the sync merge, ranking, DSP scores. Two implementations of the sync merge would diverge and lose
  learner data ([ADR-0002](docs/architecture/adr/0002-shared-rust-core.md)).
- **Every syncable field needs a declared merge class** in `packages/core/src/sync/fieldPolicy.ts`.
  CI fails without one, because a missing class is a silent data-loss bug
  ([sync-protocol.md](docs/architecture/sync-protocol.md)).
- **The practice loop is a plug-in.** Stream and Refrain implement one interface today; every future
  engine must maintain every progress signal, including ones it doesn't display (rule 5). The
  conformance suite enforces this for implemented engines
  ([practice-engines.md](docs/architecture/practice-engines.md)).
- **Offline-first is the target invariant, not a feature toggle.** The persistence primitives and
  outbox exist, but the running app remains in memory until plan 59 makes the device database the
  source of truth ([offline.md](docs/architecture/offline.md)).
- **Independent content delivery is a target, not current behavior.** Plan 61 adds the updater and
  artifact path that will let a phrase fix ship without an app release
  ([ADR-0009](docs/architecture/adr/0009-content-pipeline-and-packs.md)).

## Open questions

Unresolved decisions with owners and dates:
[`docs/decisions/open-questions.md`](docs/decisions/open-questions.md). Active roadmap gates are
**Q-15** (production audio), **Q-07** (trip semantics), **Q-05** (loop experiment and conditional
Run), **Q-14** (Refrain peak accessibility), **Q-08/Q-12** (pricing and billing), **Q-17** (rail
priority), **Q-16/Q-18–Q-20** (chat launch, budget and retention), plus bilingual review and the DSP
quality gate. Gates apply to their named slices; offline chat and spike preparation may proceed.
Work whose dependencies do not cross those gates should continue.

## Python

Per the global instruction: use `uv run python3 ...` and `uv add <pkg>`. Bare `python`/`pip` are
intentionally blocked. There is no Python in this project today; content tooling is TypeScript.

## Multilingual work (plan 87)

The UI follows the native language (`en`, `bg`, `ru`); targets are `es-ES`, `bg-BG`, `ru-RU`,
excluding matching pairs. Use `loadLearningCatalog`, neutral targetText/translation views and the
reactive `copy.ts` adapter over bundled i18next/ICU resources in `src/lib/i18n/`. Shared UI receives
translated props. The Languages route is reachable from Today's switcher. Course progress and resume
state are separate; the streak is global. Schema 2 repositories exist, but plan 59 still owns device
persistence. New linguistic content is pending bilingual review; audio/ASR/DSP capabilities remain
disabled. Plan 87 now tracks review and multilingual acceptance only; plan 59 owns device wiring and
correction of the remaining `INSERT OR REPLACE` in `sqlite/course.ts`. Plan 60 owns the
ASCII-oriented matcher/fabricated FSRS-cloze fallback and missing nightly `tests/sim` target.

## Google/Apple accounts (plan 89)

Optional `/account` identity is implemented with server-side provider verification, PostgreSQL
accounts/refresh families and native SecureStore. Browser credentials remain in memory. Auth-enabled
deployments fail closed on legacy sync/AI until tenant isolation lands. Learning data is untouched;
anonymous claim/merge, deletion/export and live provider/device verification remain separate work.
See [provider setup](docs/architecture/google-apple-auth.md).
