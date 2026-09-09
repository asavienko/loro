# Native audio playback, cache, rates, and hands-free stream

- **Requirement IDs:** `AS-01`, `AS-02`, `AS-04`, `P3-01`…`P3-11`, `LB-05`, `LB-09`, `LB-23`
- **Milestone:** M1/M2
- **Status:** 🟡 Native foreground device TTS and Phrase Detail/Stream controls are implemented.
  Recorded assets/cache, queue/rate/background/lock-screen transport and hardware acceptance remain;
  approved assets still depend on Q-15 even though ElevenLabs is selected.
- **Depends on:** 58 native workspace; 61 approved seed assets; 86 only for remote asset/TTS
  adapters.
- **Reviewed:** 2026-09-09 against checkout `42f4d57`; source/plan review only, no new device or
  deployment acceptance.

**Archive disposition (2026-09-09):** Archived at user request after integration review. The partial
status and remaining acceptance criteria below are retained; archival does not mark this plan
complete. The roadmap index continues to track its unfinished scope.

## Implemented scope

`modules/loro-audio-speech` owns foreground native speech playback and exposes real availability,
state and completion events. Phrase Detail and Stream consume installed offline target-language
voices; missing voice data produces an unavailable state. No audio bytes enter JavaScript. The
JavaScript controller serializes play, stop and recognition transitions so concurrent UI actions
cannot issue competing native-session commands.

The 2026-09-09 follow-up rechecks request ownership when a queued native command actually executes.
Stopping playback or listening while an earlier command is pending now prevents the cancelled
request from starting later. Controller regressions reproduced both failures before the fix and
pass afterward (eight tests); focused ESLint also passes. This is a cancellation guarantee for the
existing foreground session, not evidence for recorded playback, background transport or devices.

ElevenLabs is the selected production TTS provider (2026-09-07). Plan 61 still needs reviewed,
licensed seed assets with pinned provenance before recorded playback/cache can be accepted. The
current device-TTS fallback does not imply those assets or background transport exist.

## Outcome

A native-owned audio session plays cached phrase assets and device-TTS fallback offline, survives
navigation/background interruptions according to policy, and exposes truthful position/state events
without returning PCM to JavaScript.

## Remaining work

1. [ ] Extend the native state machine for item/queue/rate/position/buffering/interruption and route
       changes; screens subscribe to one session instead of creating competing players.
2. [ ] Consume plan-61 locale/voice/version manifests for verified disk cache, atomic downloads,
       eviction/pinning, bundled assets and prefetch hooks. Retain installed-device TTS fallback.
3. [ ] Implement specified rates, previous/next/repeat, headphones/Bluetooth, audio focus,
       lock-screen transport and the documented background policy.
4. [ ] Integrate real recorded position/repeat behavior in Phrase Detail/Stream, then hand off
       Today/Refrain orchestration to plan 64.
5. [ ] Add physical-device interruption/unplug/Bluetooth/offline/cache/fallback/background tests.
       The existing emulator lacks voices and proves only truthful unavailability.

## Acceptance criteria

- Playback and displayed progress use the same native clock/state.
- Cached/bundled phrases play in airplane mode; failures degrade honestly without killing a session.
- Audio continues or pauses across navigation/background exactly as the documented policy states.
- No JS API or log contains audio bytes.

## Delivery order and gates

1. Extend the existing serialized native session with position/queue/rate/interruption events;
   define the shared monotonic-clock handoff with 63 before onset measurement work.
2. Integrate 61's verified cache identity and approved assets, then background/lock-screen control.
   Plan 62 owns audio transport, 81 its in-app travelling presentation, and 70 trip/widget state;
   ordinary background playback must not wait for the blocked trip lifecycle.
3. Record per-target physical-device playback and interruption evidence through 58/72. Fixtures may
   verify state transitions while Q-15 is open; they cannot establish production asset quality.

## Out of scope

Microphone capture, ASR, DSP, catalog production, and trip prefetch policy.
