import { describe, expect, it } from 'vitest'
import { canonicalJson } from './canonical-json.js'

describe('canonicalJson', () => {
  it('orders object keys and keeps array order', () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe('{"a":{"c":3,"d":2},"b":1}')
    expect(canonicalJson([2, { z: 1, a: 0 }])).toBe('[2,{"a":0,"z":1}]')
    expect(canonicalJson(null)).toBe('null')
  })
})
