import { isActive, type PhraseState } from '../domain/phrase.js'
import type { TargetLocale } from '../domain/languages.js'
import {
  APPROVED_LISTENING_VOICES,
  LISTENING_CODEC,
  LISTENING_MIN_VOICES,
  LISTENING_MODEL_ID,
  LISTENING_REPEATS_DEFAULT,
  LISTENING_REPEATS_MAX,
  LISTENING_REPEATS_MIN,
  LISTENING_SHARE_ENABLED,
  isCatalogReferenceVoice,
  type ListeningVoice,
} from './constants.js'
import { isLearnerAuthoredListeningText } from './identity.js'

export type ListeningRepeats = typeof LISTENING_REPEATS_MIN | 3 | 4 | typeof LISTENING_REPEATS_MAX

export function clampListeningRepeats(value: number): ListeningRepeats {
  if (!Number.isInteger(value)) return LISTENING_REPEATS_DEFAULT
  if (value < LISTENING_REPEATS_MIN) return LISTENING_REPEATS_MIN
  if (value > LISTENING_REPEATS_MAX) return LISTENING_REPEATS_MAX
  return value as ListeningRepeats
}

export function listeningRepeatChoices(): readonly ListeningRepeats[] {
  const count = LISTENING_REPEATS_MAX - LISTENING_REPEATS_MIN + 1
  return Array.from({ length: count }, (_, index) =>
    clampListeningRepeats(LISTENING_REPEATS_MIN + index),
  )
}

export function selectLicensedListeningVoices(
  roster: readonly ListeningVoice[],
  locale: TargetLocale,
): readonly ListeningVoice[] {
  const seen = new Set<string>()
  const voices: ListeningVoice[] = []
  for (const voice of roster) {
    if (!voice.licensed || voice.locale !== locale || voice.id.length === 0) continue
    if (isCatalogReferenceVoice(voice.id)) continue
    if (seen.has(voice.id)) continue
    seen.add(voice.id)
    voices.push(voice)
  }
  return voices
}

export function approvedListeningVoices(locale: TargetLocale): readonly ListeningVoice[] {
  return selectLicensedListeningVoices(APPROVED_LISTENING_VOICES[locale], locale)
}

export function isApprovedListeningVoice(locale: TargetLocale, voiceId: string): boolean {
  return approvedListeningVoices(locale).some((voice) => voice.id === voiceId)
}

export function listeningAllowlistReady(locale: TargetLocale): boolean {
  return listeningModelIsPinned() && approvedListeningVoices(locale).length >= LISTENING_MIN_VOICES
}

/**
 * Consecutive takes of one phrase rotate distinct licensed voice IDs, then wrap.
 * Fewer than two voices is not a sequence — the product is unavailable.
 */
export function listeningVoiceSequence(
  voices: readonly Pick<ListeningVoice, 'id'>[],
  repeats: number,
): readonly string[] {
  const count = clampListeningRepeats(repeats)
  if (voices.length < LISTENING_MIN_VOICES) return []
  return Array.from({ length: count }, (_, index) => {
    const voice = voices[index % voices.length]
    if (voice === undefined) throw new Error('Listening voice roster is sparse')
    return voice.id
  })
}

export interface ListeningPhraseLine {
  readonly id: string
  readonly targetText: string
  readonly learnerAuthored: boolean
}

export function activeListeningPhrases(
  phrases: readonly PhraseState[],
  targetLocale: TargetLocale,
  targetTextOf: (phrase: PhraseState) => string,
): readonly ListeningPhraseLine[] {
  return phrases
    .filter((phrase) => (phrase.targetLocale ?? targetLocale) === targetLocale && isActive(phrase))
    .map((phrase) => ({
      id: phrase.id,
      targetText: targetTextOf(phrase),
      learnerAuthored: isLearnerAuthoredListeningText(phrase),
    }))
    .filter((line) => line.targetText.length > 0)
}

export interface ListeningTake {
  readonly phraseId: string
  readonly targetText: string
  readonly voiceId: string
  readonly learnerAuthored: boolean
}

export function planListeningBatch(
  lines: readonly ListeningPhraseLine[],
  voices: readonly Pick<ListeningVoice, 'id'>[],
  repeats: number,
): readonly ListeningTake[] {
  const sequence = listeningVoiceSequence(voices, repeats)
  if (sequence.length === 0) return []
  return lines.flatMap((line) =>
    sequence.map((voiceId) => ({
      phraseId: line.id,
      targetText: line.targetText,
      voiceId,
      learnerAuthored: line.learnerAuthored,
    })),
  )
}

export type ListeningBlocker =
  | 'empty'
  | 'voices-unapproved'
  | 'voices-single'
  | 'model-unpinned'
  | 'needs-network'
  | 'not-configured'
  | 'native-unavailable'
  | 'session-busy'
  | 'disk-full'
  | 'quota'
  | 'share-gated'

export interface ListeningAvailabilityInput {
  readonly phraseCount: number
  readonly voiceCount: number
  readonly modelPinned: boolean
  readonly network: boolean
  readonly configured: boolean
  readonly nativeCache: boolean
  /** Web may stream API download URLs; native still requires the file cache. */
  readonly remotePlayback?: boolean
  readonly sessionBusy: boolean
  readonly diskFull: boolean
  readonly quotaExceeded: boolean
}

export function listeningBlockers(input: ListeningAvailabilityInput): readonly ListeningBlocker[] {
  const blockers: ListeningBlocker[] = []
  if (input.phraseCount === 0) blockers.push('empty')
  if (input.voiceCount === 0) blockers.push('voices-unapproved')
  else if (input.voiceCount < LISTENING_MIN_VOICES) blockers.push('voices-single')
  if (!input.modelPinned) blockers.push('model-unpinned')
  if (!input.configured) blockers.push('not-configured')
  if (!input.nativeCache && input.remotePlayback !== true) blockers.push('native-unavailable')
  if (!input.network) blockers.push('needs-network')
  if (input.sessionBusy) blockers.push('session-busy')
  if (input.diskFull) blockers.push('disk-full')
  if (input.quotaExceeded) blockers.push('quota')
  return blockers
}

/** First render needs network, approved voices, native cache, and a configured route. */
export function canGenerateListening(input: ListeningAvailabilityInput): boolean {
  return listeningBlockers(input).length === 0
}

/** A complete batch plays from native file URIs or web download URLs. */
export function canListenFromCache(input: {
  cacheComplete: boolean
  nativeCache: boolean
  sessionBusy: boolean
  remotePlayback?: boolean
}): boolean {
  const stored = input.nativeCache || input.remotePlayback === true
  return input.cacheComplete && stored && !input.sessionBusy
}

export function canShareListening(): boolean {
  return LISTENING_SHARE_ENABLED
}

export function listeningModelIsPinned(): boolean {
  return LISTENING_MODEL_ID !== null && LISTENING_MODEL_ID.length > 0
}

/** True only when the pinned listening model id matches this request. */
export function isPinnedListeningModel(modelId: string): boolean {
  return listeningModelIsPinned() && LISTENING_MODEL_ID === modelId
}

export function listeningCodec(): typeof LISTENING_CODEC {
  return LISTENING_CODEC
}
