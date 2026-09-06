import { createServer } from 'node:http'
import { once } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import { AnthropicFailure, AnthropicMessages, type AnthropicOptions } from './messages.js'

const options: AnthropicOptions = {
  apiKey: 'test-only-secret',
  model: 'test-model',
  timeoutMs: 1000,
  maxTokens: 100,
  maxRequestBytes: 4096,
  maxResponseBytes: 4096,
}
const request = {
  system: 'Trusted test instruction',
  messages: [{ role: 'user' as const, content: 'private test phrase' }],
  schema: {
    type: 'object',
    properties: { ok: { type: 'boolean' } },
    required: ['ok'],
    additionalProperties: false,
  },
  parse: (value: unknown) => {
    if (!value || typeof value !== 'object' || !('ok' in value) || value.ok !== true) {
      throw new Error('private validation details')
    }
    return { ok: true }
  },
}
const envelope = (text = '{"ok":true}', stop = 'end_turn') => ({
  usage: { input_tokens: 12, output_tokens: 4 },
  content: [{ type: 'text', text }],
  stop_reason: stop,
})
const response = (value: unknown) => Response.json(value)

function setup(value: unknown = envelope(), changes: Partial<AnthropicOptions> = {}) {
  const send = vi.fn<typeof fetch>().mockResolvedValue(response(value))
  return { send, client: new AnthropicMessages({ ...options, ...changes }, send) }
}

describe('Anthropic provider-only messages adapter', () => {
  it('sends one bounded structured text request and returns independently validated output', async () => {
    const { client, send } = setup()
    expect(await client.generate(request)).toEqual({
      value: { ok: true },
      usage: {
        inputTokens: 12,
        outputTokens: 4,
        cacheReadInputTokens: null,
        cacheCreationInputTokens: null,
      },
    })
    expect(send).toHaveBeenCalledTimes(1)
    const [url, init] = send.mock.calls[0]!
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    expect(init).toMatchObject({ redirect: 'error', method: 'POST' })
    expect(JSON.parse(init!.body as string)).toMatchObject({
      model: 'test-model',
      stream: false,
      messages: request.messages,
      output_config: { format: { type: 'json_schema', schema: request.schema } },
    })
  })

  it('does not forward extra top-level or message attachment/tool fields', async () => {
    const { client, send } = setup()
    const withExtraFields = {
      ...request,
      messages: [{ ...request.messages[0]!, audio: 'private' }],
      tools: ['ignored'],
    }
    await client.generate(withExtraFields)
    const sent: unknown = JSON.parse(send.mock.calls[0]![1]!.body as string)
    expect(sent).toHaveProperty('messages', request.messages)
    expect(sent).not.toHaveProperty('tools')
  })

  it.each(['max_tokens', 'refusal', 'tool_use', 'pause_turn'])(
    'rejects incomplete/unsafe stop reason %s',
    async (stop) => {
      const { client } = setup(envelope('{"ok":true}', stop))
      await expect(client.generate(request)).rejects.toMatchObject({ code: 'invalid_output' })
    },
  )

  it.each(['not json', '{"ok":false}'])(
    'rejects syntactic and semantic failures: %s',
    async (text) => {
      const { client } = setup(envelope(text))
      await expect(client.generate(request)).rejects.toMatchObject({ code: 'invalid_output' })
    },
  )

  it('rejects oversized response bodies even without content-length', async () => {
    const { client } = setup(envelope(), { maxResponseBytes: 4 })
    await expect(client.generate(request)).rejects.toMatchObject({ code: 'invalid_output' })
  })

  it('rejects malformed UTF-8 instead of silently substituting text before validation', async () => {
    const bytes = Buffer.from(JSON.stringify(envelope('{"ok":true,"note":"marker"}')))
    bytes[bytes.indexOf('marker')] = 0xff
    const send = vi.fn<typeof fetch>().mockResolvedValue(new Response(bytes))
    await expect(new AnthropicMessages(options, send).generate(request)).rejects.toMatchObject({
      code: 'invalid_output',
    })
  })

  it('rejects oversized UTF-8 requests before sending', async () => {
    const { client, send } = setup(envelope(), { maxRequestBytes: 10 })
    await expect(client.generate(request)).rejects.toMatchObject({ code: 'input' })
    expect(send).not.toHaveBeenCalled()
  })

  it.each([429, 401, 503])(
    'does not retry or expose provider error body for status %i',
    async (status) => {
      const send = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('private provider data', { status }))
      const client = new AnthropicMessages(options, send)
      const error = await client.generate(request).catch((failure: unknown) => failure)
      expect(error).toBeInstanceOf(AnthropicFailure)
      expect(error).toMatchObject({ code: status === 429 ? 'rate_limited' : 'unavailable' })
      expect(String(error)).not.toContain('private')
      expect(send).toHaveBeenCalledTimes(1)
    },
  )

  it('redacts network error details and causes', async () => {
    const send = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('test-only-secret private phrase'))
    const error = await new AnthropicMessages(options, send)
      .generate(request)
      .catch((failure: unknown) => failure)
    expect(error).toMatchObject({ code: 'unavailable' })
    expect(String(error)).not.toContain('secret')
    expect(error).not.toHaveProperty('cause')
  })

  it('does not dispatch an already cancelled request', async () => {
    const { client, send } = setup()
    await expect(
      client.generate({ ...request, signal: AbortSignal.abort() }),
    ).rejects.toMatchObject({ code: 'cancelled' })
    expect(send).not.toHaveBeenCalled()
  })

  it('aborts an in-flight request on deadline', async () => {
    const send = vi.fn<typeof fetch>().mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init!.signal!.addEventListener(
            'abort',
            () => {
              reject(new Error('private transport error'))
            },
            { once: true },
          )
        }),
    )
    const client = new AnthropicMessages({ ...options, timeoutMs: 10 }, send)
    await expect(client.generate(request)).rejects.toMatchObject({ code: 'timeout' })
  })

  it('rejects invalid configuration without revealing credentials', () => {
    expect(() => new AnthropicMessages({ ...options, timeoutMs: Number.NaN })).toThrow(
      'configuration',
    )
  })

  it.each([
    undefined,
    { input_tokens: -1, output_tokens: 4 },
    { input_tokens: 1.5, output_tokens: 4 },
  ])(
    'rejects missing or invalid reported usage instead of inventing accounting values',
    async (usage) => {
      const { client } = setup({ ...envelope(), usage })
      await expect(client.generate(request)).rejects.toMatchObject({ code: 'invalid_output' })
    },
  )

  it('keeps the real HTTP body read inside the deadline after headers arrive', async () => {
    let received = false
    const server = createServer((_req, res) => {
      received = true
      res.writeHead(200, { 'content-type': 'application/json' })
      res.write('{') // Headers have arrived, but the body never completes.
    })
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Missing test listener')
    const send: typeof fetch = (_url, init) => fetch(`http://127.0.0.1:${address.port}`, init)
    try {
      const client = new AnthropicMessages({ ...options, timeoutMs: 250 }, send)
      await expect(client.generate(request)).rejects.toMatchObject({ code: 'timeout' })
      expect(received).toBe(true)
    } finally {
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error)
          else resolve()
        })
      })
    }
  })
})
