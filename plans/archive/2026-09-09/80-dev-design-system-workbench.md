# Complete the existing dev design-system workbench

- **Requirement IDs:** `F-05`, `F-06`, `LB-25`…`LB-28`
- **Milestone:** M1/M2, alongside the owning UI features
- **Status:** 🟡 Workbench, token enumeration, contrast reports, inspection controls and production
  exclusion are implemented. Production-state and navigation/language specimen coverage remains; new
  state APIs are supplied by 57 and future navigation components need 81. Current component
  registration and export drift coverage are implemented.
- **Depends on:** 53 completed; 57 production state APIs; 81 future navigation components; 87
  implemented language UI.
- **Reviewed:** 2026-09-09 against checkout `42f4d57`; source/plan review only, no new device or
  deployment acceptance.

**Archive disposition (2026-09-09):** Archived at user request after implemented slices landed. The
partial status and remaining acceptance criteria are retained; archival does not mark this plan
complete. The roadmap index continues to track its unfinished scope.

## Verified starting point

`apps/mobile/app/dev/tokens.tsx` and `apps/mobile/src/dev-tools/` already provide the gated route,
searchable generated tokens, live contrast reports, inspection-only accent/text-scale/reduced-motion
controls, device viewport and production specimens. Three workbench browser tests and a production
route unavailability check exist. The original implementation commits are `be024be`, `5632ce1`,
`7eefcf2` and `5ee247f`; plan 84 subsequently reviewed the rendered workbench.

`specimenContract.ts` marks forced pressed/focused and loading states available after plan 57
integration. Reuse and verify these production APIs; do not implement them again. Its registry now
covers 33 exports, including `NavigationMenu`, `LanguageChoices` and direct-import `AudioControls`.
Registration drift is tested; multilingual/state/navigation specimen coverage remains. The earlier
30-component inventory is superseded by the registry slice recorded below. The authored reference
remains `Design System.dc.html`.

## Remaining work

1. [x] Reconcile the registry with current exported components, including NavigationMenu and
       LanguageChoices. State explicitly whether each export is rendered, interaction-owned or
       internal; add a drift assertion that catches a new component being omitted.
2. [ ] Consume plan 57's implemented loading and forced pressed/focused APIs. Verify the same
       component under default, disabled, error, selected, long-copy and motion variants; no
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

## Delivery order and gates

1. Register current exports and add a drift check now. Loading/pressed/focused APIs are already
   available; verify their coverage instead of waiting for all of plan 57.
2. Add real Bulgarian/Russian and long-copy specimens, then English-target cases when 90 lands. Keep
   inspection state separate from persisted learner preferences.
3. Replace pending chrome specimens only when 81 supplies actual reusable components. Preserve
   production exclusion and scoped workbench checks; number-bearing learner chart geometry belongs
   to the owning feature's `e2e/render.spec.ts`, not a screenshot-only claim.

## Delivery boundary

Commit registry/language coverage first (F-05), then each dependency-backed state addition (F-06).
Plan 57 owns component behavior and theme implementation; 81 owns navigation. This plan owns only
their inspection coverage. Do not rebuild the route, token pipeline, contrast report or gallery.

## 2026-09-09 registry slice

Registered all 33 component definitions, including direct-import AudioControls, LanguageChoices and
NavigationMenu. Gallery entries now declare rendered or interaction-owned disposition; no exported
internal components exist. The source-scanning unit assertion catches newly exported components
omitted from barrels or the registry. Language selection stays in specimen-local React state,
navigation uses the production sheet with inert destinations, and audio remains explicitly disabled.
Focused registry tests pass. Combined fast and browser gates are retained by the parent integration
run because this checkout has concurrent feature edits. Multilingual long-copy, per-component state
matrices and future plan-81 APIs remain open; they are not closed by registering current components.

## Post-main review and archive disposition — 2026-09-09

The [review at `de81744`](../../../docs/reviews/2026-09-09-post-main-plan-review.md) records this
plan's current contribution, remaining work and gates. [Delivered slices](IMPLEMENTED-SLICES.md) are
retained in the archive; this plan remains incomplete. Earlier verification is dated evidence, not
acceptance of the current combined branch.
