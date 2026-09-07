import { describe, expect, it } from 'vitest'
import { userPhraseId, type Clock } from '@loro/core'
import { createEngineContext } from './engines'
import { fakeCore } from '@loro/core/testing'
import { createAppStore } from './store'

const fixedClock: Clock = {
  now: () => 1_700_000_000_000,
  localDay: () => '2023-11-14',
  streakDay: () => '2023-11-14',
}

describe('createEngineContext', () => {
  it('assembles only the supplied store and engine dependencies', async () => {
    const store = createAppStore({
      core: fakeCore(),
      clock: fixedClock,
      newId: () => userPhraseId('test-row'),
    })
    store.setState({ dailyMinutes: 20 })

    const core = fakeCore()
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
      core,
    )

    expect(context.clock).toBe(fixedClock)
    expect(context.core).toBe(core)
    expect(context.flags).toBe(flags)
    expect(context.settings).toEqual({ dailyMinutes: 20, waveTimes: ['07:00'], repTarget: 9 })
    expect(context.seed).toBe(123)
    expect(await context.phrases.all()).toBe(store.getState().phrases)
  })
})
