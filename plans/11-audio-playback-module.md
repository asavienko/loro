# `loro-audio`: playback, TTS cache, rates, and the hands-free stream

- **Requirement IDs:** `AS-01`, `AS-02`, `AS-04`, `P3-01`…`P3-11`, `LB-23`
- **Milestone:** M1/M2 (declared M1 scope; not built)
- **Size:** L
- **Depends on:** [native-toolchain-and-dev-client.md](09-native-toolchain-and-dev-client.md)
- **ADRs:** 0007 (audio pipeline)

## Why this is the most conspicuous gap

`CLAUDE.md`: "nothing runnable today exercises audio or the microphone, **which is half of what this
app is**." The Refrain screen is explicit about it in the UI itself — `app/practice/refrain.tsx:386`
renders:

> `Model plays at {modelRateForMode(mode)}× · audio lands with the native module`

So the app currently tells the learner the rate at which nothing plays. An app that teaches by
phrase and melody with no sound is a mockup with state.

The design is fully specified in `docs/architecture/audio-speech.md` — module API at `:44`, the
audio graph per platform at `:134`, the hands-free stream at `:174`, TTS strategy at `:237`,
interruptions at `:311`. This plan implements what is written there; where it disagrees with the
blueprint, the blueprint wins.

## The work

### 1. The module boundary

Implement `loro-audio` per the API in `audio-speech.md:44` as an Expo module. The boundary matters
more than the implementation: screens must not touch platform audio directly, or exclusive playback
becomes unenforceable.

One **owner** of the audio session. Every play request goes through it, and it is the only thing
that configures the session category — the "exclusive playback" requirement in `AS-02` is a property
of having a single owner, not of each caller being careful.

### 2. Playback and rate

- Rate control per the mode table (`core-rs/src/select.rs:79 model_rate_for_mode`) — 0.8×/1.0× and
  whatever `beat_ms_for_mode` implies for Chorus. Rate change must not pitch-shift; use the platform
  time-stretch, not resampling.
- Gapless/low-latency start. The Refrain's Chorus mode rides a beat, so start jitter is audible in a
  way it isn't in a normal player. Measure it and put it in the performance budget.
- Preload the next item while the current one plays.

### 3. TTS and the cache

`audio-speech.md:237` decides the strategy. The parts to get right:

- **Catalog audio first, device TTS as fallback** — `AudioSpec.source` already models exactly this
  (`packages/core/src/engines/types.ts:44`). The content catalog has no audio yet
  ([content-scale-to-600.md](36-content-scale-to-600.md)), so device TTS is the only source today;
  build both paths now so the switch is a data change.
- A disk cache keyed by `(phraseId, voice, rate)` with an LRU cap and a size budget the learner can
  see and clear in Settings. Cached audio is prefetched for the offline requirement (`F-03`).
- Never synthesise on the UI thread; never await synthesis inside a rep.

### 4. Background audio and the lock screen

`AS-04` / `P3-11`. The hands-free stream is a listening surface people use while walking and
driving, so this is not a nice-to-have:

- iOS: `UIBackgroundModes: audio`, `MPNowPlayingInfoCenter`, remote command centre (play/pause,
  next/previous mapped to phrase navigation).
- Android: a foreground media service with a `MediaSession`, notification transport controls, and
  correct behaviour with Bluetooth/AVRCP.
- Audio focus and interruptions (`audio-speech.md:311`): a phone call, a navigation prompt, another
  app taking focus, headphones unplugged — each has a defined resume-or-stop behaviour. Write the
  table and test every row, because these are the bugs that get one-star reviews.

### 5. Wire the screens

- `app/practice/stream.tsx` — the actual hands-free loop (`audio-speech.md:174`): play, gap, repeat
  count from `repeat_target`, advance, and continue with the screen off.
- `app/practice/refrain.tsx` — model playback per mode, the withheld model on Cold
  (`model_rate_for_mode` returns `None`), and the beat for Chorus.
- `app/phrase/[id].tsx` — the play control, slow play, and per-word playback if the content has word
  timings.
- Replace the "audio lands with the native module" line with the real transport.

### 6. Availability, honestly

The engine contract has `Availability` with `degraded`/`unavailable` reasons
(`packages/core/src/engines/types.ts:219`). Use it: no catalog audio _and_ no TTS voice for `es-ES`
installed is a real state on Android, and the right response is a specific message ("install a
Spanish voice") plus a working non-audio path — not a silent no-op play button.

Web target: TTS via the Web Speech API where present, `unavailable` otherwise, so screen development
on web keeps working ([native-toolchain-and-dev-client.md](09-native-toolchain-and-dev-client.md)
§6).

## Acceptance criteria

- Every phrase surface plays audio; the Refrain plays the right rate per mode and withholds it on
  Cold.
- Two play requests overlap zero times, ever — verified by a test that fires 20 concurrent requests.
- The stream keeps playing with the screen locked, with working lock-screen transport on both
  platforms, and phrase titles on the now-playing surface.
- Every interruption case in the table resumes or stops as specified.
- Cached audio plays with the network off; cache size is visible and clearable.
- No Spanish voice installed → a specific, actionable message and a usable screen.
- Playback start latency within the budget in `docs/architecture/performance.md`; measured, not
  estimated.

## Tests

- Unit: the session owner's state machine (idle → playing → interrupted → resumed → stopped).
- Cache: key collisions, LRU eviction, size accounting, corrupt-file recovery.
- Device QA matrix pass for audio specifically — `docs/process/qa-device-matrix.md` already calls
  out audio-specific QA, and it cannot be automated away. Include a Bluetooth headset and a car.
- The five hand-checks in `docs/process/onboarding.md` — two of them (audio, the warming card)
  become checkable for the first time here.

## Risks

- **Android TTS fragmentation** is the real risk: voice availability, quality, and rate support vary
  by OEM. Test on the actual matrix floor, not on a Pixel only.
- **Time-stretch quality at 0.8×** — if the platform stretch sounds bad, the Speed/Chorus modes lose
  their point. Evaluate early; it is a cheap spike.

## Out of scope

Recording, onset detection, and ASR — [asr-speech-module.md](12-asr-speech-module.md). Voice
conversion (`P3D-12`) is v2.
