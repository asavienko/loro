# CLAUDE.md

Guidance for Claude Code working in this repository.

## What this is

**Loro** — a mobile app (iOS + Android) that teaches Spanish, Bulgarian, and Russian by the phrase.

Early implementation. **What exists:** eight of the v1.1 design package's 23 learner screens,
Languages, Account, More and Settings utilities, the shared shell and a developer workbench.
Discover offers Add your own and bundled topic suggestions; live `/v1/phrases/suggest` stays behind
Q-21. Local progress and course/session state commit to native OP-SQLite or browser SQLite before
rendering. Rust owns FSRS, ranking, selection, matching, clocks and merge through generated WASM/UniFFI
bridges. Native modules provide foreground device TTS and strictly on-device ASR with an offline
Speak reveal fallback. The API stores accounts, sessions and tenant-scoped sync in PostgreSQL.
Optional Google/Apple and email sign-in connect durable local progress to cross-device sync.

The three 31-phrase Spanish/Bulgarian/Russian starters still await bilingual review. The other 15
learner screens, production recorded audio/cache, background audio, measured onset latency, DSP,
widgets and account export/erasure remain. Android compilation and an airplane-mode emulator
persistence/reveal smoke passed; full iOS and physical-device speech/convergence acceptance remain
release gates. See [persistent practice](docs/process/persistent-practice.md) and
[plan 94](plans/archive/2026-09-09/94-persistent-practice-and-account-integration.md) for scoped
evidence.

The [post-main 33-plan review](docs/reviews/2026-09-09-post-main-plan-review.md) records the six
review findings as fixed: browser file import uses the picker-provided file, picker results are
request-scoped and pair-safe, corrupt release pointers fail closed, chat choice IDs are unique, and
active-session E2E navigation uses a deterministic open-wave clock. Refrain completion remains
visible before a future-wave lock, and its persistent resume action meets the touch-target floor.
The fast and full local checks are green; device/provider acceptance remains open. No whole plan is
newly complete; the [implemented-slice archive](plans/archive/2026-09-09/IMPLEMENTED-SLICES.md)
retains delivered work.

The spine supports pull-down to open its menu; sheets dismiss by pulling their dedicated handle.
Practice routes disable native back-swipe. Native touch validation remains a release gate. Today
owns its root header and day rows; other routes retain their stack header with a Today escape for
cold entries. Onboarding keeps step-back navigation. More is reachable through the existing
destination registry and grouped More utility; exhaustive route laws, counts/search, full session
exits and travelling audio remain in plans 56/62/64/81. Rust owns a pure notification candidate
planner; native scheduling, widgets and device evidence remain in plan 70.

API contracts live in `packages/core/src/api/` with current/target/draft entry points and generated
OpenAPI. Auth, sync and content-query runtime boundaries consume the shared schemas; remaining
migration limits are recorded in [the contract guide](docs/architecture/api-contracts.md).
`pnpm check` includes route ownership, contract and generated-core drift checks. The
[twenty-plan review](docs/reviews/2026-09-09-twenty-plan-implementation.md) and follow-up retain
remediation history; import validation/recovery and exact-material review fixes are implemented. The
[nine-priority queue](plans/README.md#next-implementation-priorities--reviewed-2026-09-09) sequences
the remaining slices, with device/content/operations acceptance starting alongside priority 1.

The standalone preview can use the [AWS HTTPS gateway](docs/process/public-api.md). Account checks
real readiness independently of sign-in. The development gateway now exposes Google sign-in and
guarded sync backed by private PostgreSQL. Google is in testing mode; live consent-to-device
verification remains open. Deployment validates the exact Docker image with
`scripts/ci-api-image.sh` before transfer.

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

For development, use the repository skill
[`loro-development`](.agents/skills/loro-development/SKILL.md) (`$loro-development`). It provides a
read-only context helper and focused references distilled from current and archived project chats.
Load only the reference relevant to the task; this file remains the shared instruction source.

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

- **`master` means `main`.** When someone refers to the `master` branch, interpret it as `main` for
  branch operations, including commits, pushes, and merges, without asking for clarification.
- **Never commit or push unencrypted environment files.** Real `.env`, `.env.*`, and `*.env` values
  stay local and gitignored. The only plaintext exception is `.env.example`, containing placeholders
  or non-secret local defaults. Run `pnpm env:encrypt` before committing API configuration; commit
  only SOPS-encrypted `secrets/*.enc.env`. Verify decryption matches the local values without
  printing them, and inspect staged paths before every commit. Never stage private age identities,
  use `git add -f` to bypass this rule, or include credentials in logs or commit text.

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
- **Active plans live in `plans/`, numbered.** One markdown file per plan: a two-digit number, then
  kebab-case named for the topic — `plans/NN-topic.md`. Completed plans and superseded snapshots
  live only in `plans/archive/<date>/`, indexed by
  [`plans/archive/README.md`](plans/archive/README.md). Do not create compatibility symlinks or
  redirect files; update references to the actual archive path and rebase the moved plan's relative
  links. Keep completed records out of the active index. Archive a finished plan in the same change.
  Plan 53 was archived at user request on 2026-09-09; its former original-path exception no longer
  applies. Plan 97 owns generative Discover reach. The next new plan number is 98; recheck concurrent
  worktrees and untracked `plans/` files before allocating an ID — the README/CLAUDE "next is N"
  sentence can lag. A new plan takes the next free number and gets a row in
  [`plans/README.md`](plans/README.md). **Numbers are never reused** — a gap is left rather than
  backfilled, so a link written against a number can't come to mean a different plan. Not in
  `docs/`: that holds the durable spec. Not in a temp directory either — a plan you can't find
  again is a plan you rewrite. Name the requirement ID inside the plan so it ties back to the
  branch and the PR.
- Implemented-slice plans 56–68, 70–73, 75–77, 80–82, 86–88, 90 and 93–96 were archived at user
  request on 2026-09-09 with their partial status and remaining scope preserved in
  `plans/archive/2026-09-09/`; direct links in the roadmap index retain their ownership. This
  archival does not mean their acceptance criteria are complete.
- **A plan records its own status, and is archived rather than deleted.** Put a `**Status:**` line
  in the plan's header block when work starts, and mark its row in
  [`plans/README.md`](plans/README.md): `🟡` in progress or partly implemented, `⛔` blocked by a
  named decision/evidence gate, `—` ready when dependencies pass, or `✅` implemented. A `🟡` must
  say what is left **and what blocks it**. Archived plans stay on disk as the verified record of why
  the code looks the way it does. The 2026-07-30 reset and legacy-to-active mapping are in
  [`plans/archive/2026-07-30/REVIEW.md`](plans/archive/2026-07-30/REVIEW.md). Preserve historical
  implementation evidence when archiving; adjust only location references and archive metadata.
- **`pnpm ci:local`** is the full local CI gate; `pnpm check` is the fast development gate.
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

## CI policy

Run CI checks locally. Do not enable, dispatch, or rerun GitHub Actions unless the user explicitly
changes this policy. GitHub Actions is disabled in the repository settings; former workflows are
inactive references in `.github/workflows-disabled/`. `pnpm ci:local` is the full local gate;
`pnpm check` remains the fast development gate. See `docs/process/ci-cd.md` for prerequisites,
native builds, audits, commit validation, and retained reports.

## Local Android APK distribution

`pnpm apk:local` builds a standalone, development-key-signed testing APK from a clean committed
snapshot using local Expo prebuild and Gradle. `pnpm apk:github` also uploads it to a draft GitHub
prerelease; add `--publish` to publish the prerelease after upload verification. No GitHub Actions
or EAS build is invoked. JDK 17 and Android SDK 36 are required. Native projects stay temporary;
`apps/mobile/android` is not a source checkout. See `docs/process/local-apk.md` for signing,
configuration and release boundaries. Native core/audio/SQLite modules are now included; an APK
build alone does not prove physical-device speech or production signing.

## Running and testing

`pnpm local:up` decrypts the SOPS API environment and builds/starts the API and Expo web containers,
including WASM. `pnpm local:down` stops them. PostgreSQL and auth configuration are required for
account/sync runtime; follow the current Compose profile and setup in
[`local-development.md`](docs/process/local-development.md) for age identity setup.

**Use Node 22.** The repo pins it (`.nvmrc`, `engines`), and `pnpm` is installed only under that
version — a shell on any other Node has no `pnpm` at all, which reads as "the repo is broken" rather
than "wrong Node". Run `nvm use 22` first, every time. `cargo` lives in `~/.cargo/bin` and may also
be off PATH.

```bash
pnpm ci:local                       # full local CI; GitHub Actions stays disabled
pnpm check                          # fast lint/type/test/content/drift gate
pnpm test:e2e                       # learner routes/states, clock, a11y, text scale
pnpm test:e2e:workbench             # dev-only tokens/component inspection surface
pnpm test:e2e:bundle                # the @smoke subset against the production web export
pnpm --filter @loro/api dev         # :3000; requires PostgreSQL/auth configuration
pnpm --filter @loro/mobile bundle   # proves the app compiles; needs no simulator
npx expo start --web                # from apps/mobile — fastest way to see the screens
```

- **The API uses PostgreSQL for accounts and sync.** Configure the encrypted environment and
  database before starting it. `/v1/health/ready` checks actual database/WASM availability; missing
  dependencies are not replaced with a production in-memory fallback.
- **Local Android preview builds are verified:** `pnpm apk:local` uses Java/Android SDK and a
  temporary Expo prebuild. Native projects remain generated and ignored. Custom core/audio/SQLite
  modules require a native build; Expo Go is unsupported. iOS still needs full Xcode.
- **Native builds are a separate local gate:** `pnpm ci:local:native` requires macOS/Xcode,
  installed Rust targets, cargo-ndk and an Android NDK. It builds libraries only. EAS and
  device-farm scaffolds are inactive; no command in local CI queues a cloud build.
- **Browser E2E cannot verify native speech.** `pnpm ci:local` runs learner, workbench and
  production browser suites. The Android offline persistence/reveal smoke is recorded separately in
  [persistent practice](docs/process/persistent-practice.md); installed voices/models,
  interruptions, physical devices and iOS remain additional acceptance work.
- **Two accessibility props never reach a browser**, so a green E2E run says nothing about them:
  react-native-web's allowlist forwards neither `accessibilityLanguage` (hence no `lang="es-ES"` in
  the DOM) nor `accessibilityHint`. `check:lang` is the gate for the first, which is why it scans
  source. Conversely, react-native-web ignores NESTED `accessibilityState` / `accessibilityValue`
  entirely — `src/ui/primitives/Pressable.tsx` and `src/ui/primitives/bars.tsx` therefore set the
  flat `aria-*` forms as well; `src/ui/primitives/index.ts` explains why. Check any new
  accessibility prop against `createDOMProps`; silence is the failure mode.
- **Rust tests include inline units and integration targets.** Reference scheduling vectors,
  cross-language calendar parity and simulation checks supplement mobile/browser tests. The DSP
  physical-device quality gate remains separate from these deterministic checks.
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
| `apps/mobile/src/data/`   | Native/browser SQLite drivers, hydration, repository writes and sync      |
| `packages/core-rs/`       | Rust: FSRS, sync merge, ranking, DSP. All reproducible maths              |
| `packages/design-tokens/` | Tokens extracted from the blueprint + generators                          |
| `packages/content/`       | Spanish/Bulgarian/Russian catalogs and review/validation gates            |

## Backend testing infrastructure

[Plan 88](plans/archive/2026-09-09/88-low-cost-backend-infrastructure.md) selects one Frankfurt EC2
instance with local PostgreSQL and private S3 at a $25–35/month target. Plan 91 records the
restricted EC2 deployment; the full durable shared-testing profile still needs its own operational
acceptance. The new account/sync runtime must pass that deployment gate before shared access is
enabled. Do not add managed dev/staging stacks, Redis, CDN or live providers to this phase. Start
with [environments](docs/process/environments.md) and the
[testing runbook](docs/runbooks/backend-testing.md). Plan 73 owns production decisions; plan 86 owns
provider adapters.

## Things worth knowing before making changes

- **`packages/core-rs` owns every number that must be identical across platforms** — FSRS intervals,
  the sync merge, ranking, DSP scores. Two implementations of the sync merge would diverge and lose
  learner data ([ADR-0002](docs/architecture/adr/0002-shared-rust-core.md)).
- **Every syncable field needs a declared merge class** in `packages/core/src/sync/fieldPolicy.ts`.
  CI fails without one, because a missing class is a silent data-loss bug
  ([sync-protocol.md](docs/architecture/sync-protocol.md)).
- **The practice loop is a plug-in.** Stream, Refrain and Speak implement one interface today; every
  future engine must maintain every progress signal, including ones it doesn't display (rule 5). The
  conformance suite enforces this for implemented engines
  ([practice-engines.md](docs/architecture/practice-engines.md)).
- **Offline-first is the runtime invariant.** The device/browser database is the source of truth;
  local writes and outbox changes commit before store projections publish. Network and sign-in are
  optional for practice ([offline.md](docs/architecture/offline.md)).
- **Independent content delivery is a target, not current behavior.** Plan 61 adds the updater and
  artifact path that will let a phrase fix ship without an app release
  ([ADR-0009](docs/architecture/adr/0009-content-pipeline-and-packs.md)).

## Open questions

Unresolved decisions with owners and dates:
[`docs/decisions/open-questions.md`](docs/decisions/open-questions.md). Active roadmap gates are
**Q-15** (production audio), **Q-07** (trip semantics), **Q-05** (loop experiment and conditional
Run), **Q-14** (Refrain peak accessibility), **Q-08/Q-12** (pricing and billing), **Q-17** (rail
priority), **Q-16/Q-18–Q-20** (chat launch, budget and retention), **Q-21** (Discover suggest), plus
bilingual review and the DSP quality gate. Gates apply to their named slices; offline chat and
spike preparation may proceed.
Work whose dependencies do not cross those gates should continue.

## Python

Per the global instruction: use `uv run python3 ...` and `uv add <pkg>`. Bare `python`/`pip` are
intentionally blocked. There is no Python in this project today; content tooling is TypeScript.

## Multilingual work (plan 87)

The UI follows the native language (`en`, `bg`, `ru`); targets are `es-ES`, `bg-BG`, `ru-RU`,
excluding matching pairs. Use `loadLearningCatalog`, neutral targetText/translation views and the
reactive `copy.ts` adapter over bundled i18next/ICU resources in `src/lib/i18n/`. Shared UI receives
translated props. The Languages route is reachable from Today's switcher. Course progress and resume
state are separate; the streak is global. Device/browser hydration and transactional writes are
implemented. New linguistic content is pending bilingual review; TTS/ASR availability is checked per
device and target, while DSP stays unavailable. Plan 87 owns bilingual/multilingual acceptance;
plans 59/60 own persistence and canonical runtime behavior. Never replace a missing voice, model or
measurement with a simulated result.

## Optional accounts (plans 67/89/94)

`/account` offers Google/Apple and email sign-in backed by PostgreSQL accounts, rotating refresh
families and tenant-scoped sync. Native refresh credentials use SecureStore; browser credentials
remain in memory. Installation binding prevents another account from uploading existing local
progress. Sign-out retains learning data. Live provider/email configuration, account linking,
export/erasure and physical-device convergence remain separate acceptance work. See
[provider setup](docs/architecture/google-apple-auth.md) and
[persistent practice](docs/process/persistent-practice.md).

## EC2 development deployment (plan 91)

`infra/ec2/template.yaml` and `scripts/provision-ec2.sh` provision a restricted development host;
`scripts/deploy-ec2.sh` builds/transfers the API image and health-gates replacement with rollback.
Administrative API access uses an SSH tunnel. The eu-central-1 HTTPS gateway enables development
Google sign-in and guarded sync with private persistent PostgreSQL. Durable readiness, isolated
restore and public auth-boundary probes passed on 2026-09-08; final device consent and the full
backup/monitoring profile remain separate gates. See
[`ec2-deployment.md`](docs/process/ec2-deployment.md).
