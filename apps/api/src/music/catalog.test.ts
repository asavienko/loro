import { describe, expect, it } from 'vitest'
import { resolveMusicCatalogPhrases } from './catalog.js'

describe('music catalog resolution (p3f-04)', () => {
  it('returns selected phrases plus the full catalog without undefined deprecatedBy', () => {
    const { phrases, catalog } = resolveMusicCatalogPhrases(
      ['cafe1', 'cafe2', 'cafe3'],
      'es-ES',
      'en',
    )
    expect(phrases.map((phrase) => phrase.id)).toEqual(['cafe1', 'cafe2', 'cafe3'])
    expect(catalog.length).toBeGreaterThan(phrases.length)
    for (const line of catalog) {
      if ('deprecatedBy' in line) {
        expect(typeof line.deprecatedBy).toBe('string')
      }
    }
  })
})
