import type { LyricDocument, MusicStyleId } from '@loro/core'
import type { MusicRenderJob } from '@loro/core/api/draft'

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
  readonly status: MusicRenderJob['status']
  readonly errorCode: MusicRenderJob['error_code']
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

  async saveLyric(record: StoredLyricDocument): Promise<void> {
    this.lyrics.set(`${record.userId}:${record.id}`, record)
  }

  async getLyric(id: string, userId: string): Promise<StoredLyricDocument | null> {
    return this.lyrics.get(`${userId}:${id}`) ?? null
  }

  async saveJob(record: StoredMusicJob): Promise<void> {
    this.jobs.set(`${record.userId}:${record.jobId}`, record)
  }

  async getJob(jobId: string, userId: string): Promise<StoredMusicJob | null> {
    return this.jobs.get(`${userId}:${jobId}`) ?? null
  }

  async listJobs(lyricDocumentId: string, userId: string): Promise<StoredMusicJob[]> {
    return [...this.jobs.values()].filter(
      (job) => job.userId === userId && job.lyricDocumentId === lyricDocumentId,
    )
  }

  async getJobByTrack(trackId: string, userId: string): Promise<StoredMusicJob | null> {
    return (
      [...this.jobs.values()].find((job) => job.userId === userId && job.trackId === trackId) ??
      null
    )
  }

  async putObject(record: MusicObjectRecord): Promise<void> {
    this.objects.set(record.sha256, record)
  }

  async getObject(sha256: string): Promise<MusicObjectRecord | null> {
    return this.objects.get(sha256) ?? null
  }
}

export const MUSIC_REPOSITORY = Symbol('MusicRepository')
