import { describe, expect, it } from 'vitest'
import { makePhrase } from '@loro/core/testing'
import { userPhraseId, type Clock } from '@loro/core'
import { createEngineContext } from './engines'
import { jsCoreFacade } from './coreFacade'
import { createAppStore } from './store'

const fixedClock: Clock = {
  now: () => 1_700_000_000_000,
  localDay: () => '2023-11-14',
  streakDay: () => '2023-11-14',
}

describe('createEngineContext', () => {
  it('keeps the origin course snapshot while asynchronous practice finishes', async () => {
    const store = createAppStore({ clock: fixedClock, newId: () => userPhraseId('test-row') })
    const original = makePhrase('origin')
    store.setState({ phrases: [original], targetLocale: 'es-ES' })
    const context = createEngineContext(
      store,
      {
        clock: fixedClock,
        waveTimes: [],
        repTarget: 6,
        trip: null,
        flags: { bool: (_key, fallback) => fallback, number: (_key, fallback) => fallback },
        seed: 1,
      },
      jsCoreFacade,
    )
    store.setState({ phrases: [makePhrase('other-course')], targetLocale: 'bg-BG' })
    expect(await context.phrases.byId(original.id)).toBe(original)
    expect(await context.phrases.all()).toEqual([original])
  })

  it('assembles only the supplied store and engine dependencies', async () => {
    const store = createAppStore({ clock: fixedClock, newId: () => userPhraseId('test-row') })
    store.setState({ dailyMinutes: 20 })

    const flags = { bool: (_key: string, fallback: boolean) => fallback, number: () => 17 }
    const context = createEngineContext(
      store,
      {
        clock: fixedClock,
        waveTimes: ['07:00'],
        repTarget: 9,
        trip: null,
        flags,
        seed: 123,
      },
      jsCoreFacade,
    )

    expect(context.clock).toBe(fixedClock)
    expect(context.core).toBe(jsCoreFacade)
    expect(context.flags).toBe(flags)
    expect(context.settings).toEqual({ dailyMinutes: 20, waveTimes: ['07:00'], repTarget: 9 })
    expect(context.seed).toBe(123)
    expect(await context.phrases.all()).toBe(store.getState().phrases)
  })

  it('lets a targeted Refrain plan override the frozen day set', () => {
    const store = createAppStore({ clock: fixedClock, newId: () => userPhraseId('test-row') })
    store.setState({
      refrainDay: '2023-11-14',
      refrainSet: ['wave-a', 'wave-b'],
    })
    const context = createEngineContext(
      store,
      {
        clock: fixedClock,
        waveTimes: [],
        repTarget: 6,
        trip: null,
        flags: { bool: (_key, fallback) => fallback, number: (_key, fallback) => fallback },
        seed: 1,
      },
      jsCoreFacade,
      { refrainSet: [userPhraseId('hard-only')] },
    )
    expect(context.refrainSet).toEqual([userPhraseId('hard-only')])
  })
})
