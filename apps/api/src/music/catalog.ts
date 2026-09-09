import { targetForPhraseId, loadLearningCatalog, phraseMeaning } from '@loro/content'
import type { CatalogLyricLine, TargetLocale } from '@loro/core'
import { isNativeLanguage, isTargetLocale, supportsPair } from '@loro/core'
import { LoroError } from '../common/errors.js'

export function resolveMusicCatalogPhrases(
  catalogPhraseIds: readonly string[],
  targetLocale: string,
  meaningLanguage: string,
): { phrases: CatalogLyricLine[]; catalogVersion: number } {
  if (!isTargetLocale(targetLocale) || !isNativeLanguage(meaningLanguage)) {
    throw new LoroError('VALIDATION_FAILED', 'Unsupported language pair')
  }
  if (!supportsPair(meaningLanguage, targetLocale)) {
    throw new LoroError('VALIDATION_FAILED', 'Unsupported language pair')
  }
  if (new Set(catalogPhraseIds).size !== catalogPhraseIds.length) {
    throw new LoroError('VALIDATION_FAILED', 'Duplicate catalog phrase ids')
  }
  const catalog = loadLearningCatalog(targetLocale, meaningLanguage)
  const phrases: CatalogLyricLine[] = []
  for (const id of catalogPhraseIds) {
    if (targetForPhraseId(id) !== targetLocale) {
      throw new LoroError('VALIDATION_FAILED', 'Catalog phrase is not in the active course')
    }
    const phrase = catalog.phrases.find((entry) => entry.id === id)
    if (phrase === undefined) {
      throw new LoroError('VALIDATION_FAILED', 'Unknown catalog phrase')
    }
    if (phrase.deprecatedBy !== undefined) {
      throw new LoroError('VALIDATION_FAILED', 'Deprecated catalog phrase')
    }
    phrases.push({
      id: phrase.id,
      targetText: phrase.targetText,
      translation: phraseMeaning(phrase, meaningLanguage),
    })
  }
  return { phrases, catalogVersion: catalog.catalogVersion }
}

export function assertCourseLocales(
  targetLocale: string,
  meaningLanguage: string,
): asserts targetLocale is TargetLocale {
  if (!isTargetLocale(targetLocale) || !isNativeLanguage(meaningLanguage)) {
    throw new LoroError('VALIDATION_FAILED', 'Unsupported language pair')
  }
}
