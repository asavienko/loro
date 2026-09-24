import { describe, expect, it, vi } from 'vitest'
import { haptics } from './haptics'

vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
  Vibration: { vibrate: vi.fn() },
}))

describe('haptics', () => {
  it('exposes named select, confirm and reorder events that stay silent on web', () => {
    expect(() => {
      haptics.select()
      haptics.confirm()
      haptics.reorder()
    }).not.toThrow()
  })
})
