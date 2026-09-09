import { describe, expect, it } from 'vitest'
import {
  DESTINATIONS,
  destinationsForGroup,
  NAVIGATION_GROUPS,
  SURFACES,
  builtSurfaceForPath,
  conditionalHome,
  placeForPath,
  resolveDeepLink,
} from './navigation'

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

  it('gives every built destination one route policy for More and the switcher', () => {
    expect(
      new Set(
        NAVIGATION_GROUPS.flatMap(destinationsForGroup).map((destination) => destination.href),
      ),
    ).toEqual(
      new Set(
        DESTINATIONS.filter(({ href }) => href !== '/' && href !== '/more').map(({ href }) => href),
      ),
    )
    for (const destination of DESTINATIONS) {
      expect(destination.parent).toBe('today')
      expect(destination.home).toBe('today')
      expect(destination.exit).toBe(destination.href === '/' ? 'none' : 'stack-or-home')
      expect(['learner', 'utility']).toContain(destination.routeClass)
    }
  })
  it('names contextual phrase pages without exposing onboarding or developer pages in the menu', () => {
    expect(placeForPath('/phrase/missing')).toBe('Phrase')
    for (const path of ['/onboarding', '/dev/tokens', '/chat', '/unknown']) {
      expect(placeForPath(path)).toBeUndefined()
    }
  })
})

describe('surface registry and deep-link guard', () => {
  it('declares each authored learner screen once and never marks a missing screen built', () => {
    const learnerSurfaces = SURFACES.filter((surface) => surface.kind === 'learner')
    expect(learnerSurfaces).toHaveLength(23)
    expect(new Set(SURFACES.map((surface) => surface.id)).size).toBe(SURFACES.length)
    expect(new Set(SURFACES.map((surface) => surface.path)).size).toBe(SURFACES.length)
    expect(
      SURFACES.filter((surface) => surface.availability === 'built').map((surface) => surface.id),
    ).toEqual([
      'onboarding',
      'add',
      'phrase-detail',
      'stream',
      'speak',
      'today',
      'refrain',
      'progress',
      'languages',
      'account',
      'settings',
      'more',
      'listen-export',
    ])
  })

  it('only resolves declared, built app-relative routes', () => {
    expect(builtSurfaceForPath('/phrase/cafe-please')?.id).toBe('phrase-detail')
    expect(builtSurfaceForPath('/phrase/cafe-please?from=notification')?.id).toBe('phrase-detail')
    expect(builtSurfaceForPath('/practice/review')).toBeUndefined()
    expect(builtSurfaceForPath('https://loro.test/add')).toBeUndefined()
    expect(builtSurfaceForPath('//loro.test/add')).toBeUndefined()
  })

  it('keeps unknown, planned and malformed links behind first-run', () => {
    expect(conditionalHome(false)).toBe('/onboarding')
    expect(conditionalHome(true)).toBe('/')
    expect(resolveDeepLink('/practice/stream', true)).toMatchObject({
      kind: 'built',
      path: '/practice/stream',
      surface: { id: 'stream' },
    })
    expect(resolveDeepLink('/practice/stream', false)).toEqual({
      kind: 'fallback',
      path: '/onboarding',
      reason: 'unknown',
    })
    expect(resolveDeepLink('/practice/review', true)).toEqual({
      kind: 'fallback',
      path: '/',
      reason: 'planned',
    })
    expect(resolveDeepLink('/does-not-exist', false)).toEqual({
      kind: 'fallback',
      path: '/onboarding',
      reason: 'unknown',
    })
    expect(resolveDeepLink('https://untrusted.example/add', true)).toEqual({
      kind: 'fallback',
      path: '/',
      reason: 'malformed',
    })
  })
})
