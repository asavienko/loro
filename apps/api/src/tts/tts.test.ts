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
import { TtsFailure, StubTts } from '../integrations/elevenlabs/tts.js'
import { TtsController } from './tts.controller.js'
import { TtsGuard } from './tts.guard.js'
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

  it('renders a pinned listening voice with mocked ElevenLabs and never returns JSON audio', async () => {
    const cacheDir = await mkdtemp(join(tmpdir(), 'loro-tts-listen-pin-'))
    liveEnv(cacheDir)
    const body = pinnedListeningBody()
    const synthesize = vi.fn(() =>
      Promise.resolve({
        bytes: wav,
        contentType: 'audio/wav',
        provenance: {
          provider: 'elevenlabs' as const,
          model: ELEVENLABS_MULTILINGUAL_V2,
          voiceId: body.voice_id,
          outputFormat: 'mp3_44100_128',
          locale: 'es-ES',
        },
        characterCount: null,
      }),
    )
    const tts = new TtsService(transport(synthesize), { now: () => 1_000 })
    const raw = await tts.render({ userId: 'learner', ip: '127.0.0.1', body })
    expect(raw).not.toHaveProperty('audio')
    const first = TtsResponseSchema.parse(raw)
    expect(first.voice_id).toBe(body.voice_id)
    expect(first.model_id).toBe(ELEVENLABS_MULTILINGUAL_V2)
    expect(first.asset_class).toBe(LISTENING_ASSET_CLASS)
    expect(first.download_url).toMatch(/\/v1\/tts\/assets\/[a-f0-9]{64}$/)
    expect(synthesize).toHaveBeenCalledWith(
      expect.objectContaining({
        text,
        locale: 'es-ES',
        voiceId: body.voice_id,
        modelId: ELEVENLABS_MULTILINGUAL_V2,
      }),
    )
    const asset = await tts.asset(first.sha256)
    expect(asset.bytes.equals(Buffer.from(wav))).toBe(true)
  })

  it('serves labeled stub-render listening bytes and still fails closed without the flag', async () => {
    const cacheDir = await mkdtemp(join(tmpdir(), 'loro-tts-stub-listen-'))
    vi.stubEnv('TTS_PROVIDER', 'stub')
    vi.stubEnv('TTS_STUB_RENDER', '1')
    vi.stubEnv('TTS_CACHE_DIR', cacheDir)
    const body = pinnedListeningBody()
    const tts = new TtsService(new StubTts({ stubRender: true }), { now: () => 1_000 })
    const raw = await tts.render({ userId: 'learner', ip: '127.0.0.1', body })
    expect(raw).not.toHaveProperty('audio')
    const first = TtsResponseSchema.parse(raw)
    expect(first.voice_id).toBe(body.voice_id)
    expect(first.asset_class).toBe(LISTENING_ASSET_CLASS)
    expect(first.model_id).toBe(ELEVENLABS_MULTILINGUAL_V2)
    const asset = await tts.asset(first.sha256)
    expect(asset.contentType).toBe('audio/mp4')
    expect(asset.bytes.byteLength).toBeGreaterThan(32)
    await expect(
      tts.render({
        userId: 'learner',
        ip: '127.0.0.1',
        body: { ...referenceBody, model_id: ELEVENLABS_MULTILINGUAL_V2 },
      }),
    ).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' })
    vi.stubEnv('TTS_STUB_RENDER', '0')
    const closed = new TtsService(new StubTts(), { now: () => 1 })
    await expect(closed.render({ userId: 'learner', ip: '127.0.0.1', body })).rejects.toMatchObject(
      {
        code: 'PROVIDER_UNAVAILABLE',
        status: 503,
      },
    )
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

  it('maps a provider capacity failure to budget exceeded', async () => {
    const cacheDir = await mkdtemp(join(tmpdir(), 'loro-tts-'))
    liveEnv(cacheDir)
    const tts = new TtsService(
      transport(() => Promise.reject(new TtsFailure('capacity'))),
      { now: () => 1 },
    )
    await expect(
      tts.render({
        userId: 'learner',
        ip: '127.0.0.1',
        body: referenceBody,
      }),
    ).rejects.toMatchObject({ code: 'BUDGET_EXCEEDED', status: 429 })
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
      .overrideGuard(TtsGuard)
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

describe('anonymous catalog reference HTTP surface', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('publishes status and allows unauthenticated reference render when ElevenLabs is configured', async () => {
    const cacheDir = await mkdtemp(join(tmpdir(), 'loro-tts-anon-'))
    liveEnv(cacheDir)
    vi.stubEnv('AUTH_PUBLIC_URL', '')
    const synthesize = vi.fn(() =>
      Promise.resolve({
        bytes: wav,
        contentType: 'audio/wav',
        provenance,
        characterCount: 12,
      }),
    )
    const module = await Test.createTestingModule({
      controllers: [TtsController],
      providers: [
        TtsService,
        TtsGuard,
        {
          provide: AuthGuard,
          useValue: {
            canActivate() {
              throw new LoroError('UNAUTHENTICATED')
            },
          },
        },
        { provide: TTS_TRANSPORT, useValue: transport(synthesize) },
        { provide: SERVER_CLOCK, useValue: { now: () => 1_000 } },
      ],
    }).compile()
    const app: INestApplication = module.createNestApplication()
    app.setGlobalPrefix('v1')
    app.useGlobalFilters(new ProblemDetailsFilter())
    await app.listen(0, '127.0.0.1')
    const base = await app.getUrl()
    try {
      const status = await fetch(`${base}/v1/tts/status`)
      expect(status.status).toBe(200)
      expect(await status.json()).toEqual({ ready: true, provider: 'elevenlabs' })
      const listening = await fetch(`${base}/v1/tts/render`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(pinnedListeningBody()),
      })
      expect(listening.status).toBe(200)
      expect(TtsResponseSchema.parse(await listening.json()).asset_class).toBe(LISTENING_ASSET_CLASS)
      const created = await fetch(`${base}/v1/tts/render`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(referenceBody),
      })
      expect(created.status).toBe(200)
      const json: unknown = await created.json()
      expect(json).not.toHaveProperty('audio')
      const body = TtsResponseSchema.parse(json)
      expect(body.asset_class).toBe(REFERENCE_ASSET_CLASS)
      expect(body.download_url).toMatch(new RegExp(`^${base}/v1/tts/assets/[a-f0-9]{64}$`))
      const asset = await fetch(`${base}/v1/tts/assets/${body.sha256}`)
      expect(asset.status).toBe(200)
      expect((await asset.arrayBuffer()).byteLength).toBe(wav.byteLength)
    } finally {
      await app.close()
    }
  })
})

describe('stub-render listening HTTP surface', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('allows unauthenticated listening-class render and asset GET when TTS_STUB_RENDER=1', async () => {
    const cacheDir = await mkdtemp(join(tmpdir(), 'loro-tts-stub-http-'))
    vi.stubEnv('TTS_PROVIDER', 'stub')
    vi.stubEnv('TTS_STUB_RENDER', '1')
    vi.stubEnv('TTS_CACHE_DIR', cacheDir)
    vi.stubEnv('AUTH_PUBLIC_URL', 'http://127.0.0.1:3000')
    const module = await Test.createTestingModule({
      controllers: [TtsController],
      providers: [
        TtsService,
        TtsGuard,
        {
          provide: AuthGuard,
          useValue: {
            canActivate() {
              throw new LoroError('UNAUTHENTICATED')
            },
          },
        },
        { provide: TTS_TRANSPORT, useValue: new StubTts({ stubRender: true }) },
        { provide: SERVER_CLOCK, useValue: { now: () => 1_000 } },
      ],
    }).compile()
    const app: INestApplication = module.createNestApplication()
    app.setGlobalPrefix('v1')
    app.useGlobalFilters(new ProblemDetailsFilter())
    await app.listen(0, '127.0.0.1')
    const base = await app.getUrl()
    try {
      const catalog = await fetch(`${base}/v1/tts/render`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(referenceBody),
      })
      expect(catalog.status).toBe(401)
      const created = await fetch(`${base}/v1/tts/render`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(pinnedListeningBody()),
      })
      expect(created.status).toBe(200)
      const json: unknown = await created.json()
      expect(json).not.toHaveProperty('audio')
      const body = TtsResponseSchema.parse(json)
      expect(body.asset_class).toBe(LISTENING_ASSET_CLASS)
      expect(body.voice_id).toBe(pinnedListeningBody().voice_id)
      expect(body.download_url).toMatch(
        /^http:\/\/127\.0\.0\.1:3000\/v1\/tts\/assets\/[a-f0-9]{64}$/,
      )
      const asset = await fetch(`${base}/v1/tts/assets/${body.sha256}`)
      expect(asset.status).toBe(200)
      expect(asset.headers.get('content-type')).toMatch(/audio\/mp4/)
      expect((await asset.arrayBuffer()).byteLength).toBeGreaterThan(32)
    } finally {
      await app.close()
    }
  })
})
