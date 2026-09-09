import { beforeEach, describe, expect, it } from 'vitest'
import { useApp } from './store'
import { toView } from './view'
import { loadLearningCatalog } from './catalog'
import { NATIVE_LANGUAGES, TARGET_LOCALES, supportsPair } from '@loro/core'

beforeEach(() => {
  useApp.getState().reset()
})
const seed = (): void => {
  useApp
    .getState()
    .completeOnboarding({ goal: 'curious', level: 'beg', dailyMinutes: 10, packIds: ['cafe'] })
}
describe('F-08 course isolation', () => {
  it('supports all seven pairs with target-specific starter phrases', () => {
    for (const native of NATIVE_LANGUAGES)
      for (const target of TARGET_LOCALES) {
        if (!supportsPair(native, target)) continue
        useApp.getState().reset()
        useApp.getState().setLanguages(native, target)
        seed()
        expect(useApp.getState().phrases).toHaveLength(4)
        expect(useApp.getState().phrases.map((phrase) => phrase.phraseId)).toEqual(
          loadLearningCatalog(target, native).packs.find((pack) => pack.id === 'cafe')?.phrases,
        )
        const phrase = useApp.getState().phrases[0]
        if (!phrase) throw new Error('Missing seed')
        const view = toView(phrase)
        expect(view.targetLocale).toBe(target)
        expect(view.meaningLanguage).toBe(native)
        expect(view.translation).not.toBe('')
      }
  })
  it('restores collection, daily set and cursor without reseeding or resetting progress', () => {
    seed()
    const spanish = useApp.getState().phrases[0]
    if (!spanish) throw new Error('Missing seed')
    useApp.getState().applyDelta({ phraseId: spanish.id, reps: 1 })
    useApp.getState().setStreamCursor(2)
    const before = useApp.getState()
    useApp.getState().setLanguages('en', 'bg-BG')
    expect(useApp.getState().phrases).toHaveLength(0)
    seed()
    expect(useApp.getState().phrases.every((p) => p.phraseId?.startsWith('bg-BG:'))).toBe(true)
    useApp.getState().setLanguages('en', 'es-ES')
    expect(useApp.getState().phrases).toEqual(before.phrases)
    expect(useApp.getState().refrainSet).toEqual(before.refrainSet)
    expect(useApp.getState().streamCursor).toBe(2)
    seed()
    expect(useApp.getState().phrases).toEqual(before.phrases)
    expect(useApp.getState().practiceDays).toEqual(before.practiceDays)
  })
  it('preserves personal meanings and their language through native changes', () => {
    useApp.getState().setLanguages('bg', 'ru-RU')
    const id = useApp
      .getState()
      .addOwnPhrase({ targetText: 'Доброе утро', translation: 'Добро утро' })
    useApp.getState().setLanguages('en', 'ru-RU')
    const row = useApp.getState().phrases.find((p) => p.id === id)
    if (!row) throw new Error('Missing own phrase')
    expect(toView(row).translation).toBe('Добро утро')
    expect(toView(row).meaningLanguage).toBe('bg')
  })
  it('rejects a matching pair atomically', () => {
    const before = useApp.getState()
    expect(() => {
      before.setLanguages('bg', 'bg-BG')
    }).toThrow()
    expect(useApp.getState()).toBe(before)
  })
  it('applies a late practice result to its original course only', () => {
    seed()
    const phrase = useApp.getState().phrases[0]
    if (!phrase) throw new Error('Missing seed')
    useApp.getState().setLanguages('en', 'ru-RU')
    seed()
    useApp.getState().applyDelta({ phraseId: phrase.id, reps: 1 })
    expect(useApp.getState().phrases.every((p) => p.reps === 0)).toBe(true)
    useApp.getState().setLanguages('en', 'es-ES')
    expect(useApp.getState().phrases.find((p) => p.id === phrase.id)?.reps).toBe(1)
  })
})
