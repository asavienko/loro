# `loro-speech`: recording, onset detection, and on-device ASR

- **Requirement IDs:** `AS-03`, `AS-06`, `P3-20`…`P3-28`, `LB-25`
- **Milestone:** M2
- **Size:** L
- **Depends on:** [native-toolchain-and-dev-client.md](09-native-toolchain-and-dev-client.md),
  [audio-playback-module.md](11-audio-playback-module.md)
- **ADRs:** 0005 (on-device ASR, cloud fallback), 0011 (analytics and privacy)
- **Non-negotiables touched:** #1 (recorded audio never leaves the device), #2 (real numbers)

## Current state

Nothing records. The token-matching half is already built and tested in Rust —
`packages/core-rs/src/asr.rs` has `normalize`, `strip_diacritic`, `MatchResult`, and the
forward-walking matcher with 9 tests, ported from the blueprint's `matchTranscript`
(`Loro.dc.html:2674–2683`). It deliberately lives in Rust "so iOS and Android apply identical
normalisation and identical matching" (`asr.rs:3–5`).

What is missing is everything upstream of it: microphone capture, speech onset detection, the
platform recogniser, and the degradation ladder (`docs/architecture/audio-speech.md:271`).

## The promise this plan must not break

`Loro.dc.html:1281` prints to the learner that their recorded audio stays on their device.
`CLAUDE.md` therefore makes it a technical requirement: **PCM stays in native memory and is passed
to `loro-core` by handle; no JS API returns audio bytes.**

That constrains the module's API shape, not just its behaviour. Design it so the unsafe thing is
impossible:

- The JS surface returns a **handle** (an opaque integer or string), plus derived results —
  transcript, onset time, scores. Never a buffer, base64 string, file path, or data URI.
- The handle's lifetime is owned natively and released explicitly; a leaked handle is a memory leak,
  a returned buffer is a broken promise.
- A lint rule and a code-review checklist item: any new method on this module returning
  `ArrayBuffer`, `Uint8Array`, or a path is rejected.

Cloud ASR fallback (ADR-0005) is the sharp edge. If any cloud path exists, audio _does_ leave the
device, which contradicts the printed promise. Resolve it explicitly before building: either (a)
cloud fallback is opt-in with a distinct, unambiguous consent screen and the promise copy is scoped
to the labs, or (b) there is no cloud ASR and ADR-0005 is amended. **This is a decision, not an
implementation detail** — track it as **Q-15** in `docs/decisions/open-questions.md`, which
currently stops at Q-14. [api-integrations.md](45-api-integrations.md) §6.4 argues (b) and sets out
what each path costs; that is the analysis to decide against, and it should not be re-derived here.

## The work

### 1. Capture

- 16 kHz mono PCM (what the DSP wants — `docs/architecture/prosody-dsp.md:77`), ring-buffered
  natively.
- Permission flow with a pre-prompt that explains why, using the same words as the privacy promise.
  A denied permission is a first-class state, not an error dialog: the Refrain must remain
  completable with self-report gates (`GateSpec` already models `self-report` and `tap` —
  `packages/core/src/engines/types.ts:29`).
- Explicit start/stop with a hard cap on duration; nothing records ambiently.

### 2. Onset detection — the real latency

`docs/architecture/audio-speech.md:208` is the spec. This is what turns the Refrain's latency from
"prompt → tap" into "prompt → speech" (see
[fix-latency-measurement.md](03-fix-latency-measurement.md)):

- Energy + zero-crossing VAD with a noise-floor estimate, tuned so a noisy café does not read as
  speech.
- Return `Option<u32>` — `None` when onset was never confidently detected. The type already exists:
  `core-rs/src/lib.rs LatencySample.ms` is `Option` "so every caller must handle 'not measured'".
- Tag the sample source (`onset` vs `tap`) so the two are never averaged.

### 3. Recognition

- iOS `SFSpeechRecognizer` with `requiresOnDeviceRecognition = true`; Android `SpeechRecognizer`
  with `EXTRA_PREFER_OFFLINE`. Locale `es-ES`.
- **On-device model availability is not guaranteed** — on Android especially, the offline `es-ES`
  model may not be downloaded. That is a `degraded` availability with an actionable message, not a
  crash.
- Partial results streamed so tokens light up as they are said (the blueprint's "just said"
  highlight, `MatchResult.just_index`).
- Feed transcripts through `core-rs::asr::match_tokens` — never re-implement matching in JS
  ([fix-shared-maths-duplication.md](05-fix-shared-maths-duplication.md)).

### 4. The degradation ladder

`audio-speech.md:271` defines it. Implement it as an explicit ordered fallback with a visible state
at each step: on-device ASR → (decision above) → **reveal fallback** (`P3-26`), where the learner
taps to reveal tokens and self-reports. The reveal fallback is what makes the production gate
shippable in a loud room or on a device with no model, and the roadmap puts the production gate on
the never-cut list.

Every rung must keep FSRS and the ladder updating (rule 5) — a learner who self-reports still
progresses.

### 5. Fuzzy matching stays off

`asr.rs` has a `fuzzy` flag documented as OFF by default because "turning it on makes the production
gate more forgiving, which is a pedagogical decision". Keep it behind a flag, log its use, and do
not enable it to paper over recogniser quality. If recognition is too strict for real learners, that
is data for a decision, not a reason to quietly loosen the gate.

## Acceptance criteria

- No JS API returns audio bytes; a test asserts the module's public surface contains no buffer-typed
  return.
- Recording works on both platforms; denied permission leaves every screen completable.
- Onset-derived latency is measured, and `null` when undetected — verified with a silent take.
- Tokens light up progressively as a phrase is spoken; the full phrase completes the gate.
- No offline model → `degraded` with an actionable message and the reveal fallback available.
- Every degradation rung still writes FSRS, ladder, and automaticity deltas.
- The cloud-ASR question is resolved and recorded before any network code exists.
- Recordings never appear on disk outside the consented golden-test fixtures (`.gitignore` already
  carves out `packages/core-rs/tests/golden/recordings/`).

## Tests

- Native unit tests for the ring buffer and VAD against recorded fixtures (consented).
- Onset detection accuracy against hand-labelled onsets: report error distribution, not a pass/fail
  average.
- Matching integration: transcript fixtures (including ASR noise, insertions, wrong order) through
  the Rust matcher.
- A privacy test: enumerate module methods and assert none returns audio data.
- Device QA on the matrix, in a quiet room and a loud one.

## Risks

- **`es-ES` on-device quality is a named long-lead risk** (`docs/product/roadmap.md`, M3 risks).
  Spike it early on a mid-range Android, alongside the prosody spike, and let the result inform the
  gate design rather than discovering it during M2.
- **Recogniser hallucination** — a recogniser that returns plausible Spanish the learner did not say
  would let the gate pass falsely. Measure false-accept rate, not just word error rate.

## Out of scope

Pronunciation scoring and prosody (that is the DSP path), and open-ended speech evaluation for the
Deploy finisher (v2).
