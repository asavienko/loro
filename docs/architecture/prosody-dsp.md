# Prosody and pronunciation DSP

The signal processing behind the two labs. This is the highest-technical-risk part of the project
and the part where the product is most exposed to dishonesty, so it gets its own document and its
own validation gate.

**The rule this document exists to enforce:** the blueprint fakes these scores with a seeded PRNG
(`Loro.dc.html:3068`, `3079`) and a linear blend toward the native contour (`3158–3161`). That is
correct for a prototype and unacceptable in a product. **A wrong score is worse than no score** — it
teaches the learner the wrong thing and destroys trust in the one screen that most differentiates
Loro.

---

## What the labs claim

| Screen                | Claims to the learner                                                                                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pronunciation lab** | A 0–99 accuracy number per _syllable_, an overall score, and one concrete articulatory fix                                                                              |
| **Prosody lab**       | Their pitch contour against a native's, an off-target marker per point, per-syllable stress and duration vs native, a melody score, and a delta against their last take |

Every one of those is a measurable acoustic property. None requires a model we can't run on-device.
What they require is care.

---

## Pipeline

Everything below runs **on-device**, in `loro-core` (Rust), on a native thread, from a PCM buffer
that never leaves native memory.

```
                   ┌──────────────────────────────────────────────┐
 native PCM  ─────▶│ 1. Pre-process                               │
 16 kHz mono       │    DC removal · pre-emphasis · frame 25 ms /  │
 (UNPROCESSED)     │    hop 10 ms · Hann window                    │
                   └──────────────────┬───────────────────────────┘
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          ▼                           ▼                           ▼
 ┌────────────────┐        ┌────────────────────┐      ┌────────────────────┐
 │ 2a. F0 track   │        │ 2b. Features       │      │ 2c. Energy         │
 │ YIN / pYIN     │        │ 13 MFCC + Δ + ΔΔ   │      │ RMS envelope       │
 │ + voicing      │        │                    │      │                    │
 └───────┬────────┘        └─────────┬──────────┘      └─────────┬──────────┘
         │                           │                            │
         │                           ▼                            │
         │                 ┌────────────────────┐                 │
         │                 │ 3. Forced alignment│◀── expected     │
         │                 │    DTW to native   │    syllables     │
         │                 │    reference MFCC  │    (syl[], IPA)  │
         │                 └─────────┬──────────┘                 │
         │                           │ per-syllable spans          │
         ▼                           ▼                            ▼
 ┌──────────────────────────────────────────────────────────────────────┐
 │ 4. Scoring                                                           │
 │   • contour similarity  (normalised F0, DTW-aligned)                 │
 │   • per-syllable acoustic distance → 0–99                            │
 │   • stress  (energy + duration + F0 peak per syllable)               │
 │   • rhythm  (relative syllable durations)                            │
 └──────────────────────────────┬───────────────────────────────────────┘
                                ▼
 ┌──────────────────────────────────────────────────────────────────────┐
 │ 5. Feedback selection                                                │
 │    worst syllable → phoneme class → one concrete articulatory fix    │
 └──────────────────────────────────────────────────────────────────────┘
                                ▼
                      buffer released · scores persisted
```

---

## 1 · Pre-processing

| Step         | Setting                                  | Why                                                                                                                                                                    |
| ------------ | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sample rate  | 16 kHz mono                              | Sufficient for F0 (50–400 Hz) and MFCC; a quarter of the data of 44.1 kHz                                                                                              |
| Input source | `UNPROCESSED` / `.measurement`           | **Critical.** Platform AGC, noise suppression, and EQ distort both amplitude envelope and pitch. Enabled preprocessing would make stress and melody scores meaningless |
| DC removal   | high-pass 60 Hz                          | Removes rumble below the pitch range                                                                                                                                   |
| Pre-emphasis | `y[n] = x[n] − 0.97·x[n−1]`              | Standard for MFCC                                                                                                                                                      |
| Framing      | 25 ms window, 10 ms hop, Hann            | Standard; 10 ms hop gives ~100 F0 points/second                                                                                                                        |
| Noise gate   | estimate the floor from the first 100 ms | Reject takes with SNR < 10 dB rather than scoring them                                                                                                                 |

**Reject, don't guess.** If SNR is too low, or the take is shorter than 60% of the reference
duration, or no voiced frames are found, the result is _"Couldn't hear that clearly — try again"_ —
never a low score. Punishing a learner for a noisy café is a bug.

---

## 2 · Feature extraction

### F0 (pitch)

**YIN** as the baseline (cheap, robust, well-understood), with **pYIN** behind a flag for a
probabilistic voicing decision if YIN's octave errors prove problematic in validation.

| Parameter       | Value                                                                                              |
| --------------- | -------------------------------------------------------------------------------------------------- |
| Range           | 60–400 Hz (covers adult male through adult female Spanish speech)                                  |
| Threshold       | 0.15                                                                                               |
| Voicing         | aperiodicity < threshold ∧ RMS above the noise floor                                               |
| Post-processing | median filter (5 frames) to remove octave jumps; linear interpolation across unvoiced gaps < 60 ms |

**Normalisation** — this is what makes the comparison fair. A learner's absolute pitch is
irrelevant; the _shape_ is the skill.

```
semitones(f) = 12 · log2(f / median_voiced_f0)
normalised   = clamp((semitones + 12) / 24, 0, 1)     → the 0..1 range the UI draws
```

Both the native reference and the learner's take are normalised the same way, so a bass and a
soprano producing the same question intonation get the same contour.

### MFCC

13 coefficients + Δ + ΔΔ, 26 mel filters, 0–8 kHz. Used only for alignment and per-syllable
distance, never displayed.

### Energy

RMS per frame, dB-scaled, used for stress and for onset detection.

---

## 3 · Forced alignment

We need to know which frames belong to which syllable. Two options, and we take the cheap one first
deliberately:

| Approach                                       | Cost                                  | Accuracy                                                                                 | Decision                     |
| ---------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------- |
| **DTW against the native reference**           | Low — no model, no training           | Good when the learner said roughly the right words (which the ASR gate already confirms) | **v1.1**                     |
| A real acoustic model (HMM/DNN forced aligner) | Ship a model, ~10–40 MB, per language | Better, especially for badly mispronounced syllables                                     | Only if DTW fails validation |

**Why DTW is defensible here.** The lab is always entered with a _known target phrase_, and the
speaking gate has already confirmed the learner said approximately the right thing. We are not doing
open-vocabulary recognition; we are time-warping one utterance of a known phrase onto a reference
utterance of the same phrase. That is DTW's home ground.

```
D = dtw(learner_mfcc, reference_mfcc, band = sakoe_chiba(0.2))
→ warping path → map reference syllable spans (from `syl[]`) onto learner frames
```

The reference syllable spans come from the catalog: `syl[]` with `dur` weights, produced at content
build time from the rendered native audio ([content-model.md](../product/content-model.md#audio)).

**Failure handling.** If the warping cost exceeds a threshold, the take is _unalignable_ — the
learner probably said something different. Result: "That didn't sound like the phrase — want to hear
it again?" Not a score.

---

## 4 · Scoring

### Melody score (Prosody lab)

```
similarity = 1 − mean(|learner_f0_aligned[i] − native_f0[i]|)      over voiced frames
correlation = pearson(learner_f0_aligned, native_f0)
melody = round(100 · (0.6·similarity + 0.4·max(0, correlation)))
melody = clamp(melody, 40, 99)
```

Correlation is weighted heavily because **shape matters more than absolute offset** — a learner
whose rise happens correctly but 2 semitones lower has good prosody.

**Off-target markers** — the blueprint draws a dot where the deviation exceeds 0.15 in normalised
units (`Loro.dc.html:3220`). We keep that threshold and that unit, so the visual meaning is
unchanged.

### Per-syllable accuracy (Pronunciation lab)

```
For each syllable span s:
  spectral   = 1 − normalised_dtw_cost(learner_mfcc[s], reference_mfcc[s])
  duration   = 1 − min(1, |dur_learner(s) − dur_ref(s)| / dur_ref(s))
  voicing    = agreement of voiced/unvoiced decisions across s
  score(s)   = round(100 · (0.6·spectral + 0.25·duration + 0.15·voicing))
  score(s)   = clamp(score(s), 40, 99)
```

Band colours are the blueprint's and must not drift: **≥85 green · ≥70 amber · <70 red**
(`Loro.dc.html:3083`).

> This is a _goodness-of-pronunciation approximation_, not a phoneme classifier. It reliably answers
> "which syllable was least like the model?" — which is exactly what the screen claims. It does not
> answer "was that a /r/ or a /ɾ/?", and the UI must never imply that it does.

### Stress and rhythm

```
For each syllable s:
  stress(s) = 0.5·norm(peak_rms(s)) + 0.3·norm(dur(s)) + 0.2·norm(peak_f0(s))
```

The blueprint's rhythm view draws paired native/learner bars per syllable, flexed by duration
(`Loro.dc.html:1215–1225`). Both series come from the same formula, so they're comparable.

The most common Spanish stress error for English speakers is placing stress too early (`ca-FÉ` →
`CA-fe`). Detecting a stress-position mismatch is a first-class result: _"Move the stress to the
end: ca-FÉ and fa-VOR."_

### The three skill axes

Per phrase, from the blueprint (`Loro.dc.html:3180–3182`) — kept exactly:

```
production += max(3, round((score − production) × 0.3))
recall     += (cue_level ≥ 2) ? 6 : 2
perception += 1
all clamped to 99
```

The asymmetry is the pedagogy: **Recall advances faster at high cue levels** because recalling
without cues is what trains recall. Production tracks the actual score. Perception creeps up from
mere exposure.

---

## 5 · Feedback selection

The single most valuable output, and the hardest to do without an LLM at runtime (which we won't do
— it's offline-only work).

**Approach: a curated fix per phoneme class, authored with the content.**

```
worst_syllable → its IPA content (from resp_ipa) → phoneme class → fix template
```

| Phoneme class        | Typical English-speaker error      | Fix copy                                                                                   |
| -------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------ |
| `ɾ` (single tap)     | Produced as English `r`            | "Tap the roof of your mouth once — closer to the _d_ in 'ladder' than an English r."       |
| `r` (trill)          | Not trilled                        | "The double _rr_ needs a real roll — flutter your tongue tip behind your teeth."           |
| `ɲ` (ñ)              | Produced as `n`                    | "Soften the _ñ_ — say 'ba-nyo', tongue to the roof of the mouth."                          |
| `β ð ɣ`              | Hard stops instead of approximants | "Let the _b_ soften — lips barely touching, not a hard English b."                         |
| `x` (j/g)            | Produced as `h`                    | "The _j_ is further back — a soft scrape in the throat."                                   |
| Vowels               | Diphthongised                      | "Keep the vowel pure — Spanish _e_ doesn't glide the way English 'ay' does."               |
| Stress position      | Too early                          | "Move the stress to the end: _ca-**FÉ**_."                                                 |
| Final-syllable pitch | Falls on a question                | "You flatten the ending — keep the pitch climbing. That rise is what makes it a question." |

The last two are verbatim from the blueprint (`Loro.dc.html:3056`, `3126`), which shows the intended
register: concrete, physical, one thing to change.

**Selection rules**

1. Take the lowest-scoring syllable. If several are within 5 points, prefer the earliest — fixing an
   early error often fixes what follows.
2. If a stress-position mismatch exists, it outranks any single-syllable fix. Stress errors are more
   damaging to intelligibility.
3. On the Prosody screen, a contour-shape mismatch (question rise, statement fall) outranks
   segmental fixes.
4. **Exactly one fix.** Never a list. The blueprint's every example is a single sentence.

Each catalog phrase also carries a hand-authored `note` used as the default coaching line
(`Loro.dc.html:3126`, `3131`, `3136`), which takes precedence when the detected error matches the
one the author anticipated.

---

## Native reference data

Built once, at content build time, from the rendered catalog audio:

| Field       | Contents                            | Size    |
| ----------- | ----------------------------------- | ------- |
| `f0_native` | 14-point normalised contour         | ~30 B   |
| `syl[]`     | `{ t, stress, dur }` per syllable   | ~120 B  |
| `resp_ipa`  | IPA for alignment and fix selection | ~60 B   |
| `mfcc_ref`  | Quantised reference MFCC for DTW    | ~2–6 KB |

`mfcc_ref` is the only large one. It's fetched with the pack when the labs are enabled and is not
part of the base catalog download.

The 14-point contour is what the _UI_ draws (matching the blueprint's `native` arrays at
`Loro.dc.html:3128`); scoring uses the full-resolution track.

---

## Performance budget

Measured on the device floor (see [`process/qa-device-matrix.md`](../process/qa-device-matrix.md)),
for a 2-second utterance:

| Stage              | Budget       | Notes                          |
| ------------------ | ------------ | ------------------------------ |
| Pre-processing     | 15 ms        |                                |
| F0 (YIN)           | 60 ms        | ~200 frames                    |
| MFCC               | 25 ms        |                                |
| DTW alignment      | 80 ms        | Sakoe-Chiba banded             |
| Scoring            | 10 ms        |                                |
| Feedback selection | 1 ms         | Table lookup                   |
| **Total**          | **≤ 200 ms** | Against a 600 ms p95 UI budget |

Runs on a native thread; the UI shows the blueprint's `processing` state and stays at 60 fps. The
generous headroom is deliberate — the UI budget can absorb a slow device without the screen feeling
broken.

---

## Validation

**This is a release gate, not a nice-to-have.** From
[`product/roadmap.md`](../product/roadmap.md#m3--v11--loop-a-and-the-labs--8-weeks): if validation
fails, the labs do not ship.

### The M1 spike (de-risking, months before M3)

A throwaway harness that:

1. Records 20 phrases × 5 speakers (2 native, 3 English-speaking learners at different levels) on a
   mid-range Android device and an iPhone.
2. Runs the full pipeline.
3. Presents scores to two native Spanish speakers who rate each take independently, 1–5.

**Pass:** Spearman correlation between our score and the human mean ≥ 0.6, and the worst-syllable
identification agrees with the human judgement ≥ 70% of the time.

**If it fails:** the prosody lab is redesigned _before_ M3 — most likely toward contour-only
feedback (which is much easier to get right) and away from per-syllable numbers.

### The M3 release gate

| Gate                                                   | Threshold |
| ------------------------------------------------------ | --------- |
| Native-speaker agreement on 20 takes                   | ≥ 80%     |
| Worst-syllable identification accuracy                 | ≥ 70%     |
| Score stability — same take scored twice               | ±2 points |
| Score stability — same speaker, same phrase, two takes | ±8 points |
| False-encouragement rate — a bad take scoring ≥85      | < 5%      |
| Rejection rate on clean studio audio                   | < 2%      |
| p95 latency on the device floor                        | ≤ 600 ms  |

**False encouragement is the one we care most about.** A learner told they sound native-like when
they don't has been actively harmed.

### Golden tests, forever

`packages/core-rs/tests/golden/` holds ~50 recorded utterances with committed expected outputs. Any
change to the DSP that moves a golden score by more than the stability threshold fails CI and
requires a documented, reviewed re-baseline. This is what stops silent drift.

---

## What we are explicitly not building

| Not doing                        | Why                                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------------------- |
| A phoneme classifier             | Needs a trained acoustic model per language, and the UI never claims phoneme-level identification |
| Cloud scoring                    | Breaks the 🔒 on-screen privacy promise and offline function                                      |
| Speaker adaptation / enrolment   | Complexity for marginal gain; pitch normalisation already handles most speaker variation          |
| Scoring learner-authored phrases | No trustworthy native reference exists ([content-model.md](../product/content-model.md#audio))    |
| Real-time scoring while speaking | Fun demo, poor pedagogy — it interrupts production                                                |
| An overall "accent score"        | Reductive, discouraging, and not actionable                                                       |
