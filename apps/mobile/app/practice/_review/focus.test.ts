import { describe, expect, it } from 'vitest'
import { reviewFocus } from './focus'

describe('reviewFocus', () => {
  it('uses the real tag, never an invented focus', () => {
    expect(reviewFocus(['pron'])).toBe('pronunciation')
    expect(reviewFocus(['remember'])).toBe('remember')
    expect(reviewFocus(['useful'])).toBe('useful')
    expect(reviewFocus([])).toBe('recall')
    expect(reviewFocus(['words'])).toBe('recall')
  })
})
