# FSRS-6 model and Loro's scheduling policy

The scheduler is FSRS-6 with its published default parameters, in `packages/core-rs/src/fsrs/`
([ADR-0004](adr/0004-fsrs-scheduler.md)). The app calls it through `core_call` (`fsrs_initialize`,
`fsrs_review`) from `apps/mobile/src/shared/core/fsrs.ts`; there is no JavaScript FSRS. That file
mirrors only `retrievability`, for display, on the same curve and with the same rounding.

## Pinned reference

Equations, parameters and rounding follow
[ts-fsrs c8ca282](https://github.com/open-spaced-repetition/ts-fsrs/tree/c8ca282edc3fe1cdfa1c24912437938b63a25cb3/packages/fsrs/src)
(`algorithm.ts`, `constant.ts`):

```text
[0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001,
 1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014,
 1.8729, 0.5425, 0.0912, 0.0658, 0.1542]
```

`decay = -w[20]`, `factor = exp(log(0.9) / decay) - 1`, `R(t,S) = (1 + factor*t/S)^decay`. Stability
is FSRS's interval at 90% recall. Values are f64; intermediate results round to eight decimals. No
fuzz.

Elapsed time is whole 24-hour days (elapsed ms / 86,400,000, truncated), independent of time zone
and DST. A review within 24 hours of the last uses FSRS-6's short-term update. Backward time,
non-finite values, inconsistent state, an unknown `algorithm` and overflow return explicit errors.

## Loro's adaptations in the core

- **Desired retention 50%.** The core's due date is when predicted recall falls to half:
  `S * (0.5^(1/decay) - 1) / factor`, rounded to whole days and bounded to 1–36,500 days — about 90
  times stability.
- **Initialization.** A phrase starts `new` with stability zero and no review; its first observed
  recall sets stability from the grade. Difficulty starts from a declared prior (the app declares
  `med`, 5.0).
- **One learning step.** Again schedules ten minutes; Hard on a card not yet in `review`, fifteen;
  Good graduates to the computed interval. Again on a review card increments lapses once and enters
  `relearning`.
- **The app's grades.** Missed → Again, Hard → Hard, Easy → Good. The learner's "Easy" means "I said
  it"; FSRS Easy is not offered.
- **Only real reviews count.** Listening without rating and skipping are not reviews; nothing
  synthesizes a grade.

The persisted state carries `algorithm = fsrs-6-default-c8ca282-loro-v1`. Changing a parameter or a
policy needs a new id and an explicit migration. State from the earlier preview scheduler
(`fsrs-6/py-fsrs-6.3.2/default-90-no-steps`) is still read and adopts the current policy on its next
review.

## The app's review date

The app shortens the core's date (`reviewed` in `apps/mobile/src/shared/state/memory.ts`), so a
short listening loop sees phrases again:

- A card in `review` is due after its stability in whole days (when predicted recall falls to 90%),
  or at the core's date if that is sooner.
- A phrase's first rating, unless Missed, makes it due within one day, or four if it was first heard
  on an earlier day.

Which retention should decide reviews is open question [Q-24](../decisions/open-questions.md#q-24).

## Evidence

- `src/fsrs/scheduler.rs` tests hold the core to `tests/fixtures/fsrs-6-reference.json`, generated
  from the pinned ts-fsrs (`tests/generate_fsrs_ts_reference.mjs`), within 1e-7.
- `tests/fsrs_parity.rs` keeps 42 vectors from py-fsrs 6.3.2 (`tests/fixtures/fsrs_v6_3_2.json`) as
  compatibility evidence for preview state: memory within 1e-5 relative, not due dates.
- `tests/sim.rs` simulates 365 days of 64 cards from a fixed seed and checks bounded, replayable
  state.

None of this shows pedagogical efficacy.

## License

The implementation is derived from ts-fsrs (MIT); its notice is in
[fsrs-upstream-license.txt](fsrs-upstream-license.txt).
