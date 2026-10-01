/** OpenAI-compatible chat completions with a JSON-schema answer: Fireworks and OpenRouter (plan 111).
 * https://docs.fireworks.ai/structured-responses/structured-response-formatting
 * https://openrouter.ai/docs/features/structured-outputs
 */
import { boundedJson, isRecord } from '../bounded-body.js'
import { ProviderConcurrency } from '../provider-concurrency.js'
import { ProviderFailure } from '../provider-failure.js'
import type { StructuredRequest, StructuredResult, StructuredTextModel } from '../text-model.js'

export const FIREWORKS_CHAT_URL = 'https://api.fireworks.ai/inference/v1/chat/completions'
export const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions'

export interface ChatCompletionsOptions {
  /** For logs only: which provider answered. */
  name: string
  /** A fixed HTTPS endpoint, never configuration a learner can reach. */
  url: string
  apiKey: string
  model: string
  timeoutMs: number
  maxTokens: number
  maxRequestBytes: number
  maxResponseBytes: number
  maxConcurrentRequests: number
  /** Fixed provider fields sent with every request, such as OpenRouter's routing rules. */
  extraBody?: Readonly<Record<string, unknown>>
}

function tokens(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new ProviderFailure('invalid_output')
  }
  return value
}

const invalid = () => new ProviderFailure('invalid_output')

/** Exactly one outbound attempt; retry/spend/fallback policy belongs to the guarded service. */
export class ChatCompletions implements StructuredTextModel {
  private readonly options: Readonly<ChatCompletionsOptions>
  private readonly concurrency: ProviderConcurrency

  constructor(
    options: ChatCompletionsOptions,
    private readonly send: typeof fetch = fetch,
  ) {
    const limits = [
      options.timeoutMs,
      options.maxTokens,
      options.maxRequestBytes,
      options.maxResponseBytes,
      options.maxConcurrentRequests,
    ]
    if (
      !options.apiKey.trim() ||
      !options.model.trim() ||
      !options.url.startsWith('https://') ||
      limits.some((value) => !Number.isSafeInteger(value) || value <= 0) ||
      options.timeoutMs > 2_147_483_647
    ) {
      throw new ProviderFailure('configuration')
    }
    this.options = Object.freeze({ ...options })
    this.concurrency = new ProviderConcurrency(options.maxConcurrentRequests)
  }

  async generate<T>(input: StructuredRequest<T>): Promise<StructuredResult<T>> {
    if (input.signal?.aborted) throw new ProviderFailure('cancelled')
    if (
      !input.system.trim() ||
      input.messages.length === 0 ||
      !isRecord(input.schema) ||
      input.messages.some(
        (message) =>
          !['user', 'assistant'].includes(message.role) ||
          typeof message.content !== 'string' ||
          !message.content.trim(),
      )
    ) {
      throw new ProviderFailure('input')
    }
    let body: string
    try {
      // Explicit reconstruction excludes caller-added tool/audio/attachment fields.
      body = JSON.stringify({
        ...this.options.extraBody,
        model: this.options.model,
        max_tokens: this.options.maxTokens,
        ...(input.temperature === undefined ? {} : { temperature: input.temperature }),
        ...(input.seed === undefined ? {} : { seed: input.seed }),
        messages: [
          { role: 'system', content: input.system },
          ...input.messages.map(({ role, content }) => ({ role, content })),
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'answer', strict: true, schema: input.schema },
        },
        stream: false,
      })
    } catch {
      throw new ProviderFailure('input')
    }
    if (Buffer.byteLength(body, 'utf8') > this.options.maxRequestBytes) {
      throw new ProviderFailure('input')
    }
    const release = this.concurrency.acquire()
    if (!release) throw new ProviderFailure('capacity')
    const deadline = AbortSignal.timeout(this.options.timeoutMs)
    const signal = input.signal ? AbortSignal.any([input.signal, deadline]) : deadline
    try {
      const response = await this.send(this.options.url, {
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
      const envelope = await boundedJson(response, this.options.maxResponseBytes, invalid)
      // OpenRouter reports a provider's failure inside a 200 as `error`.
      if (!isRecord(envelope) || 'error' in envelope || !Array.isArray(envelope['choices'])) {
        throw invalid()
      }
      const choice: unknown = envelope['choices'][0]
      if (!isRecord(choice) || envelope['choices'].length !== 1) throw invalid()
      const message = choice['message']
      if (
        choice['finish_reason'] !== 'stop' ||
        !isRecord(message) ||
        typeof message['content'] !== 'string' ||
        (Array.isArray(message['tool_calls']) && message['tool_calls'].length > 0)
      ) {
        throw invalid()
      }
      const usage = envelope['usage']
      if (!isRecord(usage)) throw invalid()
      const measuredUsage = {
        inputTokens: tokens(usage['prompt_tokens']),
        outputTokens: tokens(usage['completion_tokens']),
      }
      let result: T
      try {
        result = input.parse(JSON.parse(message['content']) as unknown)
      } catch {
        throw invalid()
      }
      signal.throwIfAborted()
      return { value: result, provider: this.options.name, usage: measuredUsage }
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
