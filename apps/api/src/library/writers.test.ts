/** Plan 106: what the writers keep of Claude's answers, and their labelled fallbacks. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GeneratePhrasesRequest } from '@loro/core/api/library'
import { AnthropicMessages } from '../integrations/anthropic/messages.js'
import {
  assembleLyrics,
  bankPhrases,
  claudeLyrics,
  claudeNotes,
  claudePhrases,
  cleanImage,
  resetWriter,
  writer,
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

describe('Claude’s notes for a phrase the learner wrote', () => {
  it('keeps whole notes and a picture the app can draw', async () => {
    const written = await claudeNotes(answering({ image: ['nope', 'key'], notes }), {
      target: 'La llave, por favor',
      native: 'The key, please',
      targetLang: 'es-ES',
      nativeLang: 'en-GB',
    })
    expect(written.image).toEqual(['key'])
    expect(written.notes.pronunciation.ipa).toBe('[ˈo.la]')
  })

  it('asks for a mnemonic in the learner’s language that invents nothing', async () => {
    let body: { system: string; output_config: { format: { schema: unknown } } } | undefined
    const ai = new AnthropicMessages(
      {
        apiKey: 'test',
        model: 'test',
        timeoutMs: 1000,
        maxTokens: 100,
        maxRequestBytes: 100_000,
        maxResponseBytes: 100_000,
        maxConcurrentRequests: 1,
      },
      (_url, init) => {
        body = JSON.parse(init?.body as string) as typeof body
        return Promise.resolve(
          new Response(
            JSON.stringify({
              stop_reason: 'end_turn',
              content: [{ type: 'text', text: JSON.stringify({ image: ['key'], notes }) }],
              usage: { input_tokens: 1, output_tokens: 1 },
            }),
          ),
        )
      },
    )
    await claudeNotes(ai, {
      target: 'Един билет, моля',
      native: 'Один билет, пожалуйста',
      targetLang: 'bg-BG',
      nativeLang: 'ru-RU',
    })
    expect(body?.system).toContain('`mnemonic`: a mnemonic')
    expect(body?.system).toContain('a Russian word it sounds like')
    expect(body?.system).toContain('Never invent an etymology')
    expect(JSON.stringify(body?.output_config.format.schema)).toContain(
      'A mnemonic for remembering this phrase',
    )
  })

  it('refuses notes that are not whole', async () => {
    await expect(
      claudeNotes(answering({ image: ['key'], notes: { mnemonic: notes.mnemonic } }), {
        target: 'x',
        native: 'y',
        targetLang: 'es-ES',
        nativeLang: 'en-GB',
      }),
    ).rejects.toThrow()
  })
})

describe('the live writer, as configured by the environment', () => {
  /** What Claude answers over HTTP: the JSON after a thinking block, as a model that thinks sends it. */
  const live = (value: unknown) =>
    vi.fn<typeof fetch>().mockImplementation(() =>
      Promise.resolve(
        Response.json({
          stop_reason: 'end_turn',
          content: [
            { type: 'thinking', thinking: '', signature: 'sig' },
            { type: 'text', text: JSON.stringify(value) },
          ],
          usage: { input_tokens: 900, output_tokens: 400 },
        }),
      ),
    )
  const sent = (send: ReturnType<typeof live>) => {
    const [url, init] = send.mock.calls[0]!
    return {
      url,
      headers: init!.headers as Record<string, string>,
      body: JSON.parse(init!.body as string) as Record<string, unknown>,
    }
  }

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('writes nothing without ANTHROPIC_API_KEY', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '  ')
    resetWriter()
    expect(writer()).toBeNull()
  })

  it('asks Claude Sonnet 5 at low effort for a structured deck, and reads it past the thinking', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test')
    vi.stubEnv('AI_MODEL_GENERATE', '')
    vi.stubEnv('AI_EFFORT_GENERATE', undefined)
    const send = live({
      phrases: [
        {
          target: 'Имате ли свободни стаи?',
          native: 'Есть свободные номера?',
          image: ['key'],
          notes,
        },
      ],
    })
    vi.stubGlobal('fetch', send)
    resetWriter()
    const phrases = await claudePhrases(
      writer()!,
      request('гостиница', { targetLang: 'bg-BG', nativeLang: 'ru-RU', count: 6 }),
    )
    expect(phrases.map((p) => p.target)).toEqual(['Имате ли свободни стаи?'])
    const { url, headers, body } = sent(send)
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    expect(headers).toMatchObject({ 'x-api-key': 'sk-ant-test', 'anthropic-version': '2023-06-01' })
    expect(body).toMatchObject({
      model: 'claude-sonnet-5',
      max_tokens: 16_000,
      stream: false,
      output_config: { effort: 'low', format: { type: 'json_schema' } },
    })
    expect(body).not.toHaveProperty('thinking')
    expect(body['system']).toContain(
      'Write up to 6 phrases in Bulgarian, each with its meaning in Russian.',
    )
    const user = (body['messages'] as { role: string; content: string }[])[0]!
    expect(JSON.parse(user.content)).toEqual({ mode: 'topic', input: 'гостиница', avoid: [] })
  })

  it('takes the model and effort from AI_MODEL_GENERATE and AI_EFFORT_GENERATE; an empty effort is left out', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test')
    vi.stubEnv('AI_MODEL_GENERATE', 'claude-haiku-4-5')
    vi.stubEnv('AI_EFFORT_GENERATE', '')
    const send = live({ image: ['key'], notes })
    vi.stubGlobal('fetch', send)
    resetWriter()
    await claudeNotes(writer()!, {
      target: 'La llave, por favor',
      native: 'The key, please',
      targetLang: 'es-ES',
      nativeLang: 'en-GB',
    })
    const { body } = sent(send)
    expect(body['model']).toBe('claude-haiku-4-5')
    expect(body['output_config']).not.toHaveProperty('effort')
  })

  it('fails, for the fallback to answer, when the key is refused or the model unknown', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-wrong')
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 401 })),
    )
    resetWriter()
    await expect(claudePhrases(writer()!, request('hotel'))).rejects.toMatchObject({
      code: 'configuration',
    })
  })
})
