# 0007 · Build a native audio module rather than using a JS audio library

- **Status:** Accepted
- **Date:** 2026-07-28
- **Deciders:** Mobile lead, tech lead

## Context

Audio is not a feature of Loro; it is the substrate. The requirements, drawn from the blueprint:

1. **Continuous hands-free playback** with per-phrase repeat counts, surviving backgrounding, the
   lock screen, and a long commute (`Loro.dc.html:603–634`, and the all-day ambient loop at
   `1356–1367`).
2. **Gapless advance** between phrases while a repeat counter runs.
3. **Variable rate with pitch preserved** — 0.6× slow, 0.92× normal, 1.15× for Speed mode, up to
   1.5×. Pitch must not shift, or the pronunciation model is corrupted.
4. **Immediate play↔record alternation.** Six hear-then-speak cycles in ninety seconds in the
   Refrain; any session teardown between modes would break the beat.
5. **Latency measurement good enough to be honest** — the falling-effort chart is the Refrain's
   entire feedback signal, and a fabricated number there is forbidden
   ([`product/learning-model.md`](../../product/learning-model.md#where-the-blueprints-numbers-came-from--and-what-is-real)).
6. **Raw, unprocessed capture** for DSP. Platform AGC, noise suppression, and EQ distort both the
   amplitude envelope and the pitch track we are about to measure
   ([prosody-dsp.md](../prosody-dsp.md#1--pre-processing)).
7. **PCM must never reach JavaScript**, so that the 🔒 privacy promise is structurally guaranteed
   rather than merely intended ([ADR-0011](0011-analytics-and-privacy.md)).
8. **Interruption handling** — calls, Siri, other apps, headphones removed mid-rep.
9. All of it offline.

## Options considered

### A · An off-the-shelf RN audio library (`expo-av`, `react-native-track-player`, `react-native-sound`)

**Pros** Available today; no native code to write or maintain. **Cons**

- No control over the capture configuration, so requirement 6 is unreachable — recordings arrive
  already processed and useless for pitch scoring.
- Recorded audio is exposed as a **file path or a base64 buffer to JS**, which violates requirement
  7 by design and makes the privacy promise a matter of discipline rather than architecture.
- No speech-onset callback, so requirement 5 becomes "estimate latency", which is exactly what we
  forbid.
- Rate control is inconsistent and often pitch-shifting.
- Gapless slot swapping is not offered.

`react-native-track-player` handles background playback and lock screen controls well — but it is a
_player_, and half our requirements are about capture and measurement.

### B · Native modules for capture only, a JS library for playback

**Pros** Less native code; keeps the well-solved background-playback problem with a library that
solved it. **Cons** Two audio session owners on one device is a recipe for interruption bugs — the
library and our module would fight over `AVAudioSession` category and activation. Play↔record
alternation (requirement 4) crosses the boundary on every rep, which is the worst place for a seam.

### C · One native Expo Module owning the whole audio graph

**Pros**

- One owner of the audio session: no category fights, coherent interruption handling.
- Full control of capture configuration (`.measurement` / `UNPROCESSED`).
- Speech-onset detection in the native tap, giving a real latency number.
- **PCM stays in native memory and is passed to `loro-core` by handle.** There is no JS API that
  returns audio bytes, so the code to upload it does not exist.
- Two player nodes for gapless slot swapping.
- `AVAudioUnitTimePitch` / Oboe rate transform with pitch preserved.

**Cons**

- We write and maintain Swift and Kotlin audio code — the hardest platform area there is.
- Background playback and lock screen integration must be built (`MPNowPlayingInfoCenter`,
  `MediaSessionCompat`, a foreground service on Android).
- Interruption edge cases are ours to get right, and they are numerous.

## Decision

**Option C.** One Expo Module, `loro-audio`, owning playback, capture, rate, routing, interruptions,
and the lock screen. A second module, `loro-speech`, wraps the platform recognisers and device TTS
([ADR-0005](0005-on-device-asr-cloud-fallback.md)).

Key API shapes ([audio-speech.md](../audio-speech.md#loro-audio-api)):

- **Slots** — `load(slot, uri)` / `play(slot)` so the next phrase preloads while the current one
  repeats.
- **Buffer handles** — `stopRecording()` returns a `bufferId`, and `analyzeBuffer(bufferId, kind)`
  hands it to `loro-core`. **No API returns PCM to JS.**
- **`onSpeechOnset`** — the native tap emits an onset timestamp; latency is `onset − promptEnd` on a
  monotonic clock, or `null` if never detected.

iOS: `AVAudioEngine` + `AVAudioSession` (`.playAndRecord`, `.measurement` while recording for DSP) +
`AVAudioUnitTimePitch`. Android: Oboe/AAudio with a `VOICE_RECOGNITION`/`UNPROCESSED` input, plus
`MediaSessionCompat` and a foreground service.

## Consequences

### Good

- Requirement 6 is satisfiable, which means the labs can produce real scores rather than theatre.
- **Requirement 7 is structural.** The privacy promise is kept by the absence of an API rather than
  by reviewer vigilance — the strongest form of guarantee available
  ([threat-model.md](../threat-model.md#b2--audio-leaving-the-device--the-one-that-matters-most)).
- Real latency measurement, validated to ±60 ms against 200 hand-labelled recordings.
- One audio session owner, so interruption behaviour is coherent and testable as a matrix.
- Gapless repeat/advance, which is what makes the stream feel like a radio station rather than a
  playlist.
- The JS thread never touches PCM, so a 40-minute stream costs nothing on the UI side.

### Bad — accepted deliberately

- **This is the highest-skill native work in the project.** Mitigated by keeping the module's
  surface narrow (it contains no learning logic at all) and by the interruption matrix being
  manual-tested on real devices — the simulator lies about audio sessions.
- Background playback, lock screen metadata, and the Android foreground service are ours to build
  and keep working across OS versions.
- The interruption matrix is long: calls, Siri, other apps, route changes, silent switch, car
  systems, low power. Enumerated in
  [audio-speech.md](../audio-speech.md#interruptions-and-edge-cases) and tested on devices every
  release.
- A native crash here takes the app down. Contained by keeping the module small and defensive, and
  by reporting audio-module crashes as their own class.

### Revisit if…

- A library appears that offers configurable unprocessed capture, buffer handles that never cross
  into JS, and an onset callback. That would be the whole requirement set, and adopting it would be
  worth the migration.
- The Android low-latency path (Oboe/AAudio) proves unreliable across the device matrix, in which
  case playback may fall back to `ExoPlayer` while capture stays on Oboe — accepting two owners on
  Android only, with the session coordination that implies.
