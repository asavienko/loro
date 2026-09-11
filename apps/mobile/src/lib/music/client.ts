/**
 * Device-side stub coordinator plus the Loro music API client.
 * CI and the browser E2E journey never call vendors.
 */
import {
  bundledLyricDocument,
  MUSIC_STYLE_IDS,
  type LyricDocument,
  type MusicStyleId,
  type NativeLanguage,
  type TargetLocale,
} from '@loro/core'
import {
  MusicLyricsRequestSchema,
  MusicLyricsResponseSchema,
  MusicRendersRequestSchema,
  MusicRendersResponseSchema,
  MusicStatusSchema,
  MusicTrackResponseSchema,
  type MusicRenderJob,
} from '@loro/core/api/draft'
import { loadLearningCatalog, phraseMeaning, resolveMusicStylePacks } from '@loro/content'
import { bundledApiUrl } from '../account/config'
import { requestWithTimeout } from '../backend'
import { playableDownloadUrl } from '../practiceTts'
import { FIXTURE_WAV_DURATION_MS, silentWavBytes, wavDataUri } from './wav'

export type MusicUiState =
  | 'empty'
  | 'selected'
  | 'lyrics'
  | 'fallback'
  | 'generating'
  | 'partial'
  | 'playing'
  | 'unavailable'
  | 'error'

export interface MusicTrackView {
  readonly styleId: MusicStyleId
  readonly status: 'ready' | 'failed'
  readonly errorCode: 'copyright' | 'unavailable' | 'invalid_audio' | null
  readonly uri: string | null
  readonly sha256?: string
  readonly durationMs: number | null
  readonly generated: true
}

export interface MusicLyricsView {
  readonly document: LyricDocument
  readonly fallback: boolean
  readonly cached: boolean
  readonly lyricDocumentId?: string
}

export interface MusicRuntimeStatus {
  readonly ready: boolean
  readonly provider: string
}

export interface MusicCredentials {
  readonly token: string
  readonly deviceId: string
}

export type MusicClientErrorCode = 'unavailable' | 'quota'

export class MusicClientError extends Error {
  constructor(readonly code: MusicClientErrorCode) {
    super(code)
    this.name = 'MusicClientError'
  }
}

const audioBytes = silentWavBytes()
const audioUri = wavDataUri(audioBytes)

export function requestLocalLyrics(
  catalogPhraseIds: readonly string[],
  targetLocale: TargetLocale,
  meaningLanguage: NativeLanguage,
  options: { readonly fallback?: boolean } = {},
): MusicLyricsView {
  const catalog = loadLearningCatalog(targetLocale, meaningLanguage)
  const phrases = catalogPhraseIds.map((id) => {
    const phrase = catalog.phrases.find((entry) => entry.id === id)
    if (phrase === undefined) throw new Error(`Unknown catalog phrase: ${id}`)
    return {
      id: phrase.id,
      targetText: phrase.targetText,
      translation: phraseMeaning(phrase, meaningLanguage),
    }
  })
  return {
    document: bundledLyricDocument(phrases, targetLocale, meaningLanguage, catalog.catalogVersion),
    fallback: options.fallback ?? true,
    cached: false,
  }
}

export function renderLocalStyles(
  styleIds: readonly MusicStyleId[],
  mode: 'ok' | 'partial' | 'error' | 'unavailable',
): MusicTrackView[] {
  resolveMusicStylePacks(styleIds)
  return styleIds.map((styleId, index) => {
    if (mode === 'unavailable') {
      return {
        styleId,
        status: 'failed',
        errorCode: 'unavailable',
        uri: null,
        durationMs: null,
        generated: true,
      }
    }
    if (mode === 'error') {
      return {
        styleId,
        status: 'failed',
        errorCode: 'copyright',
        uri: null,
        durationMs: null,
        generated: true,
      }
    }
    if (mode === 'partial' && index === styleIds.length - 1) {
      return {
        styleId,
        status: 'failed',
        errorCode: 'invalid_audio',
        uri: null,
        durationMs: null,
        generated: true,
      }
    }
    return {
      styleId,
      status: 'ready',
      errorCode: null,
      uri: audioUri,
      durationMs: FIXTURE_WAV_DURATION_MS,
      generated: true,
    }
  })
}

export function defaultStyleIds(): MusicStyleId[] {
  return [MUSIC_STYLE_IDS[0], MUSIC_STYLE_IDS[1], MUSIC_STYLE_IDS[2]]
}

/** Fixtures may still play; a real offline learner gets the honest unavailable state. */
export function musicGenerationBlocked(
  online: boolean,
  fixture: MusicUiState | undefined,
): boolean {
  if (fixture === 'unavailable') return true
  if (fixture !== undefined) return false
  return !online
}

function musicHeaders(credentials: MusicCredentials | null): HeadersInit {
  return {
    'content-type': 'application/json',
    ...(credentials === null
      ? {}
      : {
          Authorization: `Bearer ${credentials.token}`,
          'X-Loro-Device': credentials.deviceId,
        }),
  }
}

export async function fetchMusicStatus(
  baseUrl: string | null = bundledApiUrl(),
  send: typeof fetch = fetch,
): Promise<MusicRuntimeStatus> {
  if (!baseUrl) return { ready: false, provider: 'unconfigured' }
  try {
    const response = await requestWithTimeout(
      `${baseUrl}/music/status`,
      { credentials: 'omit', cache: 'no-store', redirect: 'error' },
      send,
      8_000,
    )
    if (!response.ok) return { ready: false, provider: 'unavailable' }
    const parsed = MusicStatusSchema.safeParse(await response.json())
    if (!parsed.success) return { ready: false, provider: 'unavailable' }
    return parsed.data
  } catch {
    return { ready: false, provider: 'unavailable' }
  }
}

export async function requestMusicLyrics(
  input: {
    catalogPhraseIds: readonly string[]
    targetLocale: TargetLocale
    meaningLanguage: NativeLanguage
  },
  baseUrl: string | null = bundledApiUrl(),
  credentials: MusicCredentials | null = null,
  send: typeof fetch = fetch,
): Promise<MusicLyricsView> {
  if (!baseUrl) throw new MusicClientError('unavailable')
  const body = MusicLyricsRequestSchema.parse({
    target_locale: input.targetLocale,
    meaning_language: input.meaningLanguage,
    catalog_phrase_ids: [...input.catalogPhraseIds],
  })
  const response = await requestWithTimeout(
    `${baseUrl}/music/lyrics`,
    {
      method: 'POST',
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
      headers: musicHeaders(credentials),
      body: JSON.stringify(body),
    },
    send,
  )
  if (!response.ok) throw musicHttpError(response)
  const parsed = MusicLyricsResponseSchema.safeParse(await response.json())
  if (!parsed.success) throw new MusicClientError('unavailable')
  return {
    document: parsed.data.document,
    fallback: parsed.data.fallback,
    cached: parsed.data.cached,
    lyricDocumentId: parsed.data.lyric_document_id,
  }
}

export async function requestMusicRenders(
  input: {
    lyricDocumentId: string
    styleIds: readonly MusicStyleId[]
  },
  baseUrl: string | null = bundledApiUrl(),
  credentials: MusicCredentials | null = null,
  send: typeof fetch = fetch,
): Promise<MusicTrackView[]> {
  if (!baseUrl) throw new MusicClientError('unavailable')
  const body = MusicRendersRequestSchema.parse({
    lyric_document_id: input.lyricDocumentId,
    style_ids: [...input.styleIds],
  })
  const response = await requestWithTimeout(
    `${baseUrl}/music/renders`,
    {
      method: 'POST',
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
      headers: musicHeaders(credentials),
      body: JSON.stringify(body),
    },
    send,
  )
  if (!response.ok) throw musicHttpError(response)
  const parsed = MusicRendersResponseSchema.safeParse(await response.json())
  if (!parsed.success) throw new MusicClientError('unavailable')
  return Promise.all(
    parsed.data.jobs.map(async (job) => {
      const track = trackFromJob(job, baseUrl)
      if (track.uri === null || job.track_id === null) return track
      try {
        const meta = await requestWithTimeout(
          `${baseUrl}/music/tracks/${job.track_id}`,
          {
            credentials: 'omit',
            cache: 'no-store',
            redirect: 'error',
            headers: musicHeaders(credentials),
          },
          send,
        )
        if (!meta.ok) return track
        const body = MusicTrackResponseSchema.safeParse(await meta.json())
        if (!body.success) return track
        return {
          ...track,
          sha256: body.data.sha256,
          durationMs: body.data.duration_ms ?? track.durationMs,
        }
      } catch {
        return track
      }
    }),
  )
}

export async function requestMusicTrackMeta(
  trackId: string,
  baseUrl: string | null = bundledApiUrl(),
  credentials: MusicCredentials | null = null,
  send: typeof fetch = fetch,
): Promise<{ sha256: string; durationMs: number | null } | null> {
  if (!baseUrl) return null
  try {
    const meta = await requestWithTimeout(
      `${baseUrl}/music/tracks/${trackId}`,
      {
        credentials: 'omit',
        cache: 'no-store',
        redirect: 'error',
        headers: musicHeaders(credentials),
      },
      send,
    )
    if (!meta.ok) return null
    const parsed = MusicTrackResponseSchema.safeParse(await meta.json())
    if (!parsed.success) return null
    return { sha256: parsed.data.sha256, durationMs: parsed.data.duration_ms }
  } catch {
    return null
  }
}

export function musicTrackIdFromContentUrl(uri: string): string | null {
  try {
    const path = new URL(uri, 'https://loro.test').pathname
    const match = /\/music\/tracks\/([A-Za-z0-9_-]+)\/content$/.exec(path)
    return match?.[1] ?? null
  } catch {
    return null
  }
}

function musicHttpError(response: Response): MusicClientError {
  return new MusicClientError(
    response.status === 429 || response.status === 402 ? 'quota' : 'unavailable',
  )
}

function trackFromJob(job: MusicRenderJob, baseUrl: string): MusicTrackView {
  const failed = job.status !== 'ready' || job.track_id === null
  const error =
    job.error_code === 'copyright' ||
    job.error_code === 'unavailable' ||
    job.error_code === 'invalid_audio'
      ? job.error_code
      : failed
        ? 'unavailable'
        : null
  return {
    styleId: job.style_id,
    status: failed ? 'failed' : 'ready',
    errorCode: error,
    uri: failed || job.track_id === null ? null : musicTrackContentUrl(baseUrl, job.track_id),
    durationMs: job.duration_ms,
    generated: true,
  }
}

export function musicTrackContentUrl(baseUrl: string, trackId: string): string {
  return playableDownloadUrl(`${baseUrl}/music/tracks/${trackId}/content`, baseUrl)
}

export function isMusicUiState(value: string | undefined): value is MusicUiState {
  return (
    value === 'empty' ||
    value === 'selected' ||
    value === 'lyrics' ||
    value === 'fallback' ||
    value === 'generating' ||
    value === 'partial' ||
    value === 'playing' ||
    value === 'unavailable' ||
    value === 'error'
  )
}
