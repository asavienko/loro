/** F-03: implemented draft TTS, music, auth and phrase-suggest routes through the real HTTP app. */
import { createHash } from 'node:crypto'
import type { INestApplication } from '@nestjs/common'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AuthCapabilitiesSchema, ProblemSchema } from '@loro/core/api/current'
import {
  MusicLyricsResponseSchema,
  MusicStatusSchema,
  PhraseSuggestResponseSchema,
  TtsStatusSchema,
  draftOperations,
} from '@loro/core/api/draft'
import { REFERENCE_ASSET_CLASS, LISTENING_CODEC } from '@loro/core'
import { createTestApp, withTestPrincipal } from './testing/create-test-app.js'

const text = 'Me pone un cortado, por favor'
const ttsBody = {
  text,
  lang: 'es-ES',
  phrase_hash: createHash('sha256').update(text, 'utf8').digest('hex'),
  voice_id: 'voice-es',
  model_id: 'test-model',
  asset_class: REFERENCE_ASSET_CLASS,
  codec: LISTENING_CODEC,
}
const lyricsBody = {
  target_locale: 'es-ES',
  meaning_language: 'en',
  catalog_phrase_ids: ['cafe1', 'cafe2', 'cafe3'],
}
const suggestBody = {
  target_locale: 'es-ES',
  native_language: 'en',
  query: 'pharmacy',
}

let app: INestApplication
let base: string
beforeAll(async () => {
  const started = await createTestApp(withTestPrincipal)
  app = started.app
  base = started.base
})
afterAll(async () => {
  await app.close()
})

const headers = { 'content-type': 'application/json', 'x-loro-device': 'contract-device' }

describe('implemented draft HTTP contracts', () => {
  it('keeps the draft operation ids this suite owns', () => {
    expect(draftOperations.map((operation) => operation.id)).toEqual(
      expect.arrayContaining([
        'phraseSuggest',
        'ttsStatus',
        'ttsRender',
        'musicStatus',
        'musicLyrics',
      ]),
    )
  })

  it('serves public auth capabilities', async () => {
    const response = await fetch(`${base}/v1/auth/capabilities`)
    expect(response.status).toBe(200)
    expect(AuthCapabilitiesSchema.parse(await response.json())).toMatchObject({
      apple: false,
      google: false,
      email: false,
    })
  })

  it('suggests bundled phrases without writing catalog rows', async () => {
    const response = await fetch(`${base}/v1/phrases/suggest`, {
      method: 'POST',
      headers,
      body: JSON.stringify(suggestBody),
    })
    expect(response.status).toBe(200)
    const body = PhraseSuggestResponseSchema.parse(await response.json())
    expect(body.fallback).toBe(true)
    expect(body.provenance === 'bundled' || body.provenance === 'unavailable').toBe(true)
  })

  it('publishes TTS status and fails closed on default stub render', async () => {
    const status = await fetch(`${base}/v1/tts/status`)
    expect(status.status).toBe(200)
    expect(TtsStatusSchema.parse(await status.json())).toMatchObject({
      ready: false,
      provider: 'stub',
    })
    const render = await fetch(`${base}/v1/tts/render`, {
      method: 'POST',
      headers,
      body: JSON.stringify(ttsBody),
    })
    // Stub reference render is not anonymous; TtsGuard asks AuthGuard (not the
    // @UseGuards override) and fail-closes before the stub 503.
    expect(render.status).toBe(401)
    expect(ProblemSchema.parse(await render.json()).code).toBe('UNAUTHENTICATED')
  })

  it('publishes music status and serves stub lyrics', async () => {
    const status = await fetch(`${base}/v1/music/status`)
    expect(status.status).toBe(200)
    expect(MusicStatusSchema.parse(await status.json())).toEqual({
      ready: true,
      provider: 'stub',
    })
    const lyrics = await fetch(`${base}/v1/music/lyrics`, {
      method: 'POST',
      headers,
      body: JSON.stringify(lyricsBody),
    })
    expect(lyrics.status).toBe(200)
    expect(MusicLyricsResponseSchema.parse(await lyrics.json()).fallback).toBe(true)
  })
})
