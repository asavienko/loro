# M1 DSP spike evidence protocol

This protocol prepares the evidence gate in
[plan 77](../../plans/archive/2026-09-09/77-dsp-and-speech-labs.md). It does not implement DSP,
capture, calibration, device quality, or a learner surface. The only per-take inputs accepted by the
evaluator are derived score and worst-syllable candidate plus two independent human annotations. It
rejects raw audio, PCM, native buffer identifiers, transcripts, paths, and identifying fields.

## Preregistered M1 study

The study is Spanish (`es-ES`) only. It has 20 phrases, five pseudonymous speakers (two native and
three English-speaking learners at different levels), and both a mid-range Android device and an
iPhone: 200 phrase/speaker/device takes. Two independently working native-Spanish reviewers record a
1–5 quality rating and their worst-syllable judgement for every take. Resolve reviewer disagreement
before analysis; the evaluator intentionally refuses to hide it by selecting a preferred label.

The decision owner is `core-owner`. A completed derived-results file is evaluated locally:

```bash
node scripts/dsp-spike-evidence.mjs path/to/derived-study.json
```

The script reports Spearman correlation against the mean independent rating, worst-syllable
agreement, deterministic bootstrap 95% intervals, and device, speaker-kind, and noise-class
clusters. Every take declares its noise class so the study can expose a failure cluster instead of
hiding it in an average. It exits zero only when the M1 point gates pass: correlation at least 0.6
and worst-syllable agreement at least 70%. The intervals and clusters are evidence for the decision,
not extra, unapproved pass criteria.

The input and report belong in the separately governed consented-study store, never in the product
repository, telemetry, content packs, sync data, or a learner device database. No report from this
tool closes the M3 device-quality, calibration, latency, memory, battery, recording-golden, or
native-speaker release gates.

If either M1 point gate fails, the decision is failure and the plan requires a redesigned or reduced
lab before any production integration. A passing M1 result only authorizes moving to the explicitly
gated production work in plan 77.
