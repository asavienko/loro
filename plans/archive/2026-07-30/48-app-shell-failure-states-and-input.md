# Failure states, text input, and the colour-literal hole

- **Requirement IDs:** `P2-03`, `P2-07`, `P2-09`, `P2-14`, `F-05`
- **Milestone:** M1
- **Spec:** `docs/product/functional-spec.md` §2 and `#global-behaviours`,
  `docs/design/copy-and-tone.md`, `docs/architecture/offline.md`
- **Size:** S–M

## What this is

Three things that belong to no screen and therefore to no plan: what a learner sees when something
fails or has not resolved yet, how text input behaves, and the hole in the colour-literal lint rule.
Each is small; together they are part of the difference between seven screens and an app.

**Navigation is not here.** [46-navigation-system](46-navigation-system.md) owns the route map, the
surface classes, back handling, deep links, the doubled chrome, and the hub rail — including the
`unstable_settings` dead code at `app/add.tsx:499` and the eight pieces of navigational state Add
holds locally. Where this plan touches a route it defers to 46's laws.

Also not here: components ([34](34-design-system-completion.md)), screen-reader and dynamic-type
work ([35](35-accessibility-wcag-pass.md)), tokens, fonts, and haptics
([47](47-typography-motion-and-haptics.md)).

---

## 1 · A screen that fails shows nothing at all

`app/practice/refrain.tsx:100–112`:

```tsx
void refrainEngine.plan(engineContext()).then((plan) => { … })
```

No `.catch`. While the promise is pending, `session` is `null` → `item` is `undefined` → `phrase` is
`undefined` → `:292` returns `null`. The screen renders **nothing** — not an empty state, not the
`Screen` background: a blank window. Today that lasts one frame because the engine is synchronous
underneath; the moment `plan()` touches SQLite ([10](10-sqlite-persistence-and-outbox.md)) or the
UniFFI bridge ([09](09-native-toolchain-and-dev-client.md)) it becomes visible, and if it ever
rejects the learner sits on a blank screen with no message and no retry, in the app's hero flow.

Nothing else is better placed. There is **no `ErrorBoundary` anywhere in the app**, so an exception
in any screen is a white screen with no route back. `component-inventory.md` convention 8 asks for
stories covering "empty, loading, error, and long-content" states, and the inventory lists no error
component. `copy-and-tone.md` covers inline failure copy well (_"Didn't catch it — try that word
again"_) and has nothing for a screen-level failure.

**What is deliberately not a gap.** `offline.md:73` forbids an offline banner ("A banner implies
degradation, and there isn't any") and `:137` rejects a sync-failure badge or queue screen. Local
writes always succeed, so there is nothing to report; 46's law 7 says the same from the route side.
The single exception is survival mode's informational `✈ OFFLINE` chip (`Loro.dc.html:2017`), owned
by [31-offline-survival-mode](31-offline-survival-mode.md). **Do not add a sync indicator.**

**The work:**

- An `ErrorBoundary` exported from `app/_layout.tsx` (expo-router renders a route's `ErrorBoundary`
  export), plus one per practice surface so a failure mid-session does not take the shell down. Its
  exit uses 46's `home()` resolver, not `'/'`.
- Copy for it, written into `copy-and-tone.md` beside the existing failure patterns — same rule:
  describe what happened, offer the next action, never "error", "failed", or "invalid", never
  attribute fault. _"That didn't load — back to today"_ is the register, not _"Something went wrong
  :("_.
- Every engine call gets a rejection path that renders a state. `void promise.then()` with no
  `.catch` is the pattern to grep for; there will be more as async work lands.
- A pending plan and a resolved-but-empty plan are **different states and both render**.
  `copy-and-tone.md` forbids _"Loading…"_ and `motion.md` forbids skeletons — correct for local data
  — so the pending state is the screen with its content area quiet, not a spinner and a label. What
  it must never be is nothing.

## 2 · Text input is unfinished, and the keyboard is unhandled

`app/add.tsx:179` is the app's only `TextInput`.

- **No clear ✕.** `functional-spec.md` §2 requires "clear ✕ when non-empty". Clearing a query means
  eight backspaces.
- **No `KeyboardAvoidingView` anywhere in the repo.** It costs nothing today because no input sits
  low on a screen — and Import (`P2-09`, [23](23-add-import-and-capture.md)) puts a paste area and
  its commit button inside the bottom sheet, where the keyboard will cover both. Solve it at the
  shell level now rather than inside the sheet later.
- No `returnKeyType` / `onSubmitEditing`, and no `autoCorrect` / `autoCapitalize` tuning. A learner
  typing Spanish fights English autocorrect, which matters most for `P2-07` ("add your own"), where
  the typed text **becomes content** and a silent autocorrection is a corrupted phrase.
- No debounce: every keystroke re-filters the catalog and re-renders the list.
- `keyboardShouldPersistTaps` is set on the onboarding scroll view (`onboarding.tsx:161`) and on
  neither of Add's two, so a tap on a suggestion while the keyboard is up can be swallowed.

**The work:** a `TextField` primitive with the clear button, focus border, and input configuration —
already `component-inventory.md`'s `TextField` (P1), unbuilt. This plan owns keyboard avoidance and
dismissal at the shell level; [34](34-design-system-completion.md) owns the component. Build them
together, and note that once Add's `query` moves into the URL (46, defect 5) the field becomes a
controlled input over a route param, so land that order deliberately.

### 2a · Every list is unvirtualised

`ScrollView` + `.map` throughout: Add's browse and suggestion lists (`add.tsx:233`, `:299`), the
stream's up-next (`stream.tsx:288`), Today's set (`index.tsx:119`). Correct at 31 phrases, wrong at
the 600 the catalog is heading for ([36-content-scale-to-600](36-content-scale-to-600.md)) — Browse
renders every row of every theme. Move the two lists that scale with the catalog to `FlatList` with
stable `keyExtractor`s and leave the bounded ones (today's five) alone. Do it before the catalog
grows, not after.

## 3 · The colour-literal rule has a hole exactly where the tint tokens are

`eslint.config.mjs` blocks colour literals with a selector matching **hex only**:

```js
selector: 'Literal[value=/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]'
```

`rgba(...)` passes. So the selected-state tint is hardcoded in five screens — `index.tsx:179`,
`add.tsx:474`, `phrase/[id].tsx:207`, `onboarding.tsx:221`, `stream.tsx:207` — and the sheet scrim
in a sixth (`add.tsx:359`). All six are `rgba(191,87,34,0.07)` or `rgba(26,24,21,0.42)`.

`accent.tint` (`rgba(191,87,34,.07)`), `accent.tint2`, and `accent.border` **already exist as
tokens** (`design-system.md#accents--four-themes-three-variants-each`). So this is not a missing
token, it is six bypasses of the accent system: under `F-05` all four accents will change and these
six selected states will stay coral. Every one of them is a _selection_ state — the most
semantically loaded thing in the palette to hardcode.

`CLAUDE.md` states why the rule exists — "the token names carry the accessibility rule, so a literal
is not just a style inconsistency, it is the one way to bypass every check above" — and the rule as
written does not enforce it.

**The work:** extend the selector to `rgb()`, `rgba()`, `hsl()`, and named CSS colours; replace all
six literals with the existing tokens; confirm `accent.tint` reaches the generated output (it is in
`accent.json`) and add it if not. [34](34-design-system-completion.md) §6 lists the same lint item —
land it once, here, since it blocks nothing else and 34 is much larger.

### 3a · One duplicate, noted so it is not lost

`stream.tsx:337` defines a second, incompatible `Pill` beside `primitives.tsx:174`. Belongs to 34's
refactor.

---

## Acceptance criteria

- No route can render blank: every screen has a rendered state for pending, empty, and failed, and
  an `ErrorBoundary` above it whose copy passes the `copy-and-tone.md` rules and whose exit uses
  46's `home()`.
- No async engine call in `app/**` lacks a rejection path that renders something.
- Search has a clear button, Spanish-appropriate input configuration, and a debounce; no input can
  be hidden by the keyboard on any screen or sheet.
- Lists that scale with the catalog are virtualised; a 600-phrase catalog scrolls Browse at 60 fps
  on the device floor ([38](38-performance-budget-harness.md)).
- The colour-literal lint rule catches `rgba()`; zero colour literals remain in `apps/mobile`.
- No offline or sync status UI was added.
- `pnpm check` green.

## Tests

- A screen test per route rendering the failure state with a thrown engine error, and the pending
  state with a never-resolving promise. The Refrain's blank-screen bug is caught by the second and
  by nothing that exists today.
- A lint test proving the extended colour rule fires on `rgba(...)` — 34's acceptance criteria ask
  for it and it is cheap here.
- Input tests: the clear button empties the query; submit does not lose focus; the sheet's commit
  button stays visible with the keyboard up (needs a device or a keyboard-metrics mock — record
  which).
- A list test with a 600-phrase fixture asserting the rendered row count is bounded.
- Extend `apps/mobile/e2e/add.spec.ts` for the clear button and the debounce rather than adding a
  file.

## Risks

- **Error boundaries convert loud failures into quiet ones.** Wire them to the crash reporter
  ([32-observability-and-analytics](32-observability-and-analytics.md)) in the same change, or they
  hide the bugs they catch.
- **§2 and §3 touch every screen.** Both are mechanical. Land them as their own commits, before 34's
  refactor rather than inside it, or they vanish into a 2 000-line diff.
- **§2 races 46.** Add's `query` is moving into the URL. Sequence: 46's route params, then the
  `TextField`, or the field gets built twice.

## Out of scope

- Navigation, back handling, deep links, chrome, and Add's local navigational state —
  [46](46-navigation-system.md).
- The `TextField`, `Sheet`, and `Pill` components themselves, and the sheet's drawn-but-inert drag
  handle (`add.tsx:382`) — [34](34-design-system-completion.md).
- The sheet's screen-reader semantics — no `accessibilityViewIsModal`, no focus trap, a full-screen
  "Dismiss" `Pressable` as the scrim — [35](35-accessibility-wcag-pass.md). Its promotion to a route
  modal is [46](46-navigation-system.md)'s defect 6.
- Any sync or offline status UI. `offline.md` forbids it, deliberately.
- Settings' contents — [29](29-settings-and-engine-switching.md).
