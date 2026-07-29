# Screen 8 — Memory model: the visible forgetting curve

- **Requirement IDs:** `P3B-01`…`P3B-08`
- **Milestone:** M3 (v1.1)
- **Blueprint:** `Loro.dc.html:963–1037`, logic `CurveLogic` `2984–3045`
- **Spec:** `docs/product/functional-spec.md#8-memory-model`
- **Screenshots:** `02-adv.png`, `g1.png`
- **Size:** M
- **Depends on:** [fsrs-implementation-and-parity.md](17-fsrs-implementation-and-parity.md)
- **Non-negotiables touched:** #2 (every number shown to a learner is real)

## The screen that cannot fake anything

ADR-0004 chose FSRS specifically because of this screen:

> The blueprint's Memory-model screen already _is_ FSRS made visible — it plots `R(t) = 0.5^(t/S)`,
> marks a 50% review threshold, and reports stability in days (`Loro.dc.html:963–1037`). Anything
> else would mean that screen lies about the algorithm behind it.

So this is the single screen where non-negotiable #2 has no wiggle room: every pixel of the curve is
a claim about the learner's memory. With the current fabricated `fsrsReview`
(`apps/mobile/src/store/index.ts:312`, `difficulty` pinned to 5, four fixed intervals) the curve
would be a smooth lie. **Do not build this screen before the FSRS port lands.**

## The work

### 1. The curve, from real state

Plot `R(t) = 0.5^(t/S)` using the phrase's actual `stability`, with the 50% review threshold marked
and the next review date derived from `due` — not from the threshold crossing computed separately,
or the two will disagree by a day and the learner will notice.

Render with the existing charting approach in the app (`Skia` is anticipated in
`apps/mobile/package.json`'s `$comment`; today `progress.tsx` draws bars with views). Pick one and
note it in `docs/design/component-inventory.md` — a second charting strategy is a real cost.

### 2. Honest handling of "no data yet"

A phrase reviewed zero times has no stability, so it has **no curve**. Options that are honest: show
the prior-derived initial curve clearly labelled as an estimate from the learner's own difficulty
rating, or show nothing with an explanation. Options that are not: interpolate, use a default, or
draw a plausible shape. `null` is already a first-class value across this codebase; keep it that way
here.

Same for a phrase with one review — the curve exists but the confidence does not. Say so.

### 3. Stability in days, and the axes

`FsrsState.stability` is documented as "days until retrievability decays to the review threshold"
(`core-rs/src/fsrs/mod.rs`). Report it with a unit and a plain-language gloss. `formatInterval`
(`src/lib/format.ts:15`) formats intervals; a stability number is not an interval and should not
reuse the `~10 min` bucketing.

### 4. The five-level confidence rating

This screen is where the confidence control lives in the blueprint (`Attempt.confidence` —
`'forgot' | 'shaky' | 'ok' | 'strong' | 'instant'`, `packages/core/src/engines/types.ts:92`). Wire
it to the grade mapping including the `Strong` stability bonus, shared with
[the Review session](24-screen-review-session.md) rather than reimplemented.

### 5. Accessibility — this one is load-bearing

CI already enforces "every chart has a visible text summary"
(`pnpm --filter @loro/mobile check:chart-summaries`). A forgetting curve is meaningless to a screen
reader as a path, so the text summary is not a checkbox: it is the accessible version of the screen.
Write it as a sentence a learner would actually want — "You'll likely recall this for about 9 more
days; review is scheduled for Thursday" — not as coordinates.

### 6. Lapses and the shape of failure

`FsrsState.lapses` exists. Showing a learner where their curve collapsed is genuinely useful and
also the easiest place in the app to accidentally shame someone (non-negotiable #3). Mark lapses
neutrally as information — "this one needed a reset" — and check the copy against
`docs/design/copy-and-tone.md`.

## Acceptance criteria

- The curve is drawn from real `stability`; changing a review changes the curve.
- The 50% threshold marker and the displayed next-review date agree.
- A never-reviewed phrase shows no fabricated curve, and the label explains why.
- Stability is reported in days with a unit and a gloss.
- The confidence control shares one grade-mapping implementation with the Review session.
- The chart's text summary reads as a useful sentence and passes the a11y gate.
- Lapses are shown without blame.
- No PRNG, no interpolation, no default stability anywhere in the screen — verified by review and by
  a grep gate if practical.

## Tests

- View-model tests across states: never reviewed, one review, many reviews, lapsed, graduated.
- A golden test: fixed FSRS state → expected curve sample points and threshold date.
- Text-summary test asserting the sentence contains the real interval.

## Out of scope

Aggregate library-wide memory visualisations (that is the Progress screen) and FSRS weight tuning.
