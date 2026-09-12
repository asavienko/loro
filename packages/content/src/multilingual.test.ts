import { describe, expect, it } from 'vitest'
import { NATIVE_LANGUAGES, TARGET_LOCALES, supportsPair } from '@loro/core'
import { loadLearningCatalog, phraseMeaning, projectLearningPhrase } from './multilingual.js'
import type { CatalogPhrase } from './types.js'

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
        expect(catalog.graph.edges).toHaveLength(15)
        expect(catalog.graph.edges.every((edge) => ids.has(edge.from) && ids.has(edge.to))).toBe(
          true,
        )
      }
    expect(pairs).toBe(7)
  })
  it('keeps original IDs stable and namespaces new courses', () => {
    expect(loadLearningCatalog('es-ES', 'bg').phrases[0]?.id).toBe('cafe1')
    expect(loadLearningCatalog('bg-BG', 'ru').phrases[0]?.id).toBe('bg-BG:cafe1')
    expect(loadLearningCatalog('ru-RU', 'bg').reviewStatus).toBe('pending-bilingual-review')
  })

  it('remaps graph ends to the course catalog ids', () => {
    const spanish = loadLearningCatalog('es-ES', 'en')
    expect(spanish.graph.edges[0]).toEqual({
      from: 'din1',
      to: 'din2',
      relation: 'scenario_next',
      weight: 100,
    })
    const bulgarian = loadLearningCatalog('bg-BG', 'en')
    expect(bulgarian.graph.lang).toBe('bg-BG')
    expect(bulgarian.graph.edges[0]).toEqual({
      from: 'bg-BG:din1',
      to: 'bg-BG:din2',
      relation: 'scenario_next',
      weight: 100,
    })
  })

  it('projects respIpa, syl, hint and cloud audio onto the learning phrase', () => {
    const seed = loadLearningCatalog('es-ES', 'en').phrases.find((row) => row.id === 'din2')
    expect(seed).toBeDefined()
    const row: CatalogPhrase = {
      id: 'din2',
      es: '¿Qué me recomienda?',
      en: 'What do you recommend?',
      theme: 'Dining',
      emoji: '👨‍🍳',
      register: 'neutral',
      cefr: 'A2',
      resp_ipa: '/ke me rekoˈmjenda/',
      hint: 'ask the waiter',
      syl: [{ t: 'qué', stress: 1, dur: 0.2 }],
      audio: {
        uri: 'https://cdn.loro.test/clips/din2.m4a',
        sha256: 'ab'.repeat(32),
        ms: 1100,
      },
    }
    const projected = projectLearningPhrase(row, 'es-ES')
    expect(projected.respIpa).toBe('/ke me rekoˈmjenda/')
    expect(projected.syl).toEqual([{ t: 'qué', stress: 1, dur: 0.2 }])
    expect(projected.hint).toBe('ask the waiter')
    expect(projected.teaching?.en?.hint).toBe('ask the waiter')
    expect(projected.audio?.uri).toBe('https://cdn.loro.test/clips/din2.m4a')
    expect(
      projectLearningPhrase(
        { ...row, audio: { uri: 'file:///tmp/din2.m4a', sha256: 'ab'.repeat(32), ms: 1100 } },
        'es-ES',
      ).audio,
    ).toBeUndefined()
    const bulgarian = projectLearningPhrase(row, 'bg-BG')
    expect(bulgarian.hint).toBe('ask the waiter')
    expect(bulgarian.teaching).toBeUndefined()
    expect(bulgarian.audio).toBeUndefined()
    const lost = loadLearningCatalog('bg-BG', 'ru').phrases.find((row) => row.id === 'bg-BG:dir4')
    expect(lost?.hint).toBe('"Perdido" shares a root with "lost / perish."')
  })
})
