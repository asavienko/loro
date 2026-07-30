# Screen 6 — Review session, tag-aware SRS

- **Requirement IDs:** `P3-30`…`P3-40`
- **Milestone:** M3 (v1.1)
- **Blueprint:** `Loro.dc.html:750–821`, logic `RevLogic` `2742–2813`
- **Spec:** `docs/product/functional-spec.md#6-review-session`
- **Screenshots:** `03-dev.png`, `04-dev.png`
- **Size:** M
- **Depends on:** [fsrs-implementation-and-parity.md](17-fsrs-implementation-and-parity.md)
- **Non-negotiables touched:** #2 (real numbers), #3 (no shaming)

## Why it is gated on FSRS

The Review session is the surface where FSRS becomes visible. It cannot ship on the fabricated
interval table currently in `apps/mobile/src/store/index.ts:312` —
`docs/architecture/scheduling.md:124` is titled "Displayed intervals must be real", and this screen
displays them.

## What makes it _tag-aware_

The differentiator, and the reason this is not a generic SRS screen. The learner's declared tags
(`pron`, `remember`, `useful`, `words` — `core-rs/src/lib.rs Tag`) describe **what is tricky about
the phrase**, never its magnitude. That changes what a review looks like:

- `pron` → the review prompts _production_, not recognition. Getting the meaning right is not the
  problem for this phrase.
- `remember` → meaning-first recall, cloze, the hook from the content's rich fields.
- `words` → the specific lexical items get isolated.
- `useful` → surfaces more often and earlier in the trip arc.

`docs/architecture/scheduling.md:101` ("Learner-declared difficulty as a prior") is the scheduling
half of the same idea. Together they are the "connective thread" the whole product rests on — which
is why Q-03 ("does learner-declared difficulty stay accurate over weeks?") is called the most
important open question in the product. **This screen is the main place that question gets
measured.**

## The work

1. **Port `RevLogic.renderVals()`** (`2742–2813`) — the queue, the card, the grading control, the
   session summary.
2. **The engine, not the screen, owns the logic.** Implement `SrsEngine` in
   `packages/core/src/engines/srs/` against the existing `PracticeEngine` contract, and make it pass
   the conformance suite (`packages/core/src/engines/conformance.ts`). The screen renders
   `PracticeItem`s and submits `Attempt`s; it computes nothing.
3. **Grade mapping.** The five-level confidence rating maps to four FSRS grades with `Strong` →
   `Good` plus a caller-applied stability bonus (`core-rs/src/fsrs/mod.rs`). Implement the bonus;
   the module docs say it is the caller's job and the caller does not exist yet.
4. **Daily load cap** (`scheduling.md:139`). A learner who has been away for three weeks must not
   open a 400-card queue. Cap it, and — non-negotiable #3 — present the cap as _today's review_, not
   as a backlog with a debt counter. The Refrain's "you always see today" framing is the model to
   copy.
5. **Real intervals, honestly formatted.** `formatInterval` (`src/lib/format.ts:15`) renders
   `~10 min` for anything under 0.9 days, which conflates ten minutes with twenty hours. Fix it
   against what FSRS actually returns for a lapse.
6. **Rule 5 deltas.** The SRS engine maintains automaticity, ladder rung, and skill axes even though
   it displays none of them — that is what makes engine switching lossless and the loop experiment
   interpretable.
7. **Tag predictiveness telemetry.** Log declared difficulty/tags alongside the review outcome so
   the AUC target of ≥0.65 in `docs/architecture/observability.md#learning-quality-telemetry` can
   actually be computed. Without this instrumentation the screen ships and Q-03 stays unanswerable.
8. **The drift-correction seam.** Q-03's stated remedy is nudging FSRS difficulty from observed
   performance and prompting a re-rate when the two disagree strongly. Do not build it yet — but put
   the comparison in the data model so the feature is a query away rather than a migration away.

## Acceptance criteria

- No fabricated intervals; every displayed interval comes from `core-rs::fsrs`.
- Tags change the review mode as specified; a `pron`-tagged phrase asks for production.
- The five-level confidence control maps to grades correctly, including the `Strong` bonus.
- A three-week absence yields a capped, calm session with no debt framing anywhere in the copy.
- `SrsEngine` passes the conformance suite, including the rule-5 signals it never displays.
- Review outcomes and the declared prior are both logged, so tag predictiveness is computable.
- Empty state (nothing due) is a designed, positive screen — not an error.

## Tests

- Engine conformance suite (existing).
- Grade-mapping table test including the bonus.
- Load-cap test: 400 due cards → a capped session, no backlog counter in the view model.
- A golden 60-day simulated review history asserting the interval sequence.
- Copy audit against `docs/design/copy-and-tone.md` for the returning-learner case.

## Out of scope

The Memory-model visualisation ([screen-memory-model.md](25-screen-memory-model.md)) and FSRS weight
optimisation from the learner's own history.
