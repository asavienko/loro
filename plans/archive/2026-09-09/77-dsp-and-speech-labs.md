# Evidence-gated DSP, Pronunciation, and Prosody labs

- **Requirement IDs:** `P3C-01`…`P3C-08`, `P3D-01`…`P3D-11`, `P3D-13`, `P3D-14`, `AS-05`, `AS-06`
- **Milestone:** spike M1 background track; product M3
- **Status:** 🟡 DSP helper functions and an M1 derived-evidence evaluator exist. The consented
  corpus, actual offline pipeline evaluation, and production pipeline/labs remain; production is
  blocked until the recorded quality gate passes. Device evaluation needs 58/61–63.
- **Depends on:** 60 units/bindings; 58 device substrate; 61 approved references; 62/63 capture; 72
  shared harness for device evaluation.
- **Reviewed:** 2026-09-07 against merged baseline `2d9e8c3`.

**Archive disposition (2026-09-09):** Archived at user request after implemented slices landed. The
partial status and remaining acceptance criteria are retained; archival does not mark this plan
complete. The roadmap index continues to track its unfinished scope.

## Verified starting point

`packages/core-rs/src/dsp/` contains tested normalization/band/correlation helpers, while pitch,
alignment, scoring and pipeline remain unimplemented. No golden corpus/test target exists. The local
[`dsp spike evidence protocol`](../../../docs/process/dsp-spike-evidence.md) evaluates only
de-identified derived study results and independent annotations; it cannot read recordings or make
the acoustic pipeline/device evidence exist. Spanish-first spike scope does not enable
Bulgarian/Russian scoring; each target needs its own evidence and references.

## Outcome

First, a throwaway but reproducible spike proves real Spanish recordings can produce useful,
native-speaker-approved feedback on floor devices. Only then does production DSP and the two lab
screens ship. Failure triggers redesign, not fake scores.

## Spike gate

1. [ ] Build a consented corpus with the documented phrase/speaker/accent/device/noise matrix and an
       independent native-speaker annotation protocol.
2. [ ] Implement/offline-evaluate F0 extraction, voiced gaps, alignment candidates, score
       correlation, worst-segment selection, latency, memory, and battery.
3. [x] Pre-register M1 thresholds, `core-owner` as decision owner, confidence intervals and
       device/speaker-kind/noise-class clusters in the derived-evidence evaluator. It is preparation
       only: actual results still require the consented corpus and offline pipeline evaluation.
4. [ ] If the gate fails, redesign/limit/cancel the labs and update specs before production work.

## Production work after the gate

5. [ ] Implement preprocessing, pitch/MFCC features, banded DTW/forced alignment, calibrated
       scoring, one-action feedback, units, invalid/insufficient-signal states, and native-thread
       cancellation.
6. [ ] Build Pronunciation waveform/syllable/score and Prosody contour/rhythm/skill/cue surfaces
       from real outputs with accessible summaries and privacy copy.
7. [ ] Add golden corpus, properties, cross-platform parity, adversarial/noise/silence/short/long
       takes, calibration drift, and device-floor performance tests.

## Acceptance criteria

- No production lab code or displayed score ships before the recorded spike decision passes.
- PCM crosses modules by opaque native handle and never reaches JS/network.
- Scores are reproducible/calibrated, and invalid input yields no fabricated number.
- Native speakers meet the approved agreement target on held-out recordings.

## Out of scope

Clinical/accent diagnosis, punitive scoring, cloud audio analysis, and voice cloning.

## Post-main review and archive disposition — 2026-09-09

The [review at `de81744`](../../../docs/reviews/2026-09-09-post-main-plan-review.md) records this
plan's current contribution, remaining work and gates. [Delivered slices](IMPLEMENTED-SLICES.md) are
retained in the archive; this plan remains incomplete. Earlier verification is dated evidence, not
acceptance of the current combined branch.
