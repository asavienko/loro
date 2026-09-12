/**
 * Gated learner TTS. Text only. Never accepts recordings or clones voices.
 * Listening-class renders use LISTENING_VOICE_DECISION and still fail closed for a
 * wrong voice, unpinned model, missing key, or default stub. `TTS_STUB_RENDER=1`
 * is a labeled listening-class path (checksum metadata + download URL). CI stays
 * on the default stub and must not spend credits. Stub-render listening may be
 * unauthenticated for local cache wiring. ElevenLabs reference and listening
 * render may omit a bearer so web and APK can play; keep `/tts` off the public
 * gateway unless that spend is intended.
 */

import { createHash } from 'node:crypto'
import { Inject, Injectable } from '@nestjs/common'
import { audioDurationMs } from '@loro/content/audio-duration'
import {
  LISTENING_ASSET_CLASS,
  LISTENING_MIN_VOICES,
  approvedListeningVoices,
  isApprovedListeningVoice,
  isPinnedListeningModel,
  normalizeListeningText,
} from '@loro/core'
import {
  TtsRequestSchema,
  TtsResponseSchema,
  type TtsRequest,
  type TtsResponse,
} from '@loro/core/api/draft'
import { config } from '../common/config.js'
import { SERVER_CLOCK, type ServerClock } from '../common/clock.js'
import { LoroError, RATE_LIMITS } from '../common/errors.js'
import { windowMs } from '../common/rate-limit.js'
import { MemoryRateLimitStore } from '../common/rate-limit.memory.js'
import {
  isTtsFailure,
  parseTtsConfig,
  voiceForLocale,
  type TtsFailureCode,
} from '../integrations/elevenlabs/tts.js'
import { SHA256, readTtsAsset, readTtsIdentity, writeTtsRender } from './cache.js'
import { TTS_TRANSPORT, type TtsTransport } from './transport.js'

const limits = RATE_LIMITS.ttsRender

function digestUtf8(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function failureToHttp(code: TtsFailureCode): never {
  if (code === 'input') throw new LoroError('VALIDATION_FAILED')
  if (code === 'rate_limited') {
    throw new LoroError('RATE_LIMITED', undefined, { retry_after: 60 })
  }
  if (code === 'capacity') throw new LoroError('BUDGET_EXCEEDED')
  throw new LoroError('PROVIDER_UNAVAILABLE')
}

function headerString(
  headers: Record<string, unknown> | undefined,
  name: string,
): string | undefined {
  const value = headers?.[name] ?? headers?.[name.toLowerCase()]
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim())
    return value[0].trim()
  return undefined
}

/** Prefer AUTH_PUBLIC_URL; otherwise echo the caller Host so emulator/LAN URLs stay reachable. */
export function ttsDownloadOrigin(request?: {
  protocol?: string
  headers?: Record<string, unknown>
}): string {
  const configured = config.publicUrl()
  if (configured) return configured.replace(/\/$/, '')
  const host = headerString(request?.headers, 'host')
  if (host) {
    const forwarded = headerString(request?.headers, 'x-forwarded-proto')?.split(',')[0]?.trim()
    const proto = forwarded ?? request?.protocol ?? 'http'
    return `${proto}://${host}`
  }
  if (!config.isProduction()) {
    return `http://127.0.0.1:${config.listenPort()}`
  }
  return config.authIssuer().replace(/\/$/, '')
}

function downloadUrl(sha256: string, publicOrigin?: string): string {
  return `${(publicOrigin ?? ttsDownloadOrigin()).replace(/\/$/, '')}/v1/tts/assets/${sha256}`
}

function metadata(input: {
  sha256: string
  ms: number
  cached: boolean
  voiceId: string
  modelId: string
  assetClass: TtsRequest['asset_class']
  publicOrigin?: string
}): TtsResponse {
  return TtsResponseSchema.parse({
    uri: `sha256/${input.sha256}`,
    sha256: input.sha256,
    ms: input.ms,
    cached: input.cached,
    download_url: downloadUrl(input.sha256, input.publicOrigin),
    voice_id: input.voiceId,
    model_id: input.modelId,
    asset_class: input.assetClass,
  })
}

@Injectable()
export class TtsService {
  private readonly hits = new MemoryRateLimitStore()
  private readonly inflight = new Map<string, Promise<TtsResponse>>()

  constructor(
    @Inject(TTS_TRANSPORT) private readonly transport: TtsTransport,
    @Inject(SERVER_CLOCK) private readonly clock: ServerClock,
  ) {}

  status(): { ready: boolean; provider: string } {
    try {
      const parsed = parseTtsConfig(config.ttsEnv())
      return { ready: parsed.provider === 'elevenlabs', provider: parsed.provider }
    } catch {
      return { ready: false, provider: 'unavailable' }
    }
  }

  async render(input: {
    userId: string
    ip: string
    body: unknown
    publicOrigin?: string
  }): Promise<TtsResponse> {
    let parsedConfig
    try {
      parsedConfig = parseTtsConfig(config.ttsEnv())
    } catch {
      throw new LoroError('PROVIDER_UNAVAILABLE')
    }
    const request = TtsRequestSchema.safeParse(input.body)
    if (!request.success) throw new LoroError('VALIDATION_FAILED')
    const listening = request.data.asset_class === LISTENING_ASSET_CLASS
    const stubListening = parsedConfig.provider === 'stub' && parsedConfig.stubRender && listening
    if (parsedConfig.provider !== 'elevenlabs' && !stubListening) {
      throw new LoroError('PROVIDER_UNAVAILABLE')
    }
    const text = normalizeListeningText(request.data.text)
    const textHash = digestUtf8(text)
    if (textHash !== request.data.phrase_hash) throw new LoroError('VALIDATION_FAILED')
    if (!listening && request.data.model_id !== parsedConfig.model) {
      throw new LoroError('PROVIDER_UNAVAILABLE', 'TTS model is not pinned')
    }
    const voiceId = this.approvedVoice(request.data, parsedConfig.voices)
    await this.take(input.userId, input.ip)
    const renderModel = listening ? request.data.model_id : parsedConfig.model
    const voiceVersion = `${request.data.asset_class}:${renderModel}:${voiceId}`
    const identity = digestUtf8(`${input.userId}:${textHash}:${request.data.lang}:${voiceVersion}`)
    const cached = await this.cachedResponse(identity, request.data, input.publicOrigin)
    if (cached !== null) return cached
    const pending = this.inflight.get(identity)
    if (pending !== undefined) return pending
    const work = this.synthesize({
      identity,
      text,
      locale: request.data.lang,
      voiceId,
      modelId: renderModel,
      assetClass: request.data.asset_class,
      allowStub: stubListening,
      ...(input.publicOrigin === undefined ? {} : { publicOrigin: input.publicOrigin }),
    })
    this.inflight.set(identity, work)
    try {
      return await work
    } finally {
      this.inflight.delete(identity)
    }
  }

  async asset(sha256: string): Promise<{ bytes: Buffer; contentType: string }> {
    if (!SHA256.test(sha256)) throw new LoroError('VALIDATION_FAILED')
    const file = await readTtsAsset(sha256)
    if (file === null) throw new LoroError('NOT_FOUND')
    return file
  }

  private approvedVoice(
    request: TtsRequest,
    catalogVoices: Readonly<Record<string, string>>,
  ): string {
    if (request.asset_class === LISTENING_ASSET_CLASS) {
      const roster = approvedListeningVoices(request.lang)
      if (roster.length < LISTENING_MIN_VOICES) {
        throw new LoroError('PROVIDER_UNAVAILABLE', 'Licensed listening voices are not approved')
      }
      if (!isPinnedListeningModel(request.model_id)) {
        throw new LoroError('PROVIDER_UNAVAILABLE', 'Listening model is not pinned')
      }
      if (!isApprovedListeningVoice(request.lang, request.voice_id)) {
        throw new LoroError(
          'PROVIDER_UNAVAILABLE',
          'Listening voice is not an approved licensed id',
        )
      }
      return request.voice_id
    }
    let catalogVoice: string
    try {
      catalogVoice = voiceForLocale(catalogVoices, request.lang)
    } catch {
      throw new LoroError('PROVIDER_UNAVAILABLE')
    }
    if (request.voice_id !== catalogVoice) {
      throw new LoroError('PROVIDER_UNAVAILABLE', 'Reference voice does not match the catalog pin')
    }
    return catalogVoice
  }

  private async take(userId: string, ip: string): Promise<void> {
    const now = this.clock.now()
    const window = windowMs(limits.windowMinutes)
    for (const [key, limit] of [
      [`user:${userId}`, limits.perUser],
      [`ip:${ip}`, limits.perIp],
    ] as const) {
      const decision = await this.hits.consume({
        key,
        limit,
        windowMs: window,
        now,
        algorithm: 'sliding',
      })
      if (!decision.allowed) {
        throw new LoroError('RATE_LIMITED', undefined, { retry_after: 60 })
      }
    }
  }

  private async cachedResponse(
    identity: string,
    request: TtsRequest,
    publicOrigin?: string,
  ): Promise<TtsResponse | null> {
    const mapped = await readTtsIdentity(identity)
    if (mapped === null) return null
    return metadata({
      sha256: mapped.sha256,
      ms: mapped.ms,
      cached: true,
      voiceId: request.voice_id,
      modelId: request.model_id,
      assetClass: request.asset_class,
      ...(publicOrigin === undefined ? {} : { publicOrigin }),
    })
  }

  private async synthesize(input: {
    identity: string
    text: string
    locale: string
    voiceId: string
    modelId: string
    assetClass: TtsRequest['asset_class']
    allowStub: boolean
    publicOrigin?: string
  }): Promise<TtsResponse> {
    let result
    try {
      result = await this.transport.synthesize({
        text: input.text,
        locale: input.locale,
        voiceId: input.voiceId,
        modelId: input.modelId,
      })
    } catch (error) {
      if (isTtsFailure(error)) failureToHttp(error.code)
      throw new LoroError('PROVIDER_UNAVAILABLE')
    }
    const stubOk =
      input.allowStub &&
      input.assetClass === LISTENING_ASSET_CLASS &&
      result.provenance.provider === 'stub'
    if (result.provenance.provider !== 'elevenlabs' && !stubOk) {
      throw new LoroError('PROVIDER_UNAVAILABLE')
    }
    const ms = audioDurationMs(result.bytes)
    if (ms === null) throw new LoroError('PROVIDER_UNAVAILABLE')
    const { sha256 } = await writeTtsRender({
      identity: input.identity,
      bytes: result.bytes,
      contentType: result.contentType,
      provenance: result.provenance,
      ms,
    })
    return metadata({
      sha256,
      ms,
      cached: false,
      voiceId: input.voiceId,
      modelId: input.modelId,
      assetClass: input.assetClass,
      ...(input.publicOrigin === undefined ? {} : { publicOrigin: input.publicOrigin }),
    })
  }
}
