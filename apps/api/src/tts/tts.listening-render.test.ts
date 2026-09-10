/**
 * Listening-class success path against the real Q-15 pins.
 * Transport is mocked. No live ElevenLabs credits.
 */
import { createHash } from 'node:crypto'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Test } from '@nestjs/testing'
import type { ExecutionContext, INestApplication } from '@nestjs/common'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { silenceWav } from '@loro/content/audio-duration'
import {
  ELEVENLABS_MULTILINGUAL_V2,
  LISTENING_ASSET_CLASS,
  LISTENING_CODEC,
  LISTENING_VOICE_DECISION,
} from '@loro/core'
import { TtsResponseSchema } from '@loro/core/api/draft'
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js'
import { ProblemDetailsFilter } from '../common/problem-filter.js'
import { SERVER_CLOCK } from '../common/clock.js'
import { LoroError } from '../common/errors.js'
import { TtsController } from './tts.controller.js'
import { TtsService } from './tts.service.js'
import { TTS_TRANSPORT, type TtsTransport } from './transport.js'

const text = 'Me pone un cortado, por favor'
const phraseHash = createHash('sha256').update(text, 'utf8').digest('hex')
const wav = silenceWav(200)

function pinnedListeningBody() {
  const voice = LISTENING_VOICE_DECISION.voices['es-ES'][0]
  if (voice === undefined) throw new Error('expected pinned es-ES listening voice')
  return {
    text,
    lang: 'es-ES' as const,
    phrase_hash: phraseHash,
    voice_id: voice.id,
    model_id: ELEVENLABS_MULTILINGUAL_V2,
    asset_class: LISTENING_ASSET_CLASS,
    codec: LISTENING_CODEC,
  }
}

function liveEnv(cacheDir: string): void {
  vi.stubEnv('TTS_PROVIDER', 'elevenlabs')
  vi.stubEnv('TTS_API_KEY', 'test-only')
  vi.stubEnv('TTS_MODEL', ELEVENLABS_MULTILINGUAL_V2)
  vi.stubEnv('TTS_VOICE_ES_ES', 'voice-es')
  vi.stubEnv('TTS_CACHE_DIR', cacheDir)
}

function transport(synthesize: TtsTransport['synthesize']): TtsTransport {
  return { synthesize }
}

describe('listening-class TTS render with pinned voices', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('synthesizes the pinned listening voice_id and returns metadata without JSON PCM', async () => {
    const cacheDir = await mkdtemp(join(tmpdir(), 'loro-tts-listen-ok-'))
    liveEnv(cacheDir)
    const listeningBody = pinnedListeningBody()
    const synthesize = vi.fn(() =>
      Promise.resolve({
        bytes: wav,
        contentType: 'audio/wav',
        provenance: {
          provider: 'elevenlabs' as const,
          model: ELEVENLABS_MULTILINGUAL_V2,
          voiceId: listeningBody.voice_id,
          outputFormat: 'mp3_44100_128',
          locale: 'es-ES',
        },
        characterCount: null,
      }),
    )
    const tts = new TtsService(transport(synthesize), { now: () => 1_000 })
    const raw = await tts.render({ userId: 'learner', ip: '127.0.0.1', body: listeningBody })
    expect(raw).not.toHaveProperty('audio')
    const body = TtsResponseSchema.parse(raw)
    expect(body.voice_id).toBe(listeningBody.voice_id)
    expect(body.model_id).toBe(ELEVENLABS_MULTILINGUAL_V2)
    expect(body.asset_class).toBe(LISTENING_ASSET_CLASS)
    expect(body.download_url).toMatch(/\/v1\/tts\/assets\/[a-f0-9]{64}$/)
    expect(synthesize).toHaveBeenCalledTimes(1)
    expect(synthesize).toHaveBeenCalledWith(
      expect.objectContaining({
        text,
        locale: 'es-ES',
        voiceId: listeningBody.voice_id,
        modelId: ELEVENLABS_MULTILINGUAL_V2,
      }),
    )
    const asset = await tts.asset(body.sha256)
    expect(asset.bytes.equals(Buffer.from(wav))).toBe(true)
  })

  it('rejects an unapproved listening voice without synthesizing', async () => {
    const cacheDir = await mkdtemp(join(tmpdir(), 'loro-tts-listen-reject-'))
    liveEnv(cacheDir)
    const synthesize = vi.fn()
    const tts = new TtsService(transport(synthesize), { now: () => 1 })
    await expect(
      tts.render({
        userId: 'learner',
        ip: '127.0.0.1',
        body: { ...pinnedListeningBody(), voice_id: 'unapproved-voice' },
      }),
    ).rejects.toBeInstanceOf(LoroError)
    expect(synthesize).not.toHaveBeenCalled()
  })
})

describe('authenticated listening-class HTTP surface', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns voice_id and asset_class listening with no audio field', async () => {
    const cacheDir = await mkdtemp(join(tmpdir(), 'loro-tts-listen-http-'))
    liveEnv(cacheDir)
    const listeningBody = pinnedListeningBody()
    const synthesize = vi.fn(() =>
      Promise.resolve({
        bytes: wav,
        contentType: 'audio/wav',
        provenance: {
          provider: 'elevenlabs' as const,
          model: ELEVENLABS_MULTILINGUAL_V2,
          voiceId: listeningBody.voice_id,
          outputFormat: 'mp3_44100_128',
          locale: 'es-ES',
        },
        characterCount: null,
      }),
    )
    const module = await Test.createTestingModule({
      controllers: [TtsController],
      providers: [
        TtsService,
        { provide: TTS_TRANSPORT, useValue: transport(synthesize) },
        { provide: SERVER_CLOCK, useValue: { now: () => 1_000 } },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
          if (request.headers.authorization !== 'Bearer test') {
            throw new LoroError('UNAUTHENTICATED')
          }
          request.principal = {
            userId: 'tts-learner',
            deviceId: 'tts-device',
            sessionId: 'tts-session',
          }
          return true
        },
      })
      .compile()
    const app: INestApplication = module.createNestApplication()
    app.setGlobalPrefix('v1')
    app.useGlobalFilters(new ProblemDetailsFilter())
    await app.listen(0, '127.0.0.1')
    const base = await app.getUrl()
    try {
      const created = await fetch(`${base}/v1/tts/render`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer test' },
        body: JSON.stringify(listeningBody),
      })
      expect(created.status).toBe(200)
      const json: unknown = await created.json()
      expect(json).not.toHaveProperty('audio')
      const body = TtsResponseSchema.parse(json)
      expect(body.voice_id).toBe(listeningBody.voice_id)
      expect(body.asset_class).toBe(LISTENING_ASSET_CLASS)
      expect(synthesize).toHaveBeenCalledWith(
        expect.objectContaining({
          voiceId: listeningBody.voice_id,
          locale: 'es-ES',
          modelId: ELEVENLABS_MULTILINGUAL_V2,
        }),
      )
    } finally {
      await app.close()
    }
  })
})
