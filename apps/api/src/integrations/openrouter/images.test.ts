import { describe, expect, it, vi } from 'vitest'
import { ProviderFailure } from '../provider-failure.js'
import {
  imageType,
  OPENROUTER_IMAGES_URL,
  OpenRouterImages,
  type OpenRouterImagesOptions,
} from './images.js'

const options: OpenRouterImagesOptions = {
  apiKey: 'test-only-secret',
  model: 'test/image-model',
  timeoutMs: 1000,
  maxPromptBytes: 1000,
  maxImageBytes: 1000,
  maxConcurrentRequests: 1,
}
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(32, 7),
])
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32, 7)])
const WEBP = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.alloc(4),
  Buffer.from('WEBP'),
  Buffer.alloc(32, 7),
])
const answer = (bytes: Buffer, mediaType = 'image/png') => ({
  data: [{ b64_json: bytes.toString('base64'), media_type: mediaType }],
  usage: { prompt_tokens: 0, completion_tokens: 4175, cost: 0.04 },
})

function setup(value: unknown = answer(PNG), changes: Partial<OpenRouterImagesOptions> = {}) {
  const send = vi.fn<typeof fetch>().mockResolvedValue(Response.json(value))
  return { send, images: new OpenRouterImages({ ...options, ...changes }, send) }
}

describe('OpenRouter image generation adapter', () => {
  it('asks for one square picture with the routing rules and returns its checked bytes', async () => {
    const { images, send } = setup(answer(PNG), {
      extraBody: { provider: { data_collection: 'deny' } },
    })
    await expect(images.generate({ prompt: 'a lighthouse' })).resolves.toEqual({
      bytes: PNG,
      contentType: 'image/png',
    })
    const [url, init] = send.mock.calls[0]!
    expect(url).toBe(OPENROUTER_IMAGES_URL)
    expect(init).toMatchObject({ method: 'POST', redirect: 'error' })
    expect((init!.headers as Record<string, string>)['authorization']).toBe(
      'Bearer test-only-secret',
    )
    expect(JSON.parse(init!.body as string)).toEqual({
      provider: { data_collection: 'deny' },
      model: 'test/image-model',
      prompt: 'a lighthouse',
      n: 1,
      aspect_ratio: '1:1',
      stream: false,
    })
  })

  it.each([
    [JPEG, 'image/jpeg'],
    [WEBP, 'image/webp'],
  ] as const)('knows a picture by its signature (%#)', async (bytes, type) => {
    const { images } = setup(answer(bytes, 'image/png'))
    await expect(images.generate({ prompt: 'x' })).resolves.toMatchObject({ contentType: type })
  })

  it.each([
    ['an SVG', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>')],
    ['unknown bytes', Buffer.alloc(40, 1)],
  ])('refuses %s whatever its media type says', async (_name, bytes) => {
    const { images } = setup(answer(bytes, 'image/png'))
    await expect(images.generate({ prompt: 'x' })).rejects.toMatchObject({
      code: 'invalid_output',
    })
  })

  it.each([
    ['not base64', { data: [{ b64_json: 'not base64!' }] }],
    ['no picture', { data: [] }],
    ['an error in a 200', { ...answer(PNG), error: { message: 'private' } }],
    ['a URL instead of bytes', { data: [{ url: 'https://example.com/x.png' }] }],
  ])('refuses %s', async (_name, value) => {
    const { images } = setup(value)
    await expect(images.generate({ prompt: 'x' })).rejects.toMatchObject({
      code: 'invalid_output',
    })
  })

  it('refuses a picture larger than the limit', async () => {
    const { images } = setup(answer(Buffer.concat([PNG, Buffer.alloc(2000)])))
    await expect(images.generate({ prompt: 'x' })).rejects.toMatchObject({
      code: 'invalid_output',
    })
  })

  it('refuses an empty or oversized prompt before sending', async () => {
    const { images, send } = setup()
    await expect(images.generate({ prompt: ' ' })).rejects.toMatchObject({ code: 'input' })
    await expect(images.generate({ prompt: 'x'.repeat(1001) })).rejects.toMatchObject({
      code: 'input',
    })
    expect(send).not.toHaveBeenCalled()
  })

  it.each([429, 402, 503])('maps status %i to a code without the provider body', async (status) => {
    const send = vi.fn<typeof fetch>().mockResolvedValue(new Response('private', { status }))
    const error = await new OpenRouterImages(options, send)
      .generate({ prompt: 'x' })
      .catch((failure: unknown) => failure)
    expect(error).toBeInstanceOf(ProviderFailure)
    expect(error).toMatchObject({ code: status === 429 ? 'rate_limited' : 'unavailable' })
    expect(String(error)).not.toContain('private')
  })

  it('holds one permit per request and rejects overlap without sending', async () => {
    let finish!: (response: Response) => void
    const send = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)))
    const images = new OpenRouterImages(options, send)
    const pending = images.generate({ prompt: 'x' })
    await expect(images.generate({ prompt: 'y' })).rejects.toMatchObject({ code: 'capacity' })
    finish(Response.json(answer(PNG)))
    await expect(pending).resolves.toMatchObject({ contentType: 'image/png' })
  })

  it('times out a request that never answers', async () => {
    const send = vi.fn<typeof fetch>().mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init!.signal!.addEventListener('abort', () => {
            reject(new Error('private'))
          })
        }),
    )
    await expect(
      new OpenRouterImages({ ...options, timeoutMs: 10 }, send).generate({ prompt: 'x' }),
    ).rejects.toMatchObject({ code: 'timeout' })
  })

  it('rejects invalid configuration', () => {
    expect(() => new OpenRouterImages({ ...options, maxImageBytes: 0 })).toThrow('configuration')
    expect(() => new OpenRouterImages({ ...options, apiKey: '' })).toThrow('configuration')
  })

  it('reads signatures, not names', () => {
    expect(imageType(PNG)).toBe('image/png')
    expect(imageType(JPEG)).toBe('image/jpeg')
    expect(imageType(WEBP)).toBe('image/webp')
    expect(imageType(Buffer.from('RIFF....WAVE'))).toBeNull()
  })
})
