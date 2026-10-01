/** Plan 111: which providers the keys turn on, in which order, and what OpenRouter may do. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FIREWORKS_CHAT_URL, OPENROUTER_CHAT_URL } from './openai-compatible/chat.js'
import { textModel, textModelConfigured } from './models.js'

const budget = {
  timeoutMs: 1000,
  primaryTimeoutMs: 500,
  maxTokens: 100,
  maxRequestBytes: 10_000,
  maxResponseBytes: 10_000,
  maxConcurrentRequests: 1,
}
const request = {
  system: 'Trusted test instruction',
  messages: [{ role: 'user' as const, content: 'private test phrase' }],
  schema: { type: 'object' },
  parse: (value: unknown) => value,
}
const answer = () =>
  Response.json({
    choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: '{"ok":true}' } }],
    usage: { prompt_tokens: 1, completion_tokens: 1 },
  })

afterEach(() => {
  vi.unstubAllEnvs()
})

function keys(fireworks: string, openRouter: string) {
  vi.stubEnv('FIREWORKS_API_KEY', fireworks)
  vi.stubEnv('OPENROUTER_API_KEY', openRouter)
  vi.stubEnv('FIREWORKS_MODEL', undefined)
  vi.stubEnv('OPENROUTER_TEXT_MODEL', undefined)
}

describe('the configured text models', () => {
  it('is off without a key', () => {
    keys('', ' ')
    expect(textModelConfigured()).toBe(false)
    expect(textModel(budget)).toBeNull()
  })

  it('asks Fireworks first, and OpenRouter only when Fireworks fails', async () => {
    keys('fw-test', 'or-test')
    const send = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('busy', { status: 503 }))
      .mockResolvedValueOnce(answer())
    const result = await textModel(budget, send)!.generate(request)
    expect(result).toMatchObject({ value: { ok: true }, provider: 'openrouter' })
    const [[firstUrl, first], [secondUrl, second]] = send.mock.calls as [
      [string, RequestInit],
      [string, RequestInit],
    ]
    expect(firstUrl).toBe(FIREWORKS_CHAT_URL)
    expect(JSON.parse(first.body as string)).toMatchObject({
      model: 'accounts/deepseek-ai/models/deepseek-v4p1-flash',
    })
    expect((first.headers as Record<string, string>)['authorization']).toBe('Bearer fw-test')
    expect(JSON.parse(first.body as string)).not.toHaveProperty('provider')
    expect(secondUrl).toBe(OPENROUTER_CHAT_URL)
    expect((second.headers as Record<string, string>)['authorization']).toBe('Bearer or-test')
    // Only providers that neither keep nor train on prompts, and that honour the JSON schema.
    expect(JSON.parse(second.body as string)).toMatchObject({
      model: 'deepseek/deepseek-v4.1-flash',
      provider: { data_collection: 'deny', require_parameters: true },
    })
  })

  it('uses whichever one key there is', async () => {
    keys('', 'or-test')
    const send = vi.fn<typeof fetch>().mockResolvedValue(answer())
    await textModel(budget, send)!.generate(request)
    expect(send.mock.calls.map(([url]) => url)).toEqual([OPENROUTER_CHAT_URL])
  })
})
