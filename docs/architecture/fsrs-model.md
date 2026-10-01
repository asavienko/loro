# FSRS-6 model and Loro's scheduling policy

The scheduler is FSRS-6 with its published default parameters, in `packages/core-rs/src/fsrs/`
([ADR-0004](adr/0004-fsrs-scheduler.md)). Loro keeps a **50% desired retention**: a phrase comes
back when recall is predicted to fall to half. Stability still means FSRS's interval at 90% recall.
The app calls the core through `core_call` (`fsrs_initialize`, `fsrs_review`); there is no
JavaScript FSRS. `apps/mobile/src/shared/core/fsrs.ts` mirrors only `retrievability`, for display,
with the same curve and rounding.

## Pinned reference

Equations, parameters and rounding follow
[ts-fsrs c8ca282](https://github.com/open-spaced-repetition/ts-fsrs/tree/c8ca282edc3fe1cdfa1c24912437938b63a25cb3/packages/fsrs/src)
(`algorithm.ts`, `constant.ts`):

```text
[0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001,
 1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014,
 1.8729, 0.5425, 0.0912, 0.0658, 0.1542]
```

`decay = -w[20]`, `factor = exp(log(0.9) / decay) - 1`, `R(t,S) = (1 + factor*t/S)^decay`. The next
interval is `S * (0.5^(1/decay) - 1) / factor`, rounded to whole days and bounded to 1–36,500 days.
No fuzz. Values are f64; intermediate reference outputs round to eight decimals.

Elapsed time is whole 24-hour days (elapsed ms / 86,400,000), independent of time zone and DST.
Reviews within the first 24 hours use FSRS-6 short-term updates. Backward time, non-finite values,
inconsistent state and overflow return explicit errors.

## Loro's adaptations

- **Initialization.** A phrase starts `new` with stability zero and no review; its first observed
  recall sets stability from the grade. Difficulty starts from a declared prior (the app declares
  `med`, 5.0).
- **One learning step.** Again schedules ten minutes; Hard while learning, fifteen; Good/Easy
  graduate to the computed interval. A failed review increments lapses once and enters `relearning`.
- **The app's grades.** Missed → Again, Hard → Hard, Easy → Good. The learner's "Easy" means "I said
  it"; FSRS Easy is not offered.
- **Only real reviews count.** Listening without rating and skipping are not reviews; nothing
  synthesizes a grade.

The persisted result carries `algorithm = fsrs-6-default-c8ca282-loro-v1`. Changing a parameter or a
policy needs a new id and an explicit migration.

## Evidence

`tests/fixtures/fsrs-6-reference.json` comes from running the pinned upstream implementation; the
parity tests (`tests/fsrs_parity.rs`, `tests/parity.rs`) hold the core to it within 1e-7.
`tests/sim.rs` simulates 365 days of 64 cards from a fixed seed and checks bounded, replayable
state. None of this shows pedagogical efficacy.

## License

The implementation is derived from ts-fsrs (MIT); its notice is in
[fsrs-upstream-license.txt](fsrs-upstream-license.txt).
