/** Plan 106: what the writers keep of Claude's answers, and their labelled fallbacks. */
import { afterEach, describe, expect, it } from 'vitest'
import type { GeneratePhrasesRequest } from '@loro/core/api/library'
import { AnthropicMessages } from '../integrations/anthropic/messages.js'
import {
  assembleLyrics,
  bankPhrases,
  claudeLyrics,
  claudePhrases,
  cleanImage,
  resetWriter,
} from './writers.js'

const request = (
  input: string,
  extra: Partial<GeneratePhrasesRequest> = {},
): GeneratePhrasesRequest => ({
  mode: 'topic',
  input,
  targetLang: 'es-ES',
  nativeLang: 'en-GB',
  count: 12,
  avoid: [],
  ...extra,
})

const notes = {
  mnemonic: { title: 'A hook', text: 'Something true.' },
  grammar: { title: 'A rule', text: 'Something accurate.' },
  pronunciation: { title: 'A sound', text: 'Watch the r.', ipa: 'ˈo.la', respelling: 'OH-lah' },
}

/** A Claude client whose one answer is `value`. */
function answering(value: unknown): AnthropicMessages {
  const send = () =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: JSON.stringify(value) }],
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
        { status: 200 },
      ),
    )
  return new AnthropicMessages(
    {
      apiKey: 'test',
      model: 'test',
      timeoutMs: 1000,
      maxTokens: 100,
      maxRequestBytes: 100_000,
      maxResponseBytes: 100_000,
      maxConcurrentRequests: 1,
    },
    send,
  )
}

afterEach(() => {
  resetWriter()
})

describe('the phrase bank', () => {
  it('answers a topic it has, with every phrase whole', () => {
    const phrases = bankPhrases(request('hotel check in'))
    const hotel = phrases.filter((p) => p.bankId?.startsWith('bank-hotel-es-'))
    expect(hotel.length).toBeGreaterThan(3)
    // The theme the input names comes before any that match fewer of its words.
    expect(phrases.slice(0, hotel.length)).toEqual(hotel)
    for (const phrase of phrases) {
      expect(phrase.source).toBe('bank')
      expect(phrase.native).not.toBe('')
      expect(phrase.notes.pronunciation.ipa).toMatch(/^\[.+\]$/)
    }
  })

  it('leaves out what the learner has, and answers nothing for a topic it lacks', () => {
    const first = bankPhrases(request('hotel'))[0]
    expect(first).toBeDefined()
    expect(
      bankPhrases(request('hotel', { avoid: [first?.target ?? ''] })).map((p) => p.target),
    ).not.toContain(first?.target)
    expect(bankPhrases(request('quantum chromodynamics'))).toEqual([])
  })

  it('gives notes in the learner’s language where the bank has them', () => {
    const [bg] = bankPhrases(request('hotel', { nativeLang: 'bg-BG' }))
    const [en] = bankPhrases(request('hotel'))
    expect(bg?.notes.grammar.text).not.toBe(en?.notes.grammar.text)
  })
})

describe('Claude’s phrases', () => {
  it('keeps whole, new, short phrases with pictures the app can draw', async () => {
    const ai = answering({
      phrases: [
        {
          target: '«¿Tienen habitaciones libres?»',
          native: 'Any rooms free?',
          image: ['key', 'not_an_icon'],
          notes,
        },
        { target: '¿Tienen habitaciones libres?', native: 'Duplicate', image: ['key'], notes },
        {
          target:
            'Una frase con muchas más de doce palabras que no se dice en un solo aliento nunca jamás',
          native: 'Too long',
          image: [],
          notes,
        },
        { target: 'Sin notas', native: 'No notes', image: ['key'], notes: {} },
        { target: 'La llave, por favor', native: 'The key, please', image: [], notes },
      ],
    })
    const phrases = await claudePhrases(ai, request('hotel'))
    expect(phrases.map((p) => p.target)).toEqual([
      '¿Tienen habitaciones libres?',
      'La llave, por favor',
    ])
    expect(phrases[0]?.image).toEqual(['key'])
    expect(phrases[1]?.image).toEqual(['forum'])
    expect(phrases[0]?.notes.pronunciation.ipa).toBe('[ˈo.la]')
    expect(phrases.every((p) => p.source === 'ai')).toBe(true)
  })

  it('draws only known icons', () => {
    expect(cleanImage(['key', 'key', 'nope'])).toEqual(['key'])
  })
})

describe('lyrics', () => {
  const phrases = ['uno', 'dos', 'tres', 'cuatro', 'cinco'].map((target, i) => ({
    id: `p-0${i}`,
    target,
    native: `n${i}`,
  }))

  it('arranges the set’s phrases as verse, chorus, verse, chorus, adding nothing', () => {
    const sections = assembleLyrics(phrases)
    expect(sections.map((s) => s.name)).toEqual(['verse', 'chorus', 'verse', 'chorus'])
    const lines = sections.flatMap((s) => s.lines)
    expect(
      lines.every((l) => phrases.some((p) => p.id === l.phraseId && p.target === l.text)),
    ).toBe(true)
    expect(assembleLyrics([])).toEqual([])
  })

  it('keeps Claude’s claim that a line sings a phrase only when it does', async () => {
    const ai = answering({
      sections: [
        {
          name: 'verse',
          lines: [
            { text: 'Uno', meaning: 'One', phraseId: 'p-00' },
            { text: 'Hola hola', meaning: 'Hi', phraseId: 'p-01' },
          ],
        },
        { name: 'chorus', lines: [{ text: 'dos', meaning: 'two', phraseId: 'p-01' }] },
      ],
    })
    const sections = await claudeLyrics(ai, {
      targetLang: 'es-ES',
      nativeLang: 'en-GB',
      title: 'T',
      phrases,
      style: 'modern_pop',
    })
    expect(sections.flatMap((s) => s.lines.map((l) => l.phraseId))).toEqual(['p-00', null, 'p-01'])
  })
})
