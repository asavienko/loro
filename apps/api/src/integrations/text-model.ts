/**
 * What the library asks of a text model (plan 111), whoever serves it: one structured answer, checked
 * by the caller's parser. Transports make exactly one attempt each; `FallbackTextModel` tries them in
 * order within one deadline, and the owning service's labelled fallback answers when all fail.
 */

export type TextModelFailureCode =
  | 'configuration'
  | 'input'
  | 'cancelled'
  | 'timeout'
  | 'unavailable'
  | 'rate_limited'
  | 'capacity'
  | 'invalid_output'

/** Never retain provider bodies, credentials, prompts, or underlying error causes. */
export class TextModelFailure extends Error {
  constructor(readonly code: TextModelFailureCode) {
    super(`Text model request failed: ${code}`)
    this.name = 'TextModelFailure'
  }
}

export interface StructuredRequest<T> {
  system: string
  messages: readonly { role: 'user' | 'assistant'; content: string }[]
  /** Trusted provider-compatible JSON schema, never supplied directly by a learner. */
  schema: Record<string, unknown>
  /** The owning service supplies runtime contract AND semantic/safety validation. */
  parse: (value: unknown) => T
  signal?: AbortSignal
}

/** Provider-reported usage for later budget reconciliation, never estimated cost. */
export interface StructuredResult<T> {
  value: T
  /** Which transport answered, for logs. */
  provider: string
  usage: { inputTokens: number; outputTokens: number }
}

export interface StructuredTextModel {
  generate<T>(input: StructuredRequest<T>): Promise<StructuredResult<T>>
}

/**
 * The first model that answers, tried in order within one shared deadline: a slow primary leaves
 * the fallback only what is left. A request the transports refuse as `input` fails at once, since
 * every provider would refuse it too.
 */
export class FallbackTextModel implements StructuredTextModel {
  constructor(
    private readonly models: readonly StructuredTextModel[],
    private readonly timeoutMs: number,
  ) {
    if (
      models.length === 0 ||
      !Number.isSafeInteger(timeoutMs) ||
      timeoutMs <= 0 ||
      timeoutMs > 2_147_483_647
    ) {
      throw new TextModelFailure('configuration')
    }
  }

  async generate<T>(input: StructuredRequest<T>): Promise<StructuredResult<T>> {
    const deadline = AbortSignal.timeout(this.timeoutMs)
    const signal = input.signal ? AbortSignal.any([input.signal, deadline]) : deadline
    let last: unknown = new TextModelFailure('unavailable')
    for (const model of this.models) {
      try {
        return await model.generate({ ...input, signal })
      } catch (error) {
        if (input.signal?.aborted) throw new TextModelFailure('cancelled')
        if (deadline.aborted) throw new TextModelFailure('timeout')
        if (error instanceof TextModelFailure && error.code === 'input') throw error
        last = error
      }
    }
    throw last
  }
}
