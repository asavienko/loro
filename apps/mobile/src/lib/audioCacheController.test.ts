import { describe, expect, it, vi } from 'vitest'
import { LISTENING_INTER_GAP_MS, LISTENING_INTRA_GAP_MS } from '@loro/core'
import {
  AudioCacheController,
  AudioCacheError,
  type AudioCacheObject,
  type NativeAudioCache,
} from './audioCacheController'

function fixture() {
  const native = {
    download: vi.fn((): Promise<AudioCacheObject> =>
      Promise.resolve({
        fileUri:
          'file:///cache/sha256/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.m4a',
        ms: 1420,
        sha256: 'a'.repeat(64),
      }),
    ),
    lookup: vi.fn(() => Promise.resolve(null)),
    cancel: vi.fn(() => Promise.resolve(undefined)),
    pin: vi.fn(() => Promise.resolve(undefined)),
    unpin: vi.fn(() => Promise.resolve(undefined)),
    concatenate: vi.fn(() =>
      Promise.resolve({
        fileUri: 'file:///cache/loro-es-ES-2026-09-09-listen.m4a',
        ms: 8000,
        sha256: 'b'.repeat(64),
      }),
    ),
    share: vi.fn(() => Promise.resolve(undefined)),
    saveListeningBatch: vi.fn(() => Promise.resolve(undefined)),
    loadListeningBatch: vi.fn((): Promise<AudioCacheObject[] | null> => Promise.resolve(null)),
    installDevFixture: vi.fn(),
  } satisfies NativeAudioCache
  return { native, controller: new AudioCacheController(native) }
}

describe('listening cache controller', () => {
  it('returns file URIs and never treats missing native as a silent hit', async () => {
    const web = new AudioCacheController(null)
    expect(web.available).toBe(false)
    await expect(
      web.download({
        url: 'https://cdn.loro.test/sha256/aa.m4a',
        expectedSha256: 'a'.repeat(64),
        logicalKey: 'listening|es-ES',
        pinClass: 'listening',
      }),
    ).rejects.toMatchObject({ code: 'native-unavailable' })
    expect(await web.lookup('listening|es-ES')).toBeNull()
  })

  it('rejects a checksum mismatch and does not invent duration', async () => {
    const f = fixture()
    f.native.download.mockResolvedValueOnce({
      fileUri: 'file:///cache/clip.m4a',
      ms: null,
      sha256: 'c'.repeat(64),
    })
    await expect(
      f.controller.download({
        url: 'https://cdn.loro.test/clip.m4a',
        expectedSha256: 'a'.repeat(64),
        logicalKey: 'k',
        pinClass: 'listening',
      }),
    ).rejects.toBeInstanceOf(AudioCacheError)
  })

  it('refuses credentialed download URLs', async () => {
    const f = fixture()
    await expect(
      f.controller.download({
        url: 'https://user:secret@cdn.loro.test/clip.m4a',
        expectedSha256: 'a'.repeat(64),
        logicalKey: 'k',
        pinClass: 'listening',
      }),
    ).rejects.toMatchObject({ code: 'invalid-url' })
    expect(f.native.download).not.toHaveBeenCalled()
  })

  it('keeps concatenate and share closed while Q-22 is open', async () => {
    const f = fixture()
    await expect(
      f.controller.concatenate({
        fileUris: ['file:///clip.m4a'],
        intraGapMs: LISTENING_INTRA_GAP_MS,
        interGapMs: LISTENING_INTER_GAP_MS,
        takesPerPhrase: 3,
        outputName: 'loro-es-ES-2026-09-09-listen.m4a',
      }),
    ).rejects.toMatchObject({ code: 'share-gated' })
    await expect(f.controller.share('file:///clip.m4a')).rejects.toMatchObject({
      code: 'share-gated',
    })
    expect(f.native.concatenate).not.toHaveBeenCalled()
    expect(f.native.share).not.toHaveBeenCalled()
  })

  it('restores a complete file-URI batch and rejects non-file URIs', async () => {
    const f = fixture()
    const clip: AudioCacheObject = {
      fileUri: 'file:///cache/clip.m4a',
      ms: 1420,
      sha256: 'a'.repeat(64),
    }
    f.native.loadListeningBatch.mockResolvedValueOnce([clip])
    await expect(f.controller.loadListeningBatch()).resolves.toEqual([clip])
    f.native.loadListeningBatch.mockResolvedValueOnce([
      { fileUri: 'https://cdn.loro.test/clip.m4a', ms: 1, sha256: 'a'.repeat(64) },
    ])
    await expect(f.controller.loadListeningBatch()).resolves.toBeNull()
  })

  it('installs a debug fixture as a file URI and refuses it without native', async () => {
    const f = fixture()
    f.native.installDevFixture.mockResolvedValueOnce({
      fileUri: 'file:///cache/sha256/fixture.m4a',
      ms: null,
      sha256: 'a'.repeat(64),
    })
    await expect(f.controller.installDevFixture('listening|dev')).resolves.toMatchObject({
      fileUri: 'file:///cache/sha256/fixture.m4a',
    })
    const web = new AudioCacheController(null)
    await expect(web.installDevFixture('listening|dev')).rejects.toMatchObject({
      code: 'native-unavailable',
    })
  })

  it('passes an authorization header through to native and still refuses credentialed URLs', async () => {
    const f = fixture()
    await f.controller.download({
      url: 'https://api.loro.test/v1/tts/assets/aa',
      expectedSha256: 'a'.repeat(64),
      logicalKey: 'listening|es-ES',
      pinClass: 'listening',
      authorization: 'Bearer access',
      deviceId: 'device-1',
    })
    expect(f.native.download).toHaveBeenCalledWith(
      expect.objectContaining({
        authorization: 'Bearer access',
        deviceId: 'device-1',
      }),
    )
  })
})
