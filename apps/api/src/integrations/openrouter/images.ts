/** OpenRouter's image generation: one picture for a prompt, checked to be what it says (plan 111).
 * https://openrouter.ai/docs/features/multimodal/image-generation
 */
import { boundedJson, isRecord } from '../bounded-body.js'
import { ProviderConcurrency } from '../provider-concurrency.js'
import { ProviderFailure } from '../provider-failure.js'

export const OPENROUTER_IMAGES_URL = 'https://openrouter.ai/api/v1/images'

export type ImageType = 'image/png' | 'image/jpeg' | 'image/webp'

export interface GeneratedImage {
  /** The decoded bytes, whose signature matched `contentType`. */
  bytes: Buffer
  contentType: ImageType
}

export interface ImageModel {
  generate(input: { prompt: string; signal?: AbortSignal }): Promise<GeneratedImage>
}

export interface OpenRouterImagesOptions {
  apiKey: string
  model: string
  timeoutMs: number
  maxPromptBytes: number
  /** The largest decoded image accepted; the response may be a third larger as base64. */
  maxImageBytes: number
  maxConcurrentRequests: number
  /** Fixed routing rules sent with every request. */
  extraBody?: Readonly<Record<string, unknown>>
}

/** The format the bytes are, by their signature; never what the provider says they are. */
export function imageType(bytes: Buffer): ImageType | null {
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return 'image/png'
  if (bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'image/jpeg'
  if (
    bytes.subarray(0, 4).toString('latin1') === 'RIFF' &&
    bytes.subarray(8, 12).toString('latin1') === 'WEBP'
  )
    return 'image/webp'
  return null
}

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/
const invalid = () => new ProviderFailure('invalid_output')

/** Exactly one outbound attempt; the owning service decides what a failure draws instead. */
export class OpenRouterImages implements ImageModel {
  private readonly options: Readonly<OpenRouterImagesOptions>
  private readonly concurrency: ProviderConcurrency

  constructor(
    options: OpenRouterImagesOptions,
    private readonly send: typeof fetch = fetch,
  ) {
    const limits = [
      options.timeoutMs,
      options.maxPromptBytes,
      options.maxImageBytes,
      options.maxConcurrentRequests,
    ]
    if (
      !options.apiKey.trim() ||
      !options.model.trim() ||
      limits.some((value) => !Number.isSafeInteger(value) || value <= 0) ||
      options.timeoutMs > 2_147_483_647
    ) {
      throw new ProviderFailure('configuration')
    }
    this.options = Object.freeze({ ...options })
    this.concurrency = new ProviderConcurrency(options.maxConcurrentRequests)
  }

  async generate(input: { prompt: string; signal?: AbortSignal }): Promise<GeneratedImage> {
    if (input.signal?.aborted) throw new ProviderFailure('cancelled')
    if (
      !input.prompt.trim() ||
      Buffer.byteLength(input.prompt, 'utf8') > this.options.maxPromptBytes
    ) {
      throw new ProviderFailure('input')
    }
    const body = JSON.stringify({
      ...this.options.extraBody,
      model: this.options.model,
      prompt: input.prompt,
      n: 1,
      aspect_ratio: '1:1',
      stream: false,
    })
    const release = this.concurrency.acquire()
    if (!release) throw new ProviderFailure('capacity')
    const deadline = AbortSignal.timeout(this.options.timeoutMs)
    const signal = input.signal ? AbortSignal.any([input.signal, deadline]) : deadline
    try {
      const response = await this.send(OPENROUTER_IMAGES_URL, {
        method: 'POST',
        redirect: 'error',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.options.apiKey}`,
        },
        body,
        signal,
      })
      if (!response.ok) {
        await response.body?.cancel()
        throw new ProviderFailure(response.status === 429 ? 'rate_limited' : 'unavailable')
      }
      // Base64 is four characters for three bytes, plus the envelope around it.
      const limit = Math.ceil(this.options.maxImageBytes / 3) * 4 + 64_000
      const envelope = await boundedJson(response, limit, invalid)
      if (!isRecord(envelope) || 'error' in envelope || !Array.isArray(envelope['data'])) {
        throw invalid()
      }
      const image: unknown = envelope['data'][0]
      if (!isRecord(image) || typeof image['b64_json'] !== 'string') throw invalid()
      const encoded = image['b64_json']
      if (encoded.length % 4 !== 0 || !BASE64.test(encoded)) throw invalid()
      const bytes = Buffer.from(encoded, 'base64')
      if (bytes.byteLength > this.options.maxImageBytes) throw invalid()
      const contentType = imageType(bytes)
      if (!contentType) throw invalid()
      signal.throwIfAborted()
      return { bytes, contentType }
    } catch (error) {
      if (input.signal?.aborted) throw new ProviderFailure('cancelled')
      if (deadline.aborted) throw new ProviderFailure('timeout')
      if (error instanceof ProviderFailure) throw error
      throw new ProviderFailure('unavailable')
    } finally {
      release()
    }
  }
}
