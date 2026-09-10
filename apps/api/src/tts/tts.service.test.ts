import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  CATALOG_REFERENCE_VOICES,
  ELEVENLABS_MULTILINGUAL_V2,
  LISTENING_ASSET_CLASS,
  LISTENING_CODEC,
  LISTENING_VOICE_DECISION,
} from '@loro/core'
import { TtsService } from './tts.service.js'

const text = 'Me pone un cortado, por favor'
const phraseHash = createHash('sha256').update(text, 'utf8').digest('hex')

function liveEnv(cacheDir: string): void {
  vi.stubEnv('TTS_PROVIDER', 'elevenlabs')
  vi.stubEnv('TTS_API_KEY', 'test-only')
  vi.stubEnv('TTS_MODEL', 'test-model')
  vi.stubEnv('TTS_VOICE_ES_ES', 'voice-es')
  vi.stubEnv('TTS_CACHE_DIR', cacheDir)
}

describe('listening-class TTS render', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('fails closed for an unapproved listening voice and does not synthesize', async () => {
    const cacheDir = await mkdtemp(join(tmpdir(), 'loro-tts-listen-'))
    liveEnv(cacheDir)
    const synthesize = vi.fn()
    const tts = new TtsService({ synthesize }, { now: () => 1 })
    await expect(
      tts.render({
        userId: 'learner',
        ip: '127.0.0.1',
        body: {
          text,
          lang: 'es-ES',
          phrase_hash: phraseHash,
          voice_id: 'voice-a',
          model_id: ELEVENLABS_MULTILINGUAL_V2,
          asset_class: LISTENING_ASSET_CLASS,
          codec: LISTENING_CODEC,
        },
      }),
    ).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' })
    expect(synthesize).not.toHaveBeenCalled()
  })

  it('does not spend ElevenLabs credits for a catalog id or flash model', async () => {
    const cacheDir = await mkdtemp(join(tmpdir(), 'loro-tts-listen-model-'))
    liveEnv(cacheDir)
    const synthesize = vi.fn()
    const tts = new TtsService({ synthesize }, { now: () => 1 })
    const listeningVoice = LISTENING_VOICE_DECISION.voices['es-ES'][0]
    if (listeningVoice === undefined) throw new Error('expected pinned es-ES listening voice')
    await expect(
      tts.render({
        userId: 'learner',
        ip: '127.0.0.1',
        body: {
          text,
          lang: 'es-ES',
          phrase_hash: phraseHash,
          voice_id: CATALOG_REFERENCE_VOICES['es-ES'].id,
          model_id: ELEVENLABS_MULTILINGUAL_V2,
          asset_class: LISTENING_ASSET_CLASS,
          codec: LISTENING_CODEC,
        },
      }),
    ).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' })
    await expect(
      tts.render({
        userId: 'learner',
        ip: '127.0.0.1',
        body: {
          text,
          lang: 'es-ES',
          phrase_hash: phraseHash,
          voice_id: listeningVoice.id,
          model_id: 'eleven_flash_v2_5',
          asset_class: LISTENING_ASSET_CLASS,
          codec: LISTENING_CODEC,
        },
      }),
    ).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' })
    expect(synthesize).not.toHaveBeenCalled()
  })
})
