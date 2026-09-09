# Navigation, failure states, input, and scalable lists

- **Requirement IDs:** `P1-02`, `P2-03`, `P2-07`, `P2-09`, `P2-14`, `P4-01`, `P4-06`, `P5-02`,
  `P5-08`, `F-03`, `N-01`…`N-03`
- **Milestone:** M1
- **Status:** 🟡 Typed surface inventory, guarded unknown-link recovery and route/state drift checks
  and built-destination policy/group metadata are implemented. Exhaustive route laws, failure
  boundaries, keyboard and list work remain; native input proof needs 58.
- **Depends on:** 53/55/79/84 completed; 81 consumes the route contract; 58 only for native
  verification.
- **Reviewed:** 2026-09-09 against `aafa61f`; current source, tests and retained review records
  inspected. This plan refresh supplies no new runtime, device or deployment acceptance.
- **Priority:** 1; route laws with 81.

**Archive disposition (2026-09-09):** Archived at user request after integration review. The partial
status and remaining acceptance criteria below are retained; archival does not mark this plan
complete. The roadmap index continues to track its unfinished scope.

## Verified starting point

`apps/mobile/src/lib/navigation.ts` now declares all 23 authored surfaces, distinguishes built from
planned routes and resolves unknown deep links to safe recovery. It also supplies translated built
hubs to Today and the shared switcher. `apps/mobile/app/_layout.tsx` and
`apps/mobile/e2e/navigation.spec.ts` cover cold Today escapes, warm Back and menu navigation. The
registry includes all 23 learner surfaces plus Languages/Account/More, and `conditionalHome` handles
onboarding versus Today. `DESTINATIONS` already declares parent/home, group, exit and resume values
for built hubs; More consumes its groups. `check:routes` already checks files and manifest
ownership. The current `routeClass: learner | utility` is not the authored
Root/Push/Flow/Session/Sheet classification (`Navigation.dc.html:40–76`). Exhaustive surface laws,
frequency, course/source parsing and their consumer integration remain. Extend the existing registry
and resolver without introducing a second navigation authority.

## Outcome

One typed route model owns entry, exit, back, deep-link, modal, and conditional-home behavior for
all 23 authored learner surfaces plus the Languages/Account utilities and future built utilities.
Existing routes gain honest pending/error boundaries, keyboard-safe input, and list behavior that
can scale beyond the three 31-phrase starter catalogs.

## Remaining work

1. [ ] Extend the existing declarations with authored surface classes, expected-use frequency, modal
       ownership and target-course/practice-source deep-link contracts; derive built-hub policy from
       the same authority. Extend the basic conditional-home resolver only as approved product
       semantics require. Keep target routes declared but unbuilt and unreachable until their screen
       files land. This plan owns metadata/guards and `check:routes` (implemented); plan 81 owns
       menu/More rendering.
2. [ ] Replace route-specific back guesses with tested laws for first-run, add/detail, practice,
       trip, settings, notifications, widgets, and unknown deep links.
3. [ ] Add route-level error boundaries and explicit loading, empty, degradable, recoverable, and
       fatal states using the documented error taxonomy.
4. [ ] Complete text input focus/keyboard behavior and camera/import fallback navigation.
5. [ ] Virtualize catalog, phrase, suggestion, and future trip lists with stable keys and an
       explicit empty/error contract.
6. [x] Enforce route/state ownership so every new route and learner-visible state enters the E2E
       manifest in the same change.

## Acceptance criteria

- Route graph and laws have pure unit tests plus learner-reached E2E flows.
- A malformed/unknown deep link has a safe destination and never bypasses onboarding/account gates.
- Route failures render recovery UI rather than a blank tree.
- Input remains usable at 200% and 310% text scale with the keyboard visible.
- Lists meet the plan-72 performance budgets with scale fixtures.

## Delivery order and gates

1. Complete pure route/source parsing and the work-at-stake decision for built routes, then wire the
   layout, deep links and switcher to it. Reuse `check:routes` and current metadata. Plan 81 owns
   the exit/collision sheet; 56 owns whether navigation may proceed and the queued destination.
2. Deliver a practice → attempted exit → pause → relaunch → resume journey with 81 and existing
   plan-59 checkpoints. Include cold entry, wrong-course/deleted sources, course changes and a
   checkpoint-write failure that keeps the current work available. Never navigate on an uncommitted
   pause acknowledgement.
3. Follow with route-level recovery, keyboard and scaled-list behavior. Each new state enters the
   E2E manifest with learner-reached flows. Native back/focus/keyboard proof runs through 58/72.
   Q-07 gates trip-home semantics and Q-17 final rail ordering, not current-route safety.

## Out of scope

Trip business logic, notification scheduling, visual redesign, and native universal-link setup.

## 2026-09-09 route ownership slice (P1-02, F-03)

The local `check:routes` gate compares built and planned `SURFACES` with actual Expo screen files
and the runtime-expanded `STATES` manifest. It rejects absent built screens, reachable planned
screens, undeclared routes, missing/stale state ownership, duplicate identifiers and missing state
spec references. Route groups and index files normalize to their public paths; developer and Expo
infrastructure routes remain outside the learner contract.

Validation: five Node tests pass, including the current checkout and negative fixtures. This is a
structural guard; it does not prove that every rendered state was registered or replace the E2E
accessibility, text-scale and learner-flow suites. Modal/course contracts, conditional trip homes,
route failure UI, keyboard and list acceptance remain open with their existing gates.

## Post-main review and archive disposition — 2026-09-09

The [review at `de81744`](../../../docs/reviews/2026-09-09-post-main-plan-review.md) records this
plan's current contribution, remaining work and gates. [Delivered slices](IMPLEMENTED-SLICES.md) are
retained in the archive; this plan remains incomplete. Earlier verification is dated evidence, not
acceptance of the current combined branch.
