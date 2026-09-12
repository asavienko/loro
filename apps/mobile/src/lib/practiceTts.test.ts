import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CATALOG_REFERENCE_VOICES,
  CATALOG_TTS_MODEL_ID,
  LISTENING_CODEC,
  REFERENCE_ASSET_CLASS,
} from '@loro/core'
import { AudioCacheController, type NativeAudioCache } from './audioCacheController'
import {
  clearPracticeTtsCache,
  fetchTtsStatus,
  playableDownloadUrl,
  referenceTtsRequest,
  resolvePracticePlayable,
} from './practiceTts'

const sha256 = 'a'.repeat(64)
const response = {
  uri: `sha256/${sha256}`,
  sha256,
  ms: 800,
  cached: true,
  download_url: `http://127.0.0.1:3000/v1/tts/assets/${sha256}`,
  voice_id: CATALOG_REFERENCE_VOICES['es-ES'].id,
  model_id: CATALOG_TTS_MODEL_ID,
  asset_class: REFERENCE_ASSET_CLASS,
}

afterEach(() => {
  clearPracticeTtsCache()
})

describe('practice API TTS', () => {
  it('rewrites a loopback download URL onto the configured API host', () => {
    expect(
      playableDownloadUrl(
        `http://127.0.0.1:3000/v1/tts/assets/${sha256}`,
        'http://10.0.2.2:3000/v1',
      ),
    ).toBe(`http://10.0.2.2:3000/v1/tts/assets/${sha256}`)
    expect(
      playableDownloadUrl(
        `http://10.0.2.2:3001/v1/tts/assets/${sha256}`,
        'http://localhost:3001/v1',
      ),
    ).toBe(`http://localhost:3001/v1/tts/assets/${sha256}`)
  })

  it('pins the catalog reference voice and never asks for listening-class audio', () => {
    const request = referenceTtsRequest('Hola', 'es-ES', sha256)
    expect(request.asset_class).toBe(REFERENCE_ASSET_CLASS)
    expect(request.voice_id).toBe(CATALOG_REFERENCE_VOICES['es-ES'].id)
    expect(request.model_id).toBe(CATALOG_TTS_MODEL_ID)
    expect(request.codec).toBe(LISTENING_CODEC)
  })

  it('prefers a catalog cloud object and does not call render', async () => {
    const render = vi.fn()
    await expect(
      resolvePracticePlayable({
        text: 'Hola',
        locale: 'es-ES',
        catalog: { uri: `https://cdn.loro.test/${sha256}.m4a`, sha256 },
        runtime: 'web',
        render,
      }),
    ).resolves.toEqual({
      uri: `https://cdn.loro.test/${sha256}.m4a`,
      sha256,
      source: 'catalog',
    })
    expect(render).not.toHaveBeenCalled()
  })

  it('plays the download URL on web and never returns audio bytes', async () => {
    const render = vi.fn().mockResolvedValue(response)
    const result = await resolvePracticePlayable({
      text: 'Hola',
      locale: 'es-ES',
      baseUrl: 'http://127.0.0.1:3000/v1',
      runtime: 'web',
      render,
    })
    expect(result).toEqual({
      uri: response.download_url,
      sha256,
      source: 'api-tts',
    })
    expect(result).not.toHaveProperty('audio')
    expect(render.mock.calls[0]?.[0]).toMatchObject({
      asset_class: REFERENCE_ASSET_CLASS,
      lang: 'es-ES',
    })
  })

  it('downloads to a native file URI so JavaScript never receives PCM', async () => {
    const native = {
      download: vi.fn().mockResolvedValue({
        fileUri: 'file:///cache/practice.m4a',
        ms: 800,
        sha256,
      }),
      lookup: vi.fn().mockResolvedValue(null),
      cancel: vi.fn().mockResolvedValue(undefined),
      pin: vi.fn().mockResolvedValue(undefined),
      unpin: vi.fn().mockResolvedValue(undefined),
      concatenate: vi.fn(),
      share: vi.fn(),
    } satisfies NativeAudioCache
    const render = vi.fn().mockResolvedValue(response)
    await expect(
      resolvePracticePlayable({
        text: 'Hola',
        locale: 'es-ES',
        baseUrl: 'http://10.0.2.2:3000/v1',
        runtime: 'native',
        cache: new AudioCacheController(native),
        render,
      }),
    ).resolves.toEqual({
      uri: 'file:///cache/practice.m4a',
      sha256,
      source: 'api-tts',
    })
    expect(native.download).toHaveBeenCalledWith(
      expect.objectContaining({
        url: `http://10.0.2.2:3000/v1/tts/assets/${sha256}`,
        expectedSha256: sha256,
        pinClass: 'practice',
      }),
    )
  })

  it('ignores a device-path catalog URI and uses the cloud render instead', async () => {
    const render = vi.fn().mockResolvedValue(response)
    await expect(
      resolvePracticePlayable({
        text: 'Hola',
        locale: 'es-ES',
        catalog: { uri: 'file:///tmp/clip.m4a', sha256 },
        baseUrl: 'http://127.0.0.1:3000/v1',
        runtime: 'web',
        render,
      }),
    ).resolves.toEqual({
      uri: response.download_url,
      sha256,
      source: 'api-tts',
    })
    expect(render).toHaveBeenCalled()
  })

  it('downloads a remote catalog URL on native instead of asking the device to speak', async () => {
    const native = {
      download: vi.fn().mockResolvedValue({
        fileUri: 'file:///cache/catalog.m4a',
        ms: 800,
        sha256,
      }),
      lookup: vi.fn().mockResolvedValue(null),
      cancel: vi.fn().mockResolvedValue(undefined),
      pin: vi.fn().mockResolvedValue(undefined),
      unpin: vi.fn().mockResolvedValue(undefined),
      concatenate: vi.fn(),
      share: vi.fn(),
    } satisfies NativeAudioCache
    await expect(
      resolvePracticePlayable({
        text: 'Hola',
        locale: 'es-ES',
        catalog: { uri: `https://cdn.loro.test/${sha256}.m4a`, sha256 },
        runtime: 'native',
        cache: new AudioCacheController(native),
        render: vi.fn(),
      }),
    ).resolves.toEqual({
      uri: 'file:///cache/catalog.m4a',
      sha256,
      source: 'catalog',
    })
    expect(native.download).toHaveBeenCalledWith(
      expect.objectContaining({
        url: `https://cdn.loro.test/${sha256}.m4a`,
        expectedSha256: sha256,
      }),
    )
  })

  it('treats a missing API as unavailable instead of inventing a voice', async () => {
    await expect(
      resolvePracticePlayable({
        text: 'Hola',
        locale: 'es-ES',
        baseUrl: null,
        runtime: 'web',
        render: vi.fn(),
      }),
    ).resolves.toBeNull()
  })

  it('reports API TTS ready only from an explicit status payload', async () => {
    const ready = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ready: true, provider: 'elevenlabs' }), {
        headers: { 'content-type': 'application/json' },
      }),
    )
    await expect(fetchTtsStatus('http://127.0.0.1:3000/v1', ready)).resolves.toEqual({
      ready: true,
      provider: 'elevenlabs',
    })
    await expect(fetchTtsStatus(null)).resolves.toEqual({
      ready: false,
      provider: 'unconfigured',
    })
    const missing = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 404 }))
    await expect(fetchTtsStatus('https://auth.loro.test/v1', missing)).resolves.toEqual({
      ready: false,
      provider: 'unavailable',
    })
  })
})
