import { parse, TYPE, type MessageFormatElement } from '@formatjs/icu-messageformat-parser'
import { afterEach, describe, expect, it } from 'vitest'
import { detectNativeLanguage } from '@loro/core'
import { copy } from '../copy'
import { i18n, message, setCopyLanguages, translationResources, type MessageKey } from './index'

afterEach(() => {
  setCopyLanguages('en', 'es-ES')
})
describe('F-08 bundled translations', () => {
  it('has complete keys and matching interpolation contracts', () => {
    const keys = Object.keys(translationResources.en) as MessageKey[]
    const variables = (text: string): string[] => {
      const collect = (nodes: MessageFormatElement[]): string[] =>
        nodes.flatMap((node) => {
          if (node.type === TYPE.literal || node.type === TYPE.pound) return []
          if (node.type === TYPE.select || node.type === TYPE.plural)
            return [
              node.value,
              ...Object.values(node.options).flatMap((option) => collect(option.value)),
            ]
          if (node.type === TYPE.tag) return collect(node.children)
          return [node.value]
        })
      return [...new Set(collect(parse(text)))].sort()
    }
    for (const locale of ['bg', 'ru'] as const) {
      expect(Object.keys(translationResources[locale]).sort()).toEqual([...keys].sort())
      for (const key of keys)
        expect(variables(translationResources[locale][key]), `${locale}:${key}`).toEqual(
          variables(translationResources.en[key]),
        )
    }
  })
  it('uses Russian plurals for 1, 2, 5, 11 and 21', () => {
    setCopyLanguages('ru', 'es-ES')
    expect([1, 2, 5, 11, 21].map(copy.today.streakDays)).toEqual([
      '1 день',
      '2 дня',
      '5 дней',
      '11 дней',
      '21 день',
    ])
  })
  it('reacts to language changes without retaining English values', () => {
    expect(copy.today.title).toBe('Today')
    setCopyLanguages('bg', 'ru-RU')
    expect(copy.today.title).toBe('Днес')
    expect(copy.onboarding.welcome.title).toContain('руски')
    expect(copy.onboarding.welcome.greeting).toContain('Привет!')
    setCopyLanguages('ru', 'bg-BG')
    expect(copy.today.title).toBe('Сегодня')
    expect(copy.onboarding.welcome.title).toContain('болгарский')
  })
  it('uses English only as emergency UI fallback', () => {
    void i18n.changeLanguage('unknown')
    expect(message('today.title')).toBe('Today')
  })
  it('normalizes regional device locales without guessing unsupported languages', () => {
    expect(['bg-BG', 'ru_RU', 'en-GB', 'fr-FR', undefined].map(detectNativeLanguage)).toEqual([
      'bg',
      'ru',
      'en',
      'en',
      'en',
    ])
  })
})
