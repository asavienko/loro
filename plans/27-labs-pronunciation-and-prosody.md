# Screens 9 & 10 — the Pronunciation lab and the Prosody lab

- **Requirement IDs:** `P3C-01`…`P3C-08`, `P3D-01`…`P3D-11`, `P3D-13`, `P3D-14`, `AS-05`, `AS-06`
- **Milestone:** M3 (v1.1) — **highest technical risk in the project**
- **Blueprint:** Pronunciation `1051–1110` (`PronLogic` `3047–3120`); Prosody `1124–1291`
  (`ProLogic` `3122–3293`) ★
- **Spec:** `functional-spec.md#9-pronunciation-lab`, `#10-prosody-lab`
- **Screenshots:** `03-adv.png`, `h1.png`, `04-adv.png`, `ph-prosody.png`, `i1.png`, `i2.png`
- **Size:** XL
- **Depends on:** [prosody-dsp-spike-and-pipeline.md](19-prosody-dsp-spike-and-pipeline.md),
  [asr-speech-module.md](12-asr-speech-module.md),
  [content-scale-to-600.md](36-content-scale-to-600.md)
- **Non-negotiables touched:** #1 (audio never leaves the device — printed on this very screen), #2
  (real scores)

## The gate before any of this ships

`docs/product/roadmap.md`, M3 exit criteria:

> A native Spanish speaker agrees with the pronunciation and prosody scores on 20 recorded takes
> ≥80% of the time. **If not, the labs don't ship — a wrong score is worse than no score.**

That is the acceptance criterion for this plan, and it is not negotiable by shipping a "beta" label.
The M1 spike ([prosody-dsp-spike-and-pipeline.md](19-prosody-dsp-spike-and-pipeline.md)) decides
whether this plan is buildable at all; run it first.

## What the blueprint fakes, and must not be carried over

`CLAUDE.md` names the lines:

- `Loro.dc.html:3068` / `3079` — a **seeded PRNG** generating pronunciation scores.
- `Loro.dc.html:3158` — a **linear contour blend** standing in for a learner's F0 track.
- `Loro.dc.html:3377` — a **formula** for latency.

The prototype is convincing precisely because those numbers look plausible. Porting the screen means
porting the _layout and interaction_, and replacing the numeric core with the real pipeline. The
divergence table at the end of `docs/design/screen-catalog.md` is the checklist.

## Prosody lab (screen 10)

The starred screen, and the one that prints the privacy promise: `Loro.dc.html:1281` tells the
learner their recording stays on the device. That makes non-negotiable #1 a property of this
screen's implementation — PCM by handle only, no bytes across the JS bridge
([asr-speech-module.md](12-asr-speech-module.md) owns the module contract).

Components:

1. **Contour comparison.** The native reference contour (`f0_display`, 14 normalised points —
   `core-rs/src/dsp/score.rs Reference`) against the learner's real extracted F0. Off-target points
   are marked using `OFF_TARGET_THRESHOLD = 0.15`, a constant taken from the blueprint (`3220`) so
   "the visual meaning must not drift".
2. **The melody score**, `0.6 * similarity + 0.4 * max(0, correlation)`, clamped 40..99 — never 0,
   never 100, because neither is honest (`score.rs:39`).
3. **The cue ladder** (`P3D-13`). Cue level 0..3 on `PhraseState.cue_level`, levelling up at
   `LEVEL_UP_THRESHOLD = 88` — which `score.rs:44` flags as tunable "because we genuinely don't know
   the right value yet". So it is a flag, and it is an experiment
   ([experimentation-and-flags.md](33-experimentation-and-flags.md)).
4. **One fix per attempt.** `core-rs/src/dsp/feedback.rs` is already implemented and tested; the
   ladder only works if the learner has exactly one thing to change.
5. **Stress and rhythm** feedback (`P3D-14`, `prosody-dsp.md:191`).

## Pronunciation lab (screen 9)

1. **Per-syllable scoring** from forced alignment, weighted
   `0.6 * spectral + 0.25 * duration + 0.15 * voicing` (`score.rs:33–38`). Needs `syl`
   (syllabification) on every phrase — a content dependency, not an app one.
2. **The worst syllable**, surfaced. `ScoreBreakdown` already carries `worstSyllableIndex` and
   `fixCode` (`packages/core/src/engines/types.ts:72`).
3. **The three skill axes** (`prosody-dsp.md:205`) — where `axPerception`/`axRecall`/`axProduction`
   finally get real values. The current engines emit fixed progression increments, explicitly hidden
   from learner-facing UI until DSP exists; the labs replace those inputs with measured
   signal-derived deltas.

## Both labs

- **Engines, not screens.** `ProsodyEngine` and `PronunciationEngine` implementing `PracticeEngine`,
  both passing the conformance suite, both maintaining every rule-5 signal. The screens render items
  and submit attempts.
- **A score you cannot compute is `null`.** Alignment can fail; a take can be too quiet; the
  reference data can be missing for a phrase. Each produces "we couldn't score that" with a reason
  and a retry — not a low score. A low score means "you did badly", and saying that when the truth
  is "we failed" is the exact failure mode the M3 gate exists to prevent.
- **Reference data gating.** A phrase without `f0_native`/`syl` cannot be used in the labs. The
  engines' `availability()` must report that honestly per phrase, and the UI must not offer the lab
  for phrases that lack it.
- **Performance.** `prosody-dsp.md:282` sets the budget; Criterion benches already fail CI on >10%
  regression. Measure on the device floor, not a laptop.

## Acceptance criteria

- No PRNG, no linear blend, no simulated score in the shipped path — grep-gated in CI.
- Scores come from `core-rs` DSP on real recorded audio, reproducibly (same PCM → same score, all
  platforms).
- The ≥80% native-speaker agreement gate is met on 20 takes, documented, before release.
- Recorded audio never crosses the JS boundary; the printed promise holds.
- Exactly one fix is surfaced per attempt; the cue ladder advances at the flagged threshold.
- Unscoreable takes say so with a reason; no low score stands in for a failure.
- Phrases lacking reference data do not offer the labs.
- Skill axes derive from real scores.
- Within the performance budget on the floor device.

## Tests

- Golden corpus from the spike: every recorded take has a committed expected score; drift fails CI.
- Property tests: a take compared against itself scores at the ceiling; noise near the floor;
  obvious degradations score monotonically worse.
- Failure-path tests: alignment failure, too-quiet take, missing reference data.
- Cross-platform determinism.
- Engine conformance for both engines.

## Risks

- **The spike may say no.** Then this plan is replaced by a redesign, before M3 starts, not during.
- **Content dependency.** `f0_native` and `syl` for 1 200 phrases is the M3 content target; the labs
  are blocked on it for any phrase it does not cover.
- **A convincing wrong score is the worst outcome available.** Prefer refusing to score.

## Out of scope

Voice conversion / "hear myself, perfectly" (`P3D-12`, `AI-04`) — v2 and opt-in.
