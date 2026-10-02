/** Plans 106, 111: what the writers keep of the model's answers, and their labelled fallbacks. */
import { afterEach, describe, expect, it } from 'vitest'
import type { GeneratePhrasesRequest } from '@loro/core/api/library'
import { ChatCompletions, FIREWORKS_CHAT_URL } from '../integrations/openai-compatible/chat.js'
import {
  assembleLyrics,
  bankPhrases,
  aiLyrics,
  aiNotes,
  aiPhrases,
  aiRewrittenNote,
  cleanImage,
  resetWriter,
  translateLines,
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

/** A text model whose one answer is `value`, as a chat-completions provider sends it. */
function answering(
  value: unknown,
  seen?: (body: Record<string, unknown>) => void,
): ChatCompletions {
  const send = (_url: string | URL | Request, init?: RequestInit) => {
    seen?.(JSON.parse(init?.body as string) as Record<string, unknown>)
    return Promise.resolve(
      new Response(
        JSON.stringify({
          choices: [
            {
              finish_reason: 'stop',
              message: { role: 'assistant', content: JSON.stringify(value) },
            },
          ],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
        }),
        { status: 200 },
      ),
    )
  }
  return new ChatCompletions(
    {
      name: 'test',
      url: FIREWORKS_CHAT_URL,
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

describe('The model’s phrases', () => {
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
    const phrases = await aiPhrases(ai, request('hotel'))
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

  it('keeps the model’s claim that a line sings a phrase only when it does', async () => {
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
    const sections = await aiLyrics(ai, {
      targetLang: 'es-ES',
      nativeLang: 'en-GB',
      title: 'T',
      phrases,
      style: 'modern_pop',
    })
    expect(sections.flatMap((s) => s.lines.map((l) => l.phraseId))).toEqual(['p-00', null, 'p-01'])
  })

  it('writes the lyrics again with the learner’s change, the current lines in the message (plan 113)', async () => {
    const current = assembleLyrics(phrases)
    let body: Record<string, unknown> | undefined
    const answer = {
      sections: [
        { name: 'verse', lines: [{ text: 'dos', meaning: 'two', phraseId: 'p-01' }] },
        { name: 'chorus', lines: [{ text: 'uno', meaning: 'one', phraseId: 'p-00' }] },
      ],
    }
    await aiLyrics(
      answering(answer, (sent) => {
        body = sent
      }),
      {
        targetLang: 'es-ES',
        nativeLang: 'en-GB',
        title: 'T',
        phrases,
        style: 'lullaby',
        current,
        instruction: 'A shorter chorus',
      },
    )
    const messages = body?.['messages'] as { role: string; content: string }[]
    const system = messages.find((m) => m.role === 'system')?.content ?? ''
    expect(system).toContain('what the learner wants changed')
    const user = JSON.parse(messages.find((m) => m.role === 'user')?.content ?? '{}') as Record<
      string,
      unknown
    >
    expect(user['current']).toEqual(current)
    expect(user['instruction']).toBe('A shorter chorus')

    // Without an instruction the model is asked for different lyrics, and sees no instruction.
    await aiLyrics(
      answering(answer, (sent) => {
        body = sent
      }),
      { targetLang: 'es-ES', nativeLang: 'en-GB', title: 'T', phrases, style: 'lullaby', current },
    )
    const again = body?.['messages'] as { role: string; content: string }[]
    expect(again.find((m) => m.role === 'system')?.content).toContain('wants different ones')
    expect(JSON.parse(again.find((m) => m.role === 'user')?.content ?? '{}')).not.toHaveProperty(
      'instruction',
    )
  })

  it('bounds the lines by the song’s length and gives the model its mood and theme (plan 113)', async () => {
    let body: Record<string, unknown> | undefined
    const many = {
      sections: [
        {
          name: 'verse',
          lines: phrases.map((p) => ({ text: p.target, meaning: p.native, phraseId: p.id })),
        },
        {
          name: 'chorus',
          lines: phrases.map((p) => ({ text: p.target, meaning: p.native, phraseId: p.id })),
        },
      ],
    }
    const input = {
      targetLang: 'es-ES' as const,
      nativeLang: 'en-GB' as const,
      title: 'T',
      phrases,
      style: 'bossa_nova',
      options: {
        voice: 'duet',
        tempo: 'slow',
        mood: 'nostalgic',
        length: 'short',
        theme: 'the sea',
      } as const,
    }
    // Ten lines are too many for a short song's eight.
    await expect(
      aiLyrics(
        answering(many, (sent) => (body = sent)),
        input,
      ),
    ).rejects.toThrow('unusable')
    const messages = body?.['messages'] as { role: string; content: string }[]
    expect(messages.find((m) => m.role === 'system')?.content).toContain('8 lines at most')
    expect(JSON.parse(messages.find((m) => m.role === 'user')?.content ?? '{}')).toMatchObject({
      mood: 'nostalgic',
      theme: 'the sea',
      tempo: 'slow',
      voice: 'duet',
    })
    // A long song takes them; with no mood, theme or voice chosen, the model sees none.
    const long = {
      ...input,
      options: { voice: 'any', tempo: 'natural', mood: null, length: 'long', theme: null } as const,
    }
    expect(
      (
        await aiLyrics(
          answering(many, (sent) => (body = sent)),
          long,
        )
      ).flatMap((s) => s.lines),
    ).toHaveLength(10)
    const user = JSON.parse(
      (body?.['messages'] as { role: string; content: string }[]).find((m) => m.role === 'user')
        ?.content ?? '{}',
    ) as Record<string, unknown>
    expect(Object.keys(user)).not.toEqual(expect.arrayContaining(['mood']))
    expect(user).not.toHaveProperty('theme')
    expect(user).not.toHaveProperty('voice')
  })

  it('arranges no more phrases than the length has lines for', () => {
    expect(assembleLyrics(phrases, 8).flatMap((s) => s.lines).length).toBeLessThanOrEqual(8)
  })

  it('translates the lines a singer changed, one meaning per line, or nothing (plan 113)', async () => {
    const input = {
      lines: ['muy buenas noches amor', 'hasta mañana'],
      targetLang: 'es-ES' as const,
      nativeLang: 'en-GB' as const,
    }
    expect(
      await translateLines(
        answering({ meanings: [' Good night, my love ', 'See you tomorrow'] }),
        input,
      ),
    ).toEqual(['Good night, my love', 'See you tomorrow'])
    await expect(translateLines(answering({ meanings: ['Only one'] }), input)).rejects.toThrow(
      'unusable',
    )
    expect(await translateLines(answering({ meanings: [] }), { ...input, lines: [] })).toEqual([])
  })
})

describe('The model’s notes for a phrase the learner wrote', () => {
  it('keeps whole notes and a picture the app can draw', async () => {
    const written = await aiNotes(answering({ image: ['nope', 'key'], notes }), {
      target: 'La llave, por favor',
      native: 'The key, please',
      targetLang: 'es-ES',
      nativeLang: 'en-GB',
    })
    expect(written.image).toEqual(['key'])
    expect(written.notes.pronunciation.ipa).toBe('[ˈo.la]')
  })

  it('asks for a mnemonic in the learner’s language that invents nothing', async () => {
    let body: Record<string, unknown> | undefined
    await aiNotes(
      answering({ image: ['key'], notes }, (sent) => {
        body = sent
      }),
      {
        target: 'Един билет, моля',
        native: 'Один билет, пожалуйста',
        targetLang: 'bg-BG',
        nativeLang: 'ru-RU',
      },
    )
    const system = (body?.['messages'] as { role: string; content: string }[])[0]!
    expect(system.role).toBe('system')
    expect(system.content).toContain('`mnemonic`: a mnemonic')
    expect(system.content).toContain('a Russian word it sounds like')
    expect(system.content).toContain('Never invent an etymology')
    expect(JSON.stringify(body?.['response_format'])).toContain(
      'A mnemonic for remembering this phrase',
    )
  })

  it('asks for another mnemonic, sending the language, the phrase and what the learner read', async () => {
    let body: Record<string, unknown> | undefined
    const previous = [{ title: 'Билет — билет', text: 'Same word in Russian.' }]
    const note = await aiRewrittenNote(
      answering({ title: ' Моля — молю ', text: 'Picture  begging for a ticket.' }, (sent) => {
        body = sent
      }),
      {
        kind: 'mnemonic',
        target: 'Един билет, моля',
        native: 'Один билет, пожалуйста',
        targetLang: 'bg-BG',
        nativeLang: 'ru-RU',
        previous,
      },
    )
    expect(note).toEqual({ title: 'Моля — молю', text: 'Picture begging for a ticket.' })
    const [system, user] = body?.['messages'] as { role: string; content: string }[]
    expect(system!.content).toContain('asked for another one')
    expect(system!.content).toContain('Write it in Russian')
    expect(JSON.parse(user!.content)).toEqual({
      target: 'Един билет, моля',
      native: 'Один билет, пожалуйста',
      language: 'Russian',
      previous,
    })
  })

  it('refuses the same note again', async () => {
    const previous = [{ title: 'A hook', text: 'Something true.' }]
    await expect(
      aiRewrittenNote(answering(previous[0]), {
        kind: 'grammar',
        target: 'Hola',
        native: 'Hello',
        targetLang: 'es-ES',
        nativeLang: 'en-GB',
        previous,
      }),
    ).rejects.toThrow('the same note again')
  })

  it('refuses notes that are not whole', async () => {
    await expect(
      aiNotes(answering({ image: ['key'], notes: { mnemonic: notes.mnemonic } }), {
        target: 'x',
        native: 'y',
        targetLang: 'es-ES',
        nativeLang: 'en-GB',
      }),
    ).rejects.toThrow()
  })
})
