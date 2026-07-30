# Native audio playback, cache, rates, and hands-free stream

- **Requirement IDs:** `AS-01`, `AS-02`, `AS-04`, `P3-01`…`P3-11`, `LB-05`, `LB-09`, `LB-23`
- **Milestone:** M1/M2
- **Status:** Not started
- **Depends on:** 58 native workspace, 61 approved seed assets

## Outcome

A native-owned audio session plays cached phrase assets and device-TTS fallback offline, survives
navigation/background interruptions according to policy, and exposes truthful position/state events
without returning PCM to JavaScript.

## Work

1. Implement one native playback state machine for item/queue/rate/position/buffering/interruption/
   route change. Screens subscribe; they do not own playback.
2. Implement verified disk cache, atomic downloads, eviction/pinning, bundled assets, device-TTS
   fallback, and prefetch hooks using plan-61 manifests.
3. Support specified rates, previous/next/repeat, headphones/Bluetooth, audio focus, lock-screen
   transport, background policy, and silent/degraded states.
4. Expose commands and metadata/events only. PCM stays native; capture buffers later cross modules
   by opaque handle.
5. Integrate Phrase Detail and Stream first, replacing plan-55 honest placeholders with real
   position/repeat behavior; leave Today/Refrain completion to plan 64.
6. Add deterministic native fakes plus device tests for interruptions, unplug, Bluetooth, offline,
   corrupt cache, missing asset, fallback, and process/background transitions.

## Acceptance criteria

- Playback and displayed progress use the same native clock/state.
- Cached/bundled phrases play in airplane mode; failures degrade honestly without killing a session.
- Audio continues or pauses across navigation/background exactly as the documented policy states.
- No JS API or log contains audio bytes.

## Out of scope

Microphone capture, ASR, DSP, catalog production, and trip prefetch policy.
