import { describe, expect, it, vi } from 'vitest'
import { requestListeningRender, TtsRenderError } from './ttsRenderClient'

const request = {
  text: 'Un café, por favor.',
  lang: 'es-ES' as const,
  phrase_hash: 'a'.repeat(64),
  voice_id: 'listening_voice_a',
  model_id: 'eleven_multilingual_v2',
  asset_class: 'listening' as const,
  codec: 'aac-64k-mono-24k' as const,
  phrase_id: 'cafe1',
}
const response = {
  uri: `sha256/${'a'.repeat(64)}`,
  sha256: 'a'.repeat(64),
  ms: 1420,
  cached: true,
  download_url: `https://cdn.loro.test/sha256/${'a'.repeat(64)}.m4a`,
  voice_id: 'listening_voice_a',
  model_id: 'eleven_multilingual_v2',
  asset_class: 'listening',
}

describe('listening TTS client', () => {
  it('parses recorded metadata and rejects audio bytes in JSON', async () => {
    const send = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(response), { headers: { 'content-type': 'application/json' } }),
    )
    const result = await requestListeningRender(request, 'https://api.loro.test/v1', send)
    expect(result.download_url).toMatch(/^https:/)
    expect(result).not.toHaveProperty('audio')
    const forbidden = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ...response, audio: 'base64' }), {
        headers: { 'content-type': 'application/json' },
      }),
    )
    await expect(
      requestListeningRender(request, 'https://api.loro.test/v1', forbidden),
    ).rejects.toBeInstanceOf(TtsRenderError)
  })

  it('does not invent a configured endpoint', async () => {
    await expect(requestListeningRender(request, undefined)).rejects.toMatchObject({
      code: 'not-configured',
    })
  })
})
