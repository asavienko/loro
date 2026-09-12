import { isActive, userPhraseId, type PhraseState } from '@loro/core'

/**
 * Stream is the daily wave: membership is today's frozen set, listed in full.
 * Ranking may reorder inside that set. An empty or fully-learned set falls back to
 * every remaining active phrase so the stream is never a blank wall beside live rows.
 */
export function streamWaveQueue<T extends PhraseState>(
  phrases: readonly T[],
  refrainSet: readonly string[],
  rank: (phrase: T) => number,
): T[] {
  const byId = new Map(phrases.map((phrase) => [phrase.id, phrase]))
  const wave = refrainSet.flatMap((id) => {
    const phrase = byId.get(userPhraseId(id))
    return phrase !== undefined && isActive(phrase) ? [phrase] : []
  })
  const source = wave.length > 0 ? wave : phrases.filter(isActive)
  return source.slice().sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id))
}

export type RefrainFocus =
  | { readonly kind: 'phrase'; readonly phraseId: string }
  | { readonly kind: 'hard' }
  | { readonly kind: 'wave' }

export function parseRefrainFocus(params: {
  readonly phrase?: string | string[]
  readonly filter?: string | string[]
  readonly wave?: string | string[]
}): RefrainFocus {
  const phrase = firstParam(params.phrase)
  if (phrase !== undefined) return { kind: 'phrase', phraseId: phrase }
  if (firstParam(params.filter) === 'hard') return { kind: 'hard' }
  if (firstParam(params.wave) !== undefined) return { kind: 'wave' }
  return { kind: 'hard' }
}

/** Phrase ids the Refrain may plan. Targeted entries skip the day's timed wave lock. */
export function refrainFocusIds(
  focus: RefrainFocus,
  phrases: readonly PhraseState[],
  refrainSet: readonly string[],
): readonly string[] {
  if (focus.kind === 'phrase') {
    const phrase = phrases.find((row) => row.id === focus.phraseId)
    // A phrase that graduates on this last lock-in must keep the card. Missing ids stay empty.
    return phrase !== undefined ? [phrase.id] : []
  }
  if (focus.kind === 'hard') {
    return phrases
      .filter((phrase) => isActive(phrase) && phrase.difficulty === 'hard')
      .map((p) => p.id)
  }
  return refrainSet.filter((id) => {
    const phrase = phrases.find((row) => row.id === id)
    return phrase !== undefined && isActive(phrase)
  })
}

export function refrainSkipsWaveLock(focus: RefrainFocus): boolean {
  return focus.kind !== 'wave'
}

/** Keep a live plan when its members are exactly the requested focus, even if remaining work shrank. */
export function refrainSessionMatchesFocus(
  sessionPhraseIds: readonly string[],
  requestedIds: readonly string[] | undefined,
): boolean {
  if (requestedIds === undefined) return false
  const wanted = new Set(requestedIds)
  const ids = [...new Set(sessionPhraseIds)]
  return ids.length === wanted.size && ids.every((id) => wanted.has(id))
}

/** Menu and switcher open Refrain as a hard-phrase drill, not a timed wave. */
export function destinationTarget(
  href: string,
): string | { pathname: string; params: { filter: 'hard' } } {
  if (href === '/practice/refrain') {
    return { pathname: '/practice/refrain', params: { filter: 'hard' } }
  }
  return href
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined
  return Array.isArray(value) ? value[0] : value
}
