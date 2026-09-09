/**
 * Gated learner TTS. Text only. Draft until Q-15. Never accepts recordings or clones voices.
 */

import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Inject, Injectable } from '@nestjs/common'
import { audioDurationMs } from '@loro/content/audio-duration'
import { TtsRequestSchema, TtsResponseSchema, type TtsResponse } from '@loro/core/api/draft'
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
    const textHash = digestUtf8(request.data.text)
    if (textHash !== request.data.phrase_hash) throw new LoroError('VALIDATION_FAILED')
    let voiceId: string
    try {
      voiceId = voiceForLocale(parsedConfig.voices, request.data.lang)
    } catch {
      throw new LoroError('PROVIDER_UNAVAILABLE')
    }
    this.take(input.userId, input.ip)
    const voiceVersion = `${parsedConfig.model}:${voiceId}`
    const identity = digestUtf8(`${input.userId}:${textHash}:${request.data.lang}:${voiceVersion}`)
    const cached = await this.readIdentity(identity)
    if (cached !== null) return TtsResponseSchema.parse({ ...cached, cached: true })
    const pending = this.inflight.get(identity)
    if (pending !== undefined) return pending
    const work = this.synthesize({
      identity,
      text: request.data.text,
      locale: request.data.lang,
      voiceId,
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

  private async readIdentity(identity: string): Promise<Omit<TtsResponse, 'cached'> | null> {
    try {
      const mapped = JSON.parse(
        await readFile(join(config.ttsCacheDir(), 'id', `${identity}.json`), 'utf8'),
      ) as { sha256?: unknown; ms?: unknown }
      if (typeof mapped.sha256 !== 'string' || !SHA.test(mapped.sha256)) return null
      if (typeof mapped.ms !== 'number' || !Number.isSafeInteger(mapped.ms) || mapped.ms <= 0) {
        return null
      }
      if ((await this.readAsset(mapped.sha256)) === null) return null
      return { uri: `sha256/${mapped.sha256}`, sha256: mapped.sha256, ms: mapped.ms }
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
    return TtsResponseSchema.parse({
      uri: `sha256/${sha256}`,
      sha256,
      ms,
      cached: false,
    })
  }
}
