import { describe, expect, it } from 'vitest'
import { BoundedMap } from './bounded-map.js'

describe('BoundedMap', () => {
  it('evicts the oldest key when the cap is exceeded', () => {
    const map = new BoundedMap<number>(2)
    map.set('a', 1)
    map.set('b', 2)
    map.set('c', 3)
    expect(map.get('a')).toBeUndefined()
    expect(map.get('b')).toBe(2)
    expect(map.get('c')).toBe(3)
    expect(map.size).toBe(2)
  })
})
