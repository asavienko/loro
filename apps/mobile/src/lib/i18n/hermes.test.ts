import { parse, TYPE, type MessageFormatElement } from '@formatjs/icu-messageformat-parser'
import { expect, it, vi } from 'vitest'

it('F-08 formats every bundled message when the runtime starts without plural rules', async () => {
  const original = Object.getOwnPropertyDescriptor(Intl, 'PluralRules')!
  vi.resetModules()
  Object.defineProperty(Intl, 'PluralRules', { ...original, value: undefined })
  try {
    const { message, setCopyLanguages, translationResources, i18n } = await import('./index')
    // Do not let the ICU adapter's default raw-template fallback hide a formatting error.
    const formatter = i18n.services.i18nFormat as {
      options: { parseErrorHandler: (error: Error) => never }
    }
    formatter.options.parseErrorHandler = (error: Error) => {
      throw error
    }
    for (const language of ['en', 'bg', 'ru'] as const) {
      setCopyLanguages(language, 'es-ES')
      expect(Intl.PluralRules.supportedLocalesOf([language])).toEqual([language])
      for (const [key, template] of Object.entries(translationResources[language])) {
        for (const count of [0, 1, 2, 5, 11, 21]) {
          const parameters: Record<string, unknown> = {}
          const collect = (nodes: MessageFormatElement[]): void => {
            for (const node of nodes) {
              if (node.type === TYPE.argument) parameters[node.value] = 'example'
              if (node.type === TYPE.number || node.type === TYPE.plural)
                parameters[node.value] = count
              if (node.type === TYPE.select) parameters[node.value] = Object.keys(node.options)[0]
              if (node.type === TYPE.select || node.type === TYPE.plural)
                Object.values(node.options).forEach((option) => {
                  collect(option.value)
                })
            }
          }
          collect(parse(template))
          expect(
            message(key as keyof typeof translationResources.en, parameters),
            `${language}:${key}:${count}`,
          ).not.toMatch(/\{[^}]*\}/)
        }
      }
      const expected =
        language === 'ru'
          ? ['день', 'дня', 'дней']
          : language === 'bg'
            ? ['ден', 'дни', 'дни']
            : ['day', 'days', 'days']
      for (const [index, count] of [1, 2, 5].entries())
        expect(message('today.streakDays', { days: count })).toBe(`${count} ${expected[index]!}`)
    }
  } finally {
    Object.defineProperty(Intl, 'PluralRules', original)
    vi.resetModules()
  }
})
