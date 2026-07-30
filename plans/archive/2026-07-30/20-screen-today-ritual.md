# Screen 11 — Today, the ritual surface

- **Requirement IDs:** `LB-01`…`LB-10`
- **Milestone:** M2 (v1 hero loop's front door)
- **Blueprint:** `Loro.dc.html:1316–1391`, logic `DayLogic` `3295–3341`
- **Spec:** `docs/product/functional-spec.md#11-today--the-ritual`
- **Screenshots:** `01-rest.png`, `c-refrain.png`
- **Size:** M
- **Depends on:** [fix-store-invariants.md](07-fix-store-invariants.md),
  [fix-local-day-boundary.md](01-fix-local-day-boundary.md),
  [audio-playback-module.md](11-audio-playback-module.md)
- **Status:** 🟡 Partly implemented 2026-07-29. `app/index.tsx` is now the Today route with the
  frozen set, real streak, real set progress, empty-library state, three-wave layout, and entry to
  the Refrain. Remaining: time-driven wave state, truthful completion/all-graduated states,
  persisted mid-session resume, blueprint fidelity/component coverage, and audio-backed ambient
  behaviour. Resume/persistence waits on plan 10; audio waits on 11. The UI/state work is otherwise
  unblocked. Two of the blueprint's four content blocks — the **ambient loop** card (`LB-05`) and
  the **fading tail + graduated & banked** pair (`LB-06`) — are absent entirely, and the wave rows'
  hardcoded, mislabelled times are a defect owned by
  [50-interface-integrity-defects](50-interface-integrity-defects.md) §4.

## Why it matters

`app/index.tsx` is now the Today home for the current Loop-B-only app, so the hero loop has its
front door. The first port makes the closed set and three-wave structure visible, but the wave rows
are currently presentation-only: readiness is inferred from `lockedIn > 0`, not local time or
persisted wave progress, and there is no dedicated finished/resume state. This plan completes that
behaviour and records how Today is selected once engine switching exists
([settings-and-engine-switching.md](29-settings-and-engine-switching.md)).

## What the blueprint specifies

Read `DayLogic.renderVals()` (`3295–3341`) before writing anything — it is a complete view model.
The mechanics, from `docs/product/prd.md` (`LB-01`…`LB-10`) and
`docs/architecture/scheduling.md:167`:

- **A closed, finite set.** Today has a bottom. The set is chosen once and frozen
  (`select_refrain_set`, and
  [select-rs-cloze-and-set-selection.md](18-select-rs-cloze-and-set-selection.md)). Finishing it
  means _finished_ — no infinite queue, no review debt. That is the loop's entire differentiator
  versus SRS (`docs/product/roadmap.md`, "Why the Refrain before SRS").
- **Three waves** at `waveTimes` (already in `PracticeSettings`, defaulted to
  `['08:00','13:00','19:00']` in `store/index.ts:356`). A wave is a portion of today's reps, not a
  separate set.
- **The rolling window** (`LB-06`) — how phrases enter and leave rotation across days, shown as a
  **fading tail** of yesterday's phrases with days-left beside a count of **graduated & banked**
  phrases (`Loro.dc.html:1369–1381`).
- **The ambient loop** (`LB-05`) — passive listening for the day's set, a dark card with a live
  equaliser (`1356–1367`); on the M2 cut list, so build it behind a flag and cut cleanly if needed.
- **Progress within the day** shown as effort dropping, consistent with the Refrain's warming card.

**Both of those blocks are absent from the current implementation**, and their absence is not
neutral: `app/index.tsx:217–221` renders three invented `StatTile`s (reps today · in your stream ·
graduated) where the blueprint has the ambient card and the tail/bank pair, and `:225–253` adds a
three-button navigation row that the blueprint does not have anywhere on this screen. So Today
currently shows two of the blueprint's four content blocks plus chrome of its own. The navigation
question is owned by [46-navigation-system](46-navigation-system.md) (its Q-17, the hub rail) —
**sequence the two**, because changing that row without restoring the content leaves the screen with
a hole in it.

One more fidelity gap in the set list: the blueprint's rows carry a per-phrase `daysLabel`
(`p.daysLabel`, the lock-in day counter of `LB-02`'s `day n/4`) beside the LOCKED badge. The app
renders the badge and not the counter, so the four-day graduation path is invisible.

## The work

1. **Keep the landed route and close fidelity gaps** — Today intentionally lives at `app/index.tsx`;
   do not create a second `today.tsx` route. Compare its hierarchy and states with
   `DayLogic.renderVals()` and record any intentional divergence.
2. **Keep the landed day's-set source.** `refrainSet` + `refrainDay` and store-owned progress are
   already wired. Add persistence/relaunch proof rather than another state container.
3. **Wave state.** Which wave is current, what is left in it, and what happens when a learner does
   all three waves' worth at breakfast (answer: they are done for the day — do not invent more
   work).
4. **Completion.** A real finished state that says so, once, without pressure to continue. Then
   optional extra practice framed as optional.
5. **Empty and edge states**, all of which are reachable today:
   - Library smaller than the set size.
   - Every phrase graduated (`LOCK_IN_DAYS_TO_GRADUATE = 4`) → the set is empty for a good reason;
     route to Add, warmly.
   - Phrases deleted mid-day → backfill, do not empty the day.
   - Returning after a week away → today is still today. **No backlog, no apology, no counter of
     missed days** (non-negotiable #3).
6. **Entry into the Refrain** with the correct phrase and rep index, resumable if the learner leaves
   mid-rep.
7. **Accessibility** — the four CI gates apply: Spanish text carries `lang="es-ES"`, any chart has a
   text summary, tap targets ≥44×44, contrast in all four accent themes.

## Acceptance criteria

- Today shows a finite set with a visible bottom, and finishing it reads as finished.
- The set is identical across relaunches on the same day and re-rolls at local midnight.
- Waves advance on real local times; doing everything early does not generate more work.
- A learner returning after 10 days sees today's set with no backlog and no shaming copy.
- Every edge state above renders deliberately, not as an accidental blank.
- Leaving mid-rep and returning resumes at the same rep.
- `pnpm check` green including all four a11y gates.

## Tests

- Component tests for each state (set of 3/5/8, empty, all-graduated, mid-wave, complete).
- A day-rollover test with an injected clock.
- A "returned after a week" test asserting no backlog state exists in the view model.
- Snapshot the view model against `DayLogic.renderVals()` field-for-field — the blueprint is the
  spec, and this is the cheapest way to prove fidelity.

## Out of scope

The ambient loop's audio implementation (flag it off; the audio module owns it) and notifications
for waves (`N-02` — [widgets-and-notifications.md](30-widgets-and-notifications.md)).
