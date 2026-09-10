import { createServer } from 'node:http'
import { once } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import {
  ElevenLabsTts,
  StubTts,
  TtsFailure,
  parseTtsConfig,
  voiceForLocale,
  type TtsOptions,
} from './tts.js'

const options: TtsOptions = {
  apiKey: 'test-only-secret',
  model: 'test-model',
  outputFormat: 'mp3_44100_128',
  timeoutMs: 1000,
  maxRequestBytes: 4096,
  maxResponseBytes: 4096,
  maxConcurrentRequests: 1,
}
const request = { text: 'Me pone un cortado, por favor', locale: 'es-ES', voiceId: 'voice-es' }
const audio = Buffer.alloc(64, 0xfb)

function setup(body: Buffer = audio, status = 200, changes: Partial<TtsOptions> = {}) {
  const send = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(body, { status, headers: { 'content-type': 'audio/mpeg' } }))
  return { send, client: new ElevenLabsTts({ ...options, ...changes }, send) }
}

describe('ElevenLabs provider-only TTS adapter', () => {
  it('holds capacity through streamed body parsing and rejects overlap without sending', async () => {
    let finish!: () => void
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        finish = () => {
          controller.enqueue(audio)
          controller.close()
        }
      },
    })
    const send = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(body, { headers: { 'content-type': 'audio/mpeg' } }))
    send.mockImplementation(() =>
      Promise.resolve(new Response(audio, { headers: { 'content-type': 'audio/mpeg' } })),
    )
    const client = new ElevenLabsTts(options, send)
    const pending = client.synthesize(request)
    const rejected = await client.synthesize(request).catch((error: unknown) => error)
    expect(rejected).toBeInstanceOf(TtsFailure)
    expect(rejected).toMatchObject({ code: 'capacity', message: 'TTS request failed: capacity' })
    expect(send).toHaveBeenCalledTimes(1)
    finish()
    await expect(pending).resolves.toMatchObject({ contentType: 'audio/mpeg' })
    await expect(client.synthesize(request)).resolves.toHaveProperty('bytes.byteLength', 64)
    expect(send).toHaveBeenCalledTimes(2)
  })

  it.each(['transport', 'status', 'parse'])(
    'releases capacity after a %s failure without retrying it',
    async (failure) => {
      const send = vi.fn<typeof fetch>()
      if (failure === 'transport') send.mockRejectedValueOnce(new Error('private details'))
      if (failure === 'status') send.mockResolvedValueOnce(new Response('private', { status: 429 }))
      if (failure === 'parse')
        send.mockResolvedValueOnce(
          new Response(Buffer.alloc(8, 1), { headers: { 'content-type': 'audio/mpeg' } }),
        )
      send.mockImplementation(() =>
        Promise.resolve(new Response(audio, { headers: { 'content-type': 'audio/mpeg' } })),
      )
      const client = new ElevenLabsTts(options, send)
      await expect(client.synthesize(request)).rejects.toBeInstanceOf(TtsFailure)
      expect(send).toHaveBeenCalledTimes(1)
      await expect(client.synthesize(request)).resolves.toHaveProperty('bytes.byteLength', 64)
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
    send.mockImplementation(() =>
      Promise.resolve(new Response(audio, { headers: { 'content-type': 'audio/mpeg' } })),
    )
    const client = new ElevenLabsTts(options, send)
    const controller = new AbortController()
    const pending = client.synthesize({ ...request, signal: controller.signal })
    controller.abort()
    await expect(client.synthesize(request)).rejects.toMatchObject({ code: 'capacity' })
    await expect(pending).rejects.toMatchObject({ code: 'cancelled' })
    await expect(client.synthesize(request)).resolves.toHaveProperty('bytes.byteLength', 64)
  })

  it('sends one bounded text-only request and returns audio without extra fields', async () => {
    const { client, send } = setup()
    const result = await client.synthesize(request)
    expect(result.provenance).toEqual({
      provider: 'elevenlabs',
      model: 'test-model',
      voiceId: 'voice-es',
      outputFormat: 'mp3_44100_128',
      locale: 'es-ES',
    })
    expect(result.characterCount).toBeNull()
    const [url, init] = send.mock.calls[0]!
    expect(url).toBe(
      'https://api.elevenlabs.io/v1/text-to-speech/voice-es?output_format=mp3_44100_128',
    )
    expect(init).toMatchObject({ redirect: 'error', method: 'POST' })
    expect(JSON.parse(init!.body as string)).toEqual({
      text: request.text,
      model_id: 'test-model',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    })
    expect(init!.headers).toMatchObject({ 'xi-api-key': 'test-only-secret' })
  })

  it('places the requested listening voice id on the path without remapping', async () => {
    const { client, send } = setup()
    await client.synthesize({ ...request, voiceId: 'listening-voice-a' })
    expect(send.mock.calls[0]?.[0]).toBe(
      'https://api.elevenlabs.io/v1/text-to-speech/listening-voice-a?output_format=mp3_44100_128',
    )
  })

  it('sends the request model_id when it differs from the adapter default', async () => {
    const { client, send } = setup()
    await client.synthesize({ ...request, modelId: 'eleven_multilingual_v2' })
    expect(JSON.parse(send.mock.calls[0]![1]!.body as string)).toMatchObject({
      model_id: 'eleven_multilingual_v2',
    })
  })

  it('records provider character counts when they are a non-negative integer', async () => {
    const send = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(audio, {
        headers: { 'content-type': 'audio/mpeg', 'xi-character-count': '18' },
      }),
    )
    await expect(new ElevenLabsTts(options, send).synthesize(request)).resolves.toMatchObject({
      characterCount: 18,
    })
  })

  it('rejects a non-integer character-count header instead of inventing usage', async () => {
    const send = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(audio, {
        headers: { 'content-type': 'audio/mpeg', 'xi-character-count': '1.5' },
      }),
    )
    await expect(new ElevenLabsTts(options, send).synthesize(request)).rejects.toMatchObject({
      code: 'invalid_output',
    })
  })

  it('rejects oversized response bodies even without content-length', async () => {
    const { client } = setup(audio, 200, { maxResponseBytes: 8 })
    await expect(client.synthesize(request)).rejects.toMatchObject({ code: 'invalid_output' })
  })

  it('rejects oversized UTF-8 requests before sending', async () => {
    const { client, send } = setup(audio, 200, { maxRequestBytes: 10 })
    await expect(client.synthesize(request)).rejects.toMatchObject({ code: 'input' })
    expect(send).not.toHaveBeenCalled()
  })

  it.each([
    [429, 'rate_limited'],
    [401, 'configuration'],
    [404, 'configuration'],
    [402, 'capacity'],
    [503, 'unavailable'],
  ] as const)(
    'does not retry or expose provider error body for status %i',
    async (status, code) => {
      const send = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('private provider data test-only-secret', { status }))
      const error = await new ElevenLabsTts(options, send)
        .synthesize(request)
        .catch((failure: unknown) => failure)
      expect(error).toBeInstanceOf(TtsFailure)
      expect(error).toMatchObject({ code })
      expect(String(error)).not.toContain('private')
      expect(String(error)).not.toContain('secret')
      expect(send).toHaveBeenCalledTimes(1)
    },
  )

  it('redacts network error details and causes', async () => {
    const send = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('test-only-secret private phrase'))
    const error = await new ElevenLabsTts(options, send)
      .synthesize(request)
      .catch((failure: unknown) => failure)
    expect(error).toMatchObject({ code: 'unavailable' })
    expect(String(error)).not.toContain('secret')
    expect(error).not.toHaveProperty('cause')
  })

  it('does not dispatch an already cancelled request', async () => {
    const { client, send } = setup()
    await expect(
      client.synthesize({ ...request, signal: AbortSignal.abort() }),
    ).rejects.toMatchObject({ code: 'cancelled' })
    expect(send).not.toHaveBeenCalled()
  })

  it('rejects voice ids that would change the request path', async () => {
    const { client, send } = setup()
    await expect(client.synthesize({ ...request, voiceId: 'a/../b' })).rejects.toMatchObject({
      code: 'input',
    })
    expect(send).not.toHaveBeenCalled()
  })

  it('rejects JSON error bodies disguised as audio', async () => {
    const send = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(audio, { headers: { 'content-type': 'application/json' } }))
    await expect(new ElevenLabsTts(options, send).synthesize(request)).rejects.toMatchObject({
      code: 'invalid_output',
    })
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
    const client = new ElevenLabsTts({ ...options, timeoutMs: 10 }, send)
    await expect(client.synthesize(request)).rejects.toMatchObject({ code: 'timeout' })
    send.mockImplementation(() =>
      Promise.resolve(new Response(audio, { headers: { 'content-type': 'audio/mpeg' } })),
    )
    await expect(client.synthesize(request)).resolves.toHaveProperty('bytes.byteLength', 64)
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('rejects invalid configuration without revealing credentials', () => {
    expect(() => new ElevenLabsTts({ ...options, timeoutMs: Number.NaN })).toThrow('configuration')
  })

  it('keeps the real HTTP body read inside the deadline after headers arrive', async () => {
    let received = false
    const server = createServer((_req, res) => {
      received = true
      res.writeHead(200, { 'content-type': 'audio/mpeg' })
      res.write(Buffer.from([1]))
    })
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Missing test listener')
    const send: typeof fetch = (_url, init) => fetch(`http://127.0.0.1:${address.port}`, init)
    try {
      const client = new ElevenLabsTts({ ...options, timeoutMs: 250 }, send)
      await expect(client.synthesize(request)).rejects.toMatchObject({ code: 'timeout' })
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

describe('TTS configuration and stub', () => {
  it('defaults to stub and rejects unknown providers', () => {
    expect(parseTtsConfig({})).toMatchObject({ provider: 'stub', apiKey: '', stubRender: false })
    expect(() => parseTtsConfig({ TTS_PROVIDER: 'polly' })).toThrow('configuration')
  })

  it('requires a key, model and es-ES voice for live ElevenLabs mode', () => {
    expect(() => parseTtsConfig({ TTS_PROVIDER: 'elevenlabs', TTS_API_KEY: 'k' })).toThrow(
      'configuration',
    )
    expect(
      parseTtsConfig({
        TTS_PROVIDER: 'elevenlabs',
        TTS_API_KEY: 'k',
        TTS_MODEL: 'eleven_multilingual_v2',
        TTS_VOICE_ES_ES: 'voice-es',
      }),
    ).toMatchObject({
      provider: 'elevenlabs',
      stubRender: false,
      voices: { 'es-ES': 'voice-es', 'bg-BG': '', 'ru-RU': '' },
    })
  })

  it('never silently substitutes another locale voice', () => {
    const voices = { 'es-ES': 'voice-es', 'bg-BG': '', 'ru-RU': '' }
    expect(voiceForLocale(voices, 'es-ES')).toBe('voice-es')
    expect(() => voiceForLocale(voices, 'bg-BG')).toThrow('configuration')
  })

  it('refuses stub synthesis so stub bytes cannot be published', async () => {
    await expect(new StubTts().synthesize(request)).rejects.toMatchObject({ code: 'unavailable' })
  })

  it('enables labeled stub render only when TTS_STUB_RENDER=1', async () => {
    expect(parseTtsConfig({ TTS_PROVIDER: 'stub', TTS_STUB_RENDER: '1' }).stubRender).toBe(true)
    expect(parseTtsConfig({ TTS_PROVIDER: 'stub', TTS_STUB_RENDER: '0' }).stubRender).toBe(false)
    expect(
      parseTtsConfig({
        TTS_PROVIDER: 'elevenlabs',
        TTS_API_KEY: 'k',
        TTS_MODEL: 'eleven_multilingual_v2',
        TTS_VOICE_ES_ES: 'voice-es',
        TTS_STUB_RENDER: '1',
      }).stubRender,
    ).toBe(false)
    const result = await new StubTts({ stubRender: true }).synthesize({
      ...request,
      modelId: 'eleven_multilingual_v2',
    })
    expect(result.provenance.provider).toBe('stub')
    expect(result.contentType).toBe('audio/wav')
    expect(result.bytes.byteLength).toBeGreaterThan(32)
    expect(Object.keys(result)).toEqual(['bytes', 'contentType', 'characterCount', 'provenance'])
  })
})
