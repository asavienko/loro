import { TARGET_LOCALES, type TargetLocale } from '../domain/languages.js'

/**
 * Current documented listening-quality model. SPA / BUL / RUS are among the 29 languages.
 * @see https://elevenlabs.io/docs/overview/models
 */
export const ELEVENLABS_MULTILINGUAL_V2 = 'eleven_multilingual_v2'

/** AS-07. Independent of Stream `REPEAT_TARGET` until product unifies them. */
export const LISTENING_REPEATS_MIN = 2
export const LISTENING_REPEATS_MAX = 5
export const LISTENING_REPEATS_DEFAULT = 3

/** Intra-phrase gap between takes of the same line. */
export const LISTENING_INTRA_GAP_MS = 400
/** Gap before the next phrase. */
export const LISTENING_INTER_GAP_MS = 1200

/** Named listening-class LRU budget. Not the 150 MB practice figure. */
export const LISTENING_BUDGET_BYTES = 64 * 1024 * 1024

export const LISTENING_CODEC = 'aac-64k-mono-24k' as const
export const LISTENING_MIN_VOICES = 2
export const LISTENING_ASSET_CLASS = 'listening' as const
export const REFERENCE_ASSET_CLASS = 'reference' as const

export type AudioAssetClass = typeof LISTENING_ASSET_CLASS | typeof REFERENCE_ASSET_CLASS

/**
 * Q-22 remains open: neural listening audio must not leave the app as a learner-owned file.
 * Native mux/share exists behind this flag and must stay false until the question is answered.
 */
export const LISTENING_SHARE_ENABLED = false

export interface ListeningVoice {
  readonly id: string
  readonly locale: TargetLocale
  readonly name: string
  readonly licensed: boolean
}

export interface CatalogReferenceVoice {
  readonly id: string
  readonly locale: TargetLocale
  readonly name: string
}

/**
 * AS-01 catalog/reference pin. One voice per target, forever. Distinct from listening IDs.
 * Runtime catalog render still reads `TTS_VOICE_*`; these IDs are the documented production pin.
 * @see docs/decisions/listening-voice-packet.md
 */
export const CATALOG_TTS_MODEL_ID = ELEVENLABS_MULTILINGUAL_V2
export const CATALOG_REFERENCE_VOICES: Record<TargetLocale, CatalogReferenceVoice> = {
  'es-ES': { id: 't9LRTh3y1ioN00e9wsNh', locale: 'es-ES', name: 'Aaron Abad' },
  'bg-BG': { id: '406EiNlYvqFqcz3vsnOm', locale: 'bg-BG', name: 'Peter K' },
  'ru-RU': { id: '1qd9R09Ljlx9V1Ok0t5S', locale: 'ru-RU', name: 'Ivan' },
}

export function isCatalogReferenceVoice(voiceId: string): boolean {
  return TARGET_LOCALES.some((locale) => CATALOG_REFERENCE_VOICES[locale].id === voiceId)
}

/**
 * Q-15 listening pin. Filling this object is the only runtime switch for licensed listening
 * generate: `modelId` plus ≥2 `licensed: true` voices per enabled target. IDs must stay distinct
 * from `CATALOG_REFERENCE_VOICES`. `licensed: true` is in-app cache/playback only; Q-22 share
 * stays off. Pronunciation review remains before calling these production-quality.
 * @see docs/decisions/listening-voice-packet.md
 */
export interface ListeningVoiceDecision {
  readonly modelId: string | null
  readonly voices: Record<TargetLocale, readonly ListeningVoice[]>
}

export const LISTENING_VOICE_DECISION: ListeningVoiceDecision = {
  modelId: ELEVENLABS_MULTILINGUAL_V2,
  voices: {
    'es-ES': [
      { id: 'KHCvMklQZZo0O30ERnVn', locale: 'es-ES', name: 'Sara Martin 1', licensed: true },
      { id: 'usTmJvQOCyW3nRcZ8OEo', locale: 'es-ES', name: 'Dante', licensed: true },
    ],
    'bg-BG': [
      { id: 'M1ydWt7KnBCiuv4CnEDC', locale: 'bg-BG', name: 'Milena', licensed: true },
      { id: 'gdk0ZsvfAOobfbTtnx6p', locale: 'bg-BG', name: 'Kosta', licensed: true },
    ],
    'ru-RU': [
      { id: 'EDpEYNf6XIeKYRzYcx4I', locale: 'ru-RU', name: 'MARIIA_R', licensed: true },
      { id: 'ogi2DyUAKJb7CEdqqvlU', locale: 'ru-RU', name: 'Stanislav', licensed: true },
    ],
  },
}

export const LISTENING_MODEL_ID: string | null = LISTENING_VOICE_DECISION.modelId
export const APPROVED_LISTENING_VOICES: Record<TargetLocale, readonly ListeningVoice[]> =
  LISTENING_VOICE_DECISION.voices
