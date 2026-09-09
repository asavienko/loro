import type { TargetLocale } from '../domain/languages.js'

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

/** Q-15: no licensed listening voice IDs are pinned yet. */
export const LISTENING_MODEL_ID: string | null = null

export interface ListeningVoice {
  readonly id: string
  readonly locale: TargetLocale
  readonly name: string
  readonly licensed: boolean
}

/** Production roster stays empty until Q-15 pins ≥2 licensed IDs per target. */
export const APPROVED_LISTENING_VOICES: Record<TargetLocale, readonly ListeningVoice[]> = {
  'es-ES': [],
  'bg-BG': [],
  'ru-RU': [],
}
