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
import { config } from '../common/config.js'
import { SERVER_CLOCK, type ServerClock } from '../common/clock.js'
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

  constructor(
    @Inject(MUSIC_REPOSITORY) private readonly repository: MusicRepository,
    @Inject(SERVER_CLOCK) private readonly clock: ServerClock,
  ) {
    this.lyrics = new LyricsCoordinator()
    this.adapter = new ElevenLabsMusicAdapter({
      provider: config.musicProvider(),
    })
    this.budget = new MusicBudget()
  }

  status(): { ready: boolean; provider: string } {
    const provider = config.musicProvider()
    if (provider === 'elevenlabs') {
      return { ready: Boolean(config.musicApiKey()?.trim()), provider }
    }
    return { ready: provider === 'stub', provider: provider || 'stub' }
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
      createdAt: this.clock.now(),
    })
    return response
  }

  async renderStyles(principal: AuthPrincipal, body: unknown): Promise<MusicRendersResponse> {
    const request = parse(MusicRendersRequestSchema, body)
    const stored = await this.repository.getLyric(request.lyric_document_id, principal.userId)
    if (stored === null) throw new LoroError('NOT_FOUND')
    const packs = resolveMusicStylePacks(request.style_ids)
    const existing = await this.repository.listJobs(stored.id, principal.userId)
    const readyByStyle = new Map(
      existing
        .filter((job) => job.status === 'ready' && job.trackId !== null)
        .map((job) => [job.styleId, job]),
    )
    const missing = packs.filter((pack) => !readyByStyle.has(pack.style_id))
    if (missing.length > 0 && !this.budget.canSpend(principal.userId, missing.length)) {
      if (readyByStyle.size === 0) throw new LoroError('BUDGET_EXCEEDED')
      return {
        lyric_document_id: stored.id,
        jobs: packs.map((pack) => {
          const cached = readyByStyle.get(pack.style_id)
          if (cached !== undefined) return toWireJob(cached, cached.trackId)
          return {
            job_id: scopedMusicId('job', principal.userId, stored.id, pack.style_id),
            style_id: pack.style_id,
            status: 'failed',
            error_code: 'budget',
            track_id: null,
            duration_ms: null,
          }
        }),
      }
    }
    const generated = new Map<string, MusicRendersResponse['jobs'][number]>()
    if (missing.length > 0) {
      const outcomes = await composeStyles(this.adapter, stored.document, missing, 2)
      this.budget.record(principal.userId, missing.length)
      for (const [index, pack] of missing.entries()) {
        const outcome = outcomes[index]
        const jobId = scopedMusicId('job', principal.userId, stored.id, pack.style_id)
        const trackId = scopedMusicId('track', principal.userId, stored.id, pack.style_id)
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
            spendMicros: 1,
            createdAt: this.clock.now(),
          })
          await this.repository.saveJob(job)
          generated.set(pack.style_id, toWireJob(job, trackId))
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
            createdAt: this.clock.now(),
          })
          await this.repository.saveJob(job)
          generated.set(pack.style_id, toWireJob(job, null))
        }
      }
    }
    return {
      lyric_document_id: stored.id,
      jobs: packs.map((pack) => {
        const cached = readyByStyle.get(pack.style_id)
        if (cached !== undefined) return toWireJob(cached, cached.trackId)
        const created = generated.get(pack.style_id)
        if (created === undefined) throw new LoroError('INTERNAL')
        return created
      }),
    }
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

function scopedMusicId(
  kind: 'job' | 'track',
  userId: string,
  lyricId: string,
  styleId: string,
): string {
  return `${kind}_${createHash('sha256')
    .update(`${userId}\0${lyricId}\0${styleId}`)
    .digest('hex')
    .slice(0, 16)}`
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
