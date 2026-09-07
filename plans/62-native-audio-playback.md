# Native audio playback, cache, rates, and hands-free stream

- **Requirement IDs:** `AS-01`, `AS-02`, `AS-04`, `P3-01`…`P3-11`, `LB-05`, `LB-09`, `LB-23`
- **Milestone:** M1/M2
- **Status:** — Playback implementation remains to do; device integration needs 58 and an approved
  plan-61 seed batch. Playback contracts can be specified before Q-15 is resolved.
- **Depends on:** 58 native workspace; 61 approved seed assets; 86 only for remote asset/TTS
  adapters.
- **Reviewed:** 2026-09-07 against merged baseline `2d9e8c3`.

## Verified starting point

No native playback module or verified disk cache exists. Stream is explicitly manual browsing, and
Phrase Detail omits unavailable playback. `LANGUAGE_CAPABILITIES` is false for all targets. Restore
indicators only from the real native state; preserve the truthfulness delivered by 55/84.

## Outcome

A native-owned audio session plays cached phrase assets and device-TTS fallback offline, survives
navigation/background interruptions according to policy, and exposes truthful position/state events
without returning PCM to JavaScript.

## Remaining work

1. [ ] Implement one native playback state machine for
       item/queue/rate/position/buffering/interruption/ route change. Screens subscribe; they do not
       own playback.
2. [ ] Key assets/cache and fallback availability by target locale/voice/version. Implement verified
       disk cache, atomic downloads, eviction/pinning, bundled assets, device-TTS fallback, and
       prefetch hooks using plan-61 manifests.
3. [ ] Support specified rates, previous/next/repeat, headphones/Bluetooth, audio focus, lock-screen
       transport, background policy, and silent/degraded states.
4. [ ] Expose commands and metadata/events only. PCM stays native; capture buffers later cross
       modules by opaque handle.
5. [ ] Integrate Phrase Detail and Stream first, replacing plan-55 honest placeholders with real
       position/repeat behavior; leave Today/Refrain completion to plan 64.
6. [ ] Add deterministic native fakes plus device tests for interruptions, unplug, Bluetooth,
       offline, corrupt cache, missing asset, fallback, and process/background transitions.

## Acceptance criteria

- Playback and displayed progress use the same native clock/state.
- Cached/bundled phrases play in airplane mode; failures degrade honestly without killing a session.
- Audio continues or pauses across navigation/background exactly as the documented policy states.
- No JS API or log contains audio bytes.

## Out of scope

Microphone capture, ASR, DSP, catalog production, and trip prefetch policy.
