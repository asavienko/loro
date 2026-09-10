import { createHash } from 'node:crypto'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import {
  LISTENING_ASSET_CLASS,
  LISTENING_INTER_GAP_MS,
  LISTENING_INTRA_GAP_MS,
  LISTENING_MODEL_ID,
  LISTENING_SHARE_ENABLED,
  approvedListeningVoices,
} from '@loro/core'
import { AudioCacheController } from './audioCacheController'
import { createFileAudioCache } from './audioCacheFile.test-support'
import {
  playListeningSequence,
  prepareListeningBatch,
  restoreListeningBatch,
  shareListeningBatch,
} from './listenCompanion'
import { digestListeningText } from './listeningDigest'

const voices = [{ id: 'voice-a' }, { id: 'voice-b' }]
const modelId = 'dev-listen-fixture'
const phrases = [
  { id: 'row-1', targetText: 'Hola', learnerAuthored: false },
  { id: 'row-2', targetText: 'Gracias', learnerAuthored: false },
]

function hex(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function assertMetadataOnly(clip: { fileUri: string; ms: number | null; sha256: string }): void {
  expect(clip.fileUri.startsWith('file:')).toBe(true)
  expect(clip.sha256).toMatch(/^[a-f0-9]{64}$/)
  expect(Object.keys(clip).sort()).toEqual(['fileUri', 'ms', 'sha256'])
}

describe('listening generate → file cache → listen', () => {
  let root = ''
  let fixture = Buffer.alloc(0)
  let digest = ''
  let port = 0
  let requests = 0
  let lastAuth: string | undefined
  let lastDevice: string | undefined
  let lastCookie: string | string[] | undefined
  let server: ReturnType<typeof createServer> | undefined

  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), 'loro-listen-cache-'))
    const dest = join(root, 'fixture.m4a')
    const encoded = spawnSync(
      'ffmpeg',
      [
        '-y',
        '-f',
        'lavfi',
        '-i',
        'anullsrc=r=24000:cl=mono',
        '-t',
        '0.2',
        '-c:a',
        'aac',
        '-b:a',
        '64k',
        '-ac',
        '1',
        '-ar',
        '24000',
        dest,
      ],
      { encoding: 'utf8' },
    )
    if (encoded.status !== 0) throw new Error(encoded.stderr)
    fixture = readFileSync(dest)
    digest = hex(fixture)
    server = createServer((req: IncomingMessage, res: ServerResponse) => {
      requests += 1
      lastAuth = req.headers.authorization
      lastCookie = req.headers.cookie
      const deviceHeader = req.headers['x-loro-device']
      lastDevice = Array.isArray(deviceHeader) ? deviceHeader[0] : deviceHeader
      if (req.url === '/redirect') {
        res.writeHead(302, { Location: 'http://127.0.0.1/elsewhere.m4a' })
        res.end()
        return
      }
      if (req.url === '/clip.m4a') {
        res.writeHead(200, { 'Content-Type': 'audio/mp4' })
        res.end(fixture)
        return
      }
      res.writeHead(404)
      res.end()
    })
    await new Promise<void>((resolve) => {
      server?.listen(0, '127.0.0.1', () => {
        const address = server?.address()
        if (address === undefined || address === null || typeof address === 'string') {
          throw new Error('listen')
        }
        port = address.port
        resolve()
      })
    })
  })

  afterEach(() => {
    requests = 0
    lastAuth = undefined
    lastDevice = undefined
    lastCookie = undefined
    rmSync(join(root, 'sha256'), { recursive: true, force: true })
    rmSync(join(root, 'index.json'), { force: true })
    rmSync(join(root, 'listening-batch.json'), { force: true })
    mkdirSyncCache()
  })

  afterAll(() => {
    server?.close()
    rmSync(root, { recursive: true, force: true })
  })

  function mkdirSyncCache(): void {
    mkdirSync(join(root, 'sha256'), { recursive: true })
  }

  function downloadUrl(): string {
    return `http://127.0.0.1:${port}/clip.m4a`
  }

  it('downloads metadata-only renders into sha256 files and plays file URIs without network', async () => {
    const native = createFileAudioCache(root, { fixtureBytes: fixture })
    const cache = new AudioCacheController(native)
    const ready = await prepareListeningBatch({
      cache,
      locale: 'es-ES',
      phrases,
      repeats: 2,
      voices,
      modelId,
      digest: digestListeningText,
      network: () => Promise.resolve(true),
      credentials: () => Promise.resolve({ token: 'access', deviceId: 'device-1' }),
      render: (request) =>
        Promise.resolve({
          uri: `sha256/${digest}`,
          sha256: digest,
          ms: null,
          cached: false,
          download_url: downloadUrl(),
          voice_id: request.voice_id,
          model_id: modelId,
          asset_class: LISTENING_ASSET_CLASS,
        }),
    })
    expect(ready.phase).toBe('ready')
    expect(ready.clips).toHaveLength(4)
    expect(requests).toBe(4)
    expect(lastAuth).toBe('Bearer access')
    expect(lastDevice).toBe('device-1')
    expect(lastCookie).toBeUndefined()
    for (const clip of ready.clips) {
      assertMetadataOnly(clip)
      expect(clip.sha256).toBe(digest)
      expect(readFileSync(new URL(clip.fileUri))).toEqual(fixture)
    }
    expect(readFileSync(join(root, 'sha256', `${digest}.m4a`)).length).toBe(fixture.length)

    requests = 0
    const hits = await prepareListeningBatch({
      cache,
      locale: 'es-ES',
      phrases,
      repeats: 2,
      voices,
      modelId,
      digest: digestListeningText,
      network: () => Promise.resolve(false),
      render: () => {
        throw new Error('render must not run on a cache hit')
      },
    })
    expect(hits.phase).toBe('ready')
    expect(requests).toBe(0)
    expect(hits.clips.every((clip) => clip.fileUri.startsWith('file:'))).toBe(true)

    const played: string[] = []
    await playListeningSequence({
      clips: hits.clips,
      repeats: 2,
      playFile: (_id, fileUri, onEnded) => {
        expect(fileUri.startsWith('file:')).toBe(true)
        played.push(fileUri)
        onEnded?.()
        return Promise.resolve()
      },
    })
    expect(played).toHaveLength(4)

    await cache.saveListeningBatch(ready.clips)
    const relaunch = new AudioCacheController(createFileAudioCache(root, { fixtureBytes: fixture }))
    const restored = await restoreListeningBatch(relaunch)
    expect(restored).not.toBeNull()
    expect(restored?.map((clip) => clip.fileUri)).toEqual(ready.clips.map((clip) => clip.fileUri))

    await expect(
      shareListeningBatch(cache, {
        fileUris: ready.clips.map((clip) => clip.fileUri),
        intraGapMs: 400,
        interGapMs: 1200,
        takesPerPhrase: 2,
        outputName: 'loro-es-ES-2026-09-10-listen.m4a',
      }),
    ).rejects.toMatchObject({ code: 'share-gated' })
  })

  it('uses pinned listening voices and download() without a fixture seed', async () => {
    expect(LISTENING_MODEL_ID).not.toBeNull()
    expect(approvedListeningVoices('es-ES').length).toBeGreaterThanOrEqual(2)
    const native = createFileAudioCache(root, { fixtureBytes: fixture })
    const cache = new AudioCacheController(native)
    const ready = await prepareListeningBatch({
      cache,
      locale: 'es-ES',
      phrases: [phrases[0]!],
      repeats: 2,
      digest: digestListeningText,
      network: () => Promise.resolve(true),
      credentials: () => Promise.resolve({ token: 'access', deviceId: 'device-1' }),
      render: (request) => {
        expect(
          approvedListeningVoices('es-ES').some((voice) => voice.id === request.voice_id),
        ).toBe(true)
        expect(request.model_id).toBe(LISTENING_MODEL_ID)
        expect(request.asset_class).toBe(LISTENING_ASSET_CLASS)
        return Promise.resolve({
          uri: `sha256/${digest}`,
          sha256: digest,
          ms: null,
          cached: false,
          download_url: downloadUrl(),
          voice_id: request.voice_id,
          model_id: request.model_id,
          asset_class: LISTENING_ASSET_CLASS,
        })
      },
    })
    expect(ready.phase).toBe('ready')
    expect(ready.clips).toHaveLength(2)
    expect(ready.clips.every((clip) => clip.fileUri.startsWith('file:'))).toBe(true)
    expect(lastAuth).toBe('Bearer access')
    expect(lastDevice).toBe('device-1')
  })

  it('treats a checksum-mismatched file as a miss and refuses redirects', async () => {
    const native = createFileAudioCache(root, { fixtureBytes: fixture })
    const cache = new AudioCacheController(native)
    await prepareListeningBatch({
      cache,
      locale: 'es-ES',
      phrases: [phrases[0]!],
      repeats: 2,
      voices,
      modelId,
      digest: digestListeningText,
      network: () => Promise.resolve(true),
      render: (request) =>
        Promise.resolve({
          uri: `sha256/${digest}`,
          sha256: digest,
          ms: null,
          cached: false,
          download_url: downloadUrl(),
          voice_id: request.voice_id,
          model_id: modelId,
          asset_class: LISTENING_ASSET_CLASS,
        }),
    })
    writeFileSync(join(root, 'sha256', `${digest}.m4a`), 'corrupt')
    const afterCorrupt = await prepareListeningBatch({
      cache,
      locale: 'es-ES',
      phrases: [phrases[0]!],
      repeats: 2,
      voices,
      modelId,
      digest: digestListeningText,
      network: () => Promise.resolve(true),
      render: (request) =>
        Promise.resolve({
          uri: `sha256/${digest}`,
          sha256: digest,
          ms: null,
          cached: false,
          download_url: downloadUrl(),
          voice_id: request.voice_id,
          model_id: modelId,
          asset_class: LISTENING_ASSET_CLASS,
        }),
    })
    expect(afterCorrupt.phase).toBe('ready')
    expect(readFileSync(join(root, 'sha256', `${digest}.m4a`))).toEqual(fixture)

    await expect(
      cache.download({
        url: `http://127.0.0.1:${port}/redirect`,
        expectedSha256: digest,
        logicalKey: 'listening-redirect',
        pinClass: 'listening',
      }),
    ).rejects.toMatchObject({ code: 'failed' })
  })

  it('seeds a __DEV__ fixture batch into file URIs without calling cloud TTS', async () => {
    const native = createFileAudioCache(root, { fixtureBytes: fixture })
    const cache = new AudioCacheController(native)
    const ready = await prepareListeningBatch({
      cache,
      locale: 'es-ES',
      phrases: [phrases[0]!],
      repeats: 2,
      voices,
      modelId,
      digest: digestListeningText,
      network: () => Promise.resolve(false),
      render: () => {
        throw new Error('licensed render must not run for fixture seed')
      },
      seedClip: (key) => cache.installDevFixture(key),
    })
    expect(ready.phase).toBe('ready')
    expect(requests).toBe(0)
    expect(ready.clips).toHaveLength(2)
    for (const clip of ready.clips) assertMetadataOnly(clip)
  })

  it('installs the debug fixture through loopback HTTP download, not a store bypass', async () => {
    const native = createFileAudioCache(root, { fixtureBytes: fixture })
    const original = native.download.bind(native)
    const urls: string[] = []
    native.download = async (request) => {
      urls.push(request.url)
      return original(request)
    }
    const cache = new AudioCacheController(native)
    const clip = await cache.installDevFixture('listening|http-fixture')
    expect(urls).toEqual([
      expect.stringMatching(/^http:\/\/127\.0\.0\.1:\d+\/listen-fixture\.m4a$/),
    ])
    expect(clip.sha256).toBe(digest)
    expect(clip.fileUri.startsWith('file:')).toBe(true)
    expect(existsSync(join(root, 'sha256', `${digest}.m4a`))).toBe(true)
    expect(requests).toBe(0)
  })

  it('evicts unpinned clips under the named budget and keeps pinned listening clips', async () => {
    const native = createFileAudioCache(root, {
      budgetBytes: fixture.length + 4,
      fixtureBytes: fixture,
    })
    const cache = new AudioCacheController(native)
    await cache.download({
      url: downloadUrl(),
      expectedSha256: digest,
      logicalKey: 'practice-old',
      pinClass: 'practice',
    })
    const padded = Buffer.concat([fixture, Buffer.from('x')])
    const paddedDigest = hex(padded)
    const paddedServer = createServer((_req, res) => {
      res.writeHead(200)
      res.end(padded)
    })
    const paddedPort = await new Promise<number>((resolve) => {
      paddedServer.listen(0, '127.0.0.1', () => {
        const address = paddedServer.address()
        if (address === null || typeof address === 'string') throw new Error('listen')
        resolve(address.port)
      })
    })
    try {
      await cache.download({
        url: `http://127.0.0.1:${paddedPort}/`,
        expectedSha256: paddedDigest,
        logicalKey: 'practice-new',
        pinClass: 'practice',
      })
      await cache.download({
        url: downloadUrl(),
        expectedSha256: digest,
        logicalKey: 'listening-keep',
        pinClass: 'listening',
      })
    } finally {
      paddedServer.close()
    }
    expect(await cache.lookup('practice-old')).toBeNull()
    expect(await cache.lookup('listening-keep')).not.toBeNull()
  })

  it('throws share-gated from native concatenate and share while Q-22 is closed', async () => {
    expect(LISTENING_SHARE_ENABLED).toBe(false)
    const native = createFileAudioCache(root, { fixtureBytes: fixture })
    await expect(
      native.concatenate({
        fileUris: ['file:///clip.m4a'],
        intraGapMs: LISTENING_INTRA_GAP_MS,
        interGapMs: LISTENING_INTER_GAP_MS,
        takesPerPhrase: 2,
        outputName: 'loro-es-ES-2026-09-10-listen.m4a',
      }),
    ).rejects.toThrow('share-gated')
    await expect(native.share('file:///clip.m4a')).rejects.toThrow('share-gated')
  })
})
