import { isActive, userPhraseId, type PhraseState } from '@loro/core'
import type { Href } from 'expo-router'

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

/** True when the session's unique phrase ids are exactly today's frozen set. */
export function sessionCoversDaySet(
  sessionPhraseIds: readonly string[],
  refrainSet: readonly string[],
): boolean {
  const ids = [...new Set(sessionPhraseIds)]
  return ids.length === refrainSet.length && ids.every((id) => refrainSet.includes(id))
}

/**
 * Recover a paused drill's focus from its members. A stored 1-phrase plan is a phrase drill.
 * A Difficult-only plan that is not the whole frozen set is the menu drill. A plan that
 * covers the day set is a timed wave, even when every member happens to be Difficult.
 */
export function inferRefrainFocus(
  sessionPhraseIds: readonly string[],
  phrases: readonly PhraseState[],
  refrainSet: readonly string[],
): RefrainFocus {
  const ids = [...new Set(sessionPhraseIds)]
  // A one-phrase plan that is the whole frozen set is still today's wave.
  if (sessionCoversDaySet(ids, refrainSet)) return { kind: 'wave' }
  if (ids.length === 1 && ids[0] !== undefined) {
    return { kind: 'phrase', phraseId: ids[0] }
  }
  const hardIds = refrainFocusIds({ kind: 'hard' }, phrases, refrainSet)
  if (ids.length > 0 && refrainSessionMatchesFocus(ids, hardIds)) {
    return { kind: 'hard' }
  }
  return { kind: 'wave' }
}

/** Today, the spine, and the resume row open Refrain with the focus the checkpoint still is. */
export function refrainResumeTarget(
  focus: RefrainFocus,
  wave: string,
): {
  readonly pathname: '/practice/refrain'
  readonly params:
    { readonly phrase: string } | { readonly filter: 'hard' } | { readonly wave: string }
} {
  if (focus.kind === 'phrase') {
    return { pathname: '/practice/refrain', params: { phrase: focus.phraseId } }
  }
  if (focus.kind === 'hard') {
    return { pathname: '/practice/refrain', params: { filter: 'hard' } }
  }
  return { pathname: '/practice/refrain', params: { wave } }
}

/**
 * Members of today's frozen set, including learned rows, so "This wave" pills count the wave.
 * An empty or missing set falls back to every phrase, matching the live-empty stream queue.
 */
export function streamWaveMembers<T extends PhraseState>(
  phrases: readonly T[],
  refrainSet: readonly string[],
): T[] {
  const byId = new Map(phrases.map((phrase) => [phrase.id, phrase]))
  const members = refrainSet.flatMap((id) => {
    const phrase = byId.get(userPhraseId(id))
    return phrase !== undefined ? [phrase] : []
  })
  return members.length > 0 ? members : [...phrases]
}

/** Menu and switcher open Refrain as a hard-phrase drill, not a timed wave. */
export function destinationTarget(href: string): Href {
  if (href === '/practice/refrain') {
    return { pathname: '/practice/refrain', params: { filter: 'hard' } }
  }
  return href as Href
}

export interface DestinationSearchParams {
  readonly phrase?: string | string[]
  readonly filter?: string | string[]
  readonly wave?: string | string[]
}

/**
 * Phrase and timed-wave Refrain are not the menu destination. Only the difficult-only
 * drill counts as “here”, so the switcher can still open `?filter=hard`.
 */
export function destinationIsCurrent(
  href: string,
  pathname: string,
  params: DestinationSearchParams = {},
): boolean {
  if (pathname !== href) return false
  if (href === '/practice/refrain') return parseRefrainFocus(params).kind === 'hard'
  return true
}

/**
 * `dismissTo` matches pathname and would return a live phrase-focus Refrain.
 * Replace applies `?filter=hard` even when that screen is already on the stack.
 */
export function destinationNavigation(href: string): {
  readonly action: 'replace' | 'dismissTo'
  readonly target: Href
} {
  const target = destinationTarget(href)
  if (href === '/practice/refrain') return { action: 'replace', target }
  return { action: 'dismissTo', target }
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined
  return Array.isArray(value) ? value[0] : value
}
