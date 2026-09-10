# Q-15 listening-voice decision packet

**Status: pinned 2026-09-10 (leaning).** Product authorized these Voice Library IDs for **in-app
catalog reference and listening cache/playback**. This packet does **not** close
[Q-15](open-questions.md#q-15) as production-quality and does **not** answer
[Q-22](open-questions.md#q-22). A provisioned API key is not a licence. Official default voices
(Rachel `21m00Tcm4TlvDq8ikWAM` and siblings) expire 2026-12-31 and must not be pinned.

Licensed listening generate has **one runtime switch**:
[`LISTENING_VOICE_DECISION`](../../packages/core/src/listening/constants.ts) (`modelId` plus ≥2
`licensed: true` voices per enabled target). Catalog reference pins live in
`CATALOG_REFERENCE_VOICES` (one per locale, forever). Do not add a second env flag, and do not treat
`TTS_VOICE_*` catalog pins as listening voices. `selectLicensedListeningVoices` skips catalog IDs.
`LISTENING_SHARE_ENABLED` stays false.

## What is recorded

| Field                   | Why it is required                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------ |
| Voice ID (ElevenLabs)   | Exact `voice_id` used in `POST /tts/render` (`asset_class: listening` or catalog render)   |
| Display name            | Learner-visible roster; real Voice Library name, never a placeholder                       |
| Locale / accent tags    | Voice Library language and region match the target (`es-ES` not generic EN)                |
| ≥2 distinct IDs         | Listening product is unavailable with zero or one voice (`LISTENING_MIN_VOICES`)           |
| `licensed: true`        | In-app cache and playback for this product class (not share-out-of-app)                    |
| Model ID                | One pinned listening/catalog model for all clips                                           |
| Pronunciation review    | Content lead listen of starter phrases; **still open**                                     |
| Budget                  | Character ceiling for 150 then 600 phrases × voices × repeats; fail closed on 429/402      |
| Redistribution          | In-app cache only until [Q-22](open-questions.md#q-22); deletion if a licence is withdrawn |
| Distinct from reference | Listening IDs must not equal the catalog reference pin for that locale                     |

## Catalog reference pins (`AS-01`, one voice per locale forever)

Runtime catalog render still reads `TTS_VOICE_*`. These IDs are the documented production pin
(`.env.example` and `CATALOG_REFERENCE_VOICES`). Changing one is a catalog-wide re-render, not a
config tweak.

| Target  | Voice ID               | Display name | Locale tags (public)           | Pin date   |
| ------- | ---------------------- | ------------ | ------------------------------ | ---------- |
| `es-ES` | `t9LRTh3y1ioN00e9wsNh` | Aaron Abad   | Native Castilian Spanish       | 2026-09-10 |
| `bg-BG` | `406EiNlYvqFqcz3vsnOm` | Peter K      | Bulgarian, middle-aged male    | 2026-09-10 |
| `ru-RU` | `1qd9R09Ljlx9V1Ok0t5S` | Ivan         | Calm / meditative Russian male | 2026-09-10 |

Public pages:
[Aaron Abad](https://json2video.com/ai-voices/elevenlabs/voices/t9LRTh3y1ioN00e9wsNh/),
[Peter K](https://json2video.com/ai-voices/elevenlabs/voices/406EiNlYvqFqcz3vsnOm/),
[Ivan](https://json2video.com/ai-voices/elevenlabs/voices/1qd9R09Ljlx9V1Ok0t5S/).

## Listening pins (`AS-07`, ≥2 per locale, distinct from catalog)

`licensed: true` here means in-app cache/playback under the 2026-09-10 product pin. It is **not** a
share-out-of-app licence. Voice Library / PVC voices can be withdrawn after a notice period; a
withdrawn id fails closed rather than substituting another locale.

| Target  | Voice IDs                                      | Display names        | Locale tags (public)                            | Licence / commercial | Pronunciation review | Pin date   |
| ------- | ---------------------------------------------- | -------------------- | ----------------------------------------------- | -------------------- | -------------------- | ---------- |
| `es-ES` | `KHCvMklQZZo0O30ERnVn`, `usTmJvQOCyW3nRcZ8OEo` | Sara Martin 1, Dante | Spanish-Castilian; Castilian Spanish male       | in-app cache only    | **open**             | 2026-09-10 |
| `bg-BG` | `M1ydWt7KnBCiuv4CnEDC`, `gdk0ZsvfAOobfbTtnx6p` | Milena, Kosta        | Bulgarian female; conversational Bulgarian male | in-app cache only    | **open**             | 2026-09-10 |
| `ru-RU` | `EDpEYNf6XIeKYRzYcx4I`, `ogi2DyUAKJb7CEdqqvlU` | MARIIA_R, Stanislav  | Russian female; Russian male narrator           | in-app cache only    | **open**             | 2026-09-10 |

Public pages:
[Sara Martin 1](https://json2video.com/ai-voices/elevenlabs/voices/KHCvMklQZZo0O30ERnVn/),
[Dante](https://json2video.com/ai-voices/elevenlabs/voices/usTmJvQOCyW3nRcZ8OEo/),
[Milena](https://json2video.com/ai-voices/elevenlabs/voices/M1ydWt7KnBCiuv4CnEDC/),
[Kosta](https://json2video.com/ai-voices/elevenlabs/voices/gdk0ZsvfAOobfbTtnx6p/),
[MARIIA_R](https://json2video.com/ai-voices/elevenlabs/voices/EDpEYNf6XIeKYRzYcx4I/),
[Stanislav](https://json2video.com/ai-voices/elevenlabs/voices/ogi2DyUAKJb7CEdqqvlU/).

| Field                           | Pin                                                                    |
| ------------------------------- | ---------------------------------------------------------------------- |
| Listening / catalog model       | `eleven_multilingual_v2` (`es`, `bg`, `ru` among documented languages) |
| Alternate model (not preferred) | `eleven_flash_v2_5` (latency, not listening quality) — do not pin      |

Official model list: [Models](https://elevenlabs.io/docs/overview/models).

## Budget (character-based; no invented USD)

- Catalog seed: one take per phrase for the 150-phrase spine, then 600 v1 phrases, one voice per
  locale.
- Listening: default 3 takes/phrase rotating the two licensed IDs (`A`, `B`, `A`). Character spend
  is target text × takes, not a second provider.
- Fail closed on 429/402. CI and local default stay `TTS_PROVIDER=stub` and never call ElevenLabs.

## Pronunciation replacement

A failed bilingual listen replaces **that** listening ID in `LISTENING_VOICE_DECISION`, or triggers
a catalog-wide re-render if the **reference** voice is wrong. Never silently substitute another
locale's voice. Do not present device TTS as the licensed pin.

## Runtime notes

1. `LISTENING_VOICE_DECISION.modelId` is `eleven_multilingual_v2`.
2. Each enabled target has ≥2 `{ id, locale, name, licensed: true }` entries.
3. Keep `LISTENING_SHARE_ENABLED = false` until Q-22.
4. Catalog `TTS_VOICE_*` / `TTS_MODEL` remain the reference path. They must not enable listening.
5. Live generate still needs `TTS_API_KEY`, `TTS_PROVIDER=elevenlabs`, a paid plan, and Voice
   Library add-to-My-Voices. Unlicensed, wrong-locale, duplicate, empty, or catalog IDs are ignored
   by `selectLicensedListeningVoices`. Native debug fixture voices (`dev-listen-*`) must never merge
   into this object. `TTS_STUB_RENDER=1` is labeled listening-class silence for local cache wiring,
   not a bilingual seed and not catalog publish.
