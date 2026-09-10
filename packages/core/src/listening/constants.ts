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

export interface ListeningVoice {
  readonly id: string
  readonly locale: TargetLocale
  readonly name: string
  readonly licensed: boolean
}

/**
 * Q-15 listening pin. Filling this object is the only runtime switch for licensed listening
 * generate: set `modelId` and ≥2 `licensed: true` voices per enabled target. Keep empty until the
 * decision packet is signed. Do not copy unapproved candidates here.
 * @see docs/decisions/listening-voice-packet.md
 */
export interface ListeningVoiceDecision {
  readonly modelId: string | null
  readonly voices: Record<TargetLocale, readonly ListeningVoice[]>
}

export const LISTENING_VOICE_DECISION: ListeningVoiceDecision = {
  modelId: null,
  voices: {
    'es-ES': [],
    'bg-BG': [],
    'ru-RU': [],
  },
}

export const LISTENING_MODEL_ID: string | null = LISTENING_VOICE_DECISION.modelId
export const APPROVED_LISTENING_VOICES: Record<TargetLocale, readonly ListeningVoice[]> =
  LISTENING_VOICE_DECISION.voices
