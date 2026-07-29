# The extended E2E strategy — the axes the current gate structurally cannot express

- **Requirement IDs:** cross-cutting; supports the definition of done. Exercises `LB-01`…`LB-32`,
  `P1-01`…`P1-10`, `P4-02`…`P4-08` along axes the existing specs cannot reach
- **Milestone:** M1 (stages 1–3, 6, 7) → M2 (stages 4, 5)
- **Size:** M–L, split into seven independently landable stages
- **Status:** not started
- **Spec:** [`testing-strategy.md`](../docs/process/testing-strategy.md),
  [`definition-of-done.md`](../docs/process/definition-of-done.md),
  [`accessibility.md`](../docs/architecture/accessibility.md),
  [`scheduling.md#day-boundaries`](../docs/architecture/scheduling.md)
- **Parent plan:** [37-testing-gaps](37-testing-gaps.md) 🟡 — this plan takes over and expands its
  §5 (E2E) only. Everything else in 37 (`sim.rs`, `merge.rs`, `golden/`, property suites, RNTL
  component tests, blueprint fixtures) stays there.

## What this is

The Playwright suite in `apps/mobile/e2e/` answers one question well: _did a refactor change the
behaviour of the screens we have?_ It answers it for every implemented route, and it is the reason a
component refactor is currently safe.

It cannot answer a different question, and not because tests are missing — because the harness has
no way to express it. **Every test runs at the machine's current instant, in the machine's timezone,
against the dev bundle, at one viewport, with all state built by clicking through six onboarding
steps.** Those five facts, not a shortage of specs, are what put day rollover, the streak grace
window, a 2 000-phrase library, an FSRS-due queue, the production bundle, the rendered accessibility
tree, and Dynamic Type outside the suite's reach.

That matters most for one class of bug in particular. The two highest-consequence defects this repo
has fixed — [01-fix-local-day-boundary](01-fix-local-day-boundary.md) ✅ and
[02-fix-fabricated-streak](02-fix-fabricated-streak.md) ✅ — were both day-key bugs, both reached
the learner through the hero screen, and **neither is reachable by any E2E test today**. The comment
block at `apps/mobile/src/store/dayRollover.ts:1-19` describes exactly the failure it defends
against, names the three call sites that defend it, and has no browser-level test behind any of
them.

So this plan adds **axes, not paths**. `testing-strategy.md:218` is right that E2E is the least
valuable test per minute and the list should stay short; a longer list of click-throughs would be
the wrong answer. Each stage below unlocks a dimension the suite cannot currently vary, and stages
1–3 are ordered so each one makes the next possible.

## Current state, verified against the worktree on 2026-07-29

Every number here was measured in this worktree, not read from a doc.

**What is real and should not be rewritten.**

| Fact                | Measured                                                        |
| ------------------- | --------------------------------------------------------------- |
| Playwright specs    | 12 tests, 9 files, **13.6 s** wall clock, one worker            |
| Unit/integration    | **317** JS/TS across 15 files; **99** Rust (94 + 5 parity)      |
| Routes              | 7, all declared in `e2e/route-coverage.spec.ts:5`               |
| Console-error gate  | real and auto-applied to every test, `e2e/fixtures.ts:3-19`     |
| Selector discipline | roles, labels and learner-visible copy throughout               |
| API over real HTTP  | `apps/api/src/sync/sync.e2e.test.ts` boots Nest and `listen(0)` |

The suite finishes in under 14 seconds. **Runtime budget is not the constraint on extending it** —
there is roughly an order of magnitude of headroom before it becomes the slow gate that
[37](37-testing-gaps.md)'s risk section warns about. That is the single most useful fact for
planning this work.

**The structural limits.** Each row was read in the code.

| #   | Limit                                                                                                       | Where                                                                                                | What it costs                                                                                                                                                                                                                                     |
| --- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **No clock control.** No test touches `page.clock`; the app reads the real one (`src/lib/clock.ts:104-105`) | `e2e/fixtures.ts` — no clock fixture exists                                                          | The **two day keys** (`localDay()` vs `streakDay()`, four-hour grace) are untestable end to end. Day rollover has three defended call sites (`store/dayRollover.ts:22,31,34`) and zero browser coverage                                           |
| 2   | **Timezone unpinned.** `use` sets `colorScheme` and `locale` but no `timezoneId`                            | `e2e/playwright.config.mjs:19-24`                                                                    | The suite runs in the runner's zone — UTC in CI, EET locally (verified). Harmless _only_ because nothing asserts day-dependent text: `app/index.tsx:68` renders `localWeekdayLabel()` and `app/progress.tsx:56` seven local days, both unasserted |
| 3   | **All state is built by clicking.** `onboard()` runs the full six-step flow; 11 of 12 tests call it         | `e2e/fixtures.ts:42`                                                                                 | Any state costing more than ~50 UI actions is unreachable: a 30-day streak, a due FSRS queue, 2 000 phrases, a mid-flight trip. That is most of what is interesting after M1                                                                      |
| 4   | **Dev bundle only.** The web server is `expo start --web`                                                   | `e2e/playwright.config.mjs:30`; `bundle` script exports **ios** only (`apps/mobile/package.json:22`) | The suite never loads what ships. **Verified feasible and untested:** `expo export --platform web` succeeds — 1.14 MB, 723 modules, one `index.html`                                                                                              |
| 5   | **No accessibility assertion against a rendered page.** All three CI a11y gates scan `.tsx` source text     | `apps/mobile/scripts/a11yChecks.ts:27` (`SOURCE_GLOBS`)                                              | Focus order, the real accessibility tree, live-region announcement, and the reduced-motion path are unchecked. The static gates are good and cheap; they just are not this                                                                        |
| 6   | **One viewport, one text scale.** 390×844, light, `en-US`                                                   | `e2e/playwright.config.mjs:22-24`                                                                    | `testing-strategy.md:165` names Dynamic Type at five steps as a priority. No mechanism exists                                                                                                                                                     |
| 7   | **No visual or blueprint-fidelity check.** No screenshot baseline anywhere in the repo                      | —                                                                                                    | [08-built-screens-fidelity-audit](08-built-screens-fidelity-audit.md) and [37](37-testing-gaps.md) §4 both want the blueprint's `renderVals()` compared to the app; nothing does                                                                  |
| 8   | **Route manifest guards routes, not states.** `coveredRoutes` is a list of files                            | `e2e/route-coverage.spec.ts:5,19`                                                                    | A screen can gain four states and stay "covered". With 13 screens still to land this is the guard most likely to go quietly stale                                                                                                                 |
| 9   | **Retries can hide flake.** `retries: 2` in CI; the HTML report uploads only `if: failure()`                | `e2e/playwright.config.mjs:11`; `.github/workflows/ci.yml` e2e job                                   | A test that passes on attempt three is invisible. Cheap at 12 tests, not at 60                                                                                                                                                                    |
| 10  | **Serial by construction.** `fullyParallel: false`, `workers: 1`                                            | `e2e/playwright.config.mjs:9,12`                                                                     | Correct today (13.6 s). Named here so the decision is revisited deliberately, not discovered                                                                                                                                                      |

**Limits that are correctly out of reach, and what blocks each.** No work below tries to fix these.

| Blocked axis                                                    | Blocked by                                                                                                       |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Audio, microphone, native lifecycle, force-quit resume, widgets | [09](09-native-toolchain-and-dev-client.md)–[12](12-asr-speech-module.md), [30](30-widgets-and-notifications.md) |
| App ↔ API in one test; offline replay; sign-in merge            | [15](15-sync-client-loop.md), [13](13-api-postgres-persistence.md), [14](14-auth-anonymous-first.md)             |
| Real airplane mode on a cold launch                             | [31](31-offline-survival-mode.md)                                                                                |
| Dark mode / accent switching                                    | `app.config.ts:24` pins `userInterfaceStyle: 'light'`; accent is Coral until v1.1 (`src/ui/theme.ts:29`)         |
| A non-English UI axis                                           | [43](43-ui-localization.md)                                                                                      |

Faking a native module in the browser is explicitly **not** a workaround for the first row:
`testing-strategy.md:179` is right that web cannot answer native questions, and a faked audio
session on Chromium would prove nothing while looking like coverage.

## The work

### 1 · Pin the environment, then take the clock — M1, S, the unlock

Two lines of config and one fixture buy the whole day-boundary axis.

- Set `timezoneId` explicitly in `playwright.config.mjs` `use`. Pick one zone with a DST transition
  (`Europe/Madrid` — the zone `src/lib/clock.ts:1-12` uses to describe the bug it fixes) as the
  default, so CI and a laptop agree.
- Add an opt-in clock fixture, `atInstant(page, iso)`, wrapping `page.clock.install({ time })`.
  Opt-in rather than automatic, so the eleven existing specs keep running against a normal clock.

**This is verified working against this app, not assumed.** A throwaway probe run in this worktree
installed a fake clock at `2026-03-10T22:00`, completed the full six-step onboarding, recorded a
Refrain rep, advanced with `setFixedTime` past midnight, dispatched `visibilitychange`, and
navigated to Progress. The app rendered normally throughout, `useDayRollover` fired, and
`new Date()` inside the page reported `Wed Mar 11 2026 09:00:00`. Playwright is 1.62.0, so
`page.clock` is available.

Tests this makes possible for the first time — each one covering logic that currently has unit
coverage only:

| New spec                   | Asserts                                                                                                                                                                      |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Day rolls **mid-Refrain**  | The frozen set does not re-roll under the learner; `repsToday` resets; the warming card does not drop to cold mid-ritual — the exact failure `dayRollover.ts:1-19` documents |
| A 01:30 session            | Counts toward **yesterday's** streak day, and Today/Progress agree with each other                                                                                           |
| Local midnight, no session | `repsToday` resets and the streak survives the grace window                                                                                                                  |
| A DST-transition day       | The Progress seven-day row still shows seven distinct days, one day apart                                                                                                    |
| The weekday label          | `app/index.tsx:68` matches the faked day, in the pinned zone                                                                                                                 |
| Cold launch on a new day   | `ensure()` on mount re-rolls (`dayRollover.ts:34`)                                                                                                                           |

### 2 · Deep states, reached by clicking — M1, M

> **Revised while implementing, 2026-07-29.** This stage originally proposed a dev-only fixture
> loader (`?e2eFixture=streak30`) so specs could start from an injected deep state. Two facts found
> in the worktree killed that plan, and the replacement is better:
>
> 1. **The deep states that matter here are deep in time, not in size, and stage 1 already reaches
>    them.** A five-day streak is ~15 interactions; a graduation is 24 reps across four days. Both
>    run in about a second with `e2e/clock.ts`, and clicking them exercises the real accumulation
>    path — `applyDelta` → `addPracticeDay` → `streak()` → `lockInDays` → `graduatedAt` — instead of
>    asserting that a fixture loaded, which is all an injected state can prove.
> 2. **The one state clicking cannot reach is blocked by content, not by the harness.** The catalog
>    holds **31 phrases** (`packages/content/es-ES/phrases.json`), so `largeFixture(2000)` would
>    inject rows with no catalog entry and `toView` would render 2 000 blank lines. A 2 000-phrase
>    library needs [36-content-scale-to-600](36-content-scale-to-600.md), not a loader.
>
> So: **no loader, and no exception carved into `e2e/README.md`'s rule** against injecting a state
> shape production does not have. When [10](10-sqlite-persistence-and-outbox.md) lands, seeding the
> database is the right way to add speed, and it is option (b) below rather than a new mechanism.

Deliver `e2e/progression.spec.ts` — the multi-day journeys, all clicked:

| Journey                               | Covers, previously untested end to end                                           |
| ------------------------------------- | -------------------------------------------------------------------------------- |
| Five consecutive days                 | `streak()` accumulation past 2, and the week row filling with real days          |
| Practise, skip a day, practise        | The streak resetting to 1 while the history keeps all three days                 |
| Four lock-in days                     | `lockInDays` → `graduatedAt` → out of rotation. **Graduation had no E2E at all** |
| Four **non-consecutive** lock-in days | That `lockInDays` counts distinct days rather than a run                         |

Two things worth keeping from the original stage:

- **Non-negotiable 3 becomes a test, not a convention.** The missed-day journey asserts the rendered
  page contains none of a list of shaming words. That rule constrains copy on a screen no unit test
  renders, so it had nothing enforcing it.
- **A graduated phrase stays in today's set until the next roll.** Asserting it disappears
  immediately was wrong, and the spec now says why: the set is frozen once per day so a learner can
  always finish what they were shown.

Still out of reach, each tied to the plan that unblocks it: scale
([36](36-content-scale-to-600.md)), a trip mid-flight ([22](22-trip-arc-screens.md)), a due FSRS
queue ([17](17-fsrs-implementation-and-parity.md), [24](24-screen-review-session.md) — `fsrsReview`
is a four-interval stand-in today, so a due-date assertion would assert the stand-in).

### 3 · A production-bundle job — M1, S

A second Playwright project pointed at `expo export --platform web`, served statically, running a
smoke subset only: onboarding → Today → one Refrain phrase → Progress. Not the whole suite; the
point is catching what differs between bundles, not doubling coverage.

**One verified caveat:** the export emits a single `index.html` (SPA output), so a deep link to
`/progress` 404s on a plain static server. Either set `web.output: 'static'` in `app.config.ts` to
emit per-route HTML, or serve with SPA fallback. Decide in this stage rather than discovering it in
CI. Also extend the `bundle` script or add a sibling, since it exports `ios` only today.

This is the job that catches dev-only React invariants, minification breakage, and a missing asset —
and it is a precondition for stage 7's screenshot work, because baselines captured against the dev
bundle would bake in dev rendering.

### 4 · Accessibility, on the rendered tree — M1 → M2, M

Additive to the three static gates in `.github/workflows/ci.yml`; none of them is replaced.

- `@axe-core/playwright` per route and per major state, violations failing the build.
- Keyboard-only traversal of onboarding and the Refrain: every control reachable, focus order
  matching visual order, no trap, and the disabled `Continue` gates still announced.
- Live regions: the specs already assert `role="alert"` **text** (`e2e/add.spec.ts:31`,
  `e2e/stream.spec.ts:15`). Assert they are actually announced regions, which is the part a learner
  using a screen reader depends on.
- A `reducedMotion: 'reduce'` project once [34](34-design-system-completion.md) /
  [47](47-typography-motion-and-haptics.md) implement the motion path — the assertion is that the
  path exists, not that an animation looks right.
- Coordinate with [35-accessibility-wcag-pass](35-accessibility-wcag-pass.md) so the runtime checks
  land there as gates rather than being invented twice.

### 5 · Dynamic Type and long content — M2, S–M

Two projects over the smoke subset at raised text scale (the five steps `testing-strategy.md:165`
asks for, collapsed to the two that break things: ~200% and ~310%), asserting no clipped or
overlapped text on the blueprint's tight rows. The mechanism is the deliverable — the per-screen
assertions belong to each screen's plan.

### 6 · State coverage, not just route coverage — M1, S

Extend `route-coverage.spec.ts` from a route list into a **state manifest**: each route declares its
`functional-spec.md` states and the spec that owns each. It fails when a screen gains a state with
no owner, the same way it already fails when a route gains no owner.

Cheap, and it is the guard that keeps this whole plan honest as the thirteen remaining screens land
— limit #8 above is the one most likely to rot silently.

### 7 · Flake and budget hygiene — M1, S

- Upload the Playwright HTML report **always**, not only on failure, so a retry-pass is visible
  rather than green.
- Fail the job on a documented runtime budget for the fast project. 13.6 s today; a five-minute
  ceiling leaves the order of magnitude of headroom measured above and still catches a runaway.
- Keep `workers: 1` until a spec needs isolation. Revisit at roughly 40 tests, deliberately.
- Record the runtime in the step summary the way the `bundle` job records bytecode size, so the
  trend is visible before it is a problem.

## Acceptance criteria

- `timezoneId` is pinned, and the day-boundary specs pass under at least `UTC`, `Europe/Madrid`, and
  a UTC+14 zone. (The current suite passes under `Pacific/Kiritimati` — verified — because nothing
  asserts a day-dependent string. After stage 1, that is no longer why.)
- All six clock-driven scenarios in stage 1 exist and fail if `page.clock` is removed from the
  fixture.
- Four named fixtures (`seed`, `large`, `empty`, `trip`) plus the deep-state scenarios load into the
  running app, and a CI test proves none of them reaches the production bundle.
- A production-bundle smoke project runs in CI, with the SPA-versus-static decision recorded in
  `app.config.ts` or the config comment.
- axe-core runs against every implemented route and each route's major states, with zero violations
  or an explicit, reasoned waiver in the style `a11yChecks.ts:41-47` already establishes.
- Keyboard-only traversal of onboarding and the Refrain passes.
- The state manifest fails when a screen gains an undeclared state.
- The E2E section of `testing-strategy.md` describes what exists, and `e2e/README.md`'s coverage
  contract gains an axes table beside its route table.
- `CLAUDE.md`'s claim that the browser suite "protects the current web behavior, not missing native
  behavior" is still true and still stated — this plan does not change that boundary, and the plan
  says so.

## Tests

The deliverable is test machinery, so verification is meta-level — the precedent
[37](37-testing-gaps.md)'s Tests section sets:

- **Every new axis has a deliberately broken fixture** proving the assertion fails for the intended
  reason: a clock fixture that does not advance, a timezone left unpinned, a fixture loader left in
  the production bundle, an `aria-label` removed, a state removed from the manifest.
- The production-bundle project is proven by a change that passes in dev and fails in the export (a
  dev-only invariant is the natural candidate).
- The bundle-leak guard is proven by temporarily importing `@loro/core/testing` from a screen.
- Runtime is asserted, not observed: the budget check fails on a spec that sleeps past the ceiling.

## Risks

- **Fake timers versus Reanimated.** `page.clock` replaces timers, and `react-native-reanimated` 4
  drives animation from them. The probe passed on all seven current screens, but the animation-heavy
  screens from [34](34-design-system-completion.md) / [47](47-typography-motion-and-haptics.md) may
  need `clock.runFor()` rather than `setFixedTime()`. Mitigation: the clock stays behind a named
  opt-in fixture, so a screen that cannot tolerate it is one spec's problem, not the suite's.
- **The fixture loader is the one thing here that can violate a rule the repo already got right.**
  `e2e/README.md` deliberately refuses state injection. Mitigation is the leak guard plus feeding
  the shared `@loro/core/testing` fixtures rather than a bespoke shape — and retiring the loader for
  real SQLite seeding when [10](10-sqlite-persistence-and-outbox.md) lands.
- **Scope creep into component tests.** Everything here is browser-level. Per-state RNTL tests stay
  in [37](37-testing-gaps.md) §3; blueprint `renderVals()` fixtures stay in §4.
- **Two suites drifting.** A production-bundle project that shares no code with the dev project will
  diverge. Share `fixtures.ts` and the smoke path; vary only the `webServer`.

## Out of scope

- Everything in [37](37-testing-gaps.md) that is not E2E: `sim.rs`, `merge.rs`, `golden/`, the
  property suites, RNTL component tests, blueprint-fidelity fixtures.
- Native and device flows, including Maestro —
  [09](09-native-toolchain-and-dev-client.md)–[12](12-asr-speech-module.md),
  [31](31-offline-survival-mode.md), and the fifteen-flow list at `testing-strategy.md:196-216`.
- Performance budgets and the <2 s cold-launch bar — [38](38-performance-budget-harness.md).
- Device-farm procurement and CI cost — [16](16-ci-cd-and-release.md).
- Visual-regression baselines against the blueprint — [08](08-built-screens-fidelity-audit.md) and
  [37](37-testing-gaps.md) §4. Stage 3 is their precondition, not their implementation.
- A localized UI axis — [43](43-ui-localization.md).
