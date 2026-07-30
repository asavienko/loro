# Native speech, Speak to Progress, and real onset latency

- **Requirement IDs:** `AS-03`, `AS-06`, `P3-20`…`P3-28`, `LB-25`, `LB-27`
- **Milestone:** M2
- **Status:** Not started
- **Depends on:** 58 native workspace, 60 authoritative matching, 62 audio session

## Outcome

The app captures speech by opaque native handle, performs on-device Spanish recognition/onset
detection, measures prompt-end-to-speech-onset with one monotonic clock, and ships Speak to Progress
with reveal-mode degradation.

## Work

1. Implement permission/availability/session state machines and native ring buffers. JavaScript sees
   status, transcript/tokens, onset timestamps, and handles, never PCM.
2. Select and validate the on-device `es-ES` ASR path on the device floor; document model size,
   download/bundling, battery, latency, accents, and failure thresholds.
3. Implement VAD/onset timestamps in the native audio clock and map them to prompt-end playback from
   plan 62. Store raw samples append-only where the data model requires them.
4. Use plan-60 matching and explicit heard-nothing/partial/unavailable states; never fabricate a
   recognition or latency value.
5. Build the Speak route, live token reveal, Hear Answer, retry/skip, privacy copy, and first-class
   reveal mode. Correct the fallback requirement citation to `P3-25`.
6. Add device tests for permission denial/revocation, silence/noise, interruption, offline, long
   pauses, ASR unavailable, reveal mode, and measured-vs-null display.

## Acceptance criteria

- Recorded audio never leaves native memory or the device.
- Latency is measured from prompt end to detected speech onset or is `null`; formatting does not
  clamp/floor it into a different value.
- Speak is completable offline with ASR or reveal mode and writes progress only through
  `applyDelta`.
- Native-speaker acceptance and device-floor latency/accuracy thresholds are recorded with fixtures.

## Out of scope

Cloud ASR unless a new privacy decision explicitly permits it, prosody scoring, and Roleplay AI.
