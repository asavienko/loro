import { describe, expect, it } from 'vitest'
import { bundledTopicSuggestions } from './topicSuggestions.js'

describe('bundled topic suggestions', () => {
  it('returns pharmacy lines for the active pair and nothing for an unmatched topic', () => {
    const rows = bundledTopicSuggestions('pharmacy nearby', 'en', 'es-ES')
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((row) => row.source === 'generated')).toBe(true)
    expect(rows.map((row) => row.translation)).toEqual([
      'Where is the all-night pharmacy?',
      'Do you have something for a headache?',
      'I need this medicine.',
    ])
    expect(
      bundledTopicSuggestions('pharmacy nearby', 'bg', 'es-ES').map((row) => row.translation),
    ).toEqual([
      'Къде е дежурната аптека?',
      'Имате ли нещо против главоболие?',
      'Имам нужда от това лекарство.',
    ])
    expect(bundledTopicSuggestions('xyzzy', 'en', 'es-ES')).toEqual([])
  })

  it('does not silently substitute Spanish for a pair without a pack', () => {
    expect(bundledTopicSuggestions('haircut', 'en', 'es-ES').length).toBeGreaterThan(0)
    expect(bundledTopicSuggestions('haircut', 'bg', 'ru-RU')).toEqual([])
  })

  it('matches topic keywords as tokens, not substrings', () => {
    expect(bundledTopicSuggestions('chair', 'en', 'es-ES')).toEqual([])
    expect(bundledTopicSuggestions('wheelchair', 'en', 'es-ES')).toEqual([])
    expect(bundledTopicSuggestions('hair', 'en', 'es-ES').length).toBeGreaterThan(0)
  })
})
