import { describe, expect, it } from 'vitest'
import { globalSlot, retainGlobal } from './globalSlot'

describe('process-wide remount slots', () => {
  it('reuses a finished value and an in-flight open after the module is re-entered', async () => {
    const value = Symbol('value')
    const opening = Symbol('opening')
    let starts = 0
    const first = retainGlobal({ value, opening }, () => {
      starts += 1
      return Promise.resolve('live')
    })
    await expect(retainGlobal({ value, opening }, () => Promise.resolve('other'))).resolves.toBe(
      'live',
    )
    await expect(first).resolves.toBe('live')
    expect(starts).toBe(1)
    expect(globalSlot<string>(value).get()).toBe('live')
    globalSlot<string>(value).set(undefined)
  })

  it('allows a later open after a failed attempt', async () => {
    const value = Symbol('failed-value')
    const opening = Symbol('failed-opening')
    await expect(
      retainGlobal({ value, opening }, () => Promise.reject(new Error('interrupted'))),
    ).rejects.toThrow('interrupted')
    await expect(
      retainGlobal({ value, opening }, () => Promise.resolve('recovered')),
    ).resolves.toBe('recovered')
    globalSlot<string>(value).set(undefined)
  })
})
