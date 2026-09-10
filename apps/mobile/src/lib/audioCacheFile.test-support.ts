/**
 * Node stand-in for `loro-audio-cache`. Production app code must not import this:
 * learner JavaScript still must not download or hold audio bytes.
 */
import { createHash } from 'node:crypto'
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { LISTENING_BUDGET_BYTES } from '@loro/core'
import type {
  AudioCacheConcatenateRequest,
  AudioCacheDownloadRequest,
  AudioCacheObject,
  NativeAudioCache,
} from './audioCacheController'

interface IndexRow {
  path: string
  sha256: string
  ms: number | null
  pinned: boolean
  bytes: number
  accessed: number
}

export interface FileAudioCacheOptions {
  budgetBytes?: number
  fixtureBytes?: Buffer
}

export function createFileAudioCache(
  root: string,
  options: FileAudioCacheOptions = {},
): NativeAudioCache {
  const budget = options.budgetBytes ?? LISTENING_BUDGET_BYTES
  mkdirSync(join(root, 'sha256'), { recursive: true })
  let inflight: http.ClientRequest | null = null

  const cache: NativeAudioCache = {
    async download(request: AudioCacheDownloadRequest): Promise<AudioCacheObject> {
      const remote = new URL(request.url)
      if (remote.username || remote.password) throw new Error('invalid-url')
      if (remote.protocol !== 'http:' && remote.protocol !== 'https:')
        throw new Error('invalid-url')
      const headers: Record<string, string> = {}
      if (request.authorization) headers.Authorization = request.authorization
      if (request.deviceId) headers['X-Loro-Device'] = request.deviceId
      const bytes = await getBytes(remote, headers)
      const digest = sha256(bytes)
      if (digest !== request.expectedSha256.toLowerCase()) throw new Error('checksum-mismatch')
      return store(bytes, digest, request.logicalKey, request.pinClass)
    },
    lookup(logicalKey: string): Promise<AudioCacheObject | null> {
      const row = readIndex()[logicalKey]
      if (row === undefined) return Promise.resolve(null)
      const verified = verifiedObject(row)
      if (verified === null) {
        forget(logicalKey)
        return Promise.resolve(null)
      }
      mutateIndex((table) => {
        const current = table[logicalKey]
        if (current !== undefined) current.accessed = Date.now()
      })
      return Promise.resolve(verified)
    },
    cancel(): Promise<void> {
      inflight?.destroy(new Error('cancelled'))
      inflight = null
      return Promise.resolve()
    },
    pin(logicalKeys: readonly string[]): Promise<void> {
      mutateIndex((table) => {
        for (const key of logicalKeys) {
          const row = table[key]
          if (row !== undefined) row.pinned = true
        }
      })
      return Promise.resolve()
    },
    unpin(logicalKeys: readonly string[]): Promise<void> {
      mutateIndex((table) => {
        for (const key of logicalKeys) {
          const row = table[key]
          if (row !== undefined) row.pinned = false
        }
      })
      evictIfNeeded()
      return Promise.resolve()
    },
    concatenate(_request: AudioCacheConcatenateRequest): Promise<AudioCacheObject> {
      return Promise.reject(new Error('share-gated'))
    },
    share(_fileUri: string): Promise<void> {
      return Promise.reject(new Error('share-gated'))
    },
    saveListeningBatch(clips: readonly AudioCacheObject[]): Promise<void> {
      writeAtomic(join(root, 'listening-batch.json'), JSON.stringify(clips))
      return Promise.resolve()
    },
    loadListeningBatch(): Promise<AudioCacheObject[] | null> {
      const file = join(root, 'listening-batch.json')
      if (!existsSync(file)) return Promise.resolve(null)
      const parsed = JSON.parse(readFileSync(file, 'utf8')) as AudioCacheObject[]
      if (!Array.isArray(parsed) || parsed.length === 0) return Promise.resolve(null)
      const clips: AudioCacheObject[] = []
      for (const clip of parsed) {
        if (!clip.fileUri.startsWith('file:')) return Promise.resolve(null)
        const path = new URL(clip.fileUri).pathname
        if (sha256File(path) !== clip.sha256.toLowerCase()) return Promise.resolve(null)
        clips.push(clip)
      }
      return Promise.resolve(clips)
    },
    installDevFixture(logicalKey: string): Promise<AudioCacheObject> {
      const bytes = options.fixtureBytes
      if (bytes === undefined) return Promise.reject(new Error('failed'))
      const digest = sha256(bytes)
      return Promise.resolve(store(bytes, digest, logicalKey, 'listening'))
    },
  }

  function getBytes(url: URL, headers: Record<string, string>): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const lib = url.protocol === 'https:' ? https : http
      const req = lib.request(url, { method: 'GET', headers, timeout: 15_000 }, (res) => {
        const status = res.statusCode ?? 0
        if (status !== 200) {
          res.resume()
          reject(new Error('failed'))
          return
        }
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => {
          chunks.push(chunk)
        })
        res.on('end', () => {
          inflight = null
          resolve(Buffer.concat(chunks))
        })
        res.on('error', reject)
      })
      inflight = req
      req.on('error', (error) => {
        inflight = null
        reject(error.message === 'cancelled' ? new Error('cancelled') : error)
      })
      req.end()
    })
  }

  function store(bytes: Buffer, digest: string, key: string, pin: string): AudioCacheObject {
    const file = join(root, 'sha256', `${digest}.m4a`)
    const temp = `${file}.tmp`
    writeAtomic(file, bytes, temp)
    const object: AudioCacheObject = {
      fileUri: pathToFileURL(file).href,
      ms: null,
      sha256: digest,
    }
    mutateIndex((table) => {
      table[key] = {
        path: file,
        sha256: digest,
        ms: null,
        pinned: pin === 'listening',
        bytes: bytes.length,
        accessed: Date.now(),
      }
    })
    evictIfNeeded()
    return object
  }

  function indexFile(): string {
    return join(root, 'index.json')
  }

  function readIndex(): Record<string, IndexRow> {
    if (!existsSync(indexFile())) return {}
    return JSON.parse(readFileSync(indexFile(), 'utf8')) as Record<string, IndexRow>
  }

  function mutateIndex(body: (table: Record<string, IndexRow>) => void): void {
    const table = readIndex()
    body(table)
    writeAtomic(indexFile(), JSON.stringify(table))
  }

  function evictIfNeeded(): void {
    const table = readIndex()
    const unpinned = Object.entries(table)
      .filter(([, row]) => !row.pinned)
      .sort(([, left], [, right]) => left.accessed - right.accessed)
    let used = unpinned.reduce((sum, [, row]) => sum + row.bytes, 0)
    if (used <= budget) return
    const drop = new Set<string>()
    for (const [key, row] of unpinned) {
      if (used <= budget) break
      rmSync(row.path, { force: true })
      used -= row.bytes
      drop.add(key)
    }
    writeAtomic(
      indexFile(),
      JSON.stringify(Object.fromEntries(Object.entries(table).filter(([key]) => !drop.has(key)))),
    )
  }

  function forget(logicalKey: string): void {
    const table = readIndex()
    const row = table[logicalKey]
    if (row === undefined) return
    rmSync(row.path, { force: true })
    writeAtomic(
      indexFile(),
      JSON.stringify(
        Object.fromEntries(Object.entries(table).filter(([key]) => key !== logicalKey)),
      ),
    )
  }

  function verifiedObject(row: IndexRow): AudioCacheObject | null {
    if (sha256File(row.path) !== row.sha256.toLowerCase()) return null
    return { fileUri: pathToFileURL(row.path).href, ms: row.ms, sha256: row.sha256 }
  }

  return cache
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function sha256File(path: string): string | null {
  if (!existsSync(path)) return null
  return sha256(readFileSync(path))
}

function writeAtomic(file: string, contents: string | Buffer, temp = `${file}.tmp`): void {
  writeFileSync(temp, contents)
  const fd = openSync(temp, 'r+')
  fsyncSync(fd)
  closeSync(fd)
  if (existsSync(file)) rmSync(file)
  renameSync(temp, file)
}
