# Voice APIs, catalog TTS and device fallback

- **Requirement IDs:** `AS-01`, `AS-02` (existing rate contract), `AS-03` (already implemented)
- **Milestone:** M1/M2
- **Status:** 🟡 Adapter, authoring render, gated `/tts/render` and catalog-file playback with
  device-TTS fallback are in this slice. Q-15 still gates licensed production seed audio. Cloud ASR,
  voice cloning, S3 publication, DSP references, background/lock-screen transport and
  physical-device speech acceptance remain with their owners.
- **Depends on:** 86 vendor-transport pattern; 61 render/`POST /tts/render` draft; 62 playback
  session; 63 on-device ASR (unchanged).
- **Priority:** sequences the ElevenLabs slice of 86/61/62 rather than replacing those plans.

## Outcome

One ElevenLabs transport serves authoring `content:render` and a disabled-by-default learner
`POST /tts/render`. Phrase Detail and Stream play a resolved catalog file when present, otherwise
device TTS. On-device ASR and reveal stay the floor. Recorded learner audio never enters the
network.

## Ownership

| Owner | Slice                                                           |
| ----- | --------------------------------------------------------------- |
| 86    | Vendor transport, concurrency, redaction tests                  |
| 61    | `content:render`, draft `POST /tts/render`, fail-closed publish |
| 62    | Foreground file URI + device-TTS fallback                       |
| 63    | On-device ASR / reveal (no cloud adapter)                       |
| 98    | Integration order, shared config, honest source copy            |

## Remaining after this slice

1. [ ] Q-15 voice/model IDs, rights, listen review and budget before a live seed render.
2. [ ] S3/signed pack publication and client downloader (61/86).
3. [ ] Background, lock-screen, gapless queue and LRU cache (62 remainder).
4. [ ] Physical-device TTS/ASR/interruption evidence (58/63/72).
5. [ ] F0/syllable/MFCC extraction (77).

## Out of scope

Cloud ASR, voice cloning, learner PCM upload, UI sound effects, closing Q-15 in code.
