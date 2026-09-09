import { createHash } from 'node:crypto'
import { Inject, Injectable } from '@nestjs/common'
import { MUSIC_MODEL_ID, type LyricDocument } from '@loro/core'
import {
  MusicLyricsRequestSchema,
  MusicRendersRequestSchema,
  type MusicLyricsRequest,
  type MusicLyricsResponse,
  type MusicRendersResponse,
  type MusicTrackResponse,
} from '@loro/core/api/draft'
import { resolveMusicStylePacks } from '@loro/content'
import type { AuthPrincipal } from '../auth/auth.tokens.js'
import { LoroError } from '../common/errors.js'
import { ElevenLabsMusicAdapter, composeStyles } from '../integrations/elevenlabs/music.js'
import { MusicBudget } from './budget.js'
import { LyricsCoordinator } from './lyrics.coordinator.js'
import {
  MUSIC_REPOSITORY,
  type MusicErrorCode,
  type MusicRepository,
  type StoredMusicJob,
} from './repository.js'

@Injectable()
export class MusicService {
  private readonly lyrics: LyricsCoordinator
  private readonly adapter: ElevenLabsMusicAdapter
  private readonly budget: MusicBudget

  constructor(@Inject(MUSIC_REPOSITORY) private readonly repository: MusicRepository) {
    this.lyrics = new LyricsCoordinator()
    this.adapter = new ElevenLabsMusicAdapter({
      provider: process.env['MUSIC_PROVIDER'] ?? 'stub',
    })
    this.budget = new MusicBudget()
  }

  async createLyrics(principal: AuthPrincipal, body: unknown): Promise<MusicLyricsResponse> {
    const request = parse(MusicLyricsRequestSchema, body)
    const response = await this.lyrics.lyrics(request, principal.userId)
    await this.repository.saveLyric({
      id: response.lyric_document_id,
      userId: principal.userId,
      document: response.document,
      documentHash: createHash('sha256').update(JSON.stringify(response.document)).digest('hex'),
      fallback: response.fallback,
      createdAt: 0,
    })
    return response
  }

  async renderStyles(principal: AuthPrincipal, body: unknown): Promise<MusicRendersResponse> {
    const request = parse(MusicRendersRequestSchema, body)
    const stored = await this.repository.getLyric(request.lyric_document_id, principal.userId)
    if (stored === null) throw new LoroError('NOT_FOUND')
    if (!this.budget.canSpend(principal.userId, 1)) {
      throw new LoroError('BUDGET_EXCEEDED')
    }
    const packs = resolveMusicStylePacks(request.style_ids)
    const outcomes = await composeStyles(this.adapter, stored.document, packs, 2)
    const jobs: MusicRendersResponse['jobs'] = []
    for (const [index, pack] of packs.entries()) {
      const outcome = outcomes[index]
      const jobId = jobIdFor(stored.id, pack.style_id)
      const trackId = `track_${pack.style_id}_${stored.id.slice(-8)}`
      if (outcome?.ok === true) {
        await this.repository.putObject({
          sha256: outcome.result.sha256,
          contentType: outcome.result.contentType,
          bytes: outcome.result.bytes,
        })
        const job = storedJob({
          jobId,
          userId: principal.userId,
          lyricDocumentId: stored.id,
          trackId,
          styleId: pack.style_id,
          planHash: outcome.result.planHash,
          sha256: outcome.result.sha256,
          byteLength: outcome.result.bytes.byteLength,
          durationMs: outcome.result.durationMs,
          status: 'ready',
          errorCode: null,
        })
        await this.repository.saveJob(job)
        jobs.push(toWireJob(job, trackId))
      } else {
        const errorCode = errorFor(outcome?.failure.kind)
        const job = storedJob({
          jobId,
          userId: principal.userId,
          lyricDocumentId: stored.id,
          trackId: null,
          styleId: pack.style_id,
          planHash: '0'.repeat(64),
          sha256: null,
          byteLength: null,
          durationMs: null,
          status: outcome?.failure.kind === 'unavailable' ? 'unknown_spend' : 'failed',
          errorCode,
        })
        await this.repository.saveJob(job)
        jobs.push(toWireJob(job, null))
      }
    }
    return { lyric_document_id: stored.id, jobs }
  }

  async trackMetadata(principal: AuthPrincipal, trackId: string): Promise<MusicTrackResponse> {
    const job = await this.jobForTrack(trackId, principal.userId)
    if (job?.sha256 == null || job.status !== 'ready') {
      throw new LoroError('NOT_FOUND')
    }
    return {
      track_id: trackId,
      style_id: job.styleId,
      sha256: job.sha256,
      byte_length: job.byteLength ?? 0,
      duration_ms: job.durationMs,
      content_type: 'audio/wav',
      generated: true,
      download_path: `/music/tracks/${trackId}/content`,
    }
  }

  async trackContent(
    principal: AuthPrincipal,
    trackId: string,
  ): Promise<{ bytes: Uint8Array; contentType: string }> {
    const job = await this.jobForTrack(trackId, principal.userId)
    if (job?.sha256 == null) throw new LoroError('NOT_FOUND')
    const object = await this.repository.getObject(job.sha256)
    if (object === null) throw new LoroError('NOT_FOUND')
    return { bytes: object.bytes, contentType: object.contentType }
  }

  private async jobForTrack(trackId: string, userId: string): Promise<StoredMusicJob | null> {
    return this.repository.getJobByTrack(trackId, userId)
  }
}

function parse<T>(
  schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } },
  value: unknown,
): T {
  const result = schema.safeParse(value)
  if (!result.success) throw new LoroError('VALIDATION_FAILED')
  return result.data
}

function jobIdFor(lyricId: string, styleId: string): string {
  return `job_${styleId}_${lyricId.slice(-8)}`
}

function storedJob(
  input: Omit<StoredMusicJob, 'modelId' | 'providerSongId' | 'spendMicros' | 'createdAt'> &
    Partial<Pick<StoredMusicJob, 'modelId' | 'providerSongId' | 'spendMicros' | 'createdAt'>>,
): StoredMusicJob {
  return {
    modelId: MUSIC_MODEL_ID,
    providerSongId: null,
    spendMicros: 0,
    createdAt: 0,
    ...input,
  }
}

function toWireJob(
  job: StoredMusicJob,
  trackId: string | null,
): MusicRendersResponse['jobs'][number] {
  return {
    job_id: job.jobId,
    style_id: job.styleId,
    status: job.status,
    error_code: job.errorCode,
    track_id: trackId,
    duration_ms: job.durationMs,
  }
}

function errorFor(
  kind:
    | 'bad_prompt'
    | 'bad_composition_plan'
    | 'rate_limited'
    | 'invalid_audio'
    | 'unavailable'
    | undefined,
): MusicErrorCode {
  if (kind === 'bad_prompt' || kind === 'bad_composition_plan') return 'copyright'
  if (kind === 'rate_limited' || kind === 'unavailable') return 'unavailable'
  if (kind === 'invalid_audio') return 'invalid_audio'
  return 'provider'
}

export type { LyricDocument, MusicLyricsRequest }
