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
  return foldSearchText(value)
    .replace(/\s+/g, ' ')
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
    .trim()
}

/** Whole tokens after folding, so "chair" does not match "hair" and "in" does not match dinner. */
export function foldedPhraseTokens(value: string): string[] {
  return canonicalPhraseText(value)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 0)
}

/**
 * True when every keyword token appears as a query token, or as a prefix of one when the
 * keyword is a stem of four or more letters (`peluquer`, `лекарств`, `загуб`).
 */
export function queryHasKeyword(query: string, keyword: string): boolean {
  const needles = foldedPhraseTokens(keyword)
  if (needles.length === 0) return false
  const haystack = foldedPhraseTokens(query)
  return needles.every((needle) =>
    haystack.some((token) => token === needle || (needle.length >= 4 && token.startsWith(needle))),
  )
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

function queryMatchesScenarioLabel(query: string, label: string): boolean {
  if (queryHasKeyword(query, label)) return true
  const haystack = foldedPhraseTokens(query)
  return foldedPhraseTokens(label).some(
    (needle) =>
      needle.length >= 4 && haystack.some((token) => token === needle || token.startsWith(needle)),
  )
}

export function matchNearestScenario(
  query: string,
  scenarios: readonly ScenarioHint[],
): ScenarioHint | null {
  if (foldedPhraseTokens(query).join('').length < OWN_PHRASE_QUERY_MIN) return null
  for (const scenario of scenarios) {
    if (queryMatchesScenarioLabel(query, scenario.label)) return scenario
    const aliases = SCENARIO_ALIASES[scenario.id] ?? []
    if (aliases.some((alias) => queryHasKeyword(query, alias))) return scenario
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

export function ownPhraseIsAddable(candidate: {
  readonly targetText: string
  readonly translation: string
}): boolean {
  const target = candidate.targetText.trim()
  const meaning = candidate.translation.trim()
  return (
    target.length > 0 &&
    meaning.length > 0 &&
    target.length <= MAX_OWN_PHRASE_TEXT_CODE_UNITS &&
    meaning.length <= MAX_OWN_PHRASE_TEXT_CODE_UNITS
  )
}

/** Generated / chat / import candidates also stay within the spoken-practice word cap. */
export function candidateIsAddable(candidate: {
  readonly targetText: string
  readonly translation: string
}): boolean {
  return (
    ownPhraseIsAddable(candidate) &&
    phraseWordCount(candidate.targetText) <= PHRASE_SUGGEST_MAX_WORDS
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
