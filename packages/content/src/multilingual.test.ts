import { describe, expect, it } from 'vitest'
import { NATIVE_LANGUAGES, TARGET_LOCALES, supportsPair } from '@loro/core'
import { loadLearningCatalog, phraseMeaning } from './multilingual.js'

describe('F-08 starter courses', () => {
  it('ships 31 distinct target phrases and complete meanings for every supported pair', () => {
    let pairs = 0
    for (const native of NATIVE_LANGUAGES)
      for (const target of TARGET_LOCALES) {
        if (!supportsPair(native, target)) {
          expect(() => loadLearningCatalog(target, native)).toThrow()
          continue
        }
        pairs++
        const catalog = loadLearningCatalog(target, native)
        expect(catalog.phrases).toHaveLength(31)
        const ids = new Set(catalog.phrases.map((p) => p.id))
        expect(ids.size).toBe(31)
        expect(new Set(catalog.phrases.map((p) => p.targetText)).size).toBe(31)
        for (const phrase of catalog.phrases) {
          expect(phraseMeaning(phrase, native).trim().length).toBeGreaterThan(0)
          expect(phrase.targetLocale).toBe(target)
          if (native !== 'en' || target !== 'es-ES')
            expect(phrase.teaching?.[native]).toBeUndefined()
        }
        for (const pack of catalog.packs) {
          expect(pack.promisedCount).toBe(pack.phrases.length)
          expect(pack.phrases.every((id) => ids.has(id))).toBe(true)
        }
        for (const scenario of catalog.scenarios)
          expect(scenario.phrases.every((id) => ids.has(id))).toBe(true)
      }
    expect(pairs).toBe(7)
  })
  it('keeps original IDs stable and namespaces new courses', () => {
    expect(loadLearningCatalog('es-ES', 'bg').phrases[0]?.id).toBe('cafe1')
    expect(loadLearningCatalog('bg-BG', 'ru').phrases[0]?.id).toBe('bg-BG:cafe1')
    expect(loadLearningCatalog('ru-RU', 'bg').reviewStatus).toBe('pending-bilingual-review')
  })
})
