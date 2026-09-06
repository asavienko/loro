# The navigation system

- **Requirement IDs:** `P1-02`, `P2-14`, `P4-01`, `P4-06`, `P5-02`, `P5-08`, `F-03`, `N-01`…`N-03`
- **Milestone:** M1 (the contract and the enforcement) / M2 (the surfaces it enables)
- **Size:** M–L
- **Status:** not started
- **Spec:** [`mobile-app.md#navigation`](../../../docs/architecture/mobile-app.md#navigation),
  [`functional-spec.md#global-behaviours`](../../../docs/product/functional-spec.md),
  [`widgets-notifications.md#deep-links`](../../../docs/architecture/widgets-notifications.md),
  [`screen-catalog.md`](../../../docs/design/screen-catalog.md)
- **Open questions:** Q-06 (loop a setting or an assignment — decides the resolved home), Q-17
  (proposed, below)

## What this is

Eight routes exist and each was wired by the screen that needed it. Nothing owns the question "where
can a learner go from here, and how do they get back", and the answer has to hold for **21 screens,
7 practice surfaces, 4 external entry points, and 5 settings sub-pages** — most of which are not
built yet. Navigation is the one system that every remaining screen plan touches, so it is cheaper
to decide once, now, than to have thirteen screen plans each invent a header and an exit.

This plan defines the route map, the surface classes, the laws, a pure decision module, and the lint
and drift checks that keep it true. It does **not** build the thirteen missing screens — it gives
each of their plans a contract to build against.

## Current state, verified against the worktree on 2026-07-29

**What works.** A single `Stack` in `app/_layout.tsx:16` with seven declared screens;
`scheme: 'loro'` and `experiments.typedRoutes: true` in `app.config.ts`; `expo-router` 6.0.24, which
has `Stack.Protected` (`guard: boolean`) and layout-level `unstable_settings`. The route-level flow
is reachable end to end and `expo-linking` is already a dependency. A Playwright web suite
(`apps/mobile/e2e/`) covers every implemented route and already discovers the route files from disk
(`e2e/route-coverage.spec.ts:19`) — so half the drift check this plan needs is built, against a
hand-maintained list.

**What is wrong.** Every row below was read in the code, not inferred.

| #   | Defect                                                                                                                                                                                                                                                                                                     | Where                                                                |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1   | **`unstable_settings` is dead code.** `export const unstable_settings = { initialRouteName: 'index' }` sits in a screen file; expo-router reads it only from **layout** routes (`getRoutesCore.js:621`). `_layout.tsx` declares no anchor, so a cold-start deep link to `/phrase/x` has **no back target** | `app/add.tsx:499`                                                    |
| 2   | **The conditional home does not exist.** `index.tsx` _is_ Today. The documented resolution (trip countdown, survival, unseen souvenir, per-engine home) has nowhere to live, and `P5-02`/`P5-08` require the home to be replaced                                                                           | `app/index.tsx:30`, `mobile-app.md#navigation`                       |
| 3   | **Chrome is doubled.** The native header supplies `title: 'The Refrain'`, `'Stream'`, `'Progress'`, `'Add phrases'` — but the blueprint draws all four headers **in-canvas** and the Stream has no header at all. Two headers, or a native one contradicting the design                                    | `app/_layout.tsx:27–31` vs `Loro.dc.html:1410`, `600`, `1790`, `228` |
| 4   | **Onboarding's six steps are `useState`.** Android hardware back exits the flow instead of stepping back, breaking `P1-02` ("Back never loses answers"). `mobile-app.md` documents `onboarding/[step].tsx`                                                                                                 | `app/onboarding.tsx:89`                                              |
| 5   | **Add holds eight pieces of navigational state locally** — `mode`, `query`, `scenario`, `browseTheme`, `anchorTheme`, `sheet`. So `loro://add?mode=import` is unaddressable, and hardware back from a browse-theme sub-view leaves the screen rather than the sub-view                                     | `app/add.tsx:59–67`, `240`                                           |
| 6   | **The tagging sheet is local state, not a route modal** — `mobile-app.md` says it is a route-level modal "so it gets back-gesture handling and a URL"                                                                                                                                                      | `app/add.tsx:65`                                                     |
| 7   | **No back handling anywhere.** No `BackHandler`, no `usePreventRemove`. A session screen can be backed out of mid-rep with no confirmation and no save                                                                                                                                                     | grep: zero hits in `app/`, `src/`                                    |
| 8   | **Route strings are literals at 11 call sites**, so typed routes catch a typo only where the literal happens to be checked, and no destination has one name                                                                                                                                                | `router.push('/practice/refrain')` ×3, `'/add'` ×3, …                |
| 9   | **A documented deep link has no route.** `loro://settings/speech` is in the notification table; the documented settings routes are `index`, `practice`, `privacy` only. Universal links (`https://loro.app/…`) are documented but `app.config.ts` declares no `associatedDomains` or `intentFilters`       | `widgets-notifications.md:165` vs `mobile-app.md:74–77`              |
| 10  | **Two names for one concept.** `?playlist=trip` (mobile-app.md) and "a drill of exactly those phrases" (`P4-06`) are the same idea — a practice session over a named subset — with no shared parameter                                                                                                     | `mobile-app.md:190`, `prd.md:313`                                    |
| 11  | **`/` is both a surface and a destination.** `refrain.tsx:283` does `router.replace('/')` to mean "go home", which silently means "go to Today" and will be wrong the day a trip exists                                                                                                                    | `app/practice/refrain.tsx:283`, `app/onboarding.tsx:121`             |

**One divergence to resolve, not a defect.** `functional-spec.md:817` states as a global behaviour
that _every_ list row showing a phrase opens Phrase detail, "no exceptions". The blueprint's Today
rows **speak** the phrase instead (`onTap:() => this.say(p.es)`, `Loro.dc.html:3323`), and
`index.tsx:126` currently pushes to detail. The blueprint wins (`CLAUDE.md`), so law **N2** below
carries the exception and the doc gets fixed.

## What the blueprint does and does not say

**It has no global navigation chrome.** All 21 screens are standalone `.device` blocks; there is no
tab bar, drawer, or persistent rail anywhere in 3,629 lines. The one place it shows global
destinations is the countdown home's in-canvas "three shortcuts — 🗺️ Trip plan · 🎧 Stream · 🔁
Review" (`functional-spec.md` §17).

**So the blueprint's answer to global navigation is: the home surface is the hub.** That is a real
answer, and three other things confirm it: the trip _replaces_ the home (`P5-02`) and survival
_flips_ it (`P5-08`), which a fixed tab bar would contradict; nine of the 21 screens are full-bleed
(the warming card, the dark stream card, the labs), and a tab bar hidden on nine screens is not a
tab bar; and every home surface has exactly one primary CTA, which is the ritual.

**Decision: no tab bar in v1.** Recorded here rather than rediscovered per screen. What replaces it:

- The **resolved home is the hub**, with a **hub rail** of at most four secondary destinations — the
  ad-hoc `Stream · Progress · Add` row at `index.tsx:225–253`, formalised, with `More` as the
  fourth.
- **`/more` is a rendered view of the route table**, not a hand-kept list. Every route declaring
  `hub: true` appears there automatically, grouped. This is what keeps law N3 true as thirteen
  screens land, and it is the extension point: a new screen becomes reachable by adding a row.

## The model: five surface classes

Derived from the four header shapes the blueprint actually draws, plus the sheet.

| Class       | Blueprint evidence                                   | Chrome                                     | Exit                                   | Gesture | Members                                                                                |
| ----------- | ---------------------------------------------------- | ------------------------------------------ | -------------------------------------- | ------- | -------------------------------------------------------------------------------------- |
| **Root**    | Today `1319–1322`; countdown `functional-spec` §17   | Date/greeting + title + streak pill        | None — no back                         | n/a     | Today, Countdown, Survival                                                             |
| **Push**    | Phrase detail `440–443`                              | `‹` + context label + ≤1 action            | Back (pop)                             | on      | Add, Phrase detail, Progress, Phrasebook, Trip plan, Settings ×5, More                 |
| **Session** | Speak `691–694`; Refrain `1410–1418`                 | `✕` + progress + wave/deck label, no title | Dismiss; `replace(home())` on complete | **off** | Refrain, Stream, Speak, Review, Roleplay, Curve, Pronunciation, Prosody, Run, Souvenir |
| **Flow**    | Onboarding `134–141`; drop `1964`                    | `‹` from step 1 + step dots                | Back steps; exit confirms              | on      | Onboarding, Trip new, Daily drop, Import, Capture                                      |
| **Sheet**   | Tagging sheet `functional-spec` §"The tagging sheet" | Handle + 42% scrim                         | Scrim tap or swipe down                | on      | Tagging sheet, Paywall                                                                 |

Souvenir is Session-class: full-screen, entered by redirect, no back, and its exit commits
`souvenirSeen` then `replace(home())`. The Refrain's completion state and the Run's wrap are
in-screen states of a session, not routes.

The widget, notifications, and the Live Activity are **not** routes. They are deep-link _sources_,
and each must land on a class-appropriate route (law N9).

## The route map

Every surface, including the thirteen not yet built. Paths keep `practice/` for all practice
surfaces as `mobile-app.md` already documents, so the existing deep links stay valid — "the labs" is
product language, not a route group.

| #   | Screen                                       | Route                                               | Class   | Hub | Plan |
| --- | -------------------------------------------- | --------------------------------------------------- | ------- | --- | ---- |
| —   | dispatcher                                   | `/`                                                 | —       | —   | 46   |
| 1   | Onboarding                                   | `/onboarding/[step]`                                | Flow    |     | 08   |
| 2   | Add phrases                                  | `/add?mode=discover\|browse\|import&theme=&q=`      | Push    | ✅  | 23   |
| —   | tagging sheet                                | `/add/tag/[catalogId]`                              | Sheet   |     | 23   |
| —   | Capture                                      | `/add/capture`                                      | Flow    |     | 23   |
| 3   | Phrase detail                                | `/phrase/[id]`                                      | Push    |     | 08   |
| 4   | Adaptive stream                              | `/practice/stream?source=`                          | Session | ✅  | 08   |
| 5   | Speak to progress                            | `/practice/speak?source=`                           | Session |     | 21   |
| 6   | Review session                               | `/practice/review?source=`                          | Session |     | 24   |
| 7   | Roleplay                                     | `/practice/roleplay?scene=`                         | Session |     | 26   |
| 8   | Memory model                                 | `/practice/curve?phrase=`                           | Session |     | 25   |
| 9   | Pronunciation lab                            | `/practice/pronunciation?source=`                   | Session |     | 27   |
| 10  | Prosody lab                                  | `/practice/prosody?source=`                         | Session |     | 27   |
| 11  | **Today**                                    | `/today`                                            | Root    |     | 20   |
| 12  | The Refrain                                  | `/practice/refrain?wave=&source=`                   | Session |     | 20   |
| 13  | The Run                                      | `/practice/run`                                     | Session |     | 28   |
| 14  | Phrasebook                                   | `/phrasebook`                                       | Push    | ✅  | 28   |
| 15  | Progress                                     | `/progress?range=week\|all`                         | Push    | ✅  | 08   |
| 16  | Set the arrival                              | `/trip/new`                                         | Flow    |     | 22   |
| 17  | **Countdown home**                           | `/trip`                                             | Root    |     | 22   |
| 18  | Daily drop                                   | `/trip/drop/[day]`                                  | Flow    |     | 22   |
| 19  | Lock screen widget                           | _not a route_ — deep-link source                    | —       |     | 30   |
| 20  | **Survival mode**                            | `/trip/survival`                                    | Root    |     | 22   |
| 21  | Souvenir                                     | `/trip/souvenir`                                    | Session |     | 22   |
| —   | More                                         | `/more`                                             | Push    | ✅  | 46   |
| —   | Settings                                     | `/settings`                                         | Push    |     | 29   |
| —   | …practice · privacy · speech · notifications | `/settings/{practice,privacy,speech,notifications}` | Push    |     | 29   |
| —   | Paywall                                      | `/paywall`                                          | Sheet   |     | 40   |
| —   | Auth callback                                | `/auth/callback?token=` _(reserved)_                | —       |     | 14   |

**`/` redirects and never renders.** Today moves to `app/today.tsx`; `app/index.tsx` becomes a
dispatcher whose whole body is `<Redirect href={resolveHome(input)} />`. Every home surface is then
separately addressable — the widget can link `loro://today` — no route both renders and redirects,
and `replace(home())` re-resolves correctly on the day a trip starts mid-session (defect 11).

## The twelve laws

Written so each can be checked. `N3`, `N6`, `N9`, `N10` are machine-checked; the rest are reviewed
or tested.

1. **One root stack, and the home is resolved, never named.** No screen links to `/today` or `/trip`
   assuming which home is current; it links to `home()`.
2. **Every phrase row anywhere opens Phrase detail** — except Today, where the blueprint's tap
   speaks (`3323`). Where the primary tap is not detail, detail stays reachable from the row (a
   chevron plus an accessibility action), so the app remains one object graph
   (`functional-spec.md:817`).
3. **Every route is reachable by tapping — no route exists only as a deep link — and every _surface_
   within 2 taps of the resolved home.** A surface's own sub-pages are reached from it, not from
   home: Settings' five are 3 taps (home → More → Settings → page) and that is correct, because the
   thing a learner looks for is Settings. So the check is two-part: reachability for every route,
   plus a declared `depth` per route that the test asserts — which turns "is this discoverable?"
   into a number someone has to justify when they add a screen.
4. **A session is dismissed, not popped.** `✕` confirms if reps would be lost; completion does
   `replace(home())` so a finished session is not in the back stack.
5. **An in-screen sub-view is a route.** If a surface draws a back chip, hardware back and the iOS
   swipe must do what the chip does (defect 5).
6. **What changes a screen and is worth returning to lives in the URL** — mode, theme, query, range,
   wave, source. Scroll, focus, and animation values do not.
7. **No route awaits the network.** A route renders its offline state; it never shows a spinner that
   becomes an error (`F-03`).
8. **Audio survives navigation.** No unmount stops playback; the audio module owns transport.
9. **Every deep link lands on its surface, never the home screen.** An unresolvable link lands on
   the nearest honest surface _and says why_ — never a crash, never a silent bounce home.
10. **A navigation decision is a pure function.** Route files branch on no learner state; they read
    a resolver.
11. **No screen shames a missed day** — extended to navigation: no catch-up interstitial, no backlog
    gate, no forced route after an absence (rule 10).
12. **Back never loses an answer** (`P1-02`).

## Architecture: navigation decisions are pure

```
apps/mobile/src/navigation/
├── routes.ts        # the route table: id, path, class, params, hub, depth, loggable — DATA
├── href.ts          # typed builders: home(), phrase(id), practice(engine, source)
├── resolveHome.ts   # (HomeInput) => RouteRef
├── exit.ts          # (SessionExitInput) => RouteRef | 'confirm'
├── source.ts        # PracticeSource + parse/serialize
├── deepLinks.ts     # (url) => RouteRef | Unresolvable
├── graph.ts         # entry edges, for the reachability test
└── *.test.ts
```

**The module imports no React, no `react-native`, and no `expo-router` value** — type-only imports
of `Href` are allowed, and `consistent-type-imports` is already enforced. This is not purism: the
mobile vitest config is `include: ['src/**/*.test.ts'], environment: 'node'`, so a pure module is
fully tested **today, with zero new dependencies**, while a route-render test needs
`@testing-library/react-native` (not installed) and a jsdom environment. It also mirrors the split
that already works here — engines decide, screens render.

`src/navigation/` may import `src/lib/` and types from `@loro/core`, and nothing else. `src/ui/` and
`src/engines/` may not import it: a design-system component that knows a route is a feature
component, and an engine that navigates is not headless.

**The resolver**, ordered per `mobile-app.md#navigation` and `functional-spec` §16/17/20:

```ts
interface HomeInput {
  onboarded: boolean
  onboardingStep: number // resume mid-flow (law 12)
  trip: { state: 'countdown' | 'abroad' | 'returned'; souvenirSeen: boolean } | null
  engine: EngineId // Q-06 decides how this is set, not what it does here
}
// !onboarded → /onboarding/[step] · returned && !souvenirSeen → /trip/souvenir
// abroad → /trip/survival · countdown → /trip · else the engine's home
export function resolveHome(i: HomeInput): RouteRef
```

`HomeInput` is the resolver's own type, and a thin adapter maps the store onto it. The store has no
trip state yet (`src/store/state.ts:24`), so the adapter passes `trip: null` and widens when plan 22
lands — the resolver and its table test are written once, complete, now.

**One name for a practice subset**, closing defect 10 and implementing `P4-06`:

```ts
type PracticeSource =
  | { kind: 'today' } // the frozen Refrain set — the default
  | { kind: 'phrase'; id: UserPhraseId } // from detail
  | { kind: 'tag'; tag: Tag } // P4-06 — the tricky drill
  | { kind: 'theme'; theme: Theme }
  | { kind: 'due' } // SRS
  | { kind: 'drop'; day: number } // trip drop
  | { kind: 'survival' }
```

Serialised as `?source=today`, `?source=tag:pronunciation`, `?source=drop:9`, with one parser, one
serialiser, and a round-trip property test. `mobile-app.md`'s `?playlist=trip` becomes
`?source=drop:<day>`; since no deep link is implemented yet, unifying now costs a doc edit.

## Chrome: four in-canvas headers, no native one

`headerShown: false` app-wide, and a `ScreenHeader` component in `src/ui/` with one variant per
surface class. This is the fix for defect 3 and it is what the blueprint draws: the Add screen's
header carries a subtitle a native header cannot show (`228–231`), and the Stream has no header at
all (`600`). `component-inventory.md` lists no header component today — `ScreenHeader` gets a row,
with the 44×44 hit area the blueprint already sets for `‹` (`Loro.dc.html:45–46`).

Per-class `screenOptions` (`animation`, `gestureEnabled`, `presentation`) are read from the route
table, not written per screen, so a class change cannot be applied inconsistently. Session gets
`gestureEnabled: false` (a swipe must not abandon a wave), Sheet gets `presentation: 'modal'`, and
transitions come from [`motion.md`](../../../docs/design/motion.md).

## Guards, deep links, and the outside world

**Guards.** `Stack.Protected guard={onboarded}` wraps every non-onboarding route, so a deep link
cannot land on `/practice/refrain` before onboarding — a redirect check per screen would be eleven
chances to forget. `unstable_settings = { anchor: 'index' }` goes in **`_layout.tsx`** so a
cold-start deep link has a back target (defect 1).

**The link inventory**, consolidated from `mobile-app.md` and `widgets-notifications.md` — one
table, one parser, both directions tested:

| Link                                       | Source                   | Lands on                    |
| ------------------------------------------ | ------------------------ | --------------------------- |
| `loro://practice/refrain`                  | Daily reminder `N-01`    | the active engine's session |
| `loro://practice/refrain?wave=midday`      | Wave nudge `N-02`        | that wave                   |
| `loro://phrase/<id>?play=1`                | Widget                   | detail, playing             |
| `loro://practice/stream?source=drop:<day>` | Countdown home           | the drop, in the stream     |
| `loro://trip`                              | Widget, milestone        | countdown home              |
| `loro://trip/drop/<day>`                   | Drop notification `N-03` | that drop                   |
| `loro://trip/survival`                     | Arrival                  | survival                    |
| `loro://trip/souvenir`                     | Return                   | souvenir                    |
| `loro://settings/speech`                   | Language pack            | speech settings (defect 9)  |
| `loro://today`                             | Widget streak tap        | Today                       |
| `loro://auth/callback?token=`              | Magic link (plan 14)     | reserved, not built here    |

**Universal links** need `ios.associatedDomains` and `android.intentFilters` in `app.config.ts`,
plus `apple-app-site-association` and `assetlinks.json` served by the API. `https://loro.app/…` is
documented and undeclared today; this plan declares the config and names the hosting as plan 16's.

**Errors and cost.** Route-level `ErrorBoundary` per class via the layout — "a crashed Prosody
screen must not take down the stream playing behind it" (`mobile-app.md#errors`). The Skia lab
routes are lazily imported so a v1 learner who never opens them does not pay for them
(`mobile-app.md#performance-practices`).

**Accessibility.** Focus moves to the new screen's header on navigation and the screen name is
announced; `‹` and `✕` carry distinct labels ("Back" vs "Close practice") because they mean
different things; the hub rail is one focusable row of buttons, not a nested tree; Reduce Motion
turns transitions into cross-fades
([`accessibility.md#motion`](../../../docs/architecture/accessibility.md)).

## Instrumentation, and the collision it exposes

[`observability.md`](../../../docs/architecture/observability.md) already requires navigation
breadcrumbs ("Navigation, engine transitions, audio-session events…"), per-screen frame drops, and
per-screen memory. Instrumenting that **once in the shell** — a route listener that reads the route
table for a stable screen id — is strictly better than thirteen screens each remembering to emit an
event, and it is the only way the per-screen performance budgets get a name that survives a route
rename.

**But law 6 and the privacy rules collide, and it is worth naming before either is implemented.**
Observability's rule 2 is "no free text. Not in logs, not in events, not in breadcrumbs, not in
crash reports" — and law 6 deliberately puts `?q=<what the learner typed>` in the URL, with
`/phrase/<id>` and `?source=tag:…` alongside it. A breadcrumb that records the URL verbatim
therefore exfiltrates learner-typed text into a crash report.

The resolution, which belongs in the route table rather than in the analytics layer: **each route
declares which params are loggable.** The breadcrumb records the route id plus the allowlisted
params, never the raw URL — the same allowlist-not-denylist shape observability.md already argues
for, applied one layer earlier. `q` is never loggable; `mode`, `range`, and `wave` always are; `id`
and `source` are logged as presence, not value. Plan 32 owns the pipeline; this plan owns the
declaration, because the route table is the only place that knows what a param means.

## Enforcement

Rules this repo would otherwise rely on reviewer memory for, in the idiom it already uses
(`eslint.config.mjs`):

1. **No hand-written route strings.** `no-restricted-syntax` on
   `CallExpression[callee.object.name="router"] > :matches(Literal, TemplateLiteral)` and
   `JSXAttribute[name.name="href"] > :matches(Literal, JSXExpressionContainer > TemplateLiteral)` —
   use an `href.ts` builder. Same shape as the colour-literal and `new Date()` rules. **Both halves
   are needed:** the 11 literal sites are one form, and ``router.push(`/phrase/${p.id}`)``
   (`index.tsx:126`) is a `TemplateLiteral` that a `Literal`-only selector misses — which is exactly
   the interpolated, most-typo-prone case.
2. **`src/navigation/**` may not import** `react`, `react-native`, `**/features/**`, `**/ui/**`,
   `**/engines/**`, `**/domain/**`, `**/data/**`, `**/platform/**`, or `expo-router` as a value
   (`allowTypeImports: true`).
3. **`src/ui/**` and `src/engines/**` may not import `**/navigation/**`** — added to the existing
   boundary groups.
4. **`check:routes`** — a script beside `scripts/a11yChecks.ts`, wired into `turbo.json` and the
   root `check`: every file under `app/` has a row in `routes.ts` and vice versa; every route
   declares a class, a `depth`, and its loggable params; every deep link in the table resolves to a
   declared route; every route is reachable and at its declared depth (law 3). Route drift then
   fails the build the way token drift does, in `pnpm check` rather than only in the E2E job — and
   `e2e/route-coverage.spec.ts` reuses the same table instead of its own array, so there is one list
   of routes in the repo, not three.

## Tests

**Unit — the pure module, in the existing harness.** `src/**/*.test.ts` under `environment: 'node'`,
no new dependency:

- `resolveHome` **table test**: onboarded × trip state × souvenir seen × engine, every cell.
- `PracticeSource` round-trip, plus rejection of malformed `?source=`.
- Deep links: every row of the table parses to its route; unknown paths and bad params yield
  `Unresolvable`, never a throw (law 9).
- `exit.ts`: mid-session exit confirms, completed session replaces, and a session entered from
  detail does not strand the stack (defect: `phrase/[id]:351` → `refrain:283`).

**Playwright — the web E2E suite that now exists** (`apps/mobile/e2e/`, `pnpm test:e2e`). It already
discovers every route file and asserts each has an owner (`e2e/route-coverage.spec.ts:15`) against a
**hand-maintained `coveredRoutes` array** — that array should read `routes.ts` instead, which makes
the route table the one list and deletes a second place to forget a screen. What the browser can
then prove directly:

- **Law 6** — mode, theme, query, and range survive a reload and a browser Back, which is exactly
  the state Add currently holds locally (defects 5, 6).
- **Law 9** — every link in the table, entered as a URL, lands on its surface; a bad one explains
  itself.
- **Law 1** — `/` redirects, and it redirects somewhere different once trip state is set.
- **Law 3** — reachability by clicking, not just by graph.

**Not the browser's job.** Android hardware back, the iOS swipe, and `presentation: 'modal'` are
device behaviours (defects 4, 7). They belong to the Maestro flows in
[`testing-strategy.md`](../../../docs/process/testing-strategy.md) — which do not exist yet — so
this plan adds them to that plan's list rather than pretending web coverage settles them, and law 5
stays a review item until plan 09 makes a device build possible.

## Commit sequence

Each commit leaves `pnpm check` green on its own, per `CLAUDE.md`.

1. `src/navigation/` — table, builders, resolver, source, deep links, graph, and their tests. No
   route touched; nothing imports it yet.
2. Lint boundaries and `check:routes`, with the current routes registered.
3. `ScreenHeader` in `src/ui/` + `component-inventory.md` row.
4. The shell: `_layout.tsx` per-class options and anchor, `headerShown: false`, `index.tsx` becomes
   the dispatcher, Today moves to `today.tsx`, and the 11 literal call sites become builders. **This
   commit renames a route, so it must also update the E2E suite** — `coveredRoutes`
   (`e2e/route-coverage.spec.ts:5`) and every spec that navigates to `/` expecting Today. Note that
   `pnpm check` does **not** run `test:e2e`, so run it by hand here or the breakage surfaces in CI.
5. `/more`, rendered from the route table, and the hub rail on Today.
6. `onboarding/[step]` and Add's URL state (defects 4, 5, 6) — the two screens whose local state the
   laws contradict.
7. Docs: `mobile-app.md#navigation` rewritten against the table; the settings routes and `?source=`
   corrected; `functional-spec.md:817` gains the Today exception; `screen-catalog.md`'s divergence
   table records the tab-bar decision.

## Acceptance criteria

- `resolveHome` is the only place that decides which home renders, and `/` renders nothing else.
- Every one of the 21 screens plus settings, more, and paywall has a row in `routes.ts` with a
  class, and `check:routes` fails if a file and the table disagree.
- Every deep link in the consolidated table lands on its surface from a cold start, with a working
  back target; an unknown link explains itself.
- No hand-written route string remains in `app/` or `src/`, literal or interpolated, enforced by
  lint.
- Browser Back and a reload preserve every URL-borne state (mode, theme, query, range, wave,
  source), proven in the Playwright suite. **Hardware back and the iOS swipe are reviewed, not
  proven** — they need a device build (plan 09) and the Maestro flow this plan adds to plan 37's
  list. Saying so is the point: a green `pnpm check` does not mean law 5 holds.
- Every route is reachable by tapping and matches its declared `depth`, proven by test; a new screen
  becomes reachable by adding a table row, and an undeclared depth fails the check.
- `headerShown: false` everywhere; all four headers come from `ScreenHeader`.
- Navigating during playback does not interrupt audio — untestable until plan 11, so it ships as a
  review item with the audio module, not as a claim made here.
- `pnpm check` runs `check:routes`, and the route table is the only list of routes in the repo.
- Every route declares its loggable params, and no breadcrumb or crash report contains a raw URL —
  so `?q=` can never reach an event. Checked by `check:routes`; the pipeline that consumes it is
  plan 32's.

## Out of scope

The thirteen unbuilt screens' contents — each stays with its own plan; this plan gives them a route,
a class, and a header. Also out: the practice-engine resolution itself (plan 29, Q-06), the widget
and notification implementations that _send_ the deep links (plan 30), universal-link hosting (plan
16), auth's magic-link handler beyond reserving the route (plan 14), and route-render tests with
`@testing-library/react-native` — a dependency and a jsdom environment, deliberately deferred to
plan 37 rather than smuggled in here.

## Open questions this raises

- **Q-17 (proposed, not yet filed)** — _what are the four hub-rail destinations?_ Owner: design.
  Blocks nothing (the rail renders from the table), but the choice changes as screens land, and it
  is the one navigational judgement the blueprint does not make. Verified 2026-07-29: the blueprint
  draws a three-tile rail on exactly **one** surface — `Trip plan · Stream · Review` on the
  countdown home (`Loro.dc.html:1950`) — and **none on Today**, whose only bottom control is the
  wave CTA (`1384–1386`). The `Stream · Progress · Add` row now on Today (`app/index.tsx:225–253`)
  is the app's own invention, and the space it occupies is where the blueprint puts the ambient loop
  and the fading tail ([20-screen-today-ritual](20-screen-today-ritual.md)). So the rail is per-home
  by precedent, not per-app. Recommendation to review: keep them per-home, declared in the table —
  and sequence Today's rail change with 20, or the screen ends up with a hole where the buttons
  were.
- **Q-06** already blocks the last row of `resolveHome` — whether the engine home comes from an
  assignment or a setting. The mechanism is neutral to the answer; only the adapter changes.
