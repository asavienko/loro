# ElevenLabs transports — AS-01

Provider-only HTTP adapters. Nest registration, caching and fallbacks belong to their callers.

## Text-to-speech (`tts.ts`)

`ElevenLabsTts` sends one text-only request to `https://api.elevenlabs.io/v1/text-to-speech/<voice>`
with an explicit model, output format, byte limits, deadline and concurrency. It refuses redirects,
makes no retries, bounds the audio it reads and accepts only audio content types. It records
`xi-character-count` when the provider sends one and never estimates duration or cost. Failures are
a `TtsFailure` with a fixed code only.

`parseTtsConfig` reads the `TTS_*` values that `config.ttsEnv()` passes in.
`TTS_PROVIDER=elevenlabs` needs `TTS_API_KEY`, `TTS_MODEL` and `TTS_VOICE_ES_ES`; `TTS_VOICE_BG_BG`,
`TTS_VOICE_RU_RU` and `TTS_VOICE_EN_GB` add those languages. An incomplete configuration falls back
to the stub.

| Caller                              | Use                                                                                                      | Limits            |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------- |
| `tts/transport.ts`                  | The process-wide transport: the library's phrase clips (`library/speech.ts`) and the older `/tts` routes | 8 s, 2 at a time  |
| `library/speech.ts`                 | Raw PCM lines spoken over a demo song                                                                    | 10 s, 2 at a time |
| `packages/content` `content:render` | Authoring catalog audio                                                                                  | its own           |

`StubTts` is the default (`TTS_PROVIDER=stub`) and returns no audio. With `TTS_STUB_RENDER=1` it
returns labelled silent AAC for the older `/tts` routes in local development; a stub render can
never be published as catalog audio. Q-15 decides the voices.

## Music (`music.ts`)

`ElevenLabsMusicAdapter` serves the older `/music` routes, from fixtures unless
`MUSIC_PROVIDER=elevenlabs`; `wav.ts` makes the fixtures' silent WAV. The library's songs don't use
it: `library/music-live.ts` calls ElevenLabs Music itself.

## Tests and limits

`maxConcurrentRequests` works as in the text-model transports (`../openai-compatible/`,
`../openrouter/`): over the limit, a call fails at once with `capacity`. An injected fetch exercises
the failure modes and a loopback server proves a stalled body is aborted; no live ElevenLabs traffic
is sent.

No recorded learner audio, ASR upload or voice-clone transport exists here.
