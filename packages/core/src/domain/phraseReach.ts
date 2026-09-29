/**
 * Phrase reach — canonical identity and the limits the suggest route (`api/phrase-suggest.ts`)
 * applies to generated lines (plan 97 / AI-06).
 *
 * Candidates are learner-owned drafts. They never receive a catalog id.
 */

import { foldSearchText } from './text.js'
import { MAX_OWN_PHRASE_TEXT_CODE_UNITS, type PhraseSource, type Theme } from './phrase.js'

export const PHRASE_SUGGEST_MAX_QUERY = 200
export const PHRASE_SUGGEST_MAX_CANDIDATES = 6
export const PHRASE_SUGGEST_MAX_WORDS = 12

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
