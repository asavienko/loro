# Evidence-gated DSP, Pronunciation, and Prosody labs

- **Requirement IDs:** `P3C-01`…`P3C-08`, `P3D-01`…`P3D-11`, `P3D-13`, `P3D-14`, `AS-05`, `AS-06`
- **Milestone:** spike M1 background track; product M3
- **Status:** Blocked until the spike quality gate passes
- **Depends on:** 60 units/bindings, 61 approved reference assets, 62/63 native audio/capture, 72
  native quality harness

## Outcome

First, a throwaway but reproducible spike proves real Spanish recordings can produce useful,
native-speaker-approved feedback on floor devices. Only then does production DSP and the two lab
screens ship. Failure triggers redesign, not fake scores.

## Spike gate

1. Build a consented corpus with the documented phrase/speaker/accent/device/noise matrix and an
   independent native-speaker annotation protocol.
2. Implement/offline-evaluate F0 extraction, voiced gaps, alignment candidates, score correlation,
   worst-segment selection, latency, memory, and battery.
3. Pre-register thresholds and decision owners. At minimum use the roadmap's agreement gate; record
   confidence intervals and failure clusters, not one average.
4. If the gate fails, redesign/limit/cancel the labs and update specs before production work.

## Production work after gate

5. Implement preprocessing, pitch/MFCC features, banded DTW/forced alignment, calibrated scoring,
   one-action feedback, units, invalid/insufficient-signal states, and native-thread cancellation.
6. Build Pronunciation waveform/syllable/score and Prosody contour/rhythm/skill/cue surfaces from
   real outputs with accessible summaries and privacy copy.
7. Add golden corpus, properties, cross-platform parity, adversarial/noise/silence/short/long takes,
   calibration drift, and device-floor performance tests.

## Acceptance criteria

- No production lab code or displayed score ships before the recorded spike decision passes.
- PCM crosses modules by opaque native handle and never reaches JS/network.
- Scores are reproducible/calibrated, and invalid input yields no fabricated number.
- Native speakers meet the approved agreement target on held-out recordings.

## Out of scope

Clinical/accent diagnosis, punitive scoring, cloud audio analysis, and voice cloning.
