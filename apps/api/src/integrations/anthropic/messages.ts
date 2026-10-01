/** Provider-only transport. Runtime routes/guards are deliberately not registered here.
 * https://platform.claude.com/docs/en/build-with-claude/structured-outputs
 */
import { ProviderConcurrency } from '../provider-concurrency.js'

export type AnthropicFailureCode =
  | 'configuration'
  | 'input'
  | 'cancelled'
  | 'timeout'
  | 'unavailable'
  | 'rate_limited'
  | 'capacity'
  | 'invalid_output'
  /** The model declined (`stop_reason: "refusal"`); the output can't be trusted to match the schema. */
  | 'refused'
  /** The answer hit `max_tokens` (thinking counts against it): incomplete JSON. */
  | 'truncated'

/** Never retain provider bodies, credentials, prompts, or underlying error causes. */
export class AnthropicFailure extends Error {
  constructor(readonly code: AnthropicFailureCode) {
    super(`Anthropic request failed: ${code}`)
    this.name = 'AnthropicFailure'
  }
}

/** `output_config.effort`; omitted when unset, for models that don't take it (Claude Haiku 4.5). */
export type AnthropicEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'
export const ANTHROPIC_EFFORTS: readonly AnthropicEffort[] = [
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
]

export interface AnthropicOptions {
  apiKey: string
  model: string
  effort?: AnthropicEffort | undefined
  timeoutMs: number
  maxTokens: number
  maxRequestBytes: number
  maxResponseBytes: number
  maxConcurrentRequests: number
}

export interface StructuredMessage<T> {
  system: string
  messages: readonly { role: 'user' | 'assistant'; content: string }[]
  /** Trusted provider-compatible JSON schema, never supplied directly by a learner. */
  schema: Record<string, unknown>
  /** The owning service supplies runtime contract AND semantic/safety validation. */
  parse: (value: unknown) => T
  signal?: AbortSignal
}

/** Provider-reported usage for later budget reconciliation, never estimated cost. */
export interface AnthropicResult<T> {
  value: T
  usage: {
    inputTokens: number
    outputTokens: number
    cacheReadInputTokens: number | null
    cacheCreationInputTokens: number | null
  }
}

function tokens(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new AnthropicFailure('invalid_output')
  }
  return value
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function boundedJson(response: Response, limit: number): Promise<unknown> {
  if (!response.body) throw new AnthropicFailure('invalid_output')
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const chunk = await reader.read()
      if (chunk.done) break
      const bytes: unknown = chunk.value
      if (!(bytes instanceof Uint8Array)) throw new AnthropicFailure('invalid_output')
      size += bytes.byteLength
      if (size > limit) {
        await reader.cancel()
        throw new AnthropicFailure('invalid_output')
      }
      chunks.push(bytes)
    }
  } finally {
    reader.releaseLock()
  }
  try {
    return JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)),
    ) as unknown
  } catch {
    throw new AnthropicFailure('invalid_output')
  }
}

/**
 * The provider's status as a failure code: a rejected key or unknown model is configuration, a
 * malformed request is input, and only 429 and the 5xx/529 family are worth a later try.
 */
function failureForStatus(status: number): AnthropicFailureCode {
  if (status === 429) return 'rate_limited'
  if (status === 401 || status === 403 || status === 404) return 'configuration'
  if (status === 400 || status === 413) return 'input'
  return 'unavailable'
}

/**
 * The one text block that holds the JSON. Thinking blocks come before it when the model thinks
 * (adaptive thinking is on by default on current models) and are skipped; any other block, or
 * more than one text block, is not an answer this adapter accepts.
 */
function answerBlock(content: unknown[]): { type: 'text'; text: string } {
  let answer: { type: 'text'; text: string } | null = null
  for (const block of content) {
    if (!record(block)) throw new AnthropicFailure('invalid_output')
    if (block['type'] === 'thinking' || block['type'] === 'redacted_thinking') continue
    if (block['type'] !== 'text' || typeof block['text'] !== 'string' || answer) {
      throw new AnthropicFailure('invalid_output')
    }
    answer = { type: 'text', text: block['text'] }
  }
  if (!answer) throw new AnthropicFailure('invalid_output')
  return answer
}

/** Exactly one outbound attempt; retry/spend/fallback policy belongs to the guarded service. */
export class AnthropicMessages {
  private readonly options: Readonly<AnthropicOptions>
  private readonly concurrency: ProviderConcurrency

  constructor(
    options: AnthropicOptions,
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
      limits.some((value) => !Number.isSafeInteger(value) || value <= 0) ||
      options.timeoutMs > 2_147_483_647 ||
      (options.effort !== undefined && !ANTHROPIC_EFFORTS.includes(options.effort))
    ) {
      throw new AnthropicFailure('configuration')
    }
    this.options = Object.freeze({ ...options })
    this.concurrency = new ProviderConcurrency(options.maxConcurrentRequests)
  }

  async generate<T>(input: StructuredMessage<T>): Promise<AnthropicResult<T>> {
    if (input.signal?.aborted) throw new AnthropicFailure('cancelled')
    if (
      !input.system.trim() ||
      input.messages.length === 0 ||
      !record(input.schema) ||
      input.messages.some(
        (message) =>
          !['user', 'assistant'].includes(message.role) ||
          typeof message.content !== 'string' ||
          !message.content.trim(),
      )
    ) {
      throw new AnthropicFailure('input')
    }
    let body: string
    try {
      // Explicit reconstruction excludes caller-added tool/audio/attachment fields.
      body = JSON.stringify({
        model: this.options.model,
        max_tokens: this.options.maxTokens,
        system: input.system,
        messages: input.messages.map(({ role, content }) => ({ role, content })),
        // No `thinking` field: current models think adaptively by default, and effort bounds it.
        output_config: {
          format: { type: 'json_schema', schema: input.schema },
          ...(this.options.effort ? { effort: this.options.effort } : {}),
        },
        stream: false,
      })
    } catch {
      throw new AnthropicFailure('input')
    }
    if (Buffer.byteLength(body, 'utf8') > this.options.maxRequestBytes) {
      throw new AnthropicFailure('input')
    }
    const release = this.concurrency.acquire()
    if (!release) throw new AnthropicFailure('capacity')
    const deadline = AbortSignal.timeout(this.options.timeoutMs)
    const signal = input.signal ? AbortSignal.any([input.signal, deadline]) : deadline
    try {
      const response = await this.send('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        redirect: 'error',
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.options.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body,
        signal,
      })
      if (!response.ok) {
        await response.body?.cancel()
        throw new AnthropicFailure(failureForStatus(response.status))
      }
      const envelope = await boundedJson(response, this.options.maxResponseBytes)
      if (!record(envelope)) throw new AnthropicFailure('invalid_output')
      if (envelope['stop_reason'] === 'refusal') throw new AnthropicFailure('refused')
      if (envelope['stop_reason'] === 'max_tokens') throw new AnthropicFailure('truncated')
      if (envelope['stop_reason'] !== 'end_turn' || !Array.isArray(envelope['content'])) {
        throw new AnthropicFailure('invalid_output')
      }
      const block = answerBlock(envelope['content'])
      const usage = envelope['usage']
      if (!record(usage)) throw new AnthropicFailure('invalid_output')
      const measuredUsage = {
        inputTokens: tokens(usage['input_tokens']),
        outputTokens: tokens(usage['output_tokens']),
        cacheReadInputTokens:
          usage['cache_read_input_tokens'] === undefined
            ? null
            : tokens(usage['cache_read_input_tokens']),
        cacheCreationInputTokens:
          usage['cache_creation_input_tokens'] === undefined
            ? null
            : tokens(usage['cache_creation_input_tokens']),
      }
      let result: T
      try {
        result = input.parse(JSON.parse(block.text) as unknown)
      } catch {
        throw new AnthropicFailure('invalid_output')
      }
      signal.throwIfAborted()
      return { value: result, usage: measuredUsage }
    } catch (error) {
      if (input.signal?.aborted) throw new AnthropicFailure('cancelled')
      if (deadline.aborted) throw new AnthropicFailure('timeout')
      if (error instanceof AnthropicFailure) throw error
      throw new AnthropicFailure('unavailable')
    } finally {
      release()
    }
  }
}
