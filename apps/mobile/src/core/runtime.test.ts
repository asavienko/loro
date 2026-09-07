import { describe, expect, it } from 'vitest'
import { jsonRuntime } from './runtime'

describe('canonical transport', () => {
  it('round-trips requests and propagates Rust failures', () => {
    const core = jsonRuntime((request) => {
      expect(JSON.parse(request)).toEqual({ op: 'normalize', text: 'ñ' })
      return '{"ok":"ñ"}'
    })
    expect(core.coreCall({ op: 'normalize', text: 'ñ' })).toBe('ñ')
    expect(() => jsonRuntime(() => '{"error":"invalid state"}').coreCall({})).toThrow(
      'invalid state',
    )
  })
  it('fails closed for malformed responses', () => {
    expect(() => jsonRuntime(() => '{}').coreCall({})).toThrow('Invalid canonical core response')
  })
})
