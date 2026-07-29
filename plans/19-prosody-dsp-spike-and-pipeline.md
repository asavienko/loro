# The prosody DSP: the M1 spike first, then the pipeline

- **Requirement IDs:** `P3D-01`…`P3D-11`, `P3D-13`, `P3D-14`, `P3C-01`…`P3C-08`, `AS-05`, `AS-06`
- **Milestone:** spike in **M1**, pipeline in M3
- **Size:** spike M · pipeline XL
- **Non-negotiables touched:** #1 (audio never leaves the device), #2 (scores come from real signal
  processing)

## Current state

`packages/core-rs/src/dsp/` is scaffolding with the honest parts implemented and four `todo!`s at
the centre:

| File          | Implemented                                                                                                | `todo!`                                                              |
| ------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `pitch.rs`    | `median_filter`, all constants (`F0_MIN_HZ` 60, `F0_MAX_HZ` 400, `YIN_THRESHOLD` 0.15)                     | `extract()` — YIN over 25 ms/10 ms frames                            |
| `align.rs`    | —                                                                                                          | banded DTW + span mapping                                            |
| `score.rs`    | `pearson`, all weights (`W_SIMILARITY` 0.6 / `W_CORRELATION` 0.4), floors (`SCORE_MIN` 40, `SCORE_MAX` 99) | the score itself                                                     |
| `mod.rs`      | —                                                                                                          | the pipeline: pre-process → F0 + MFCC → DTW → score → select one fix |
| `feedback.rs` | fix selection (7 tests)                                                                                    | —                                                                    |

The blueprint prototypes these numbers with fake data, and `CLAUDE.md` names the exact lines that
must not be carried over: a seeded PRNG for pronunciation scores (`Loro.dc.html:3068`/`3079`), a
formula for latency (`3377`), a linear contour blend (`3158`). So there is a working-looking demo
whose implementation is forbidden — which is exactly why this is the highest-risk work in the
project.

## The spike comes first, and it is the whole point

`docs/product/roadmap.md` says it plainly: a throwaway spike, **starting in M1 as a background
track** — and if it "can't produce a score a native speaker agrees with, the prosody lab is
redesigned _before_ M3 starts, not during." `docs/architecture/prosody-dsp.md:309` specifies it.

### The spike (do this before writing any pipeline code)

1. **Collect real audio.** 20 `es-ES` phrases from the catalog, each with (a) a native reference
   take and (b) 5–10 learner takes spanning genuinely good to genuinely bad prosody. Consented, and
   stored under the one path `.gitignore` allows: `packages/core-rs/tests/golden/recordings/`.
2. **Implement F0 extraction only** — YIN per `pitch.rs`, on real audio, in Rust.
3. **Run it on the device floor**, not a laptop. The budget is `prosody-dsp.md:282`; `pitch.rs:31`
   says ≤60 ms for 2 s of audio. A desktop measurement proves nothing about a mid-range Android.
4. **Blind-rate the takes** with a native Spanish speaker, then correlate. The M3 release gate is
   agreement on ≥80% of 20 recorded takes (`roadmap.md`, M3 exit criteria).
5. **Write up the result either way.** A spike that says "this does not work" is the most valuable
   output available here, because it saves an 8-week milestone. Record it as an ADR amendment, not a
   Slack message.

The spike is throwaway code and should be labelled as such — but the **recordings and the ratings
are permanent assets**. They become the golden corpus (`prosody-dsp.md:339` — "golden tests,
forever").

## The pipeline (M3, gated on the spike)

### 1. Pre-processing (`prosody-dsp.md:73`)

16 kHz mono, DC removal, normalisation, trim to speech. Deterministic — same input, same output, on
every platform.

### 2. Features (`:90`)

F0 via YIN (median filter and gap interpolation are already specified and `median_filter` is already
written), MFCC, energy. `pitch.rs` constants are decided; do not re-derive them.

### 3. Forced alignment (`:126`)

Banded DTW against the reference MFCC, then map reference syllable spans through the warping path.
Banded, not full — the band is what keeps it inside the budget.

### 4. Scoring (`:155`)

- Melody: `0.6 * similarity + 0.4 * max(0, correlation)`, clamped 40..99. The clamp is a deliberate
  honesty choice — `score.rs:39` says "we never show 0 or 100 — neither is honest."
- Per-syllable: `0.6 * spectral + 0.25 * duration + 0.15 * voicing`.
- Stress and rhythm (`:191`), and the three skill axes (`:205`) — which is where `axPerception`,
  `axRecall`, `axProduction` finally get real values. The store no longer invents them, but the
  engines still emit fixed increments (`RefrainEngine.record()` and `StreamEngine.record()`); those
  values are deliberately not displayed and must be replaced, not reinterpreted as DSP scores.

### 5. One fix, selected (`:222`)

`feedback.rs` is already implemented and tested. The pipeline's job is to hand it real data. **One**
fix per attempt — the cue ladder depends on the learner having exactly one thing to change.

### 6. Reference data (`:263`)

`f0_native`, `syl`, and quantised reference MFCC are content-build outputs, per phrase, for the
whole catalog ([content-scale-to-600.md](36-content-scale-to-600.md)). Without them there is nothing
to compare against, so content and DSP are the same critical path.

## Acceptance criteria

**Spike:** F0 extraction runs on real `es-ES` audio within budget on the device floor, and a native
speaker agrees with the resulting melody ranking on ≥80% of 20 takes — or a written redesign
recommendation lands before M3 planning.

**Pipeline:**

- No `todo!` in `packages/core-rs/src/dsp/`.
- No PRNG, no linear blend, no simulated score anywhere in the path — verified by grep in CI.
- Scores are reproducible: same PCM in, identical score out, on iOS, Android, and host.
- Full pipeline within the budget in `prosody-dsp.md:282`, measured on the device floor.
- Audio never crosses the JS boundary ([asr-speech-module.md](12-asr-speech-module.md) owns that
  constraint).
- Exactly one fix is surfaced per attempt.
- Skill axes derive from real scores.

## Tests

- Golden corpus: every recorded take has a committed expected score; the suite fails on drift and
  the diff is reviewable. Criterion benches already run in CI's `budgets` job (>10% regression
  fails) — extend them to the DSP path.
- Property tests: identical input to itself scores at the ceiling; noise scores near the floor;
  scores are monotonic in obvious degradations (pitch-flattened, time-scrambled).
- Cross-platform determinism test.

## Risks

- **The spike may fail**, and that is the designed outcome to allow for. Do not let the pipeline
  start before the spike reports.
- **Reference data quality** gates everything. A bad `f0_native` produces a confidently wrong score,
  and a wrong score is worse than no score (`roadmap.md`, M3 exit criteria).
- **Budget on the floor device.** DTW is the expensive step; the banding parameter is the lever.

## Out of scope

Voice conversion / "hear myself, perfectly" (`P3D-12`, `AI-04`) — v2, opt-in. And anything in
`prosody-dsp.md:347` ("what we are explicitly not building").
