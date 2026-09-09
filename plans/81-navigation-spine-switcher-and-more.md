# Complete navigation laws, More, exits, resume and travelling audio

- **Requirement IDs:** `NAV-01`…`NAV-16`, `F-03`, `P1-02`, `P2-14`, `P4-06`, `P5-08`, `AS-04`
- **Milestone:** M1/M2
- **Status:** 🟡 Shared built-page spine/switcher, translated hubs and cold-entry escapes are
  implemented. More, ongoing/contextual groups, full flow/session laws, durable resume and transport
  remain. Consume 56's metadata; 59/64 supply checkpoints and 62 supplies audio. Q-17 gates final
  home-rail priority, not reachability work.
- **Depends on:** 55/79/84 completed; 56 route contract, 57 shared state APIs; 59/64 checkpoints and
  62 playback for later slices.
- **Reviewed:** 2026-09-09 against checkout `42f4d57`; source/plan review only, no new device or
  deployment acceptance.

## Verified starting point

`apps/mobile/app/_layout.tsx` mounts shared chrome over Today, Add, Progress, Stream, Refrain,
phrase detail and Languages. `apps/mobile/src/lib/navigation.ts` supplies translated built hubs and
Today's rail. `NavigationMenu.tsx` and `apps/mobile/e2e/navigation.spec.ts` cover menu navigation,
cold Today escapes, warm Back and Escape/focus restoration. Onboarding retains step-back behavior.

There is no `/more`, ongoing-work selector, exit sheet or travelling audio. The complete
built/planned surface inventory and onboarding/Today home resolver already exist. Durable course
checkpoints and Refrain resume are implemented by 59/64; this plan still needs their cross-route
presentation and full exit laws. Additional product-dependent homes need approved feature semantics
and extended route metadata from 56.

## Source and ownership

`Navigation.dc.html:40–76`, `82–305`, `311–499`, `512–873` own surface classes, chrome and laws.
Plan 56 owns the single route declaration, parsing/guards, conditional-home resolution, failure
policy and `check:routes`. This plan owns presentation and interaction against those values; it must
not create a second route table or navigation store. Plan 59 owns checkpoint persistence, 64 owns
wave transitions, 62 owns playback truth and audio lock-screen transport; 70 owns trip widgets/Live
Activity.

## Remaining work

1. [ ] Consume plan 56's exhaustive metadata: surface class, translated place/parent, built/hub,
       expectedUse, practice source with target course, resumability and rail/More grouping.
       Preserve all currently reachable hubs, including Languages. Resolve Q-17 before final daily
       rail priorities; store rails on each approved resolved home, not as a Today-only assumption.
2. [ ] Evolve existing chrome into the repeated production components needed by actual call sites.
       Root has no Back; Push names its real destination or cold resolved home; Flow steps back with
       answers preserved; Session disables implicit exits; Sheet owns focus and the only active
       escape.
3. [ ] Add More and switcher groups from selectors: Ongoing first, contextual flow steps, built
       destinations, then Lately/Phrases/Practice/You with real counts and conditional trip entries.
       Hide unbuilt/empty groups. Expose search over owned phrases using the existing phrase
       data/list surface; reserve the ladder Phrasebook/Run product for gated plan 78. Do not create
       a dead `/phrasebook` link or log search text.
4. [ ] Show one/multiple ongoing items and implement NAV-13/14: Pause, End and Keep going; persisted
       checkpoint acknowledgement; a single primary Resume action on the resolved home; focus
       restoration and no underlying exit while a sheet is active. A language/course switch must not
       discard work.
5. [ ] Implement the pure work-at-stake predicate and deep-link collision flow together with 56:
       queue a target when reps/answers would be lost; replace only idle work. Distinguish
       valid-empty, deleted/gone and malformed sources, with useful recovery and no silent course
       substitution.
6. [ ] Connect NAV-15 to plan 62: one travelling transport on Root/Push, hidden in its own Session,
       pause before another practice Session, continue behind Flow/Sheet when policy permits.
       Commands must affect the same native session and use real position/state.
7. [ ] Complete sheet gesture/focus ownership, safe-area/keyboard behavior, meaningful translated
       names, minimum touch targets, reduced motion and 200%/310% reflow; feed real components
       to 80.

## Delivery order and gates

1. Consume 56's extended metadata to deliver More and contextual groups first. Existing checkpoints
   from 59/64 already supply resume data; this plan owns presentation, not another persistence
   store.
2. Add explicit exit/collision sheets next with durable acknowledgement and course-preserving
   resume. Preserve the gestures already implemented in 93 and feed their native checks into 58/72.
3. Add travelling audio only after 62 supplies real session position/state. Q-17 gates final rail
   priorities, not reachability or More; Q-07 still gates trip-dependent home behavior.

## Verification and acceptance

- Pure route tables cover cold/warm entry, surface classes, built state, target course and practice
  sources. Properties enforce one home, one escape, one transport and reachability of every built
  hub.
- Add manifest states and E2E journeys for More, ongoing work, exit/resume, empty/gone/bad links,
  language changes and provider-independent navigation. Keep current menu/Back expectations green.
- Native tests prove back gestures, process resume, real audio continuity and lock-screen parity. A
  browser fake can test UI state, not prove native playback or persistence.
- Counts come from selectors; pause/resume survives relaunch; missing routes and fake audio remain
  unavailable. `check:routes`, `pnpm check`, learner/bundle E2E and applicable device suites pass.

## Delivery sequence

1. [ ] More/contextual navigation on the completed route-contract slice (NAV-01/NAV-08).
2. [ ] Session/flow exits and persisted resume integration (NAV-13/NAV-14).
3. [ ] Travelling transport and device verification (NAV-15/NAV-16).

Native universal-link provisioning, route business logic, persistence/audio internals and OS widgets
remain with their owners. No authored artifact changes are required.
