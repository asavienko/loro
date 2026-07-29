# 0005 · On-device ASR, with an opt-in cloud fallback and a reveal-mode floor

- **Status:** Accepted
- **Date:** 2026-07-28
- **Deciders:** Tech lead, mobile lead, product

## Context

Speaking is the core loop. Speak-to-progress gates progress on **producing** the phrase, the
Refrain's last three modes are speech-only, the labs require a recording, and roleplay offers spoken
replies. There is no version of this product where the microphone is optional.

Three constraints collide:

1. **It must work offline.** The primary persona is abroad with no data plan
   ([offline.md](../offline.md)).
2. **🔒 Audio must not leave the device.** The prosody screen says so in writing
   (`Loro.dc.html:1281`).
3. **Latency matters.** The Refrain does six hear-then-speak cycles in ninety seconds; a 1.5-second
   round trip per rep would destroy the beat that screen is built around.

## Options considered

### A · Cloud ASR as primary (Whisper API, Deepgram, Google STT)

**Pros** Best accuracy, uniform behaviour across devices, one implementation. **Cons** Fails all
three constraints. Offline: dead. Privacy promise: broken by default. Latency: 300–1500 ms per
utterance plus upload. Also a recurring per-minute cost on the app's most-used interaction.
**Rejected.**

### B · Bundle Whisper (whisper.cpp / ONNX Runtime) in the app

**Pros** Offline, private, uniform across devices, and genuinely good at Spanish. **Cons**

- Model size: 40–75 MB for `tiny`/`base` quantised, against a 60 MB iOS download budget
  ([performance.md](../performance.md#bundle-and-install)). It would roughly double the app.
- Latency on the device floor for a 2-second utterance is 400–900 ms — acceptable, but not better
  than the platform recognisers.
- **No streaming partials.** The blueprint's Speak-to-progress un-blurs words _as you say them_
  (`Loro.dc.html:2667` uses interim results), which needs partial hypotheses. Whisper is
  utterance-at-a-time.
- Battery and thermals on a 6-rep Refrain session.

### C · Platform on-device recognisers

**Pros**

- Free, no bundle cost, OS-maintained, hardware-accelerated.
- **Streaming partial results** — exactly what the word-by-word reveal needs.
- Offline (once a language pack is present) and private by construction with the on-device flags
  set.
- Low latency: ~150–400 ms to finalisation.

**Cons**

- **Availability is not guaranteed.** iOS `supportsOnDeviceRecognition` for Spanish varies by device
  and OS version; Android needs a downloaded offline language pack.
- Accuracy is somewhat below Whisper, especially for a heavy learner accent.
- Two different APIs and two different failure vocabularies.

## Decision

**Platform on-device recognisers**, with `onDeviceOnly: true` as a hard flag, and a four-rung
degradation ladder ([audio-speech.md](../audio-speech.md#degradation-ladder)):

```
1. On-device recogniser available                → full experience
2. Language pack missing                         → in-context download prompt, reveal mode meanwhile
3. Unavailable, learner opted into cloud ASR     → cloud (per-utterance, explicitly consented)
4. Unavailable, no consent                       → REVEAL MODE
```

**Reveal mode is the floor, and it is a first-class experience, not an error state.** It comes
straight from the blueprint: the mic button becomes a reveal button and the hint reads _"No mic here
— tap to reveal a word"_ (`Loro.dc.html:2661`, `2729`). Every speaking screen completes without a
microphone.

**Matching lives in `loro-core`, not in the ASR module** ([ADR-0002](0002-shared-rust-core.md)), so
both platforms apply identical normalisation and identical forward-walk matching. Accuracy
differences between recognisers therefore surface as recognition differences, never as _scoring_
differences.

## Consequences

### Good

- Zero bundle cost, zero per-utterance cost, and the privacy promise holds by default.
- Streaming partials give us the word-by-word un-blur the blueprint designed.
- Latency fits inside the Refrain's beat.
- Reveal mode means the app is never blocked by a missing recogniser, a denied permission, or a
  noisy room — which also makes the whole speaking loop usable by learners who can't or won't speak
  aloud in the moment.
- The matching layer being shared means we can tune tolerance once, as a pedagogical decision, and
  it applies everywhere.

### Bad — accepted deliberately

- **Availability varies by device.** Mitigated by detecting it up front (`asrAvailability`),
  prompting for the language pack in context, and having a real fallback. We instrument the
  reveal-mode rate — if it's high on a platform, that's a signal to revisit option B.
- Accuracy is lower than Whisper for strong learner accents. Mitigated by the forward-walk matcher
  tolerating insertions, and by an optional bounded edit-distance tolerance in `loro-core` (off by
  default — turning it on is a pedagogical choice about gate strictness, and should be made with
  data).
- Two platform APIs to wrap and two failure vocabularies to normalise. Contained in one module with
  one TS surface.
- Cloud fallback adds a consented path where audio does leave the device. It is off by default,
  asked for only when on-device is genuinely unavailable, revocable immediately, and never silent
  ([security-privacy.md](../security-privacy.md#consent-surfaces)).

### Revisit if…

- The reveal-mode rate exceeds ~15% of speaking sessions on either platform. That's the number that
  says the platform recogniser isn't good enough, and it's the trigger to bundle a Whisper-class
  model — probably as an optional download rather than in the binary, which sidesteps the size
  objection.
- A materially smaller streaming-capable on-device model becomes available (<15 MB with partials).
- Accuracy complaints correlate with learner accent in a way the matcher can't absorb.
