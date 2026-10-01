import { describe, expect, it } from 'vitest'
import {
  FallbackTextModel,
  TextModelFailure,
  type StructuredRequest,
  type StructuredTextModel,
} from './text-model.js'

const request: StructuredRequest<string> = {
  system: 'Trusted test instruction',
  messages: [{ role: 'user', content: 'private test phrase' }],
  schema: { type: 'object' },
  parse: (value) => String(value),
}

const calls = new Map<StructuredTextModel, number>()
function model(answer: (input: StructuredRequest<unknown>) => Promise<unknown>) {
  const self: StructuredTextModel = {
    generate: async <T>(input: StructuredRequest<T>) => {
      calls.set(self, (calls.get(self) ?? 0) + 1)
      return {
        value: input.parse(await answer(input)),
        provider: 'test',
        usage: { inputTokens: 1, outputTokens: 1 },
      }
    },
  }
  return self
}
const asked = (m: StructuredTextModel) => calls.get(m) ?? 0
const failing = (code: TextModelFailure['code']) =>
  model(() => Promise.reject(new TextModelFailure(code)))
const hanging = () =>
  model(
    (input) =>
      new Promise((_resolve, reject) => {
        input.signal?.addEventListener('abort', () => {
          reject(new TextModelFailure('cancelled'))
        })
      }),
  )

describe('FallbackTextModel', () => {
  it('answers from the first model without asking the next', async () => {
    const first = model(() => Promise.resolve('first'))
    const second = model(() => Promise.resolve('second'))
    await expect(
      new FallbackTextModel([first, second], 1000).generate(request),
    ).resolves.toMatchObject({ value: 'first' })
    expect(asked(second)).toBe(0)
  })

  it.each(['unavailable', 'rate_limited', 'capacity', 'invalid_output', 'timeout'] as const)(
    'asks the next model when the first fails with %s',
    async (code) => {
      const second = model(() => Promise.resolve('second'))
      await expect(
        new FallbackTextModel([failing(code), second], 1000).generate(request),
      ).resolves.toMatchObject({ value: 'second' })
    },
  )

  it('fails at once on a request every provider would refuse', async () => {
    const second = model(() => Promise.resolve('second'))
    await expect(
      new FallbackTextModel([failing('input'), second], 1000).generate(request),
    ).rejects.toMatchObject({ code: 'input' })
    expect(asked(second)).toBe(0)
  })

  it("rethrows the last model's failure when all fail", async () => {
    await expect(
      new FallbackTextModel([failing('unavailable'), failing('rate_limited')], 1000).generate(
        request,
      ),
    ).rejects.toMatchObject({ code: 'rate_limited' })
  })

  it('shares one deadline: a primary that uses it all leaves nothing to the fallback', async () => {
    const second = model(() => Promise.resolve('second'))
    await expect(
      new FallbackTextModel([hanging(), second], 20).generate(request),
    ).rejects.toMatchObject({ code: 'timeout' })
    expect(asked(second)).toBe(0)
  })

  it("passes the caller's cancellation through and reports it as cancelled", async () => {
    const controller = new AbortController()
    const pending = new FallbackTextModel([hanging()], 1000).generate({
      ...request,
      signal: controller.signal,
    })
    controller.abort()
    await expect(pending).rejects.toMatchObject({ code: 'cancelled' })
  })

  it('rejects an empty chain or a bad deadline', () => {
    expect(() => new FallbackTextModel([], 1000)).toThrow('configuration')
    expect(() => new FallbackTextModel([failing('input')], 0)).toThrow('configuration')
  })
})
