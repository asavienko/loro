# Fix the store's invariants: partial reset, mid-session day rollover, unapplied engine deltas

- **Requirement IDs:** `LB-01`, `LB-03`, `LB-21`, `P3-01`
- **Milestone:** M1
- **Size:** S–M
- **Status:** ✅ Implemented 2026-07-29 — all five defects. `INITIAL_STATE` in
  `apps/mobile/src/store/state.ts` with a deep-equal reset test; `useDayRollover` on foreground plus
  entry to the Refrain and Today; backfill-not-re-roll with `refrainSubstituted`; `applyDelta` as
  the only practice write path (`recordRep` and its invented `axProduction + 2` deleted); the
  Refrain is engine-driven and reads `repsToday` from the store, so no visit-local counter exists to
  disagree with it. **One thing this plan did not foresee:** the engine's `repsToday` is absolute,
  so once `applyDelta` became the write path, re-entering a phrase at 4/6 would have overwritten the
  stored 4 with 1 — `RefrainEngine.plan` now resumes from today's count. Increment / absolute /
  monotonic is declared per field on `ProgressDelta`.

## Five defects in `apps/mobile/src/store/index.ts`

The store is small and deliberately mirrors the blueprint's single shared store
(`Loro.dc.html:3575–3626`), which is right. These are the places where it does not yet hold the
invariants it claims.

### 1. `reset()` leaves state behind

Lines 274–284 clear `onboarded`, `goal`, `phrases`, `refrainSet`, `refrainDay`, `selectedId`,
`toast` — and **not** `dailyMinutes` or `streakDays`. So "reset" produces a fresh-looking app that
still remembers the previous learner's session length and streak. Once
[the streak becomes real](02-fix-fabricated-streak.md) this is a cross-learner data leak on a shared
device.

Fix by defining the initial state **once** as a named constant and having both `create()` and
`reset()` spread it. A reset that enumerates fields will always drift from the state that gains
them.

### 2. The Refrain set never rolls over mid-session

`ensureRefrainSet()` (line 266) is only called from `completeOnboarding` (line 160). Nothing calls
it on app foreground, on navigation into the Refrain, or when the local day changes while the app is
open. A learner who opens the app at 23:55 and practises past midnight keeps yesterday's set, and
`repsToday` (keyed on `repsTodayDay`) resets underneath it — so the warming card drops to cold
mid-ritual, which is the single most visible thing in the v1 hero screen.

Fix: call `ensureRefrainSet()` from an app-state listener (`AppState.addEventListener('change')`)
and on entry to `app/practice/refrain.tsx` and `Today`. Combine with a day-change subscription so
any screen can react. Depends on [the clock fix](01-fix-local-day-boundary.md).

### 3. `refrainSet` can silently shrink to nothing — and the obvious fix for #2 makes it re-roll

`removePhrase` (line 180) filters the id out of `refrainSet` and does not backfill. Remove the three
phrases in a 3-item set and the Refrain renders its empty state for the rest of the day: "You always
see today" becomes "you see nothing today".

Read the guard carefully before fixing it, because it is **not** the cause and it hides a second bug
(line 269):

```ts
if (st.refrainDay === day && st.refrainSet.length > 0) return
```

The `length > 0` clause means an emptied set does _not_ short-circuit. So:

- **Today** the set stays empty only because nothing ever calls `ensureRefrainSet` again — defect
  #2, not this guard.
- **After #2 is fixed** the naive call-on-foreground re-enters, the guard falls through on an empty
  set, and `selectRefrainSet` re-rolls **the whole day's set** — including the items the learner
  already practised. That silently breaks the frozen-set promise, and it is a bug the fix for #2
  introduces rather than one it removes.

Fix both together: on removal, backfill from `selectRefrainSet` excluding the ids already completed
today, and record which ids were substituted so the frozen-set promise stays legible (the set is
frozen; a deleted item is replaced, not re-rolled). Then tighten the guard to distinguish "no set
for this day yet" from "this day's set is short a member" — one re-rolls, the other backfills.

### 4. Engines return deltas that the store ignores

`RefrainEngine.record` returns a `ProgressDelta` covering ten-plus signals (rule 5,
`packages/core/src/engines/types.ts:109–142`), including `srs`, `rung`, `lockedInToday`, and `axes`.
The store's `recordRep` (line 233) instead hand-writes a subset and invents one field:

```ts
axProduction: Math.min(99, p.axProduction + (success ? 2 : 0)),
```

`+2 per rep` is a made-up progression for a value the Prosody lab is specified to derive from real
scoring, and rule 5's whole point is that the _engine_ owns these updates so switching engines is
lossless. Right now the engine's deltas are unreachable from the UI, so the conformance suite proves
a property the app does not exercise.

Fix: `applyDelta(delta: ProgressDelta)` on the store as the **only** write path for practice
outcomes. Screens call `engine.record(...)` then `applyDelta(...)`. Delete the ad-hoc field maths
from the store, including `axProduction`.

### 5. `automaticity` is recomputed in two places from different inputs

`recordRep` (line 245) computes `automaticity(todayReps, DEFAULT_REP_TARGET)` from the store's own
counter, while `refrain.tsx:96` computes `automaticity(reps, DEFAULT_REP_TARGET)` from **local
component state** (`reps`, line 78) that resets to 0 on `nextPhrase()` (line 112). So the card's
warmth and the stored value disagree the moment a learner revisits a phrase later the same day: the
card starts cold, the store says 83%. One of them is wrong on screen, and it is the one the learner
is looking at.

Fix: the card reads `repsToday` from the store for the current phrase. Local state tracks only "reps
completed in this visit", used for mode sequencing, and is clearly named (`repsThisVisit`). Add a
comment explaining why the two differ — this is a real distinction, not a redundancy.

## Acceptance criteria

- Initial state is declared once; `reset()` restores every field including `dailyMinutes` and
  `streakDays`.
- Crossing local midnight with the app open re-rolls the Refrain set and the warming card stays
  consistent with the new day.
- Deleting every phrase in the day's set backfills rather than emptying the day, **and** re-entering
  the Refrain afterwards does not re-roll the items already practised.
- `applyDelta` is the only practice write path; no screen or store branch computes a progress field.
- `axProduction` is never incremented by a constant.
- Re-entering the Refrain on a phrase already at 4/6 reps shows 67%, not 0%.

## Tests

- Store tests for reset completeness (assert deep-equal to the initial constant).
- A day-rollover test with an injected clock.
- Backfill test: 3-item set, remove all 3, set is repopulated.
- Anti-re-roll test: practise 2 of a 3-item set, remove the third, call `ensureRefrainSet` again —
  the two practised ids are still in the set. This is the test that catches the interaction between
  defects #2 and #3.
- `applyDelta` applies every field in a fully-populated `ProgressDelta` and ignores absent ones.
- A round-trip test: `RefrainEngine.record` → `applyDelta` → store state matches the delta.

## Out of scope

Persistence (separate plan) and undo history beyond the existing single-level toast undo
(`showToast`, line 259).
