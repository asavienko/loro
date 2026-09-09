import { describe, expect, it } from 'vitest'
import { LISTENING_ASSET_CLASS, REFERENCE_ASSET_CLASS, listeningClipKey } from '../listening/index.js'
import { TtsRequestSchema, TtsResponseSchema } from './draft.js'

const hash = 'a'.repeat(64)
const listeningRequest = {
  text: 'Un café, por favor.',
  lang: 'es-ES',
  phrase_hash: hash,
  voice_id: 'listening_voice_a',
  model_id: 'eleven_multilingual_v2',
  asset_class: 'listening',
  codec: 'aac-64k-mono-24k',
  phrase_id: 'cafe1',
} as const
const listeningResponse = {
  uri: `sha256/${hash}`,
  sha256: hash,
  ms: 1420,
  cached: true,
  download_url: `https://cdn.loro.test/sha256/${hash}.m4a`,
  voice_id: 'listening_voice_a',
  model_id: 'eleven_multilingual_v2',
  asset_class: 'listening',
}

describe('POST /tts/render listening-class contract', () => {
  it('requires voice, model, codec and asset class, and metadata-only JSON', () => {
    expect(TtsRequestSchema.parse(listeningRequest)).toEqual(listeningRequest)
    expect(TtsResponseSchema.parse(listeningResponse).download_url).toMatch(/^https:/)
    expect(
      TtsRequestSchema.safeParse({
        text: listeningRequest.text,
        lang: 'es-ES',
        phrase_hash: hash,
      }).success,
    ).toBe(false)
    expect(
      TtsResponseSchema.safeParse({
        uri: listeningResponse.uri,
        sha256: hash,
        ms: 1420,
        cached: true,
      }).success,
    ).toBe(false)
    expect(
      TtsResponseSchema.safeParse({ ...listeningResponse, audio: 'base64' }).success,
    ).toBe(false)
    expect(TtsResponseSchema.parse({ ...listeningResponse, ms: null }).ms).toBeNull()
  })

  it('accepts bg-BG and ru-RU listening locales and rejects a one-voice catalog body', () => {
    expect(TtsRequestSchema.parse({ ...listeningRequest, lang: 'bg-BG' }).lang).toBe('bg-BG')
    expect(TtsRequestSchema.parse({ ...listeningRequest, lang: 'ru-RU' }).lang).toBe('ru-RU')
    expect(
      TtsRequestSchema.safeParse({ ...listeningRequest, lang: 'en-US' }).success,
    ).toBe(false)
    expect(
      TtsRequestSchema.parse({ ...listeningRequest, asset_class: REFERENCE_ASSET_CLASS }).asset_class,
    ).toBe(REFERENCE_ASSET_CLASS)
  })

  it('keeps listening and reference identities distinct for the same text and voice', () => {
    const shared = {
      locale: 'es-ES' as const,
      phraseId: 'cafe1',
      textDigest: hash,
      voiceId: 'listening_voice_a',
      modelId: 'eleven_multilingual_v2',
      codec: 'aac-64k-mono-24k' as const,
    }
    expect(listeningClipKey({ ...shared, assetClass: LISTENING_ASSET_CLASS })).not.toBe(
      listeningClipKey({ ...shared, assetClass: REFERENCE_ASSET_CLASS }),
    )
  })
})
