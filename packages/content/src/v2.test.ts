/** Plan 108: the languages the API serves are the ones the library's contracts accept. */
import { describe, expect, it } from 'vitest'
import { LIBRARY_COURSES, LIBRARY_LANGUAGES } from '@loro/core/api/library'
import { V2_COURSES, V2_LANGUAGES, V2_NATIVES } from './v2.js'

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
