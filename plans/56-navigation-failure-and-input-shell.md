# Navigation, failure states, input, and scalable lists

- **Requirement IDs:** `P1-02`, `P2-03`, `P2-07`, `P2-09`, `P2-14`, `P4-01`, `P4-06`, `P5-02`,
  `P5-08`, `F-03`, `N-01`…`N-03`
- **Milestone:** M1
- **Status:** 🟡 Built destinations and cold-entry recovery exist. Full route laws, failure
  boundaries, keyboard and list work remain; registry work can start now, native input proof
  needs 58.
- **Depends on:** 53/55/79/84 completed; 81 consumes the route contract; 58 only for native
  verification.
- **Reviewed:** 2026-09-07 against merged baseline `2d9e8c3`.

## Verified starting point

`apps/mobile/src/lib/navigation.ts` supplies translated built hubs to Today and the shared switcher.
`apps/mobile/app/_layout.tsx` and `apps/mobile/e2e/navigation.spec.ts` cover cold Today escapes,
warm Back and menu navigation. There is no exhaustive 23-screen surface registry or `check:routes`
gate. Extend this declaration; do not replace the working menu.

## Outcome

One typed route model owns entry, exit, back, deep-link, modal, and conditional-home behavior for
all 23 authored learner surfaces plus the Languages utility. Existing routes gain honest
pending/error boundaries, keyboard-safe input, and list behavior that can scale beyond the three
31-phrase starter catalogs.

## Remaining work

1. [ ] Extend the existing destination declaration with pure route/surface classes, the
       conditional-home resolver, guard results, modal routes, and deep-link contracts. Include
       target course identity and Languages. Keep target routes declared but unbuilt and unreachable
       until their screen files land. This plan owns metadata/guards and `check:routes`; plan 81
       owns menu/More rendering.
2. [ ] Replace route-specific back guesses with tested laws for first-run, add/detail, practice,
       trip, settings, notifications, widgets, and unknown deep links.
3. [ ] Add route-level error boundaries and explicit loading, empty, degradable, recoverable, and
       fatal states using the documented error taxonomy.
4. [ ] Complete text input focus/keyboard behavior and camera/import fallback navigation.
5. [ ] Virtualize catalog, phrase, suggestion, and future trip lists with stable keys and an
       explicit empty/error contract.
6. [ ] Enforce route/state ownership so every new route and learner-visible state enters the E2E
       manifest in the same change.

## Acceptance criteria

- Route graph and laws have pure unit tests plus learner-reached E2E flows.
- A malformed/unknown deep link has a safe destination and never bypasses onboarding/account gates.
- Route failures render recovery UI rather than a blank tree.
- Input remains usable at 200% and 310% text scale with the keyboard visible.
- Lists meet the plan-72 performance budgets with scale fixtures.

## Out of scope

Trip business logic, notification scheduling, visual redesign, and native universal-link setup.
