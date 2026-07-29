# Screen 5 — Speak to progress: the production gate

- **Requirement IDs:** `P3-20`…`P3-28`, `AS-03`
- **Milestone:** M2 — on the roadmap's **never cut** list
- **Blueprint:** `Loro.dc.html:688–739`, logic `SpkLogic` `2634–2740`
- **Spec:** `docs/product/functional-spec.md#5-speak-to-progress`
- **Screenshots:** `02-dev.png`, `g2.png`
- **Size:** M
- **Depends on:** [asr-speech-module.md](12-asr-speech-module.md)

## What this screen is

The gate that makes the whole app's claim credible: **the phrase does not count until the learner
has said the whole thing**. `GateSpec` already models it — `{ kind: 'asr-full' }` and
`{ kind: 'asr-partial', minTokens }` with the comment "The WHOLE phrase must be produced. The
production gate." (`packages/core/src/engines/types.ts:35`).

The matching logic is already built and tested in Rust (`packages/core-rs/src/asr.rs`, 9 tests) with
the three properties the screen depends on: order matters, ASR insertions are tolerated, and
progress is monotonic — partial credit is never lost.

## The work

### 1. The screen

Port `SpkLogic.renderVals()` (`2634–2740`). The core interaction: the target phrase renders as
tokens, each hidden until produced; speaking reveals them left to right; the just-revealed token
highlights (`MatchResult.just_index`, which exists for exactly this); completing all tokens passes
the gate.

### 2. Live token reveal

Partial ASR results stream in and each is matched through `core-rs::asr::match_tokens` with the
current `revealed` count. Never re-match from zero — monotonicity is a property of the algorithm and
re-matching would let a token un-reveal, which reads as the app taking progress away.

### 3. The reveal fallback (`P3-26`)

The rung that makes the gate shippable when ASR cannot work — no offline model, a loud room, a
denied mic permission, or a learner who cannot speak aloud right now. Tap to reveal a token,
self-report at the end. It must still write the full `ProgressDelta` (rule 5), because a learner who
used the fallback still practised.

Make the fallback **visibly a fallback** without making it feel like failure. The copy rules are in
`docs/design/copy-and-tone.md`.

### 4. Every failure state, deliberately

Each of these is reachable on a real device and each needs a designed state, not an error toast:

| State                          | Behaviour                                                                                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mic permission denied          | Explain once, offer the reveal fallback, never re-prompt in a loop                                                                                                  |
| No `es-ES` offline model       | `degraded` availability, actionable message, fallback available                                                                                                     |
| Recogniser returns nothing     | Retry affordance; no "you failed" framing                                                                                                                           |
| Recogniser returns wrong words | Show what was heard, so the learner can tell mis-recognition from mis-pronunciation. This distinction is the difference between a useful gate and a frustrating one |
| Very long phrase               | Partial gate (`asr-partial`, `minTokens`) rather than all-or-nothing                                                                                                |
| Learner gives up               | Skip is always available and writes `outcome: 'skipped'` honestly                                                                                                   |

### 5. Latency, measured here

This screen is where onset-derived latency becomes real
([fix-latency-measurement.md](03-fix-latency-measurement.md)). `null` when onset was not detected;
the read-out hides rather than estimates.

### 6. Fuzzy matching stays off

`asr.rs` documents `fuzzy` as off by default because loosening the gate is a pedagogical decision.
Keep it flagged, log when it is on, and do not enable it to compensate for recogniser quality —
measure instead ([experimentation-and-flags.md](33-experimentation-and-flags.md)).

## Acceptance criteria

- Speaking the phrase reveals tokens progressively and completes the gate.
- Revealed tokens never un-reveal.
- ASR noise between target words does not break matching (property inherited from `asr.rs`).
- Words spoken out of order do not advance the gate.
- Every state in the table above renders as designed, verified on a physical device.
- The reveal fallback writes the same progress deltas as a spoken pass.
- What the recogniser heard is visible on a mismatch.
- Latency is measured or hidden; never estimated.
- All four a11y gates pass; the screen is completable by a learner who cannot use the mic.

## Tests

- Transcript fixtures through the real Rust matcher: exact, with insertions, out of order, partial,
  empty, and hallucinated-Spanish.
- Component tests for each failure state.
- A device pass in a quiet room and a loud one — `docs/process/qa-device-matrix.md` audio QA.
- False-accept measurement: a set of takes that say something _else_ must not pass the gate.

## Risks

- **`es-ES` on-device recogniser quality** is a named long-lead risk. If the false-reject rate is
  high for real learners, the answer is the partial gate and the reveal fallback, not fuzzy
  matching.
- **Accessibility**: this screen is the clearest instance of Q-10 (a text-production mode for deaf
  learners). The reveal fallback is adjacent to that answer but is not it — typing the phrase would
  be. Flag it to the open question rather than quietly deciding.

## Out of scope

Pronunciation _quality_ scoring — that is the Pronunciation lab. This gate cares that the words were
produced, not how well.
