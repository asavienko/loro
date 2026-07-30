# Finish Today and the Refrain as a production loop

- **Requirement IDs:** `LB-01`…`LB-10`, `LB-20`…`LB-32`, `P3-01`…`P3-12`
- **Milestone:** M2
- **Status:** Partly implemented; this plan contains only the remaining behavior
- **Depends on:** 55 truth fixes, 59 durable state, 60 selection/maths, 62 audio, 63 speech

## What already exists

Today route/layout, frozen daily set, streak/day logic, basic Refrain six-mode UI, engine contract,
warming meter, completion screen, browser state coverage, and `applyDelta` write path are
implemented.

## Work

1. Make wave availability, labels, completion, banked/yesterday tail, all-graduated state, and
   next-action copy derive from persisted scheduling state and the real clock.
2. Persist/resume a wave at every transition; define midnight, timezone, interruption, abandon, and
   day-rollover behavior without erasing completed reps.
3. Integrate native prompt/model audio, rates, beat/ambient loop, phrase taps, hands-free
   progression, speech/reveal mode, and real latency while keeping the privacy boundary.
4. Use plan-60 cloze/set eligibility and canonical effort/mode semantics. Tag drills navigate to a
   genuinely filtered set.
5. Implement the warming transition, peak accessibility resolution, reduced-motion alternative, and
   honest absent-data states without fake scores.
6. Add device E2E for first/partial/complete waves, resume, midnight, offline, interruption,
   permission denial, empty/all-graduated rotation, and no-shame missed days.

## Acceptance criteria

- The full Today → wave → completion → relaunch path is audible, persisted, offline, and truthful.
- Every learner-visible number comes from stored events or real native measurement.
- A recoverable audio/ASR failure degrades the current rep; it never destroys the session.
- Existing browser coverage remains green and new native states have owners.

## Out of scope

Trip waves, experiment arm switching, Review/Memory, and prosody/pronunciation labs.
