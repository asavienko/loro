# Q-15 listening-voice decision packet

**Status: unsigned.** This packet does not close [Q-15](open-questions.md#q-15). A provisioned API
key is not a licence. Public ElevenLabs voice IDs below are **candidates only** and are
**unapproved**. Do not copy them into `LISTENING_VOICE_DECISION`.

Licensed listening generate has **one runtime switch**: fill
[`LISTENING_VOICE_DECISION`](../../packages/core/src/listening/constants.ts) (`modelId` plus ≥2
`licensed: true` voices per enabled target). Empty arrays and `modelId: null` fail closed in the
composer, `POST /tts/render`, and `listeningAllowlistReady`. Do not add a second env flag, and do
not treat `TTS_VOICE_*` catalog pins as listening voices.

## What must be recorded to pin

For **each** enabled target (`es-ES`, `bg-BG`, `ru-RU`), record every row before writing IDs into
the allowlist. One approved locale does not unlock the others. Listening voices must stay distinct
from the catalog **reference** voice (`TTS_VOICE_*` / plan 61 / `AS-01`).

| Field                   | Why it is required                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------ |
| Voice ID (ElevenLabs)   | Exact `voice_id` used in `POST /tts/render` (`asset_class: listening`)                     |
| Display name            | Learner-visible roster; must be the real name, never a placeholder                         |
| Locale / accent tags    | Voice Library language and region match the target (`es-ES` not generic EN)                |
| ≥2 distinct IDs         | Product is unavailable with zero or one voice (`LISTENING_MIN_VOICES`)                     |
| `licensed: true`        | Commercial + in-app cache rights for this product class                                    |
| Model ID                | One pinned listening model for all listening clips                                         |
| Pronunciation review    | Content lead listened to starter phrases; replacement policy named                         |
| Budget                  | Character/credit ceiling for 150 then 600 phrases × voices × repeats                       |
| Redistribution          | In-app cache only until [Q-22](open-questions.md#q-22); deletion if a licence is withdrawn |
| Distinct from reference | IDs must not equal the catalog reference pin for that locale                               |

## Per-target worksheet (empty until signed)

| Target  | Candidate voice IDs (unapproved)                                         | Review owner        | Licence / commercial rights | Pronunciation review | Pin date |
| ------- | ------------------------------------------------------------------------ | ------------------- | --------------------------- | -------------------- | -------- |
| `es-ES` | _none pinned; pick ≥2 Spanish-tagged Voice Library voices during review_ | Content + tech lead | _open_                      | _open_               | —        |
| `bg-BG` | _none pinned; pick ≥2 Bulgarian-tagged voices; no Spanish substitute_    | Content + tech lead | _open_                      | _open_               | —        |
| `ru-RU` | _none pinned; pick ≥2 Russian-tagged voices; no Spanish substitute_      | Content + tech lead | _open_                      | _open_               | —        |

| Field                           | Candidate (unapproved)                               | Signed pin                                      |
| ------------------------------- | ---------------------------------------------------- | ----------------------------------------------- |
| Listening model                 | `eleven_multilingual_v2`                             | `LISTENING_VOICE_DECISION.modelId` stays `null` |
| Alternate model (not preferred) | `eleven_flash_v2_5` (latency, not listening quality) | do not pin                                      |

## Public research (not an approval)

Cited 2026-09-10 from public ElevenLabs documentation. These IDs are **not** production pins.

**Models**
([What models do you offer?](https://help.elevenlabs.io/hc/en-us/articles/17883183930129-What-models-do-you-offer-and-what-is-the-difference-between-them)
and [Text to Speech](https://elevenlabs.io/docs/capabilities/text-to-speech)):

- `eleven_multilingual_v2` — documented SPA / BUL / RUS among 29 languages. Best public candidate
  for listening quality. **Unapproved.**
- `eleven_flash_v2_5` — also lists BUL / SPA / RUS; ultra-low latency, not the listening-quality
  default. **Unapproved.**
- Commercial use of generated audio requires a paid plan on the vendor FAQ. That still does not
  select a Loro voice or grant share-out-of-app ([Q-22](open-questions.md#q-22)).

**Voice IDs.** Public docs say to choose a Voice Library voice whose accent matches the target
language and region. They do **not** publish a stable per-locale (`es-ES` / `bg-BG` / `ru-RU`)
listening roster. Official Voice Picker examples are English-labelled premade voices (ID shape only;
**not** locale candidates):

| Name   | Voice ID               | Public labels        | Use                   |
| ------ | ---------------------- | -------------------- | --------------------- |
| Rachel | `21m00Tcm4TlvDq8ikWAM` | american, en, female | ID-shape example only |
| Drew   | `29vD33N1CtxCmqQRPOHJ` | american, male       | ID-shape example only |
| Clyde  | `2EiwWnXFnvU5JabPnv8n` | american, en, male   | ID-shape example only |

Source: [Voice Picker](https://ui.elevenlabs.io/docs/components/voice-picker). Do not write these
into `APPROVED_LISTENING_VOICES`. During Q-15 review, copy ≥2 locale-tagged IDs from My Voices / the
List Voices API into `LISTENING_VOICE_DECISION` after licence and pronunciation sign-off.

## Runtime switch (after signing)

1. Set `LISTENING_VOICE_DECISION.modelId` to the signed model.
2. Set each enabled target's array to ≥2 `{ id, locale, name, licensed: true }` entries.
3. Leave unused targets empty (fail-closed) until that locale is reviewed.
4. Keep `LISTENING_SHARE_ENABLED = false` until Q-22.
5. Catalog `TTS_VOICE_ES_ES` / `TTS_MODEL` stay the reference path. They must not enable listening.

Unlicensed, wrong-locale, duplicate, or empty IDs are ignored by `selectLicensedListeningVoices`.
Native debug fixture voices (`dev-listen-*`) must never merge into this object.
