# Navigation, failure states, input, and scalable lists

- **Requirement IDs:** `P1-02`, `P2-03`, `P2-07`, `P2-09`, `P2-14`, `P4-01`, `P4-06`, `P5-02`,
  `P5-08`, `F-03`, `N-01`…`N-03`
- **Milestone:** M1
- **Status:** 🟡 Typed surface inventory, guarded unknown-link recovery and route/state drift checks
  are implemented. Full route laws, failure boundaries, keyboard and list work remain; native input
  proof needs 58.
- **Depends on:** 53/55/79/84 completed; 81 consumes the route contract; 58 only for native
  verification.
- **Reviewed:** 2026-09-09 against checkout `42f4d57`; source/plan review only, no new device or
  deployment acceptance.

**Archive disposition (2026-09-09):** Archived at user request after integration review. The partial
status and remaining acceptance criteria below are retained; archival does not mark this plan
complete. The roadmap index continues to track its unfinished scope.

## Verified starting point

`apps/mobile/src/lib/navigation.ts` now declares all 23 authored surfaces, distinguishes built from
planned routes and resolves unknown deep links to safe recovery. It also supplies translated built
hubs to Today and the shared switcher. `apps/mobile/app/_layout.tsx` and
`apps/mobile/e2e/navigation.spec.ts` cover cold Today escapes, warm Back and menu navigation. The
registry includes all 23 learner surfaces plus Languages/Account, and `conditionalHome` handles
onboarding versus Today. Surface-class/parent/frequency/resume metadata, product-dependent homes and
a `check:routes` gate remain absent. Extend these declarations and resolver; do not replace the
working menu.

## Outcome

One typed route model owns entry, exit, back, deep-link, modal, and conditional-home behavior for
all 23 authored learner surfaces plus the Languages/Account utilities and future built utilities.
Existing routes gain honest pending/error boundaries, keyboard-safe input, and list behavior that
can scale beyond the three 31-phrase starter catalogs.

## Remaining work

1. [ ] Extend the basic conditional-home resolver with modal routes and target-course deep-link
       contracts in the implemented pure surface registry. Keep target routes declared but unbuilt
       and unreachable until their screen files land. This plan owns metadata/guards and
       `check:routes` (implemented); plan 81 owns menu/More rendering.
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

1. Extend `SURFACES` and `conditionalHome` first, with pure tests and a route-drift check, then hand
   their metadata to 81. Keep the existing first-run guard and planned-route fallback.
2. Deliver recovery/input/list changes independently of unbuilt trip/chat screens. Q-07 still owns
   trip-home semantics; metadata alone must not make a planned route reachable.
3. Coordinate work-at-stake/deep-link collision rules with 81: 56 owns the decision and guarded
   destination; 81 owns the sheet and focus behavior. Validate current routes before adding new
   ones.

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
