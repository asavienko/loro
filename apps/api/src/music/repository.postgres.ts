import { Inject, Injectable } from '@nestjs/common'
import { isMusicStyleId } from '@loro/core'
import { DATABASE, type SqlDatabase } from '../database/database.js'
import type {
  MusicErrorCode,
  MusicJobStatus,
  MusicObjectRecord,
  MusicRepository,
  StoredLyricDocument,
  StoredMusicJob,
} from './repository.js'

@Injectable()
export class PostgresMusicRepository implements MusicRepository {
  constructor(@Inject(DATABASE) private readonly database: SqlDatabase) {}

  async saveLyric(record: StoredLyricDocument): Promise<void> {
    await this.database.query(
      `INSERT INTO music_lyric_documents(
         id, user_id, document_json, document_hash, fallback, created_at
       ) VALUES ($1,$2,$3::jsonb,$4,$5,$6)
       ON CONFLICT (id) DO UPDATE SET
         document_json = excluded.document_json,
         document_hash = excluded.document_hash,
         fallback = excluded.fallback
       WHERE music_lyric_documents.user_id = excluded.user_id`,
      [
        record.id,
        record.userId,
        JSON.stringify(record.document),
        record.documentHash,
        record.fallback,
        record.createdAt,
      ],
    )
  }

  async getLyric(id: string, userId: string): Promise<StoredLyricDocument | null> {
    const result = await this.database.query(
      `SELECT id, user_id, document_json, document_hash, fallback, created_at
       FROM music_lyric_documents WHERE id = $1 AND user_id = $2`,
      [id, userId],
    )
    const row = result.rows[0]
    if (row === undefined) return null
    return {
      id: asText(row['id']),
      userId: asText(row['user_id']),
      document: row['document_json'] as StoredLyricDocument['document'],
      documentHash: asText(row['document_hash']),
      fallback: Boolean(row['fallback']),
      createdAt: Number(row['created_at']),
    }
  }

  async saveJob(record: StoredMusicJob): Promise<void> {
    await this.database.query(
      `INSERT INTO music_jobs(
         id, user_id, lyric_document_id, track_id, style_id, model_id, plan_hash,
         sha256, byte_length, duration_ms, provider_song_id, status, error_code,
         spend_micros, created_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (id) DO UPDATE SET
         status = excluded.status,
         sha256 = excluded.sha256,
         byte_length = excluded.byte_length,
         duration_ms = excluded.duration_ms,
         error_code = excluded.error_code,
         track_id = excluded.track_id
       WHERE music_jobs.user_id = excluded.user_id`,
      [
        record.jobId,
        record.userId,
        record.lyricDocumentId,
        record.trackId,
        record.styleId,
        record.modelId,
        record.planHash,
        record.sha256,
        record.byteLength,
        record.durationMs,
        record.providerSongId,
        record.status,
        record.errorCode,
        record.spendMicros,
        record.createdAt,
      ],
    )
  }

  async getJob(jobId: string, userId: string): Promise<StoredMusicJob | null> {
    const result = await this.database.query(
      `SELECT * FROM music_jobs WHERE id = $1 AND user_id = $2`,
      [jobId, userId],
    )
    return rowToJob(result.rows[0])
  }

  async listJobs(lyricDocumentId: string, userId: string): Promise<StoredMusicJob[]> {
    const result = await this.database.query(
      `SELECT * FROM music_jobs WHERE lyric_document_id = $1 AND user_id = $2`,
      [lyricDocumentId, userId],
    )
    return result.rows
      .map((row) => rowToJob(row))
      .filter((job): job is StoredMusicJob => job !== null)
  }

  async getJobByTrack(trackId: string, userId: string): Promise<StoredMusicJob | null> {
    const result = await this.database.query(
      `SELECT * FROM music_jobs WHERE track_id = $1 AND user_id = $2`,
      [trackId, userId],
    )
    return rowToJob(result.rows[0])
  }

  async putObject(record: MusicObjectRecord): Promise<void> {
    await this.database.query(
      `INSERT INTO music_objects(sha256, content_type, byte_length, body)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (sha256) DO UPDATE SET
         content_type = excluded.content_type,
         byte_length = excluded.byte_length,
         body = excluded.body`,
      [record.sha256, record.contentType, record.bytes.byteLength, Buffer.from(record.bytes)],
    )
  }

  async getObject(sha256: string): Promise<MusicObjectRecord | null> {
    const result = await this.database.query(
      `SELECT sha256, content_type, body FROM music_objects WHERE sha256 = $1`,
      [sha256],
    )
    const row = result.rows[0]
    if (row === undefined) return null
    const body = row['body']
    const bytes = body instanceof Uint8Array ? body : Buffer.from(asText(body))
    return {
      sha256: asText(row['sha256']),
      contentType: asText(row['content_type']),
      bytes: new Uint8Array(bytes),
    }
  }
}

function asText(value: unknown): string {
  if (typeof value !== 'string') throw new Error('expected text column')
  return value
}

function asTextOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null
  return asText(value)
}

function asStyleId(value: unknown): StoredMusicJob['styleId'] {
  const text = asText(value)
  if (!isMusicStyleId(text)) throw new Error('expected music style id')
  return text
}

function asJobStatus(value: unknown): MusicJobStatus {
  if (value === 'queued' || value === 'ready' || value === 'failed' || value === 'unknown_spend') {
    return value
  }
  throw new Error('expected music job status')
}

function asErrorCode(value: unknown): MusicErrorCode | null {
  if (value === null || value === undefined) return null
  if (
    value === 'provider' ||
    value === 'copyright' ||
    value === 'budget' ||
    value === 'invalid_audio' ||
    value === 'unavailable'
  ) {
    return value
  }
  throw new Error('expected music error code')
}

function rowToJob(row: Record<string, unknown> | undefined): StoredMusicJob | null {
  if (row === undefined) return null
  return {
    jobId: asText(row['id']),
    userId: asText(row['user_id']),
    lyricDocumentId: asText(row['lyric_document_id']),
    trackId: asTextOrNull(row['track_id']),
    styleId: asStyleId(row['style_id']),
    modelId: asText(row['model_id']),
    planHash: asText(row['plan_hash']),
    sha256: asTextOrNull(row['sha256']),
    byteLength: row['byte_length'] === null ? null : Number(row['byte_length']),
    durationMs: row['duration_ms'] === null ? null : Number(row['duration_ms']),
    providerSongId: asTextOrNull(row['provider_song_id']),
    status: asJobStatus(row['status']),
    errorCode: asErrorCode(row['error_code']),
    spendMicros: Number(row['spend_micros'] ?? 0),
    createdAt: Number(row['created_at']),
  }
}
