import { describe, expect, it } from 'vitest'
import { DESTINATIONS, placeForPath } from './navigation'

describe('built navigation destinations', () => {
  it('has unique destinations and resolves every visible hub', () => {
    expect(new Set(DESTINATIONS.map((destination) => destination.href)).size).toBe(
      DESTINATIONS.length,
    )
    for (const destination of DESTINATIONS) {
      expect(placeForPath(destination.href)).toBe(destination.label)
    }
    expect(
      DESTINATIONS.filter((destination) => destination.rail).map((destination) => destination.href),
    ).toEqual(['/practice/stream', '/add', '/progress'])
  })
  it('names contextual phrase pages without exposing onboarding or developer pages in the menu', () => {
    expect(placeForPath('/phrase/missing')).toBe('Phrase')
    for (const path of ['/onboarding', '/dev/tokens', '/settings', '/chat', '/unknown']) {
      expect(placeForPath(path)).toBeUndefined()
    }
  })
})
