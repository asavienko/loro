# Finish Today and the Refrain as a production loop

- **Requirement IDs:** `LB-01`…`LB-10`, `LB-20`…`LB-32`, `P3-01`…`P3-12`
- **Milestone:** M2
- **Status:** 🟡 Today/Refrain, durable course checkpoints and resume are implemented. Production
  timed-wave behavior, tag drills, audio/speech orchestration and peak acceptance remain; playback
  and measurement need 62/63, with Q-14 blocking peak sign-off only.
- **Depends on:** 55/84 completed; 59 persistence, 60 selection/maths, 62 playback, 63 speech; 81
  presents exit/resume state.
- **Reviewed:** 2026-09-09 against `aafa61f`; current source, tests and retained review records
  inspected. This plan refresh supplies no new runtime, device or deployment acceptance.
- **Priority:** 2; timed waves/tag drills, then priority 7 audible integration.

Previous starting point: [archived snapshot](../2026-09-08/64-today-and-refrain-production-loop.md).

**Archive disposition (2026-09-09):** Archived at user request after integration review. The partial
status and remaining acceptance criteria below are retained; archival does not mark this plan
complete. The roadmap index continues to track its unfinished scope.

## Verified starting point

`apps/mobile/src/store/slices/refrain.ts`, `apps/mobile/src/lib/waves.ts`,
`apps/mobile/src/store/delta.ts` and learner E2E cover the current manual loop. Plan 87 isolates
course sessions and sends late deltas to their owning course; the streak remains global. Manual taps
produce no speech latency or effort score. Progress tags are a non-interactive rollup until a real
filtered session exists. Completed waves now persist in the course state and selected Today waves
open Refrain with the durable selection.

## What already exists

Today route/layout, frozen daily set, streak/day logic, basic Refrain six-mode UI, engine contract,
warming meter, completion screen, browser state coverage, and `applyDelta` write path are
implemented.

## Focused clock-refresh slice (2026-09-09)

Today now refreshes at minute boundaries while focused and immediately on foreground return. This
updates the current wave/CTA and invokes the existing frozen-day transaction at midnight; no new
persistence or completion inference is introduced. Browser regressions cover a wave-time transition,
same-day foreground jump and open-screen midnight. Timed enforcement, banked tail, filtered drills,
audio/ASR and native transition acceptance remain open.

Validation: target-file ESLint passed; `today.spec.ts` passed all five cases and the existing
`day-boundary.spec.ts` passed all seven cases, including retained streak and DST/grace behavior.
Full local CI and native/device evidence are not claimed by this slice.

## Remaining work

1. [ ] Enforce timed-wave entry at both Today actions and direct/resumed practice entry. Existing
       `waveSchedule` labels, persisted completion and focused clock refresh are inputs, not new
       implementation. Define banked/yesterday tail, all-graduated and next-action behavior from
       persisted scheduling state; elapsed time never implies completion.
2. [ ] Extend acceptance of the implemented course checkpoint/resume path at every wave transition.
       Preserve stale-result rejection and the shared global streak. With plan 59 owning checkpoint
       writes and plan 81 their presentation, complete midnight, timezone, interruption, abandon and
       day-rollover behavior without erasing completed reps or rebuilding persistence.
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

## Delivery order and gates

1. Deliver enforced wave entry, tail/empty/all-graduated states and tag-filtered drills on existing
   59/60 state. Cover pre-first-wave, exact boundaries, foreground time jumps, midnight/DST and
   course changes; labels and permitted actions must agree. A drill's actual candidate IDs must
   match its selected tag. Reuse the focused clock refresh and durable completion/selection.
2. Consume 62 playback and 63 speech/measurement events for the audible loop; keep manual/reveal
   completion and null timing honest while a native capability is unavailable. Plan 81 presents
   exits/resume, while this plan owns wave transitions and 59 owns their transaction boundary.
3. Validate checkpoint interruption, midnight/timezone changes and selected-course ownership through
   58/72. Q-14 blocks peak presentation sign-off only; it does not block scheduling or tag drills.

## Out of scope

Trip waves, experiment arm switching, Review/Memory, and prosody/pronunciation labs.

## Post-main review and archive disposition — 2026-09-09

The [review at `de81744`](../../../docs/reviews/2026-09-09-post-main-plan-review.md) records this
plan's current contribution, remaining work and gates. [Delivered slices](IMPLEMENTED-SLICES.md) are
retained in the archive; this plan remains incomplete. Earlier verification is dated evidence, not
acceptance of the current combined branch.
