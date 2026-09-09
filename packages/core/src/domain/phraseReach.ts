/**
 * Phrase reach — canonical identity, Discover matching and the add-handoff shared by
 * Discover suggestions, Import assistance and chat keep-line (plan 97 / AI-06).
 *
 * Candidates are learner-owned drafts. They never receive a catalog id.
 */

import { foldSearchText } from './text.js'
import { MAX_OWN_PHRASE_TEXT_CODE_UNITS, type PhraseSource, type Theme } from './phrase.js'
import type { NativeLanguage, TargetLocale } from './languages.js'

export const PHRASE_SUGGEST_MAX_QUERY = 200
export const PHRASE_SUGGEST_MAX_CANDIDATES = 6
export const PHRASE_SUGGEST_MAX_WORDS = 12
export const PHRASE_SUGGEST_THIN_CATALOG = 3
export const OWN_PHRASE_QUERY_MIN = 2

export type PhraseCandidateProvenance = 'live' | 'bundled' | 'cache'
export type PhraseHandoffSource = Extract<PhraseSource, 'custom' | 'generated' | 'chat' | 'import'>

export interface PhraseCandidate {
  readonly targetText: string
  readonly translation: string
  readonly theme?: Theme
  readonly emoji?: string
  readonly provenance: PhraseCandidateProvenance
  readonly source: PhraseHandoffSource
  readonly needsReview: true
}

export interface PhraseHandoffDraft {
  readonly targetText: string
  readonly translation: string
  readonly theme?: Theme
  readonly emoji?: string
}

export interface PhraseHandoff {
  readonly draft: PhraseHandoffDraft
  readonly source: PhraseHandoffSource
}

export interface ScenarioHint {
  readonly id: string
  readonly label: string
  readonly emoji: string
}

const INJECTION = /ignore\s+(previous|all)\s+instructions|you are now\b|system\s*:|<\s*script/i

/** Folded identity for duplicate detection. Catalog and owned lines share this key. */
export function canonicalPhraseText(value: string): string {
  return foldSearchText(value).replace(/\s+/g, ' ').trim()
}

export function phraseWordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length
}

export function containsPromptInjection(value: string): boolean {
  return INJECTION.test(value)
}

export function isExactLibraryMatch(
  query: string,
  phrases: readonly { readonly targetText: string; readonly translation: string }[],
): boolean {
  const needle = canonicalPhraseText(query)
  if (needle.length === 0) return false
  return phrases.some(
    (phrase) =>
      canonicalPhraseText(phrase.targetText) === needle ||
      canonicalPhraseText(phrase.translation) === needle,
  )
}

export function shouldOfferOwnPhrase(query: string, exactLibraryMatch: boolean): boolean {
  return query.trim().length >= OWN_PHRASE_QUERY_MIN && !exactLibraryMatch
}

export function shouldRequestSuggestions(
  query: string,
  catalogHitCount: number,
  exactLibraryMatch: boolean,
): boolean {
  return (
    shouldOfferOwnPhrase(query, exactLibraryMatch) && catalogHitCount < PHRASE_SUGGEST_THIN_CATALOG
  )
}

/**
 * Authored aliases so a typed situation can reach a scenario without an LLM.
 * Matching is folded; the query must contain a whole alias token or the scenario label.
 */
const SCENARIO_ALIASES: Readonly<Record<string, readonly string[]>> = {
  dinner: ['dinner', 'restaurant', 'reserva', 'restaurante', 'вечеря', 'ужин', 'ресторант'],
  train: ['train', 'station', 'tren', 'estacion', 'estación', 'влак', 'поезд', 'гара'],
  checkin: ['hotel', 'check-in', 'checkin', 'хотел', 'отель'],
  market: ['shop', 'market', 'store', 'магазин', 'пазар', 'рынок'],
  lost: ['lost', 'directions', 'загуб', 'потерял'],
}

export function matchNearestScenario(
  query: string,
  scenarios: readonly ScenarioHint[],
): ScenarioHint | null {
  const folded = canonicalPhraseText(query)
  if (folded.length < OWN_PHRASE_QUERY_MIN) return null
  for (const scenario of scenarios) {
    const label = canonicalPhraseText(scenario.label)
    if (label.length > 0 && (folded.includes(label) || label.includes(folded))) return scenario
    const aliases = SCENARIO_ALIASES[scenario.id] ?? []
    if (aliases.some((alias) => folded.includes(canonicalPhraseText(alias)))) return scenario
  }
  return null
}

export function filterNewCandidates(
  candidates: readonly PhraseCandidate[],
  existingTexts: readonly string[],
): PhraseCandidate[] {
  const owned = new Set(existingTexts.map(canonicalPhraseText).filter((text) => text.length > 0))
  const seen = new Set<string>()
  const next: PhraseCandidate[] = []
  for (const candidate of candidates) {
    if (next.length >= PHRASE_SUGGEST_MAX_CANDIDATES) break
    const key = canonicalPhraseText(candidate.targetText)
    if (key.length === 0 || owned.has(key) || seen.has(key)) continue
    seen.add(key)
    next.push(candidate)
  }
  return next
}

export function phraseHandoff(candidate: PhraseCandidate): PhraseHandoff {
  return {
    draft: {
      targetText: candidate.targetText.trim(),
      translation: candidate.translation.trim(),
      ...(candidate.theme === undefined ? {} : { theme: candidate.theme }),
      ...(candidate.emoji === undefined ? {} : { emoji: candidate.emoji }),
    },
    source: candidate.source,
  }
}

export function typedOwnPhraseHandoff(query: string): PhraseHandoff {
  return {
    draft: { targetText: query.trim(), translation: '' },
    source: 'custom',
  }
}

export function chatKeepLineHandoff(input: {
  readonly targetText: string
  readonly translation: string
  readonly theme?: Theme
  readonly emoji?: string
}): PhraseHandoff {
  return phraseHandoff({
    targetText: input.targetText,
    translation: input.translation,
    ...(input.theme === undefined ? {} : { theme: input.theme }),
    ...(input.emoji === undefined ? {} : { emoji: input.emoji }),
    provenance: 'bundled',
    source: 'chat',
    needsReview: true,
  })
}

export function candidateIsAddable(candidate: {
  readonly targetText: string
  readonly translation: string
}): boolean {
  const target = candidate.targetText.trim()
  const meaning = candidate.translation.trim()
  return (
    target.length > 0 &&
    meaning.length > 0 &&
    target.length <= MAX_OWN_PHRASE_TEXT_CODE_UNITS &&
    meaning.length <= MAX_OWN_PHRASE_TEXT_CODE_UNITS &&
    phraseWordCount(target) <= PHRASE_SUGGEST_MAX_WORDS
  )
}

export function suggestCacheKey(input: {
  readonly query: string
  readonly nativeLanguage: NativeLanguage
  readonly targetLocale: TargetLocale
  readonly catalogVersion: number
}): string {
  return `${input.nativeLanguage}:${input.targetLocale}:${input.catalogVersion}:${canonicalPhraseText(input.query)}`
}
