import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { buildTranslateRequest, glossConvention, type TranslateInput } from './prompt/translate.js'
import { buildJudgeTranslateRequest } from './prompt/judge-translate.js'
import { loadPlanFile } from './slot.js'
import { checkTranslation, inScript } from './translate.js'

const PLAN = fileURLToPath(
  new URL('../../../../packages/content/v2/plan/es/A1/eating-out.json', import.meta.url),
)

const inputs: TranslateInput[] = [
  {
    id: 'es-aaaaaaa',
    target: '¿Nos pone dos zumos, por favor?',
    english: 'Could you get us two juices, please?',
    words: [
      { w: 'nos', gloss: 'for us' },
      { w: 'pone', gloss: '(you) serve' },
      { w: 'dos', gloss: 'two' },
      { w: 'zumos', gloss: 'juices' },
      { w: 'por favor', gloss: 'please' },
    ],
  },
  {
    id: 'es-bbbbbbb',
    target: '¿Cuánto es?',
    english: 'How much is it?',
    words: [
      { w: 'cuánto', gloss: 'how much' },
      { w: 'es', gloss: 'is' },
    ],
  },
]

describe('translate', () => {
  const [slot] = loadPlanFile(PLAN)
  if (!slot) throw new Error('no slot')

  it('builds the same request twice, and a different one per language', () => {
    const a = buildTranslateRequest(slot, inputs, 'ru', 'Ordering at the counter', 'm')
    expect(buildTranslateRequest(slot, inputs, 'ru', 'Ordering at the counter', 'm')).toEqual(a)
    expect(
      buildTranslateRequest(slot, inputs, 'pl', 'Ordering at the counter', 'm').cacheKey,
    ).not.toBe(a.cacheKey)
    const text = a.messages[0]?.content ?? ''
    expect(text).toContain('zumos = juices')
    expect(a.system).toContain('Russian')
  })

  it('writer and judge share one gloss convention, with the exact article glosses', () => {
    const convention = glossConvention('es-ES', 'pl').join('\n')
    expect(convention).toContain('«(rodzajnik nieokreślony)»')
    const writer = buildTranslateRequest(slot, inputs, 'pl', 's', 'm').system
    const judge = buildJudgeTranslateRequest(
      slot,
      inputs.map((i) => ({
        ...i,
        translation: 'x',
        glosses: i.words.map((w) => ({ w: w.w, english: w.gloss, gloss: 'y' })),
      })),
      'pl',
      'm',
    ).system
    for (const line of glossConvention('es-ES', 'pl')) {
      expect(writer).toContain(line)
      expect(judge).toContain(line)
    }
    expect(glossConvention('ru-RU', 'pl').join()).not.toContain('rodzajnik')
  })

  it('aligns glosses with words and names what does not line up', () => {
    const { subtitle, phrases } = checkTranslation(
      {
        subtitle: 'Заказ у стойки',
        phrases: [
          {
            n: 1,
            translation: 'Можно нам два сока, пожалуйста?',
            glosses: ['нам', 'подайте', 'два', 'сока', 'пожалуйста'],
          },
          { n: 2, translation: 'Сколько с меня?', glosses: ['сколько'] },
        ],
      },
      inputs,
      'ru',
    )
    expect(subtitle).toBe('Заказ у стойки')
    expect(phrases[0]?.problems).toEqual([])
    expect(phrases[0]?.words).toEqual({
      nos: 'нам',
      pone: 'подайте',
      dos: 'два',
      zumos: 'сока',
      'por favor': 'пожалуйста',
    })
    expect(phrases[1]?.problems.join()).toContain('1 glosses for 2 words')
  })

  it('refuses an English gloss but keeps a loanword', () => {
    const { phrases } = checkTranslation(
      {
        subtitle: 'x',
        phrases: [
          {
            n: 1,
            translation: 'Два сока, пожалуйста',
            glosses: ['нам', 'the', 'два', 'сока', 'пожалуйста'],
          },
          { n: 2, translation: 'Сколько?', glosses: ['сколько', 'es'] },
        ],
      },
      inputs,
      'ru',
    )
    expect(phrases[0]?.problems.join()).toContain('gloss for «pone» not in the ru-RU script')
    expect(phrases[1]?.problems).toEqual([])
  })

  it('accepts a loanword inside the native script, not a line in the wrong one', () => {
    expect(inScript('У вас есть wifi?', 'ru')).toBe(true)
    expect(inScript('Czy macie wifi?', 'pl')).toBe(true)
    expect(inScript('Do you have wifi?', 'ru')).toBe(false)
  })

  it('rejects the wrong script and a missing answer', () => {
    const { phrases } = checkTranslation(
      {
        subtitle: 'x',
        phrases: [{ n: 1, translation: 'Two juices please', glosses: ['a', 'b', 'c', 'd', 'e'] }],
      },
      inputs,
      'bg',
    )
    expect(phrases[0]?.problems.join()).toContain('script')
    expect(phrases[1]?.problems).toEqual(['no answer'])
  })
})
