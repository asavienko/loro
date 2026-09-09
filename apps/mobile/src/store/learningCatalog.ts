import { loadLearningCatalog, phraseMeaning, type LearningPhrase } from '@loro/content'
import { useApp } from './store'
import type { NativeLanguage, TargetLocale } from '@loro/core'

export type DisplayPhrase = LearningPhrase & {
  translation: string
  resp?: string
  hint?: string
  note?: string
  words?: readonly { targetText: string; gloss: string; say?: string }[]
  example?: { targetText: string; translation: string }
}
const indexes = new Map<string, Map<string, DisplayPhrase>>()
const projections = new Map<string, DisplayPhrase[]>()
export function displayPhrases(target: TargetLocale, native: NativeLanguage): DisplayPhrase[] {
  const key = `${target}/${native}`
  const cached = projections.get(key)
  if (cached) return cached
  const phrases = loadLearningCatalog(target, native).phrases.map((p) => ({
    ...p,
    translation: phraseMeaning(p, native),
    ...p.teaching?.[native],
  }))
  projections.set(key, phrases)
  indexes.set(key, new Map(phrases.map((phrase) => [phrase.id, phrase])))
  return phrases
}
export function useLearningCatalog() {
  const target = useApp((s) => s.targetLocale)
  const native = useApp((s) => s.nativeLanguage)
  const catalog = loadLearningCatalog(target, native)
  return { ...catalog, phrases: displayPhrases(target, native) }
}

export function displayPhrase(
  target: TargetLocale,
  native: NativeLanguage,
  id: string,
): DisplayPhrase | undefined {
  displayPhrases(target, native)
  return indexes.get(`${target}/${native}`)?.get(id)
}

export { bundledTopicSuggestions } from '@loro/content'
