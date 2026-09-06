/** F-08. The legacy Spanish bundle is adapted at this boundary only. */
import {
  assertLanguagePair,
  isTargetLocale,
  type NativeLanguage,
  type TargetLocale,
  type CatalogPhrase as CoreCatalogPhrase,
} from '@loro/core'
import starter from '../translations/starter.json' with { type: 'json' }
import labels from '../translations/labels.json' with { type: 'json' }
import { bundledCatalog } from './catalog.js'
import type { CatalogPhrase, Pack, Scenario } from './types.js'
export interface LearningPhrase extends Omit<CoreCatalogPhrase, 'id' | 'theme' | 'catalogVersion'> {
  id: string
  theme: CatalogPhrase['theme']
}
export interface LearningCatalog {
  targetLocale: TargetLocale
  nativeLanguage: NativeLanguage
  catalogVersion: number
  reviewStatus: 'pending-bilingual-review' | 'legacy'
  phrases: LearningPhrase[]
  packs: Pack[]
  scenarios: Scenario[]
}
const translated = new Map(starter.phrases.map((p) => [p.id, p]))
const labelMap: Record<string, Record<NativeLanguage, string>> = labels
const phraseCache = new Map<TargetLocale, LearningPhrase[]>()
function phrasesFor(targetLocale: TargetLocale): LearningPhrase[] {
  const cached = phraseCache.get(targetLocale)
  if (cached) return cached
  const phrases = bundledCatalog.phrases.map((p): LearningPhrase => {
    const translation = translated.get(p.id)
    if (!translation) throw new Error(`Missing translations for ${p.id}`)
    const translations = { en: p.en, bg: translation.bg, ru: translation.ru }
    if (p.id === 'cafe1' && targetLocale === 'es-ES') {
      translations.bg = 'Едно кортадо, моля'
      translations.ru = 'Кортадо, пожалуйста'
    }
    // A cortado is Spanish-specific; the new courses teach the local generic request.
    if (p.id === 'cafe1' && targetLocale !== 'es-ES')
      translations.en = 'A coffee with a little milk, please'
    return {
      id: targetLocale === 'es-ES' ? p.id : `${targetLocale}:${p.id}`,
      targetLocale,
      targetText:
        targetLocale === 'es-ES'
          ? p.es
          : targetLocale === 'bg-BG'
            ? translation.bg
            : translation.ru,
      translations,
      theme: p.theme,
      emoji: p.emoji,
      ...(p.register ? { register: p.register } : {}),
      ...(p.cefr ? { cefr: p.cefr } : {}),
      ...(targetLocale === 'es-ES'
        ? {
            teaching: {
              en: {
                ...(p.resp ? { resp: p.resp } : {}),
                ...(p.hint ? { hint: p.hint } : {}),
                ...(p.note ? { note: p.note } : {}),
                ...(p.words
                  ? {
                      words: p.words.map(({ es, gloss, say }) => ({
                        targetText: es,
                        gloss,
                        ...(say === undefined ? {} : { say }),
                      })),
                    }
                  : {}),
                ...(p.example
                  ? { example: { targetText: p.example.es, translation: p.example.en } }
                  : {}),
              },
            },
          }
        : {}),
    }
  })
  phraseCache.set(targetLocale, phrases)
  return phrases
}
const catalogs = new Map<string, LearningCatalog>()
export function loadLearningCatalog(
  targetLocale: TargetLocale,
  nativeLanguage: NativeLanguage,
): LearningCatalog {
  assertLanguagePair(nativeLanguage, targetLocale)
  const key = `${targetLocale}/${nativeLanguage}`
  const cached = catalogs.get(key)
  if (cached) return cached
  const localize = <T extends Pack | Scenario>(item: T): T => ({
    ...item,
    label: labelMap[item.label]?.[nativeLanguage] ?? item.label,
    phrases: item.phrases.map((id) => (targetLocale === 'es-ES' ? id : `${targetLocale}:${id}`)),
  })
  const catalog: LearningCatalog = {
    targetLocale,
    nativeLanguage,
    catalogVersion: 1,
    reviewStatus:
      targetLocale === 'es-ES' && nativeLanguage === 'en' ? 'legacy' : 'pending-bilingual-review',
    phrases: phrasesFor(targetLocale),
    packs: bundledCatalog.packs.map(localize),
    scenarios: bundledCatalog.scenarios.map(localize),
  }
  catalogs.set(key, catalog)
  return catalog
}
export function targetForPhraseId(id: string): TargetLocale {
  const prefix = id.split(':')[0] ?? ''
  if (id.includes(':') && !isTargetLocale(prefix))
    throw new Error(`Unknown catalog locale: ${prefix}`)
  return isTargetLocale(prefix) ? prefix : 'es-ES'
}
export function phraseMeaning(phrase: LearningPhrase, nativeLanguage: NativeLanguage): string {
  const meaning = phrase.translations[nativeLanguage]
  if (!meaning) throw new Error(`Missing ${nativeLanguage} meaning for ${phrase.id}`)
  return meaning
}
