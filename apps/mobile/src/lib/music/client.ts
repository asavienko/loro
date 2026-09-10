/**
 * Device-side stub coordinator. CI and the browser E2E journey never call vendors.
 */
import {
  bundledLyricDocument,
  MUSIC_STYLE_IDS,
  type LyricDocument,
  type MusicStyleId,
  type NativeLanguage,
  type TargetLocale,
} from '@loro/core'
import { loadLearningCatalog, phraseMeaning, resolveMusicStylePacks } from '@loro/content'
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
  readonly durationMs: number | null
  readonly generated: true
}

export interface MusicLyricsView {
  readonly document: LyricDocument
  readonly fallback: boolean
  readonly cached: boolean
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
