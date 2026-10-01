/** Provider-only TTS transport. Runtime routes are registered only by the owning Nest module. */

import { silenceAac } from '@loro/content/audio-duration'
import { ProviderConcurrency } from '../provider-concurrency.js'

export type TtsFailureCode =
  | 'configuration'
  | 'input'
  | 'cancelled'
  | 'timeout'
  | 'unavailable'
  | 'rate_limited'
  | 'capacity'
  | 'invalid_output'

/** Never retain provider bodies, credentials, text, or underlying error causes. */
export class TtsFailure extends Error {
  constructor(readonly code: TtsFailureCode) {
    super(`TTS request failed: ${code}`)
    this.name = 'TtsFailure'
  }
}

export type TtsProviderName = 'stub' | 'elevenlabs'

export interface TtsOptions {
  apiKey: string
  model: string
  outputFormat: string
  timeoutMs: number
  maxRequestBytes: number
  maxResponseBytes: number
  maxConcurrentRequests: number
}

export interface TtsRequest {
  text: string
  locale: string
  voiceId: string
  /** Pinned request model. Listening-class must send `LISTENING_MODEL_ID`. */
  modelId?: string
  signal?: AbortSignal
}

export interface TtsResult {
  bytes: Uint8Array
  contentType: string
  provenance: {
    provider: 'elevenlabs' | 'stub'
    model: string
    voiceId: string
    outputFormat: string
    locale: string
  }
  /** Provider-reported character count when present; never estimated. */
  characterCount: number | null
}

/** Labeled local silence AAC. Not licensed neural audio and not a catalog publish path. */
const STUB_RENDER_FORMAT = 'aac-64k-mono-24k'

const ELEVENLABS_TTS = 'https://api.elevenlabs.io/v1/text-to-speech'
const ALLOWED_AUDIO = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/mp4',
  'audio/aac',
  'audio/mp4a-latm',
  // Raw 16-bit PCM (output_format=pcm_*): the library mixes spoken lines into demo songs.
  'audio/pcm',
  'application/octet-stream',
])

export function parseTtsConfig(env: NodeJS.Dict<string>): {
  provider: TtsProviderName
  apiKey: string
  model: string
  outputFormat: string
  voices: Readonly<Record<string, string>>
  stubRender: boolean
} {
  const provider = env['TTS_PROVIDER'] ?? 'stub'
  if (provider !== 'stub' && provider !== 'elevenlabs') {
    throw new TtsFailure('configuration')
  }
  const voices = {
    'es-ES': (env['TTS_VOICE_ES_ES'] ?? '').trim(),
    'bg-BG': (env['TTS_VOICE_BG_BG'] ?? '').trim(),
    'ru-RU': (env['TTS_VOICE_RU_RU'] ?? '').trim(),
    // The prompts of English-speaking learners (plan 108): the app has no device voice any more.
    'en-GB': (env['TTS_VOICE_EN_GB'] ?? '').trim(),
    'en-US': (env['TTS_VOICE_EN_US'] ?? '').trim(),
    'pl-PL': (env['TTS_VOICE_PL_PL'] ?? '').trim(),
    'cs-CZ': (env['TTS_VOICE_CS_CZ'] ?? '').trim(),
  }
  const apiKey = (env['TTS_API_KEY'] ?? '').trim()
  const model = (env['TTS_MODEL'] ?? '').trim()
  const outputFormat = (env['TTS_OUTPUT_FORMAT'] ?? 'mp3_44100_128').trim()
  if (provider === 'elevenlabs') {
    if (!apiKey || !model || !voices['es-ES'] || !outputFormat) {
      throw new TtsFailure('configuration')
    }
  }
  return {
    provider,
    apiKey,
    model,
    outputFormat,
    voices,
    stubRender: provider === 'stub' && env['TTS_STUB_RENDER'] === '1',
  }
}

export function voiceForLocale(voices: Readonly<Record<string, string>>, locale: string): string {
  const voiceId = voices[locale]?.trim() ?? ''
  if (!voiceId) throw new TtsFailure('configuration')
  return voiceId
}

async function boundedBytes(response: Response, limit: number): Promise<Uint8Array> {
  if (!response.body) throw new TtsFailure('invalid_output')
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const chunk = await reader.read()
      if (chunk.done) break
      const bytes: unknown = chunk.value
      if (!(bytes instanceof Uint8Array)) throw new TtsFailure('invalid_output')
      size += bytes.byteLength
      if (size > limit) {
        await reader.cancel()
        throw new TtsFailure('invalid_output')
      }
      chunks.push(bytes)
    }
  } finally {
    reader.releaseLock()
  }
  return Buffer.concat(chunks)
}

function failureForStatus(status: number): TtsFailureCode {
  if (status === 401 || status === 403 || status === 404) return 'configuration'
  if (status === 429) return 'rate_limited'
  if (status === 402) return 'capacity'
  return 'unavailable'
}

function characterCount(headers: Headers): number | null {
  const raw = headers.get('xi-character-count') ?? headers.get('x-character-count')
  if (raw === null) return null
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value < 0) throw new TtsFailure('invalid_output')
  return value
}

function contentType(value: string | null): string {
  const type = (value ?? 'application/octet-stream').split(';')[0]?.trim().toLowerCase() ?? ''
  if (!ALLOWED_AUDIO.has(type)) throw new TtsFailure('invalid_output')
  return type
}

/** One outbound attempt. Retry and spend policy belong to the authoring CLI, not this adapter. */
export class ElevenLabsTts {
  private readonly options: Readonly<TtsOptions>
  private readonly concurrency: ProviderConcurrency

  constructor(
    options: TtsOptions,
    private readonly send: typeof fetch = fetch,
  ) {
    const limits = [
      options.timeoutMs,
      options.maxRequestBytes,
      options.maxResponseBytes,
      options.maxConcurrentRequests,
    ]
    if (
      !options.apiKey.trim() ||
      !options.model.trim() ||
      !options.outputFormat.trim() ||
      limits.some((value) => !Number.isSafeInteger(value) || value <= 0) ||
      options.timeoutMs > 2_147_483_647
    ) {
      throw new TtsFailure('configuration')
    }
    this.options = Object.freeze({ ...options })
    this.concurrency = new ProviderConcurrency(options.maxConcurrentRequests)
  }

  async synthesize(input: TtsRequest): Promise<TtsResult> {
    if (input.signal?.aborted) throw new TtsFailure('cancelled')
    const text = input.text.trim()
    const voiceId = input.voiceId.trim()
    const locale = input.locale.trim()
    const model = (input.modelId ?? this.options.model).trim()
    if (!text || !voiceId || !locale || !model || /[/?#]/.test(voiceId)) {
      throw new TtsFailure('input')
    }
    let body: string
    try {
      body = JSON.stringify({
        text,
        model_id: model,
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      })
    } catch {
      throw new TtsFailure('input')
    }
    if (Buffer.byteLength(body, 'utf8') > this.options.maxRequestBytes) {
      throw new TtsFailure('input')
    }
    const release = this.concurrency.acquire()
    if (!release) throw new TtsFailure('capacity')
    const deadline = AbortSignal.timeout(this.options.timeoutMs)
    const signal = input.signal ? AbortSignal.any([input.signal, deadline]) : deadline
    const url = `${ELEVENLABS_TTS}/${encodeURIComponent(voiceId)}?output_format=${encodeURIComponent(this.options.outputFormat)}`
    try {
      const response = await this.send(url, {
        method: 'POST',
        redirect: 'error',
        headers: {
          'content-type': 'application/json',
          accept: 'audio/mpeg',
          'xi-api-key': this.options.apiKey,
        },
        body,
        signal,
      })
      if (!response.ok) {
        await response.body?.cancel()
        throw new TtsFailure(failureForStatus(response.status))
      }
      const bytes = await boundedBytes(response, this.options.maxResponseBytes)
      if (bytes.byteLength < 32) throw new TtsFailure('invalid_output')
      const type = contentType(response.headers.get('content-type'))
      const count = characterCount(response.headers)
      signal.throwIfAborted()
      return {
        bytes,
        contentType: type,
        characterCount: count,
        provenance: {
          provider: 'elevenlabs',
          model,
          voiceId,
          outputFormat: this.options.outputFormat,
          locale,
        },
      }
    } catch (error) {
      if (input.signal?.aborted) throw new TtsFailure('cancelled')
      if (deadline.aborted) throw new TtsFailure('timeout')
      if (error instanceof TtsFailure) throw error
      throw new TtsFailure('unavailable')
    } finally {
      release()
    }
  }
}

/**
 * Local default: never yields bytes that can be published as production audio.
 * `stubRender: true` is a labeled listening-class path (`TTS_STUB_RENDER=1`) that still
 * goes through checksum metadata + native `download()`. Catalog seed must not use it.
 */
export class StubTts {
  constructor(private readonly options: { readonly stubRender?: boolean } = {}) {}

  synthesize(input: TtsRequest): Promise<TtsResult> {
    if (this.options.stubRender !== true) {
      return Promise.reject(new TtsFailure('unavailable'))
    }
    const text = input.text.trim()
    const voiceId = input.voiceId.trim()
    const locale = input.locale.trim()
    const model = (input.modelId ?? '').trim()
    if (!text || !voiceId || !locale || !model || /[/?#]/.test(voiceId)) {
      return Promise.reject(new TtsFailure('input'))
    }
    const bytes = silenceAac()
    return Promise.resolve({
      bytes,
      contentType: 'audio/mp4',
      characterCount: null,
      provenance: {
        provider: 'stub',
        model,
        voiceId,
        outputFormat: STUB_RENDER_FORMAT,
        locale,
      },
    })
  }
}

export function isTtsFailure(error: unknown): error is TtsFailure {
  return error instanceof TtsFailure
}
