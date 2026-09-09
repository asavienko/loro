> Historical snapshot archived on 2026-09-08 (F-04). Its starting point is superseded; unfinished
> work remains in [active plan 64](../../64-today-and-refrain-production-loop.md). This is not a
> completion record.

# Finish Today and the Refrain as a production loop

- **Requirement IDs:** `LB-01`…`LB-10`, `LB-20`…`LB-32`, `P3-01`…`P3-12`
- **Milestone:** M2
- **Status:** 🟡 Today/Refrain and course-aware in-memory sessions exist. Durable timed waves, tag
  drills, audio/speech and peak behavior remain; they need 59/60/62/63, with Q-14 blocking peak
  sign-off only.
- **Depends on:** 55/84 completed; 59 persistence, 60 selection/maths, 62 playback, 63 speech; 81
  presents exit/resume state.
- **Reviewed:** 2026-09-07 against merged baseline `2d9e8c3`.

## Verified starting point

`apps/mobile/src/store/slices/refrain.ts`, `apps/mobile/src/lib/waves.ts`,
`apps/mobile/src/store/delta.ts` and learner E2E cover the current manual loop. Plan 87 isolates
course sessions and sends late deltas to their owning course; the streak remains global. Manual taps
produce no speech latency or effort score. Progress tags are a non-interactive rollup until a real
filtered session exists.

## What already exists

Today route/layout, frozen daily set, streak/day logic, basic Refrain six-mode UI, engine contract,
warming meter, completion screen, browser state coverage, and `applyDelta` write path are
implemented.

## Remaining work

1. [ ] Make wave availability, labels, completion, banked/yesterday tail, all-graduated state, and
       next-action copy derive from persisted scheduling state and the real clock.
2. [ ] Persist/resume a wave at every transition under its target course; reject stale results that
       would mutate a newly selected course and keep the global streak shared. With plan 59 owning
       the checkpoint write and plan 81 its presentation, define midnight, timezone, interruption,
       abandon, and day-rollover behavior without erasing completed reps.
3. [ ] Integrate native prompt/model audio, rates, beat/ambient loop, phrase taps, hands-free
       progression, speech/reveal mode, and real latency while keeping the privacy boundary.
4. [ ] Use plan-60 cloze/set eligibility and canonical effort/mode semantics. Tag drills navigate to
       a genuinely filtered set.
5. [ ] Implement the warming transition, peak accessibility resolution, reduced-motion alternative,
       and honest absent-data states without fake scores.
6. [ ] Add device E2E for first/partial/complete waves, resume, midnight, offline, interruption,
       permission denial, empty/all-graduated rotation, and no-shame missed days.

## Acceptance criteria

- The full Today → wave → completion → relaunch path is audible, persisted, offline, and truthful.
- Every learner-visible number comes from stored events or real native measurement.
- A recoverable audio/ASR failure degrades the current rep; it never destroys the session.
- Existing browser coverage remains green and new native states have owners.

## Out of scope

Trip waves, experiment arm switching, Review/Memory, and prosody/pronunciation labs.
