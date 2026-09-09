/** AS-07. Native cache returns file URIs only; JavaScript never receives audio bytes. */
import { canShareListening } from '@loro/core'

export type AudioPinClass = 'listening' | 'practice'

export interface AudioCacheObject {
  fileUri: string
  ms: number | null
  sha256: string
}

export interface AudioCacheDownloadRequest {
  url: string
  expectedSha256: string
  logicalKey: string
  pinClass: AudioPinClass
}

export interface AudioCacheConcatenateRequest {
  fileUris: readonly string[]
  intraGapMs: number
  interGapMs: number
  takesPerPhrase: number
  outputName: string
}

export interface NativeAudioCache {
  download(request: AudioCacheDownloadRequest): Promise<AudioCacheObject>
  lookup(logicalKey: string): Promise<AudioCacheObject | null>
  cancel(): Promise<void>
  pin(logicalKeys: readonly string[]): Promise<void>
  unpin(logicalKeys: readonly string[]): Promise<void>
  concatenate(request: AudioCacheConcatenateRequest): Promise<AudioCacheObject>
  share(fileUri: string): Promise<void>
  saveListeningBatch?(clips: readonly AudioCacheObject[]): Promise<void>
  loadListeningBatch?(): Promise<AudioCacheObject[] | null>
}

export type AudioCacheErrorCode =
  | 'native-unavailable'
  | 'checksum-mismatch'
  | 'disk-full'
  | 'cancelled'
  | 'share-gated'
  | 'invalid-url'
  | 'failed'

export class AudioCacheError extends Error {
  constructor(readonly code: AudioCacheErrorCode) {
    super(code)
    this.name = 'AudioCacheError'
  }
}

function asCacheError(error: unknown): AudioCacheError {
  if (error instanceof AudioCacheError) return error
  const message = error instanceof Error ? error.message : ''
  if (message.includes('DISK') || message.includes('disk')) return new AudioCacheError('disk-full')
  if (message.includes('cancel')) return new AudioCacheError('cancelled')
  if (message.includes('checksum') || message.includes('sha256'))
    return new AudioCacheError('checksum-mismatch')
  if (message.includes('share')) return new AudioCacheError('share-gated')
  return new AudioCacheError('failed')
}

function assertHttpsOrLocal(url: string): void {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new AudioCacheError('invalid-url')
    }
    if (parsed.username || parsed.password) throw new AudioCacheError('invalid-url')
  } catch (error) {
    if (error instanceof AudioCacheError) throw error
    throw new AudioCacheError('invalid-url')
  }
}

export class AudioCacheController {
  constructor(private readonly native: NativeAudioCache | null) {}

  get available(): boolean {
    return this.native !== null
  }

  async download(request: AudioCacheDownloadRequest): Promise<AudioCacheObject> {
    if (this.native === null) throw new AudioCacheError('native-unavailable')
    assertHttpsOrLocal(request.url)
    try {
      const result = await this.native.download(request)
      if (result.sha256 !== request.expectedSha256) throw new AudioCacheError('checksum-mismatch')
      return result
    } catch (error) {
      throw asCacheError(error)
    }
  }

  async lookup(logicalKey: string): Promise<AudioCacheObject | null> {
    if (this.native === null) return null
    return this.native.lookup(logicalKey)
  }

  cancel(): Promise<void> {
    return this.native?.cancel() ?? Promise.resolve()
  }

  pin(logicalKeys: readonly string[]): Promise<void> {
    return this.native?.pin([...logicalKeys]) ?? Promise.resolve()
  }

  unpin(logicalKeys: readonly string[]): Promise<void> {
    return this.native?.unpin([...logicalKeys]) ?? Promise.resolve()
  }

  async concatenate(request: AudioCacheConcatenateRequest): Promise<AudioCacheObject> {
    if (!canShareListening()) throw new AudioCacheError('share-gated')
    if (this.native === null) throw new AudioCacheError('native-unavailable')
    try {
      return await this.native.concatenate(request)
    } catch (error) {
      throw asCacheError(error)
    }
  }

  async share(fileUri: string): Promise<void> {
    if (!canShareListening()) throw new AudioCacheError('share-gated')
    if (this.native === null) throw new AudioCacheError('native-unavailable')
    try {
      await this.native.share(fileUri)
    } catch (error) {
      throw asCacheError(error)
    }
  }

  /** Persist a complete batch so airplane-mode relaunch can play without generate. */
  saveListeningBatch(clips: readonly AudioCacheObject[]): Promise<void> {
    if (this.native?.saveListeningBatch === undefined) return Promise.resolve()
    return this.native.saveListeningBatch(clips)
  }

  async loadListeningBatch(): Promise<AudioCacheObject[] | null> {
    if (this.native?.loadListeningBatch === undefined) return null
    const clips = await this.native.loadListeningBatch()
    if (clips === null || clips.length === 0) return null
    if (clips.some((clip) => !clip.fileUri.startsWith('file:'))) return null
    return clips
  }
}
