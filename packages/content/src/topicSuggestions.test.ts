import { describe, expect, it } from 'vitest'
import { bundledTopicSuggestions } from './topicSuggestions.js'

describe('bundled topic suggestions', () => {
  it('returns pharmacy lines for the active pair and nothing for an unmatched topic', () => {
    const rows = bundledTopicSuggestions('pharmacy nearby', 'en', 'es-ES')
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((row) => row.source === 'generated')).toBe(true)
    expect(bundledTopicSuggestions('xyzzy', 'en', 'es-ES')).toEqual([])
  })

  it('does not silently substitute Spanish for a pair without a pack', () => {
    expect(bundledTopicSuggestions('haircut', 'en', 'es-ES').length).toBeGreaterThan(0)
    expect(bundledTopicSuggestions('haircut', 'bg', 'ru-RU')).toEqual([])
  })
})
