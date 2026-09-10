import { describe, expect, it } from 'vitest'
import { catalogPhraseId, userPhraseId } from '@loro/core'
import { musicPickerRows, todayPresetCatalogIds, uniqueCatalogIds } from './selection'
import type { PhraseView } from '../../store/view'

function row(id: string, catalogId: string, extra: Partial<PhraseView> = {}): PhraseView {
  return {
    id: userPhraseId(id),
    phraseId: catalogPhraseId(catalogId),
    targetText: catalogId,
    translation: catalogId,
    meaningLanguage: 'en',
    theme: 'Café',
    emoji: '☕',
    catalog: {
      id: catalogId,
      targetLocale: 'es-ES',
      targetText: catalogId,
      translation: catalogId,
      translations: { en: catalogId },
      theme: 'Café',
      emoji: '☕',
    },
    source: 'starter',
    difficulty: 'med',
    tags: [],
    loved: false,
    learned: false,
    note: null,
    plays: 0,
    reps: 0,
    addedAt: 1,
    lastPracticedAt: null,
    graduatedAt: null,
    srs: null,
    repsToday: 0,
    repsTodayDay: null,
    automaticity: 0,
    lockInDays: 0,
    rung: 0,
    stumbles: 0,
    cueLevel: 0,
    axPerception: 0,
    axRecall: 0,
    axProduction: 0,
    ...extra,
  }
}

describe('music phrase selection (p3f-01)', () => {
  it('keeps catalog-backed active rows and collapses duplicate catalog ids', () => {
    const custom = row('own', 'cafe1', { phraseId: null, catalog: null, ownEs: 'hola' })
    const learned = row('done', 'cafe2', { learned: true })
    const active = [row('a', 'cafe1'), row('b', 'cafe1'), row('c', 'cafe3')]
    expect(musicPickerRows([...active, custom, learned]).map((view) => view.id)).toEqual([
      'a',
      'b',
      'c',
    ])
    expect(uniqueCatalogIds(active)).toEqual(['cafe1', 'cafe3'])
  })

  it("offers today's set only when it has three catalog phrases", () => {
    const views = [row('a', 'cafe1'), row('b', 'cafe2'), row('c', 'cafe3')]
    expect(todayPresetCatalogIds(views, ['a', 'b'])).toEqual([])
    expect(todayPresetCatalogIds(views, ['a', 'b', 'c'])).toEqual(['cafe1', 'cafe2', 'cafe3'])
  })
})
