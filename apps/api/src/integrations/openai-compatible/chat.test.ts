import { createServer } from 'node:http'
import { once } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import { TextModelFailure } from '../text-model.js'
import { ChatCompletions, FIREWORKS_CHAT_URL, type ChatCompletionsOptions } from './chat.js'

const options: ChatCompletionsOptions = {
  name: 'test-provider',
  url: FIREWORKS_CHAT_URL,
  apiKey: 'test-only-secret',
  model: 'test-model',
  timeoutMs: 1000,
  maxTokens: 100,
  maxRequestBytes: 4096,
  maxResponseBytes: 4096,
  maxConcurrentRequests: 1,
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
const envelope = (content: unknown = '{"ok":true}', finish = 'stop') => ({
  id: 'gen-1',
  usage: { prompt_tokens: 12, completion_tokens: 4, total_tokens: 16 },
  choices: [{ index: 0, finish_reason: finish, message: { role: 'assistant', content } }],
})
const response = (value: unknown) => Response.json(value)

function setup(value: unknown = envelope(), changes: Partial<ChatCompletionsOptions> = {}) {
  const send = vi.fn<typeof fetch>().mockResolvedValue(response(value))
  return { send, client: new ChatCompletions({ ...options, ...changes }, send) }
}

describe('OpenAI-compatible chat completions adapter', () => {
  it('holds capacity through streamed body parsing and rejects overlap without sending', async () => {
    let finish!: () => void
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        finish = () => {
          controller.enqueue(new TextEncoder().encode(JSON.stringify(envelope())))
          controller.close()
        }
      },
    })
    const send = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(body))
    send.mockImplementation(() => Promise.resolve(response(envelope())))
    const client = new ChatCompletions(options, send)
    const pending = client.generate(request)
    const rejected = await client.generate(request).catch((error: unknown) => error)
    expect(rejected).toBeInstanceOf(TextModelFailure)
    expect(rejected).toMatchObject({
      code: 'capacity',
      message: 'Text model request failed: capacity',
    })
    expect(send).toHaveBeenCalledTimes(1)
    finish()
    await expect(pending).resolves.toHaveProperty('value.ok', true)
    await expect(client.generate(request)).resolves.toHaveProperty('value.ok', true)
    expect(send).toHaveBeenCalledTimes(2)
  })

  it.each(['transport', 'status', 'parse'])(
    'releases capacity after a %s failure without retrying it',
    async (failure) => {
      const send = vi.fn<typeof fetch>()
      if (failure === 'transport') send.mockRejectedValueOnce(new Error('private details'))
      if (failure === 'status') send.mockResolvedValueOnce(new Response('private', { status: 429 }))
      if (failure === 'parse')
        send.mockResolvedValueOnce(response(envelope('private invalid JSON')))
      send.mockImplementation(() => Promise.resolve(response(envelope())))
      const client = new ChatCompletions(options, send)
      await expect(client.generate(request)).rejects.toBeInstanceOf(TextModelFailure)
      expect(send).toHaveBeenCalledTimes(1)
      await expect(client.generate(request)).resolves.toHaveProperty('value.ok', true)
      expect(send).toHaveBeenCalledTimes(2)
    },
  )

  it('releases capacity after an in-flight cancellation has settled', async () => {
    const send = vi.fn<typeof fetch>().mockImplementationOnce(
      async (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init!.signal!.addEventListener(
            'abort',
            () => {
              reject(new Error('cancelled'))
            },
            { once: true },
          )
        }),
    )
    send.mockImplementation(() => Promise.resolve(response(envelope())))
    const client = new ChatCompletions(options, send)
    const controller = new AbortController()
    const pending = client.generate({ ...request, signal: controller.signal })
    controller.abort()
    await expect(client.generate(request)).rejects.toMatchObject({ code: 'capacity' })
    await expect(pending).rejects.toMatchObject({ code: 'cancelled' })
    await expect(client.generate(request)).resolves.toHaveProperty('value.ok', true)
  })

  it('sends one bounded JSON-schema request with a bearer and returns validated output', async () => {
    const { client, send } = setup(envelope(), {
      extraBody: { provider: { data_collection: 'deny' } },
    })
    expect(await client.generate(request)).toEqual({
      value: { ok: true },
      provider: 'test-provider',
      usage: { inputTokens: 12, outputTokens: 4 },
    })
    expect(send).toHaveBeenCalledTimes(1)
    const [url, init] = send.mock.calls[0]!
    expect(url).toBe(FIREWORKS_CHAT_URL)
    expect(init).toMatchObject({ redirect: 'error', method: 'POST' })
    expect((init!.headers as Record<string, string>)['authorization']).toBe(
      'Bearer test-only-secret',
    )
    expect(JSON.parse(init!.body as string)).toEqual({
      provider: { data_collection: 'deny' },
      model: 'test-model',
      max_tokens: 100,
      stream: false,
      messages: [{ role: 'system', content: request.system }, ...request.messages],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'answer', strict: true, schema: request.schema },
      },
    })
  })

  it('lets no extra field override the model, messages or answer format', async () => {
    const { client, send } = setup(envelope(), {
      extraBody: { model: 'other', messages: [], response_format: null, stream: true },
    })
    await client.generate(request)
    const sent = JSON.parse(send.mock.calls[0]![1]!.body as string) as Record<string, unknown>
    expect(sent).toMatchObject({ model: 'test-model', stream: false })
    expect(sent['messages']).toHaveLength(2)
    expect(sent['response_format']).toMatchObject({ type: 'json_schema' })
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
    expect(sent).toHaveProperty('messages', [
      { role: 'system', content: request.system },
      ...request.messages,
    ])
    expect(sent).not.toHaveProperty('tools')
  })

  it.each(['length', 'content_filter', 'tool_calls', 'error'])(
    'rejects incomplete/unsafe finish reason %s',
    async (finish) => {
      const { client } = setup(envelope('{"ok":true}', finish))
      await expect(client.generate(request)).rejects.toMatchObject({ code: 'invalid_output' })
    },
  )

  it('rejects a provider error reported inside a 200', async () => {
    const { client } = setup({ ...envelope(), error: { code: 502, message: 'private' } })
    await expect(client.generate(request)).rejects.toMatchObject({ code: 'invalid_output' })
  })

  it.each([null, 42, ['{"ok":true}']])('rejects non-text content %j', async (content) => {
    const { client } = setup(envelope(content))
    await expect(client.generate(request)).rejects.toMatchObject({ code: 'invalid_output' })
  })

  it('rejects an answer that also calls tools', async () => {
    const value = envelope()
    const message = value.choices[0]!.message as Record<string, unknown>
    message['tool_calls'] = [{ id: 'call-1', type: 'function' }]
    const { client } = setup(value)
    await expect(client.generate(request)).rejects.toMatchObject({ code: 'invalid_output' })
  })

  it('rejects more than one choice', async () => {
    const value = envelope()
    const { client } = setup({ ...value, choices: [...value.choices, ...value.choices] })
    await expect(client.generate(request)).rejects.toMatchObject({ code: 'invalid_output' })
  })

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
    await expect(new ChatCompletions(options, send).generate(request)).rejects.toMatchObject({
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
      const client = new ChatCompletions(options, send)
      const error = await client.generate(request).catch((failure: unknown) => failure)
      expect(error).toBeInstanceOf(TextModelFailure)
      expect(error).toMatchObject({ code: status === 429 ? 'rate_limited' : 'unavailable' })
      expect(String(error)).not.toContain('private')
      expect(send).toHaveBeenCalledTimes(1)
    },
  )

  it('redacts network error details and causes', async () => {
    const send = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('test-only-secret private phrase'))
    const error = await new ChatCompletions(options, send)
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
    const client = new ChatCompletions({ ...options, timeoutMs: 10 }, send)
    await expect(client.generate(request)).rejects.toMatchObject({ code: 'timeout' })
    send.mockImplementation(() => Promise.resolve(response(envelope())))
    await expect(client.generate(request)).resolves.toHaveProperty('value.ok', true)
    expect(send).toHaveBeenCalledTimes(2)
  })

  it.each([
    { timeoutMs: Number.NaN },
    { url: 'http://api.fireworks.ai/inference/v1/chat/completions' },
    { apiKey: ' ' },
    { model: '' },
  ])('rejects invalid configuration %j without revealing credentials', (change) => {
    expect(() => new ChatCompletions({ ...options, ...change })).toThrow('configuration')
  })

  it.each([
    undefined,
    { prompt_tokens: -1, completion_tokens: 4 },
    { prompt_tokens: 1.5, completion_tokens: 4 },
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
      const client = new ChatCompletions({ ...options, timeoutMs: 250 }, send)
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
