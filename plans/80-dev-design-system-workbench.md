# Complete the existing dev design-system workbench

- **Requirement IDs:** `F-05`, `F-06`, `LB-25`…`LB-28`
- **Milestone:** M1/M2, alongside the owning UI features
- **Status:** 🟡 Workbench, token enumeration, contrast reports, inspection controls and production
  exclusion are implemented. Production-state and navigation/language specimen coverage remains; new
  state APIs need 57 and future navigation components need 81. Existing component registration can
  start now.
- **Depends on:** 53 completed; 57 production state APIs; 81 future navigation components; 87
  implemented language UI.
- **Reviewed:** 2026-09-07 against merged baseline `2d9e8c3`.

## Verified starting point

`apps/mobile/app/dev/tokens.tsx` and `apps/mobile/src/dev-tools/` already provide the gated route,
searchable generated tokens, live contrast reports, inspection-only accent/text-scale/reduced-motion
controls, device viewport and production specimens. Three workbench browser tests and a production
route unavailability check exist. The original implementation commits are `be024be`, `5632ce1`,
`7eefcf2` and `5ee247f`; plan 84 subsequently reviewed the rendered workbench.

`specimenContract.ts` still marks forced pressed/focused and loading states pending. Its registry
lists 30 components and six pending navigation names, while production now also exports
`NavigationMenu` and `LanguageChoices`. Registration must follow actual production exports, not
obsolete prototype names. The authored reference remains `Design System.dc.html`.

## Remaining work

1. [ ] Reconcile the registry with current exported components, including NavigationMenu and
       LanguageChoices. State explicitly whether each export is rendered, interaction-owned or
       internal; add a drift assertion that catches a new component being omitted.
2. [ ] Consume plan 57's actual loading and forced pressed/focused APIs when they exist. Verify the
       same component under default, disabled, error, selected, long-copy and motion variants; no
       demonstration-only clone or loading prop invented inside the workbench.
3. [ ] Add Bulgarian/Russian and translated long-copy specimens alongside Spanish, testing 200% and
       310% with font size, line height and letter spacing. Inspection must not mutate learner
       settings.
4. [ ] Replace pending navigation entries with real plan-81 components as they land: named headers,
       More/switcher, exits, resume and transport. Keep unfinished components honestly pending.
5. [ ] Extend the existing keyboard/focus/overflow, token and small stable screenshot suites only
       for those changes. Retain the authored-size horizontal viewport; do not shrink it to hide
       overflow.
6. [ ] Update `apps/mobile/README.md` and component inventory with the final supported/pending
       matrix.

## Acceptance criteria

- Every production export and specimen state has an accurate coverage disposition.
- Specimens consume the same generated tokens and production APIs as learner routes.
- Keyboard, screen reader, large text and Cyrillic specimens remain usable.
- Production export and deep links still make `/dev/tokens` unavailable; learner menus never list
  it.
- `pnpm check`, `pnpm test:e2e:workbench` and `pnpm test:e2e:bundle` pass. Run learner E2E when
  shared component behavior changes; keep developer states outside the learner manifest.

## Delivery boundary

Commit registry/language coverage first (F-05), then each dependency-backed state addition (F-06).
Plan 57 owns component behavior and theme implementation; 81 owns navigation. This plan owns only
their inspection coverage. Do not rebuild the route, token pipeline, contrast report or gallery.
