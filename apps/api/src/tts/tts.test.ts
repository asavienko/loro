import { createHash } from 'node:crypto'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Test } from '@nestjs/testing'
import type { ExecutionContext, INestApplication } from '@nestjs/common'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { silenceWav } from '@loro/content/audio-duration'
import {
  CATALOG_REFERENCE_VOICES,
  ELEVENLABS_MULTILINGUAL_V2,
  LISTENING_ASSET_CLASS,
  LISTENING_CODEC,
  LISTENING_VOICE_DECISION,
  REFERENCE_ASSET_CLASS,
} from '@loro/core'
import { TtsResponseSchema } from '@loro/core/api/draft'
import { ProblemSchema } from '@loro/core/api/current'
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js'
import { ProblemDetailsFilter } from '../common/problem-filter.js'
import { SERVER_CLOCK } from '../common/clock.js'
import { LoroError } from '../common/errors.js'
import { TtsFailure } from '../integrations/elevenlabs/tts.js'
import { TtsController } from './tts.controller.js'
import { TtsService } from './tts.service.js'
import { TTS_TRANSPORT, type TtsTransport } from './transport.js'

const text = 'Me pone un cortado, por favor'
const phraseHash = createHash('sha256').update(text, 'utf8').digest('hex')
const wav = silenceWav(200)
const provenance = {
  provider: 'elevenlabs' as const,
  model: 'test-model',
  voiceId: 'voice-es',
  outputFormat: 'mp3_44100_128',
  locale: 'es-ES',
}
const referenceBody = {
  text,
  lang: 'es-ES' as const,
  phrase_hash: phraseHash,
  voice_id: 'voice-es',
  model_id: 'test-model',
  asset_class: REFERENCE_ASSET_CLASS,
  codec: LISTENING_CODEC,
}

function liveEnv(cacheDir: string): void {
  vi.stubEnv('TTS_PROVIDER', 'elevenlabs')
  vi.stubEnv('TTS_API_KEY', 'test-only')
  vi.stubEnv('TTS_MODEL', 'test-model')
  vi.stubEnv('TTS_VOICE_ES_ES', 'voice-es')
  vi.stubEnv('TTS_CACHE_DIR', cacheDir)
}

function transport(synthesize: TtsTransport['synthesize']): TtsTransport {
  return { synthesize }
}

describe('gated POST /tts/render', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns 503 in stub mode and never yields publishable audio', async () => {
    vi.stubEnv('TTS_PROVIDER', 'stub')
    const tts = new TtsService(
      transport(() => Promise.reject(new Error('stub must not synthesize'))),
      { now: () => 1 },
    )
    await expect(
      tts.render({
        userId: 'learner',
        ip: '127.0.0.1',
        body: referenceBody,
      }),
    ).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE', status: 503 })
  })

  it('recomputes the text hash, caches identity, and serves bytes without JSON audio', async () => {
    const cacheDir = await mkdtemp(join(tmpdir(), 'loro-tts-'))
    liveEnv(cacheDir)
    const synthesize = vi.fn(() =>
      Promise.resolve({
        bytes: wav,
        contentType: 'audio/wav',
        provenance,
        characterCount: 12,
      }),
    )
    const tts = new TtsService(transport(synthesize), { now: () => 1_000 })
    const body = referenceBody
    const first = TtsResponseSchema.parse(
      await tts.render({ userId: 'learner', ip: '127.0.0.1', body }),
    )
    expect(first.cached).toBe(false)
    expect(first.ms).toBe(200)
    expect(first.uri).toBe(`sha256/${first.sha256}`)
    expect(first.download_url).toMatch(/\/v1\/tts\/assets\/[a-f0-9]{64}$/)
    expect(first.asset_class).toBe(REFERENCE_ASSET_CLASS)
    expect(first).not.toHaveProperty('audio')
    const second = await tts.render({ userId: 'learner', ip: '127.0.0.1', body })
    expect(second).toMatchObject({ cached: true, sha256: first.sha256, ms: 200 })
    expect(synthesize).toHaveBeenCalledTimes(1)
    const asset = await tts.asset(first.sha256)
    expect(asset.bytes.equals(Buffer.from(wav))).toBe(true)
    expect(asset.contentType).toBe('audio/wav')
    await expect(
      tts.render({
        userId: 'learner',
        ip: '127.0.0.1',
        body: { text, lang: 'es-ES', phrase_hash: 'a'.repeat(64) },
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' })
  })

  it('fails closed for listening-class when voices are unapproved', async () => {
    const cacheDir = await mkdtemp(join(tmpdir(), 'loro-tts-'))
    liveEnv(cacheDir)
    const synthesize = vi.fn()
    const tts = new TtsService(transport(synthesize), { now: () => 1 })
    await expect(
      tts.render({
        userId: 'learner',
        ip: '127.0.0.1',
        body: {
          ...referenceBody,
          asset_class: LISTENING_ASSET_CLASS,
          voice_id: 'unapproved-voice',
          model_id: ELEVENLABS_MULTILINGUAL_V2,
        },
      }),
    ).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' })
    expect(synthesize).not.toHaveBeenCalled()
  })

  it('rejects a catalog reference id and flash model as listening without synthesizing', async () => {
    const cacheDir = await mkdtemp(join(tmpdir(), 'loro-tts-'))
    liveEnv(cacheDir)
    const synthesize = vi.fn()
    const tts = new TtsService(transport(synthesize), { now: () => 1 })
    const listeningVoice = LISTENING_VOICE_DECISION.voices['es-ES'][0]
    if (listeningVoice === undefined) throw new Error('expected pinned es-ES listening voice')
    await expect(
      tts.render({
        userId: 'learner',
        ip: '127.0.0.1',
        body: {
          ...referenceBody,
          asset_class: LISTENING_ASSET_CLASS,
          voice_id: CATALOG_REFERENCE_VOICES['es-ES'].id,
          model_id: ELEVENLABS_MULTILINGUAL_V2,
        },
      }),
    ).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' })
    await expect(
      tts.render({
        userId: 'learner',
        ip: '127.0.0.1',
        body: {
          ...referenceBody,
          asset_class: LISTENING_ASSET_CLASS,
          voice_id: listeningVoice.id,
          model_id: 'eleven_flash_v2_5',
        },
      }),
    ).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' })
    expect(synthesize).not.toHaveBeenCalled()
  })

  it('does not serve a checksum-mismatched cache file and will not treat it as cached', async () => {
    const cacheDir = await mkdtemp(join(tmpdir(), 'loro-tts-'))
    liveEnv(cacheDir)
    const synthesize = vi.fn(() =>
      Promise.resolve({
        bytes: wav,
        contentType: 'audio/wav',
        provenance,
        characterCount: null,
      }),
    )
    const tts = new TtsService(transport(synthesize), { now: () => 1_000 })
    const body = referenceBody
    const first = await tts.render({ userId: 'learner', ip: '127.0.0.1', body })
    await writeFile(join(cacheDir, `${first.sha256}.bin`), Buffer.from('tampered-audio'))
    await expect(tts.asset(first.sha256)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    const retry = await tts.render({ userId: 'learner', ip: '127.0.0.1', body })
    expect(retry.cached).toBe(false)
    expect(synthesize).toHaveBeenCalledTimes(2)
  })

  it('rate-limits a user after the documented daily cap, including cache hits', async () => {
    const cacheDir = await mkdtemp(join(tmpdir(), 'loro-tts-'))
    liveEnv(cacheDir)
    const tts = new TtsService(
      transport(() =>
        Promise.resolve({
          bytes: wav,
          contentType: 'audio/wav',
          provenance,
          characterCount: null,
        }),
      ),
      { now: () => 1_000 },
    )
    const body = referenceBody
    for (let index = 0; index < 100; index += 1) {
      await tts.render({ userId: 'learner', ip: '127.0.0.1', body })
    }
    await expect(tts.render({ userId: 'learner', ip: '127.0.0.1', body })).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      status: 429,
    })
  })

  it('maps provider failures without returning estimated duration', async () => {
    const cacheDir = await mkdtemp(join(tmpdir(), 'loro-tts-'))
    liveEnv(cacheDir)
    const tts = new TtsService(
      transport(() => Promise.reject(new TtsFailure('unavailable'))),
      { now: () => 1 },
    )
    await expect(
      tts.render({
        userId: 'learner',
        ip: '127.0.0.1',
        body: referenceBody,
      }),
    ).rejects.toBeInstanceOf(LoroError)
  })
})

describe('authenticated TTS HTTP surface', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('requires a bearer session and stays draft-only (no clone route)', async () => {
    const cacheDir = await mkdtemp(join(tmpdir(), 'loro-tts-'))
    liveEnv(cacheDir)
    const synthesize = vi.fn(() =>
      Promise.resolve({
        bytes: wav,
        contentType: 'audio/wav',
        provenance,
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
      const unauthenticated = await fetch(`${base}/v1/tts/render`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(referenceBody),
      })
      expect(unauthenticated.status).toBe(401)
      const created = await fetch(`${base}/v1/tts/render`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer test' },
        body: JSON.stringify(referenceBody),
      })
      expect(created.status).toBe(200)
      const body = TtsResponseSchema.parse(await created.json())
      const bytes = await fetch(`${base}/v1/tts/assets/${body.sha256}`, {
        headers: { authorization: 'Bearer test' },
      })
      expect(bytes.status).toBe(200)
      expect(new Uint8Array(await bytes.arrayBuffer()).byteLength).toBe(wav.byteLength)
      const clone = await fetch(`${base}/v1/tts/voice-clone`, {
        method: 'POST',
        headers: { authorization: 'Bearer test' },
      })
      expect(clone.status).toBe(404)
      expect(ProblemSchema.parse(await clone.json()).code).toBe('NOT_FOUND')
    } finally {
      await app.close()
    }
  })
})
