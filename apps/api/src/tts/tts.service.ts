/**
 * Gated learner TTS. Text only. Draft until Q-15. Never accepts recordings or clones voices.
 * Listening-class renders fail closed until Q-15 pins ≥2 licensed voices (AS-07).
 */

import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Inject, Injectable } from '@nestjs/common'
import { audioDurationMs } from '@loro/content/audio-duration'
import {
  APPROVED_LISTENING_VOICES,
  LISTENING_ASSET_CLASS,
  LISTENING_MIN_VOICES,
  LISTENING_MODEL_ID,
  REFERENCE_ASSET_CLASS,
  normalizeListeningText,
} from '@loro/core'
import { TtsRequestSchema, TtsResponseSchema, type TtsRequest, type TtsResponse } from '@loro/core/api/draft'
import { config } from '../common/config.js'
import { SERVER_CLOCK, type ServerClock } from '../common/clock.js'
import { LoroError, RATE_LIMITS } from '../common/errors.js'
import {
  isTtsFailure,
  parseTtsConfig,
  voiceForLocale,
  type TtsFailureCode,
} from '../integrations/elevenlabs/tts.js'
import { TTS_TRANSPORT, type TtsTransport } from './transport.js'

const SHA = /^[a-f0-9]{64}$/
const limits = RATE_LIMITS.ttsRender

function digestUtf8(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function failureToHttp(code: TtsFailureCode): never {
  if (code === 'input') throw new LoroError('VALIDATION_FAILED')
  if (code === 'rate_limited') {
    throw new LoroError('RATE_LIMITED', undefined, { retry_after: 60 })
  }
  throw new LoroError('PROVIDER_UNAVAILABLE')
}

function ttsPublicOrigin(): string {
  const raw = process.env['AUTH_PUBLIC_URL'] ?? process.env['AUTH_ISSUER'] ?? 'https://api.loro.app'
  return raw.replace(/\/$/, '')
}

function downloadUrl(sha256: string): string {
  return `${ttsPublicOrigin()}/v1/tts/assets/${sha256}`
}

function metadata(input: {
  sha256: string
  ms: number
  cached: boolean
  voiceId: string
  modelId: string
  assetClass: TtsRequest['asset_class']
}): TtsResponse {
  return TtsResponseSchema.parse({
    uri: `sha256/${input.sha256}`,
    sha256: input.sha256,
    ms: input.ms,
    cached: input.cached,
    download_url: downloadUrl(input.sha256),
    voice_id: input.voiceId,
    model_id: input.modelId,
    asset_class: input.assetClass,
  })
}

@Injectable()
export class TtsService {
  private readonly hits = new Map<string, number[]>()
  private readonly inflight = new Map<string, Promise<TtsResponse>>()

  constructor(
    @Inject(TTS_TRANSPORT) private readonly transport: TtsTransport,
    @Inject(SERVER_CLOCK) private readonly clock: ServerClock,
  ) {}

  async render(input: { userId: string; ip: string; body: unknown }): Promise<TtsResponse> {
    let parsedConfig
    try {
      parsedConfig = parseTtsConfig(config.ttsEnv())
    } catch {
      throw new LoroError('PROVIDER_UNAVAILABLE')
    }
    if (parsedConfig.provider !== 'elevenlabs') {
      throw new LoroError('PROVIDER_UNAVAILABLE')
    }
    const request = TtsRequestSchema.safeParse(input.body)
    if (!request.success) throw new LoroError('VALIDATION_FAILED')
    const text = normalizeListeningText(request.data.text)
    const textHash = digestUtf8(text)
    if (textHash !== request.data.phrase_hash) throw new LoroError('VALIDATION_FAILED')
    if (
      request.data.asset_class !== LISTENING_ASSET_CLASS &&
      request.data.model_id !== parsedConfig.model
    ) {
      throw new LoroError('PROVIDER_UNAVAILABLE', 'TTS model is not pinned')
    }
    const voiceId = this.approvedVoice(request.data, parsedConfig.voices)
    this.take(input.userId, input.ip)
    const voiceVersion = `${request.data.asset_class}:${parsedConfig.model}:${voiceId}`
    const identity = digestUtf8(
      `${input.userId}:${textHash}:${request.data.lang}:${voiceVersion}`,
    )
    const cached = await this.readIdentity(identity, request.data)
    if (cached !== null) return cached
    const pending = this.inflight.get(identity)
    if (pending !== undefined) return pending
    const work = this.synthesize({
      identity,
      text,
      locale: request.data.lang,
      voiceId,
      modelId: request.data.model_id,
      assetClass: request.data.asset_class,
    })
    this.inflight.set(identity, work)
    try {
      return await work
    } finally {
      this.inflight.delete(identity)
    }
  }

  async asset(sha256: string): Promise<{ bytes: Buffer; contentType: string }> {
    if (!SHA.test(sha256)) throw new LoroError('VALIDATION_FAILED')
    const file = await this.readAsset(sha256)
    if (file === null) throw new LoroError('NOT_FOUND')
    return file
  }

  private approvedVoice(
    request: TtsRequest,
    catalogVoices: Readonly<Record<string, string>>,
  ): string {
    if (request.asset_class === LISTENING_ASSET_CLASS) {
      const roster = APPROVED_LISTENING_VOICES[request.lang]
      if (roster.length < LISTENING_MIN_VOICES) {
        throw new LoroError('PROVIDER_UNAVAILABLE', 'Licensed listening voices are not approved')
      }
      if (LISTENING_MODEL_ID === null || request.model_id !== LISTENING_MODEL_ID) {
        throw new LoroError('PROVIDER_UNAVAILABLE', 'Listening model is not pinned')
      }
      if (!roster.some((voice) => voice.id === request.voice_id && voice.licensed)) {
        throw new LoroError('PROVIDER_UNAVAILABLE', 'Listening voice is not an approved licensed id')
      }
      return request.voice_id
    }
    if (request.asset_class !== REFERENCE_ASSET_CLASS) {
      throw new LoroError('VALIDATION_FAILED')
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

  private take(userId: string, ip: string): void {
    const now = this.clock.now()
    const windowMs = limits.windowMinutes * 60_000
    if (!this.admit(`user:${userId}`, limits.perUser, now, windowMs)) {
      throw new LoroError('RATE_LIMITED', undefined, { retry_after: 60 })
    }
    if (!this.admit(`ip:${ip}`, limits.perIp, now, windowMs)) {
      throw new LoroError('RATE_LIMITED', undefined, { retry_after: 60 })
    }
  }

  private admit(key: string, limit: number, now: number, windowMs: number): boolean {
    const start = now - windowMs
    const times = (this.hits.get(key) ?? []).filter((time) => time > start)
    if (times.length >= limit) {
      this.hits.set(key, times)
      return false
    }
    times.push(now)
    this.hits.set(key, times)
    return true
  }

  private async readIdentity(
    identity: string,
    request: TtsRequest,
  ): Promise<TtsResponse | null> {
    try {
      const mapped = JSON.parse(
        await readFile(join(config.ttsCacheDir(), 'id', `${identity}.json`), 'utf8'),
      ) as { sha256?: unknown; ms?: unknown }
      if (typeof mapped.sha256 !== 'string' || !SHA.test(mapped.sha256)) return null
      if (typeof mapped.ms !== 'number' || !Number.isSafeInteger(mapped.ms) || mapped.ms <= 0) {
        return null
      }
      if ((await this.readAsset(mapped.sha256)) === null) return null
      return metadata({
        sha256: mapped.sha256,
        ms: mapped.ms,
        cached: true,
        voiceId: request.voice_id,
        modelId: request.model_id,
        assetClass: request.asset_class,
      })
    } catch {
      return null
    }
  }

  private async readAsset(sha256: string): Promise<{ bytes: Buffer; contentType: string } | null> {
    try {
      const dir = config.ttsCacheDir()
      const bytes = await readFile(join(dir, `${sha256}.bin`))
      if (createHash('sha256').update(bytes).digest('hex') !== sha256) return null
      const sidecar = JSON.parse(await readFile(join(dir, `${sha256}.json`), 'utf8')) as {
        contentType?: unknown
      }
      const contentType =
        typeof sidecar.contentType === 'string' && sidecar.contentType.length > 0
          ? sidecar.contentType
          : 'application/octet-stream'
      return { bytes, contentType }
    } catch {
      return null
    }
  }

  private async synthesize(input: {
    identity: string
    text: string
    locale: string
    voiceId: string
    modelId: string
    assetClass: TtsRequest['asset_class']
  }): Promise<TtsResponse> {
    let result
    try {
      result = await this.transport.synthesize({
        text: input.text,
        locale: input.locale,
        voiceId: input.voiceId,
      })
    } catch (error) {
      if (isTtsFailure(error)) failureToHttp(error.code)
      throw new LoroError('PROVIDER_UNAVAILABLE')
    }
    if (result.provenance.provider !== 'elevenlabs') {
      throw new LoroError('PROVIDER_UNAVAILABLE')
    }
    const ms = audioDurationMs(result.bytes)
    if (ms === null) throw new LoroError('PROVIDER_UNAVAILABLE')
    const sha256 = createHash('sha256').update(result.bytes).digest('hex')
    const dir = config.ttsCacheDir()
    await mkdir(join(dir, 'id'), { recursive: true })
    const tmp = join(dir, `${sha256}.tmp`)
    await writeFile(tmp, result.bytes)
    await rename(tmp, join(dir, `${sha256}.bin`))
    await writeFile(
      join(dir, `${sha256}.json`),
      `${JSON.stringify({ ...result.provenance, contentType: result.contentType, ms }, null, 2)}\n`,
    )
    await writeFile(
      join(dir, 'id', `${input.identity}.json`),
      `${JSON.stringify({ sha256, ms })}\n`,
    )
    return metadata({
      sha256,
      ms,
      cached: false,
      voiceId: input.voiceId,
      modelId: input.modelId,
      assetClass: input.assetClass,
    })
  }
}
