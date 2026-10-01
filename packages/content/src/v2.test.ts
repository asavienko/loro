/** Plan 108: the languages the API serves are the ones the library's contracts accept. */
import { describe, expect, it } from 'vitest'
import { LIBRARY_COURSES, LIBRARY_LANGUAGES } from '@loro/core/api/library'
import { V2_CONTENT, V2_COURSES, V2_LANGUAGES, V2_NATIVES } from './v2.js'

describe('the languages the app offers', () => {
  it('are the library’s languages, its courses those a course can teach', () => {
    expect(V2_LANGUAGES.map((l) => l.code)).toEqual([...LIBRARY_LANGUAGES])
    expect(V2_COURSES).toEqual([...LIBRARY_COURSES])
  })

  it('are spoken by the app where it has an interface in them', () => {
    expect(V2_NATIVES).toEqual(['en-GB', 'en-US', 'bg-BG', 'ru-RU', 'pl-PL', 'cs-CZ'])
    for (const language of V2_LANGUAGES) {
      expect(language.flag.length).toBeGreaterThan(0)
      expect([null, 'en', 'bg', 'ru', 'pl', 'cs']).toContain(language.uiLocale)
      if (language.uiLocale) expect(language.code.startsWith(language.uiLocale)).toBe(true)
    }
  })
})

describe('the content’s ids', () => {
  // Phrases, sets, topics, bank themes and bank phrases share the API's library and the learner's
  // log, so an id names one item only: never two of a kind, nor a phrase and a bank phrase alike.
  const items: [string, string][] = [
    ...V2_CONTENT.phrases.map((p): [string, string] => [p.id, 'phrase']),
    ...V2_CONTENT.sets.map((s): [string, string] => [s.id, 'set']),
    ...V2_CONTENT.topics.map((t): [string, string] => [t.id, 'topic']),
    ...V2_CONTENT.bank.themes.map((t): [string, string] => [t.id, 'bank theme']),
    ...V2_CONTENT.bank.phrases.map((p): [string, string] => [p.id, 'bank phrase']),
  ]

  it('are every one unique', () => {
    const seen = new Map<string, string>()
    const twice: string[] = []
    for (const [id, kind] of items) {
      const first = seen.get(id)
      if (first) twice.push(`${id} (${first} and ${kind})`)
      else seen.set(id, kind)
    }
    expect(twice).toEqual([])
  })

  it('are what every note translation and set belongs to', () => {
    const phrases = new Set(V2_CONTENT.phrases.map((p) => p.id))
    const bank = new Set(V2_CONTENT.bank.phrases.map((p) => p.id))
    const owner = (key: string) => key.slice(0, key.lastIndexOf('.'))
    expect(Object.keys(V2_CONTENT.noteTranslations).filter((k) => !phrases.has(owner(k)))).toEqual(
      [],
    )
    expect(Object.keys(V2_CONTENT.bankNoteTranslations).filter((k) => !bank.has(owner(k)))).toEqual(
      [],
    )
    expect(V2_CONTENT.sets.flatMap((s) => s.phraseIds).filter((id) => !phrases.has(id))).toEqual([])
  })
})
