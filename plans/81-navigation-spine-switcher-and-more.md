# Complete navigation laws, More, exits, resume and travelling audio

- **Requirement IDs:** `NAV-01`…`NAV-16`, `F-03`, `P1-02`, `P2-14`, `P4-06`, `P5-08`, `AS-04`
- **Milestone:** M1/M2
- **Status:** 🟡 Shared built-page spine/switcher, translated hubs and cold-entry escapes are
  implemented, including More grouped from shared built-destination policy. Owned-phrase search,
  real counts, ongoing/contextual groups, full flow/session laws, resume presentation and transport
  remain. Consume 56's metadata; 59/64 supply checkpoints and 62 supplies audio. Q-17 gates final
  home-rail priority, not reachability work.
- **Depends on:** 55/79/84 completed; 56 route contract, 57 shared state APIs; 59/64 checkpoints and
  62 playback for later slices.
- **Reviewed:** 2026-09-09 against `aafa61f`; current source, tests and retained review records
  inspected. This plan refresh supplies no new runtime, device or deployment acceptance.
- **Priority:** 1; exits/resume with 56, then priority 7 audio presentation.

## Verified starting point

**Review of the later `828d296` implementation:** Refrain exit/resume and ongoing presentation now
exist, but the new wave field fails the shared checkpoint codec and exit/ongoing policies disagree.
Repair [R1–R3 in the 33-plan review](../docs/reviews/2026-09-09-thirty-three-plan-implementation.md)
before treating this slice as accepted. The following inventory describes the earlier `aafa61f`
starting point; search and travelling audio remain unbuilt.

`apps/mobile/app/_layout.tsx` mounts shared chrome over Today, Add, Progress, Stream, Refrain,
phrase detail and Languages. `apps/mobile/src/lib/navigation.ts` supplies translated built hubs and
Today's rail. `NavigationMenu.tsx` and `apps/mobile/e2e/navigation.spec.ts` cover menu navigation,
cold Today escapes, warm Back and Escape/focus restoration. Onboarding retains step-back behavior.

The `/more` utility renders translated Lately/Phrases/Practice/You groups from `NAVIGATION_GROUPS`
and `destinationsForGroup`, excluding home, itself and empty groups. It has a shared-menu entry and
normal stack return. Grouping and built-hub parent/home/exit/resume metadata already exist; counts,
search and contextual/ongoing selectors do not. There is no ongoing-work selector, exit sheet or
travelling audio. The complete built/planned surface inventory and onboarding/Today home resolver
already exist. Durable course checkpoints and Refrain resume are implemented by 59/64; this plan
still needs their cross-route presentation and full exit laws. Additional product-dependent homes
need approved feature semantics and extended route metadata from 56.

The initial More slice passed navigation and route-manifest E2E (including every destination and
return to More), navigation/i18n unit checks and scoped lint. Its manifest state participates in the
full accessibility/text-scale suites; full combined CI and native acceptance remain separate.

## Source and ownership

`Navigation.dc.html:40–76`, `82–305`, `311–499`, `512–873` own surface classes, chrome and laws.
Plan 56 owns the single route declaration, parsing/guards, conditional-home resolution, failure
policy and `check:routes`. This plan owns presentation and interaction against those values; it must
not create a second route table or navigation store. Plan 59 owns checkpoint persistence, 64 owns
wave transitions, 62 owns playback truth and audio lock-screen transport; 70 owns trip widgets/Live
Activity.

## Remaining work

1. [ ] Extend consumption beyond the existing built-hub group policy to plan 56's exhaustive
       metadata: surface class, translated place/parent, built/hub, expectedUse, practice source
       with target course, resumability and rail/More grouping. Preserve all currently reachable
       hubs, including Languages. Resolve Q-17 before final daily rail priorities; store rails on
       each approved resolved home, not as a Today-only assumption.
2. [ ] Evolve existing chrome into the repeated production components needed by actual call sites.
       Root has no Back; Push names its real destination or cold resolved home; Flow steps back with
       answers preserved; Session disables implicit exits; Sheet owns focus and the only active
       escape.
3. [ ] Extend existing More grouping and switcher presentation with selectors: Ongoing first,
       contextual flow steps, built destinations, then Lately/Phrases/Practice/You with real counts
       and conditional trip entries. Hide unbuilt/empty groups. Expose search over owned phrases
       using the existing phrase data/list surface; reserve the ladder Phrasebook/Run product for
       gated plan 78. Do not create a dead `/phrasebook` link or log search text.
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

1. Complete explicit session/flow exits with 56's work-at-stake policy and existing checkpoints.
   Pause must acknowledge the durable write before leaving; End preserves earned progress; Keep
   going restores focus. Show ongoing work and a primary Resume action without a second session
   store.
2. Prove course-preserving resume after relaunch and queued deep-link collisions, including rejected
   writes and deleted/stale sources. Keep existing menu gestures and first-run escapes. Reuse More's
   groups, then add real counts and owned-phrase search; final rail ordering remains Q-17-gated.
3. At priority 7, consume 62's real session position/state for travelling audio and 64's wave
   transitions. Do not delay non-audio exits/resume for recorded assets or onset measurement.

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

1. [ ] Session/flow exits, ongoing work and persisted resume integration (NAV-13/NAV-14), with 56.
2. [ ] Complete More/contextual selectors, useful counts and owned-phrase search (NAV-01/NAV-08).
       Static built-destination grouping is already implemented; preserve it.
3. [ ] Travelling transport and physical-device verification (NAV-15/NAV-16), after 62.

Native universal-link provisioning, route business logic, persistence/audio internals and OS widgets
remain with their owners. No authored artifact changes are required.
