# Navigation spine, switcher, and More menu

- **Requirement IDs:** `NAV-01`…`NAV-16`, plus existing `F-03`, `P1-02`, `P2-14`, `P4-06`, `P5-08`,
  and `AS-04`
- **Milestone:** M1/M2
- **Status:** Not started
- **Depends on:** 56 typed navigation/failure shell; 57 runtime design system; transport/resume
  integration also depends on 59, 62, and 64

## Outcome

Every learner route participates in the v1.1 navigation system: a 28px spine names the current place
and ongoing work, opens the new switcher, and reaches the state-driven More menu. Back names its
destination, sessions pause or end honestly, flows resume, empty deep links stay explainable, and
active audio has one travelling transport.

## Relationship to existing plans

Plan 56 owns the typed route model, route guards, deep-link parsing, failure boundaries, input
shell, and scalable-list contract. This plan consumes and extends that model with the authored v1.1
navigation metadata and presentation. It must not build a competing navigation store or route table.
Plans 59/64 own durable session checkpoints, plan 62 owns playback truth, and plan 70 owns OS
lock-screen/Live Activity mirrors.

The source is `Navigation.dc.html`, especially the five surface classes at lines 40–76, four
reference screens at 82–305, spine/switcher behavior at 311–499, and six state laws at 512–873.

## Work

1. Extend the single route declaration with exhaustive metadata: `surfaceClass` (`root`, `push`,
   `session`, `flow`, `sheet`), place/copy keys, parent/resolved-home behavior, `hub`, `built`,
   `expectedUse`, `resumable`, practice-source parsing, empty-state copy, and rail/More grouping.
   Add a static `check:routes` gate for missing or contradictory fields.
2. Implement shared navigation components from the v1.1 package: `Spine`, `ScreenHeader`, `NavRail`,
   `SwitcherHandle`, `SwitcherSheet`, `ArrivalNote`, `ExitSheet`, `ResumeStrip`, and
   `TransportStrip`. Components consume route/session/audio values and presentation copy; they do
   not import the store or invent route policy.
3. Mount the spine above Root, Push, Session, and Flow surfaces and omit it while a Sheet owns
   focus. The left word names the place and opens the switcher. The right word names the one ongoing
   item, or “n ongoing” and opens the Ongoing group. Never add a second chrome row.
4. Implement the switcher and `/more` from route data:
   - switcher: Ongoing first, then built/root destinations and contextual flow steps;
   - More: Lately, Phrases, Practice, and You, with real counts and conditional trip content;
   - hide unbuilt or empty groups rather than rendering disabled destinations;
   - add `/phrasebook?q=` for owned-phrase search without logging query text.
5. Implement surface-class behavior: Root has no back; Push names the actual stack destination or
   uses the cold-entry `✕ <resolved home>` variant; Session disables back gestures and exits through
   pause/end/keep-going; Flow steps back and persists answers; Sheet traps focus and is the sole
   escape while open.
6. Implement authored laws using one source of truth:
   - `NAV-13`: dismissal writes a resumable checkpoint and makes the resolved home's primary CTA
     Resume, without adding a second CTA;
   - `NAV-14`: one escape at a time, with underlying session exits inert and inaccessible;
   - `NAV-15`: playback state from the audio module renders one travelling strip on Root/Push, stays
     hidden in its own Session, pauses before another practice Session, and keeps playing behind
     Flow/Sheet;
   - `NAV-16`: every non-Sheet surface has the route-rendered spine.
7. Handle deep-link/session collisions with the existing pure “work at stake” predicate: queue a
   target when reps or flow answers would be lost; replace only an idle Session, Root, or Push.
   Distinguish resolvable-empty, gone/deleted, and malformed/unresolvable destinations with honest
   copy and two useful next actions.
8. Update the eight existing routes first, then require every later route plan to declare metadata
   and states in its own commit. Preserve the current conditional-home resolver and add authored
   rails as data on each possible home rather than hardcoding Today.
9. Add accessibility and interaction behavior: focus trap/restore, scrim and swipe dismissal,
   meaningful control names, minimum touch targets, safe-area/keyboard handling, reduced motion, and
   200%/310% layouts. A screen reader must hear place, ongoing state, counts, and destinations
   without relying on glyphs or color.

## Test matrix

- Pure tables cover every route × surface class × cold/warm entry × built state × practice source.
- Property tests enforce: one resolved home, no unreachable built route, no daily route hidden at
  depth three, one active escape, and one rendered transport.
- Browser E2E adds states for closed/open switcher, one/multiple ongoing items, More with hidden and
  populated groups, named back, cold deep link, exit sheet, resume strip, empty/gone/bad source, and
  route-persistent audio fake.
- Native integration covers back gestures, sheet focus/gesture ownership, process-resumed sessions,
  real audio continuity, interruptions, and lock-screen parity once dependencies land.

## Acceptance criteria

- Every built learner route is reachable from the spine/switcher or More without relying on Back.
- No visible menu row points to an unbuilt screen; real counts come from selectors, never fixtures.
- Leaving an active session offers Pause first and distinguishes Pause, End, and Keep going without
  loss or shame copy.
- Cold deep links never render a false back destination; empty valid sets never silently redirect.
- Audio state is read from plan 62's module and survives allowed route changes with pause/end
  controls that affect the same underlying session.
- `check:routes`, `pnpm check`, `pnpm test:e2e`, and the applicable native matrix pass.

## Commit sequence

1. `feat(mobile): declare v1.1 route metadata and laws (NAV-01)`
2. `feat(mobile): add the spine and switcher menu (NAV-16)`
3. `feat(mobile): add state-driven More navigation (NAV-08)`
4. `feat(mobile): implement honest exits and resumability (NAV-13)`
5. `feat(mobile): connect travelling audio transport (NAV-15)`
6. `test(mobile): cover navigation states and invariants (NAV-01)`

## Out of scope

Business logic for unbuilt destinations, native universal-link provisioning, session persistence
internals, audio playback internals, widgets/Live Activities, and the dev-only tokens route.
