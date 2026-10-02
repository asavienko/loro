/** Plan 112: the course writer's shards, compiled for the seed. */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { compileCourses } from './courses.js'
import { contentRoot } from './fs.js'
import { V2_CONTENT, V2_ICON_NAMES, V2_NATIVES } from './v2.js'

const v2 = join(contentRoot, 'v2')

describe('v2/courses.compiled.json', () => {
  it('is what build:courses compiles from the shards (run it after author:run)', () => {
    const committed = JSON.parse(readFileSync(join(v2, 'courses.compiled.json'), 'utf8')) as unknown
    expect(committed).toEqual(compileCourses(v2, V2_NATIVES))
  })

  it('publishes sets whose topics, icons and phrases the app knows, under ids of their own', () => {
    const { sets, phrases } = V2_CONTENT.written
    const topics = new Set(V2_CONTENT.topics.map((t) => t.id))
    const icons = new Set(V2_ICON_NAMES)
    const taken = new Set([
      ...V2_CONTENT.sets.map((s) => s.id),
      ...V2_CONTENT.phrases.map((p) => p.id),
      ...V2_CONTENT.bank.phrases.map((p) => p.id),
    ])
    const ids = [...sets.map((s) => s.id), ...phrases.map((p) => p.id)]
    expect(ids.filter((id) => taken.has(id))).toEqual([])
    expect(new Set(ids).size).toBe(ids.length)
    for (const set of sets) {
      expect(topics.has(set.topicId), `${set.id} topic ${set.topicId}`).toBe(true)
      expect(icons.has(set.coverIcon), `${set.id} icon ${set.coverIcon}`).toBe(true)
    }
    expect(sets.flatMap((s) => s.phraseIds).sort()).toEqual(phrases.map((p) => p.id).sort())
    for (const phrase of phrases)
      for (const icon of phrase.image) expect(icons.has(icon), `${phrase.id} ${icon}`).toBe(true)
  })
})

describe('compileCourses', () => {
  let root: string
  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  /** One Polish set of one phrase, in English, with whichever interface languages are given. */
  function shards(langs: Record<string, { subtitle: string; line: string; gloss: string }>) {
    root = mkdtempSync(join(tmpdir(), 'loro-courses-'))
    const dir = join(root, 'courses', 'pl', 'A1')
    mkdirSync(dir, { recursive: true })
    const set = {
      id: 'set-pl-a1-x',
      title: 'Kawa',
      subtitle: { en: 'Coffee.' },
      topicId: 'eating-out',
      situation: 'x',
      level: 'A1',
      coverIcon: 'coffee',
      targetLang: 'pl-PL',
      phraseIds: ['pl-x1'],
      grammarFocus: [],
      provenance: {},
    }
    writeFileSync(join(dir, 'eating-out.sets.json'), JSON.stringify([set]))
    const phrase = {
      id: 'pl-x1',
      target: 'Kawa, poproszę.',
      translations: { 'en-GB': 'A coffee, please.', 'en-US': 'A coffee, please.' },
      register: 'neutral',
      region: 'PL',
      tags: ['request'],
      image: ['coffee'],
      words: { kawa: { 'en-GB': 'coffee', 'en-US': 'coffee' } },
      grammar: [],
      functions: [],
      uses: [],
    }
    writeFileSync(join(dir, 'eating-out.phrases.jsonl'), `${JSON.stringify(phrase)}\n`)
    for (const [lang, t] of Object.entries(langs))
      writeFileSync(
        join(dir, `eating-out.${lang}.jsonl`),
        [
          { kind: 'set', id: set.id, subtitle: t.subtitle },
          { kind: 'phrase', id: 'pl-x1', translation: t.line, words: { kawa: t.gloss } },
        ]
          .map((l) => JSON.stringify(l))
          .join('\n'),
      )
  }

  const russian = { subtitle: 'Кофе.', line: 'Кофе, пожалуйста.', gloss: 'кофе' }
  const bulgarian = { subtitle: 'Кафе.', line: 'Кафе, моля.', gloss: 'кафе' }
  const czech = { subtitle: 'Káva.', line: 'Kávu, prosím.', gloss: 'káva' }

  it('holds a set missing an interface language, naming what it lacks', () => {
    shards({ ru: russian })
    const compiled = compileCourses(root, V2_NATIVES)
    expect(compiled.sets).toEqual([])
    expect(compiled.held).toEqual([{ id: 'set-pl-a1-x', reason: 'missing bg-BG, cs-CZ' }])
  })

  it('holds a set whose language file lacks a gloss', () => {
    shards({ ru: russian, bg: bulgarian, cs: { ...czech, gloss: '' } })
    expect(compileCourses(root, V2_NATIVES).held).toEqual([
      { id: 'set-pl-a1-x', reason: 'missing cs-CZ' },
    ])
  })

  it('publishes a complete set with every language merged, the course’s own needed by none', () => {
    shards({ ru: russian, bg: bulgarian, cs: czech })
    const compiled = compileCourses(root, V2_NATIVES)
    expect(compiled.held).toEqual([])
    expect(compiled.sets).toEqual([
      {
        id: 'set-pl-a1-x',
        title: 'Kawa',
        subtitle: { en: 'Coffee.', bg: 'Кафе.', ru: 'Кофе.', cs: 'Káva.' },
        topicId: 'eating-out',
        level: 'A1',
        coverIcon: 'coffee',
        targetLang: 'pl-PL',
        phraseIds: ['pl-x1'],
      },
    ])
    expect(compiled.phrases).toEqual([
      {
        id: 'pl-x1',
        target: 'Kawa, poproszę.',
        translations: {
          'en-GB': 'A coffee, please.',
          'en-US': 'A coffee, please.',
          'bg-BG': 'Кафе, моля.',
          'ru-RU': 'Кофе, пожалуйста.',
          'cs-CZ': 'Kávu, prosím.',
        },
        register: 'neutral',
        region: 'PL',
        tags: ['request'],
        image: ['coffee'],
        words: {
          kawa: {
            'en-GB': 'coffee',
            'en-US': 'coffee',
            'bg-BG': 'кафе',
            'ru-RU': 'кофе',
            'cs-CZ': 'káva',
          },
        },
      },
    ])
    expect(compiled.version).toMatch(/^[0-9a-f]{12}$/)
  })
})
