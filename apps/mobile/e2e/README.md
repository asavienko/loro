# Mobile web E2E

Playwright protects every behavior currently runnable in the Expo app, along five axes the suite
originally could not express at all. **61 tests in 13 files, about 80 seconds.** State is always
established the way a learner establishes it — no injected Zustand, no storage the production app
does not have.

```bash
nvm use 22
pnpm test:e2e:install   # once per machine
pnpm test:e2e           # the gate
pnpm test:e2e:workbench # the dev-only design-system surface
pnpm test:e2e:bundle    # the same @smoke flows from the production web export
```

The workbench suite is separate on purpose. `/dev/tokens` is developer tooling rather than a
learner-visible state, so it does not belong in `states.ts` and does not inflate learner route,
accessibility, or text-scale coverage. Its suite proves generated-token search, inspection controls,
keyboard use, large-text overflow, and a narrow screenshot baseline. Refresh that baseline only
after reviewing an intended design-system change:

```bash
pnpm test:e2e:workbench:update
```

That screenshot uses one platform-neutral baseline so the same reviewed image is enforced locally
and on CI's Linux runner. Pixel-level font rasterization can still vary across hosts; keep the
subset small and production-font-backed, and review a cross-platform diff instead of widening the
tolerance or snapshotting the full workbench.

The production-bundle suite also deep-links to `/dev/tokens` and requires Expo's unmatched-route
result, then proves the learner surface has no link to it. This is a behavioral availability
contract: the static route import means workbench code can remain among the export's bytes, and the
test deliberately makes no tree-shaking or bundle-content claim.

## What the suite varies

The first row is what a route-by-route suite gives you. The rest are the reason
[plan 51](../../../plans/archive/2026-07-30/51-extended-e2e-strategy.md) exists: each was
structurally inexpressible before, and each found real defects on its first run.

| Axis                       | Owner                                                                    | What it establishes                                                                                    |
| -------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Behavior, per screen       | `onboarding` `today` `add` `phrase-detail` `stream` `refrain` `progress` | Every implemented route, its states, and the mutations between them                                    |
| **The clock**              | `day-boundary.spec.ts`                                                   | Both day keys, the four-hour streak grace either side, DST, rollover at all reachable call sites       |
| **Multi-day time**         | `progression.spec.ts`                                                    | Streaks past two days, a missed day, graduation over four lock-in days — consecutive and not           |
| **The rendered a11y tree** | `accessibility.spec.ts`                                                  | axe over 21 states, `aria-checked`, named progress bars, live regions, 44 px targets, keyboard-only    |
| **Text size**              | `text-scale.spec.ts`                                                     | 200% and 310%, text-only: no clipping, no horizontal scroll, nothing pushed out of reach               |
| **Odd interactions**       | `interactions.spec.ts`                                                   | Toast expiry on its real timings, browser Forward, a double-pressed rep, empty states, cold deep links |
| The contract itself        | `route-coverage.spec.ts`                                                 | Every route has a state, every state cites a spec section, names are unique                            |

## The state manifest

`states.ts` is the list of learner-visible states and how to reach each one by clicking.
`accessibility.spec.ts`, `text-scale.spec.ts` and `route-coverage.spec.ts` all read it, so **a state
described once is audited by all three**.

It replaced a route list because a route is a file, not a unit of behavior: `/add` counted as
covered while its tagging sheet — three radios and a submit — had never been rendered, and a
critical `aria-checked` defect sat inside a screen the contract called green.

**When a screen gains a state, add a row in the same change.** `route-coverage.spec.ts` fails if a
route has no state, and the `spec` field makes a state with no home in `functional-spec.md` visible
as exactly that.

## Shared machinery

| File                              | Why it exists                                                                                                                               |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `fixtures.ts`                     | `onboard()`, plus the gate that fails any test emitting a browser console error or uncaught page error                                      |
| `clock.ts`                        | Instants written in the learner's wall clock; the zone is read back from the browser, and the helper asserts the page agrees                |
| `states.ts`                       | The manifest, `enter()`, and the navigation and assertion helpers                                                                           |
| `config.shared.mjs`               | Browser, timezone, artifact, and runtime-budget defaults shared by learner, production, and workbench suites                                |
| `playwright.config.workbench.mjs` | Starts the development server for the isolated `/dev/tokens` contract; its specs live under `workbench/`                                    |
| `serveExport.ts`                  | Serves the production export. Extensionless paths fall back to `index.html`; anything with an extension 404s, so a missing asset is visible |

Selectors use learner-visible roles, labels and copy, so a refactor may change component structure
freely while preserving behavior. The `mobile web E2E` job is part of CI's required aggregate and
uploads its report **always**, not only on failure — with `retries: 2` a test that passes on the
third attempt is otherwise indistinguishable from one that passed first time.

## Deliberate boundaries

**Native.** This is the cross-platform web gate, not a substitute for device tests. Audio,
microphone, SQLite hydration, force-quit resume and airplane mode do not exist in the app yet; their
Maestro flows are owned by plans 09–12, 15, 31 and 37.

**What react-native-web will not forward.** Its allowlist decides what reaches the DOM, and two of
the app's accessibility props are not on it: `accessibilityLanguage` (so Spanish text carries no
`lang` attribute in a browser, however correct the source) and `accessibilityHint` (all of them). No
green run here is evidence about either — `pnpm --filter @loro/mobile check:lang` covers the first,
which is why it scans source rather than a page.

**Recorded exceptions, never silent ones.** `accessibility.spec.ts` waives exactly one axe rule with
its reason, and records the peak warming band's contrast per state and per rule so that a
_different_ violation there still fails — and so does that one disappearing, which is the reminder
that **Q-14** was answered.

**Time travel, not state injection.** Deep states are reached by moving the clock and clicking,
which exercises the real accumulation path. The one state clicking cannot reach — a 2 000-phrase
library — is blocked by the 31-phrase catalog, so it waits on plan 36 rather than on a fixture
loader.
