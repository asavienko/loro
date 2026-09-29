# Voice APIs, catalog TTS and device fallback

- **Requirement IDs:** `AS-01`, `AS-02` (existing rate contract), `AS-03` (already implemented)
- **Milestone:** M1/M2
- **Status:** 🟡 Adapter, authoring render, gated `/tts/render`, `GET /tts/status`, and
  catalog-or-API practice playback (no device-TTS fallback) are in this slice. Q-15 leaning pins
  catalog `TTS_VOICE_*` IDs; live seed still needs a key and pronunciation review. Cloud ASR, voice
  cloning, S3 publication, DSP references, background/lock-screen transport and physical-device
  speech acceptance remain with their owners.
- **App swap (2026-09-30):** the first app's catalog-file playback and its native audio modules were
  removed. The ElevenLabs adapter, `content:render`, `/tts/render` and `/tts/status` remain; the
  current app speaks with the device voice and calls no TTS route.
- **Depends on:** 86 vendor-transport pattern; 61 render/`POST /tts/render` draft; 62 playback
  session; 63 on-device ASR (unchanged).
- **Priority:** sequences the ElevenLabs slice of 86/61/62 rather than replacing those plans.

## Outcome

One ElevenLabs transport serves authoring `content:render` and a disabled-by-default learner
`POST /tts/render`. Phrase Detail, Stream and Refrain play a resolved catalog file when present,
otherwise API reference TTS when ElevenLabs is configured. Device TTS is not a practice fallback.
On-device ASR and reveal stay the floor. Recorded learner audio never enters the network.

## Ownership

| Owner | Slice                                                           |
| ----- | --------------------------------------------------------------- |
| 86    | Vendor transport, concurrency, redaction tests                  |
| 61    | `content:render`, draft `POST /tts/render`, fail-closed publish |
| 62    | Foreground file URI + device-TTS fallback                       |
| 63    | On-device ASR / reveal (no cloud adapter)                       |
| 98    | Integration order, shared config, honest source copy            |

## Remaining after this slice

1. [x] Q-15 Voice Library catalog pins (`CATALOG_REFERENCE_VOICES` / `.env.example`).
2. [ ] Content-lead listen, live `TTS_API_KEY`, and seed render of 150 then 600 phrases.
3. [ ] S3/signed pack publication and client downloader (61/86).
4. [ ] Background, lock-screen, gapless queue and LRU cache (62 remainder).
5. [ ] Physical-device TTS/ASR/interruption evidence (58/63/72).
6. [ ] F0/syllable/MFCC extraction (77).

## Out of scope

Cloud ASR, voice cloning, learner PCM upload, UI sound effects, closing Q-15 pronunciation review in
code.
