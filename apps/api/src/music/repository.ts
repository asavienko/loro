import type { LyricDocument, MusicStyleId } from '@loro/core'

export type MusicJobStatus = 'queued' | 'ready' | 'failed' | 'unknown_spend'
export type MusicErrorCode = 'provider' | 'copyright' | 'budget' | 'invalid_audio' | 'unavailable'

export interface StoredLyricDocument {
  readonly id: string
  readonly userId: string
  readonly document: LyricDocument
  readonly documentHash: string
  readonly fallback: boolean
  readonly createdAt: number
}

export interface StoredMusicJob {
  readonly jobId: string
  readonly userId: string
  readonly lyricDocumentId: string
  readonly trackId: string | null
  readonly styleId: MusicStyleId
  readonly modelId: string
  readonly planHash: string
  readonly sha256: string | null
  readonly byteLength: number | null
  readonly durationMs: number | null
  readonly providerSongId: string | null
  readonly status: MusicJobStatus
  readonly errorCode: MusicErrorCode | null
  readonly spendMicros: number
  readonly createdAt: number
}

export interface MusicObjectRecord {
  readonly sha256: string
  readonly contentType: string
  readonly bytes: Uint8Array
}

export interface MusicRepository {
  saveLyric(record: StoredLyricDocument): Promise<void>
  getLyric(id: string, userId: string): Promise<StoredLyricDocument | null>
  saveJob(record: StoredMusicJob): Promise<void>
  getJob(jobId: string, userId: string): Promise<StoredMusicJob | null>
  listJobs(lyricDocumentId: string, userId: string): Promise<StoredMusicJob[]>
  getJobByTrack(trackId: string, userId: string): Promise<StoredMusicJob | null>
  putObject(record: MusicObjectRecord): Promise<void>
  getObject(sha256: string): Promise<MusicObjectRecord | null>
}

export class MemoryMusicRepository implements MusicRepository {
  private readonly lyrics = new Map<string, StoredLyricDocument>()
  private readonly jobs = new Map<string, StoredMusicJob>()
  private readonly objects = new Map<string, MusicObjectRecord>()

  saveLyric(record: StoredLyricDocument): Promise<void> {
    this.lyrics.set(`${record.userId}:${record.id}`, record)
    return Promise.resolve()
  }

  getLyric(id: string, userId: string): Promise<StoredLyricDocument | null> {
    return Promise.resolve(this.lyrics.get(`${userId}:${id}`) ?? null)
  }

  saveJob(record: StoredMusicJob): Promise<void> {
    this.jobs.set(`${record.userId}:${record.jobId}`, record)
    return Promise.resolve()
  }

  getJob(jobId: string, userId: string): Promise<StoredMusicJob | null> {
    return Promise.resolve(this.jobs.get(`${userId}:${jobId}`) ?? null)
  }

  listJobs(lyricDocumentId: string, userId: string): Promise<StoredMusicJob[]> {
    return Promise.resolve(
      [...this.jobs.values()].filter(
        (job) => job.userId === userId && job.lyricDocumentId === lyricDocumentId,
      ),
    )
  }

  getJobByTrack(trackId: string, userId: string): Promise<StoredMusicJob | null> {
    return Promise.resolve(
      [...this.jobs.values()].find((job) => job.userId === userId && job.trackId === trackId) ??
        null,
    )
  }

  putObject(record: MusicObjectRecord): Promise<void> {
    this.objects.set(record.sha256, record)
    return Promise.resolve()
  }

  getObject(sha256: string): Promise<MusicObjectRecord | null> {
    return Promise.resolve(this.objects.get(sha256) ?? null)
  }
}

export const MUSIC_REPOSITORY = Symbol('MusicRepository')
