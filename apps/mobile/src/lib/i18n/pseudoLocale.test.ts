import { afterEach, describe, expect, it } from 'vitest'
import { createInstance } from 'i18next'
import ICU from 'i18next-icu'
import { parse, TYPE, type MessageFormatElement } from '@formatjs/icu-messageformat-parser'
import en from './en.json'
import pseudo from './en-XA.json'
import { pseudoMessage, pseudoResources } from './pseudoLocale'
import { pseudoLocaleEnabled } from './pseudoMode'
import {
  currentNativeLanguage,
  currentTargetLocale,
  i18n,
  message,
  setCopyLanguages,
} from './index'

afterEach(() => {
  setCopyLanguages('en', 'es-ES')
})

describe('F-08 pseudo-locale release harness', () => {
  it('keeps the committed fixture in step with every English interface key', () => {
    expect(pseudo).toEqual(pseudoResources(en))
    expect(pseudo['today.title']).toBe('[!! Töödááy !!]')
  })

  it('preserves every bundled ICU argument, formatting style and plural/select branch', () => {
    const structure = (nodes: MessageFormatElement[]): unknown[] =>
      nodes.flatMap<unknown>((node) => {
        if (node.type === TYPE.literal) return []
        if (node.type === TYPE.select || node.type === TYPE.plural)
          return [
            {
              ...node,
              options: Object.fromEntries(
                Object.entries(node.options).map(([selector, option]) => [
                  selector,
                  structure(option.value),
                ]),
              ),
            },
          ]
        if (node.type === TYPE.tag) return [{ ...node, children: structure(node.children) }]
        return [node]
      })
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(structure(parse(pseudo[key])), key).toEqual(structure(parse(en[key])))
    }
  })

  it('requires an explicit development flag and cannot enable a production build', () => {
    expect(pseudoLocaleEnabled(true, '1')).toBe(true)
    for (const flag of [undefined, '', '0', 'true', '1']) {
      expect(pseudoLocaleEnabled(false, flag)).toBe(false)
      if (flag !== '1') expect(pseudoLocaleEnabled(true, flag)).toBe(false)
    }
  })

  it('expands ICU literals without changing nested selectors, arguments or escaped punctuation', () => {
    const fixture = createInstance().use(ICU)
    void fixture.init({
      lng: 'en',
      initAsync: false,
      interpolation: { escapeValue: false },
      resources: {
        en: {
          translation: {
            nested: pseudoMessage(
              '{mode, select, learn {{count, plural, one {# lesson for {name}} other {# lessons for {name}}}} other {Nothing}}',
            ),
            quoted: pseudoMessage("Say '{hello}' and # — don't edit {target}"),
            pluralLiteral: pseudoMessage("{count, plural, other {'#' and '<tag>' #}}"),
          },
        },
      },
    })
    expect(fixture.t('nested', { mode: 'learn', count: 2, name: 'Здравей!' })).toBe(
      '[!! 2 lëëssööns föör Здравей! !!]',
    )
    expect(fixture.t('nested', { mode: 'learn', count: 1, name: '¡Hola!' })).toBe(
      '[!! 1 lëëssöön föör ¡Hola! !!]',
    )
    expect(fixture.t('nested', { mode: 'other' })).toBe('[!! Nööthïïng !!]')
    expect(fixture.t('pluralLiteral', { count: 2 })).toBe('[!! # áánd <táág> 2 !!]')
    expect(fixture.t('quoted', { target: 'Привет!' })).toBe(
      "[!! Sááy {hëëllöö} áánd # — döön't ëëdïït Привет! !!]",
    )
  })

  it('uses the real message seam while preserving learning-language parameters and selection', () => {
    setCopyLanguages('bg', 'ru-RU')
    void i18n.changeLanguage('en-XA')
    expect(message('today.title')).toBe(pseudo['today.title'])
    expect(message('onboarding.welcome.greeting')).toContain('Привет!')
    expect(currentNativeLanguage()).toBe('bg')
    expect(currentTargetLocale()).toBe('ru-RU')
    expect(message('today.streakDays', { days: 21 })).toBe('[!! 21 dááys !!]')
  })
})
