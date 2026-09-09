import type { TargetLocale } from '../domain/languages.js'
import type { PhraseSource } from '../domain/phrase.js'
import {
  LISTENING_ASSET_CLASS,
  LISTENING_CODEC,
  REFERENCE_ASSET_CLASS,
  type AudioAssetClass,
} from './constants.js'

export interface ListeningClipIdentity {
  readonly assetClass: AudioAssetClass
  readonly locale: TargetLocale
  readonly phraseId: string
  readonly textDigest: string
  readonly voiceId: string
  readonly modelId: string
  readonly codec: typeof LISTENING_CODEC
}

const IDENTITY_SEPARATOR = '\u001f'

/** NFC trim and collapse whitespace so an edit is a cache miss, not a near-hit. */
export function normalizeListeningText(text: string): string {
  return text.normalize('NFC').trim().replace(/\s+/g, ' ')
}

export function isListeningTextDigest(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value)
}

/**
 * Logical cache key. Address files by content sha256; this key is the index, not the filename.
 * Listening and reference never share a key even when voice, text and locale match.
 */
export function listeningClipKey(identity: ListeningClipIdentity): string {
  if (identity.codec !== LISTENING_CODEC) {
    throw new Error('Listening clips use the catalog AAC codec only')
  }
  if (!isListeningTextDigest(identity.textDigest)) {
    throw new Error('Listening text digest must be sha256 hex')
  }
  if (identity.assetClass !== LISTENING_ASSET_CLASS && identity.assetClass !== REFERENCE_ASSET_CLASS)
    throw new Error('Unknown audio asset class')
  return [
    identity.assetClass,
    identity.locale,
    identity.phraseId,
    identity.textDigest,
    identity.voiceId,
    identity.modelId,
    identity.codec,
  ].join(IDENTITY_SEPARATOR)
}

export function contentAddressUri(sha256: string): `sha256/${string}` {
  if (!isListeningTextDigest(sha256)) throw new Error('Content address must be sha256 hex')
  return `sha256/${sha256}`
}

export function contentAddressFilename(sha256: string): `sha256/${string}.m4a` {
  return `${contentAddressUri(sha256)}.m4a`
}

export function listeningShareFilename(targetLocale: TargetLocale, localDay: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDay)) throw new Error('Share filename needs clock.localDay()')
  return `loro-${targetLocale}-${localDay}-listen.m4a`
}

const LEARNER_AUTHORED_SOURCES: ReadonlySet<PhraseSource> = new Set([
  'custom',
  'import',
  'capture',
])

/** Catalog text is a Q-15 event; learner-authored text needs an extra confirmation. */
export function isLearnerAuthoredListeningText(phrase: {
  phraseId: string | null
  source: PhraseSource
}): boolean {
  return phrase.phraseId === null || LEARNER_AUTHORED_SOURCES.has(phrase.source)
}
