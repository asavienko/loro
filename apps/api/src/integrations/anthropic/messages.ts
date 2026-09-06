/** Provider-only transport. Runtime routes/guards are deliberately not registered here.
 * https://platform.claude.com/docs/en/build-with-claude/structured-outputs
 */
export type AnthropicFailureCode =
  | 'configuration'
  | 'input'
  | 'cancelled'
  | 'timeout'
  | 'unavailable'
  | 'rate_limited'
  | 'invalid_output'

/** Never retain provider bodies, credentials, prompts, or underlying error causes. */
export class AnthropicFailure extends Error {
  constructor(readonly code: AnthropicFailureCode) {
    super(`Anthropic request failed: ${code}`)
    this.name = 'AnthropicFailure'
  }
}

export interface AnthropicOptions {
  apiKey: string
  model: string
  timeoutMs: number
  maxTokens: number
  maxRequestBytes: number
  maxResponseBytes: number
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
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
  } catch {
    throw new AnthropicFailure('invalid_output')
  }
}

/** Exactly one outbound attempt; retry/spend/fallback policy belongs to the guarded service. */
export class AnthropicMessages {
  private readonly options: Readonly<AnthropicOptions>

  constructor(
    options: AnthropicOptions,
    private readonly send: typeof fetch = fetch,
  ) {
    const limits = [
      options.timeoutMs,
      options.maxTokens,
      options.maxRequestBytes,
      options.maxResponseBytes,
    ]
    if (
      !options.apiKey.trim() ||
      !options.model.trim() ||
      limits.some((value) => !Number.isSafeInteger(value) || value <= 0) ||
      options.timeoutMs > 2_147_483_647
    ) {
      throw new AnthropicFailure('configuration')
    }
    this.options = Object.freeze({ ...options })
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
        output_config: { format: { type: 'json_schema', schema: input.schema } },
        stream: false,
      })
    } catch {
      throw new AnthropicFailure('input')
    }
    if (Buffer.byteLength(body, 'utf8') > this.options.maxRequestBytes) {
      throw new AnthropicFailure('input')
    }
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
        throw new AnthropicFailure(response.status === 429 ? 'rate_limited' : 'unavailable')
      }
      const envelope = await boundedJson(response, this.options.maxResponseBytes)
      if (
        !record(envelope) ||
        envelope['stop_reason'] !== 'end_turn' ||
        !Array.isArray(envelope['content']) ||
        envelope['content'].length !== 1
      ) {
        throw new AnthropicFailure('invalid_output')
      }
      const block: unknown = envelope['content'][0]
      if (!record(block) || block['type'] !== 'text' || typeof block['text'] !== 'string') {
        throw new AnthropicFailure('invalid_output')
      }
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
        result = input.parse(JSON.parse(block['text']) as unknown)
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
    }
  }
}
