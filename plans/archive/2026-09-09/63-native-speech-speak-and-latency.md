# Native speech, Speak to Progress, and real onset latency

- **Requirement IDs:** `AS-03`, `AS-06`, `P3-20`…`P3-28`, `LB-25`, `LB-27`
- **Milestone:** M2
- **Status:** 🟡 Strictly on-device ASR, canonical matching and Speak recognition/reveal are
  implemented. Physical-device/per-language accuracy, retained native buffers and measured onset
  latency remain; full acceptance requires installed models and hardware evidence.
- **Depends on:** 58 native workspace; 60 matching/bindings; 62 shared audio clock/session; 87
  language identities.
- **Reviewed:** 2026-09-09 against `aafa61f`; current source, tests and retained review records
  inspected. This plan refresh supplies no new runtime, device or deployment acceptance.
- **Priority:** 7; measured onset after 62; existing ASR acceptance starts with priority 9.

**Archive disposition (2026-09-09):** Archived at user request after integration review. The partial
status and remaining acceptance criteria below are retained; archival does not mark this plan
complete. The roadmap index continues to track its unfinished scope.

## Implemented scope

The native audio/speech module uses platform-supported on-device recognition only, requests
permission when recognition starts, and exposes local transcript/status events without PCM.
`practice/speak` supports partial matching, heard-nothing/unavailable states, answer playback and
offline word reveal. Recognized outcomes use the engine's `ProgressDelta`; revealing words never
claims successful speech. Matching uses the shared Rust core.

Latency stays `null`: prompt-end-to-onset measurement and retained native-buffer DSP are absent. An
airplane-mode Android emulator with no voice/model confirmed the unavailable/reveal path and no
microphone permission request. It did not validate successful ASR or a language's accuracy. The JS
boundary validates native speech events and deliberately drops numeric timing until a native
monotonic-clock measurement exists.

The runtime speech-event adapter also rejects null, non-object, incomplete and empty-session
payloads without throwing. Only the validated lifecycle fields are projected into app state;
unexpected native fields and numeric callback timing are discarded. Unit fixtures cover every
existing speech state, including empty transcripts for silence/error/unavailable handling. This is
boundary hardening, not new physical-device recognition or onset acceptance.

## Outcome

The app captures speech by opaque native handle, performs validated on-device target-language
recognition/onset detection, measures prompt-end-to-speech-onset with one monotonic clock, and ships
Speak to Progress with reveal-mode degradation.

## Remaining work

1. [ ] Validate es-ES/bg-BG/ru-RU separately on supported physical devices, recording on-device
       model availability, install requirements, latency, battery, accents and failure thresholds.
2. [ ] Add native ring-buffer handles and VAD/onset timestamps using the shared 62/60 contract.
       Define release on completion, cancellation, failure and session replacement; test stale
       handles and mismatched session generations. JavaScript may receive timestamps/opaque handles,
       never PCM samples; audio remains in native memory. Preserve unrounded onset measurements
       separately from the existing transcript/status events.
3. [ ] Exercise permission denial/revocation, silence/noise, interruption, long pauses and offline
       recognition on hardware. Unsupported targets retain reveal mode.
4. [ ] Validate measured-vs-null display and native-speaker acceptance before enabling timing or
       pronunciation claims. Keep successful recognition and manual reveal distinct in progress.

## Acceptance criteria

- Recorded audio never leaves native memory or the device.
- Latency is measured from prompt end to detected speech onset or is `null`; formatting does not
  clamp/floor it into a different value.
- Speak is completable offline with ASR or reveal mode and writes progress only through
  `applyDelta`.
- Native-speaker acceptance and device-floor latency/accuracy thresholds are recorded with fixtures.

## Delivery order and gates

1. Continue per-target device ASR/permission acceptance on the existing recognition/reveal path
   independently of recorded-asset delivery. Keep unsupported targets usable through reveal.
2. Agree timestamp units, prompt-end event, native buffer ownership/release and cancellation with
   62/60 before exposing onset measurement. Include stale-session, silence/noise and interruption
   fixtures; only real native monotonic-clock measurements may replace null latency. Do not reuse
   ASR callback arrival as speech onset. Verify native handle cleanup and measured-vs-null states
   through interruption, unavailable models and prompt cancellation before connecting 64.
3. Feed measured results to 64 and device evidence to 72; include English only after plan 90's
   locale contract and separate capability review. Successful recognition is not DSP scoring proof.

## Out of scope

Cloud ASR/audio upload, prosody scoring, and Roleplay AI. There is no consent exception to the
recorded-audio privacy requirement.

## Post-main review and archive disposition — 2026-09-09

The [review at `de81744`](../../../docs/reviews/2026-09-09-post-main-plan-review.md) records this
plan's current contribution, remaining work and gates. [Delivered slices](IMPLEMENTED-SLICES.md) are
retained in the archive; this plan remains incomplete. Earlier verification is dated evidence, not
acceptance of the current combined branch.
