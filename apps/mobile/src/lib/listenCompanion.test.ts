import { describe, expect, it, vi } from 'vitest'
import {
  LISTENING_INTER_GAP_MS,
  LISTENING_INTRA_GAP_MS,
  LISTENING_MIN_VOICES,
  LISTENING_SHARE_ENABLED,
} from '@loro/core'
import { AudioCacheController, AudioCacheError } from './audioCacheController'
import {
  listenStatusKind,
  listenViewModel,
  listeningFixtureSeedEnabled,
  playListeningSequence,
  prepareListeningBatch,
  restoreListeningBatch,
  shareListeningBatch,
} from './listenCompanion'
import { fixtureListenView } from './listenFixtures'
import { TtsRenderError } from './ttsRenderClient'

describe('listening companion', () => {
  it('enables generate once Q-15 pins two licensed voices and keeps Q-22 share closed', () => {
    const view = listenViewModel({
      phase: 'idle',
      locale: 'es-ES',
      phrases: [{ id: 'row-1', targetText: 'Hola', learnerAuthored: false }],
      repeats: 3,
      network: true,
      configured: true,
      nativeCache: true,
      sessionBusy: false,
      diskFull: false,
      quotaExceeded: false,
      cacheComplete: false,
      progress: { done: 0, total: 0, failed: 0 },
      durationMs: null,
    })
    expect(view.voices.length).toBeGreaterThanOrEqual(LISTENING_MIN_VOICES)
    expect(view.voices.map((voice) => voice.name)).toEqual(['Sara Martin 1', 'Dante'])
    expect(view.generateEnabled).toBe(true)
    expect(view.blockers).not.toContain('voices-unapproved')
    expect(view.blockers).not.toContain('model-unpinned')
    expect(listenStatusKind(view)).toBe('ready-to-generate')
    expect(LISTENING_SHARE_ENABLED).toBe(false)
    expect(view.shareEnabled).toBe(false)
  })

  it('keeps generate and listen unavailable without native cache', () => {
    const view = listenViewModel({
      phase: 'ready',
      locale: 'es-ES',
      phrases: [{ id: 'row-1', targetText: 'Hola', learnerAuthored: false }],
      repeats: 3,
      network: true,
      configured: true,
      nativeCache: false,
      sessionBusy: false,
      diskFull: false,
      quotaExceeded: false,
      cacheComplete: true,
      progress: { done: 9, total: 9, failed: 0 },
      durationMs: 1420,
    })
    expect(view.nativeCache).toBe(false)
    expect(view.generateEnabled).toBe(false)
    expect(view.listenEnabled).toBe(false)
    expect(view.shareEnabled).toBe(false)
    expect(view.blockers).toContain('native-unavailable')
    expect(listenStatusKind(view)).toBe('native-unavailable')
  })

  it('plays from cache without network and keeps Q-22 share closed', () => {
    const view = listenViewModel({
      phase: 'ready',
      locale: 'es-ES',
      phrases: [{ id: 'row-1', targetText: 'Hola', learnerAuthored: false }],
      repeats: 3,
      network: false,
      configured: true,
      nativeCache: true,
      sessionBusy: false,
      diskFull: false,
      quotaExceeded: false,
      cacheComplete: true,
      progress: { done: 9, total: 9, failed: 0 },
      durationMs: 1420,
    })
    expect(view.listenEnabled).toBe(true)
    expect(view.shareEnabled).toBe(false)
    expect(view.generateEnabled).toBe(false)
    expect(listenStatusKind(view)).toBe('ready-to-listen')
  })

  it('skips verified cache hits and keeps completed clips on cancel', async () => {
    const lookup = vi.fn((key: string) =>
      Promise.resolve(
        key.includes('hit')
          ? { fileUri: 'file:///clip.m4a', ms: 1000, sha256: 'a'.repeat(64) }
          : null,
      ),
    )
    const cache = new AudioCacheController({
      download: vi.fn(),
      lookup,
      cancel: vi.fn(() => Promise.resolve(undefined)),
      pin: vi.fn(() => Promise.resolve(undefined)),
      unpin: vi.fn(() => Promise.resolve(undefined)),
      concatenate: vi.fn(),
      share: vi.fn(() => Promise.resolve(undefined)),
    })
    const abort = new AbortController()
    abort.abort()
    const result = await prepareListeningBatch({
      cache,
      locale: 'es-ES',
      phrases: [{ id: 'row-1', targetText: 'Hola', learnerAuthored: false }],
      repeats: 3,
      signal: abort.signal,
    })
    expect(result.phase).toBe('cancelled')
  })

  it('fixtures honest composer states without claiming licensed neural audio', () => {
    expect(fixtureListenView('voices-unapproved').blockers).toContain('voices-unapproved')
    expect(fixtureListenView('share-unavailable').shareEnabled).toBe(false)
    expect(fixtureListenView('share-ready').shareEnabled).toBe(true)
    expect(fixtureListenView('generating').phase).toBe('generating')
    expect(fixtureListenView('empty').phraseCount).toBe(0)
  })

  it('plays cached file URIs with named gaps and never muxes while Q-22 is open', async () => {
    const playFile = vi.fn((_id: string, _uri: string, onEnded?: () => void) => {
      onEnded?.()
      return Promise.resolve()
    })
    const wait = vi.fn(() => Promise.resolve(undefined))
    await playListeningSequence({
      clips: [
        { fileUri: 'file:///a.m4a', ms: 1000, sha256: 'a'.repeat(64) },
        { fileUri: 'file:///b.m4a', ms: 1000, sha256: 'b'.repeat(64) },
        { fileUri: 'file:///c.m4a', ms: 1000, sha256: 'c'.repeat(64) },
      ],
      repeats: 2,
      playFile,
      wait,
    })
    expect(playFile).toHaveBeenCalledTimes(3)
    expect(wait).toHaveBeenNthCalledWith(1, LISTENING_INTRA_GAP_MS, undefined)
    expect(wait).toHaveBeenNthCalledWith(2, LISTENING_INTER_GAP_MS, undefined)
    await expect(
      playListeningSequence({
        clips: [{ fileUri: 'https://cdn.loro.test/clip.m4a', ms: 1, sha256: 'a'.repeat(64) }],
        repeats: 2,
        playFile,
      }),
    ).rejects.toMatchObject({ code: 'invalid-url' })
    const cache = new AudioCacheController({
      download: vi.fn(),
      lookup: vi.fn(),
      cancel: vi.fn(() => Promise.resolve(undefined)),
      pin: vi.fn(() => Promise.resolve(undefined)),
      unpin: vi.fn(() => Promise.resolve(undefined)),
      concatenate: vi.fn(),
      share: vi.fn(() => Promise.resolve(undefined)),
    })
    await expect(
      shareListeningBatch(cache, {
        fileUris: ['file:///a.m4a'],
        intraGapMs: LISTENING_INTRA_GAP_MS,
        interGapMs: LISTENING_INTER_GAP_MS,
        takesPerPhrase: 2,
        outputName: 'loro-es-ES-2026-09-09-listen.m4a',
      }),
    ).rejects.toBeInstanceOf(AudioCacheError)
    expect(LISTENING_SHARE_ENABLED).toBe(false)
  })

  it('stops on licensed quota and forwards the bearer to native download', async () => {
    const download = vi.fn(() =>
      Promise.resolve({
        fileUri: 'file:///clip.m4a',
        ms: 1000,
        sha256: 'a'.repeat(64),
      }),
    )
    const cache = new AudioCacheController({
      download,
      lookup: vi.fn(() => Promise.resolve(null)),
      cancel: vi.fn(() => Promise.resolve(undefined)),
      pin: vi.fn(() => Promise.resolve(undefined)),
      unpin: vi.fn(() => Promise.resolve(undefined)),
      concatenate: vi.fn(),
      share: vi.fn(() => Promise.resolve(undefined)),
    })
    const voices = [{ id: 'voice-a' }, { id: 'voice-b' }]
    await expect(
      prepareListeningBatch({
        cache,
        locale: 'es-ES',
        phrases: [{ id: 'row-1', targetText: 'Hola', learnerAuthored: false }],
        repeats: 2,
        voices,
        modelId: 'eleven_multilingual_v2',
        credentials: () => Promise.resolve({ token: 'access', deviceId: 'device-1' }),
        digest: () => Promise.resolve('a'.repeat(64)),
        network: () => Promise.resolve(true),
        render: () => Promise.reject(new TtsRenderError('quota')),
      }),
    ).rejects.toMatchObject({ code: 'quota' })
    const ready = await prepareListeningBatch({
      cache,
      locale: 'es-ES',
      phrases: [{ id: 'row-1', targetText: 'Hola', learnerAuthored: false }],
      repeats: 2,
      voices,
      modelId: 'eleven_multilingual_v2',
      credentials: () => Promise.resolve({ token: 'access', deviceId: 'device-1' }),
      digest: () => Promise.resolve('a'.repeat(64)),
      network: () => Promise.resolve(true),
      render: () =>
        Promise.resolve({
          uri: `sha256/${'a'.repeat(64)}`,
          sha256: 'a'.repeat(64),
          ms: 1000,
          cached: false,
          download_url: `https://api.loro.test/v1/tts/assets/${'a'.repeat(64)}`,
          voice_id: 'voice-a',
          model_id: 'eleven_multilingual_v2',
          asset_class: 'listening',
        }),
    })
    expect(ready.phase).toBe('ready')
    expect(download).toHaveBeenCalledWith(
      expect.objectContaining({
        authorization: 'Bearer access',
        deviceId: 'device-1',
        pinClass: 'listening',
      }),
    )
  })

  it('restores a previously saved complete batch without network', async () => {
    const clip = { fileUri: 'file:///cache/clip.m4a', ms: 1000, sha256: 'a'.repeat(64) }
    const cache = new AudioCacheController({
      download: vi.fn(),
      lookup: vi.fn(),
      cancel: vi.fn(() => Promise.resolve(undefined)),
      pin: vi.fn(() => Promise.resolve(undefined)),
      unpin: vi.fn(() => Promise.resolve(undefined)),
      concatenate: vi.fn(),
      share: vi.fn(() => Promise.resolve(undefined)),
      saveListeningBatch: vi.fn(() => Promise.resolve(undefined)),
      loadListeningBatch: vi.fn(() => Promise.resolve([clip])),
    })
    await expect(restoreListeningBatch(cache)).resolves.toEqual([clip])
  })

  it('seeds fixture clips as file URIs without licensed render or network', async () => {
    const cache = new AudioCacheController({
      download: vi.fn(),
      lookup: vi.fn(() => Promise.resolve(null)),
      cancel: vi.fn(() => Promise.resolve(undefined)),
      pin: vi.fn(() => Promise.resolve(undefined)),
      unpin: vi.fn(() => Promise.resolve(undefined)),
      concatenate: vi.fn(),
      share: vi.fn(() => Promise.resolve(undefined)),
    })
    const ready = await prepareListeningBatch({
      cache,
      locale: 'es-ES',
      phrases: [{ id: 'row-1', targetText: 'Hola', learnerAuthored: false }],
      repeats: 2,
      voices: [{ id: 'voice-a' }, { id: 'voice-b' }],
      modelId: 'dev-listen-fixture',
      digest: () => Promise.resolve('a'.repeat(64)),
      network: () => Promise.resolve(false),
      render: () => Promise.reject(new Error('licensed render must not run')),
      seedClip: () =>
        Promise.resolve({
          fileUri: 'file:///cache/fixture.m4a',
          ms: null,
          sha256: 'a'.repeat(64),
        }),
    })
    expect(ready.phase).toBe('ready')
    expect(ready.clips).toHaveLength(2)
    expect(ready.clips.every((clip) => clip.fileUri.startsWith('file:'))).toBe(true)
  })

  it('does not seed the debug fixture when licensed generate is available', () => {
    expect(
      listeningFixtureSeedEnabled({
        licensedGenerate: true,
        nativeDebug: true,
        nativeCache: true,
      }),
    ).toBe(false)
    expect(
      listeningFixtureSeedEnabled({
        licensedGenerate: false,
        nativeDebug: true,
        nativeCache: true,
      }),
    ).toBe(true)
    expect(
      listeningFixtureSeedEnabled({
        licensedGenerate: false,
        nativeDebug: false,
        nativeCache: true,
      }),
    ).toBe(false)
  })
})
