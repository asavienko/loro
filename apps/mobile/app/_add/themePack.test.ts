import { describe, expect, it } from 'vitest'
import { themePackProgress } from './themePack'

describe('themePackProgress', () => {
  it('derives owned and percent from remaining vs catalog total', () => {
    expect(themePackProgress(4, 16)).toEqual({
      remaining: 4,
      total: 16,
      owned: 12,
      percent: 75,
      complete: false,
    })
    expect(themePackProgress(2, 4)).toEqual({
      remaining: 2,
      total: 4,
      owned: 2,
      percent: 50,
      complete: false,
    })
  })

  it('treats nothing left as complete, including an empty catalog theme', () => {
    expect(themePackProgress(0, 12)).toMatchObject({ owned: 12, percent: 100, complete: true })
    expect(themePackProgress(0, 0)).toMatchObject({ owned: 0, percent: 100, complete: true })
  })

  it('clamps a leftover count that cannot exceed the catalog', () => {
    expect(themePackProgress(9, 4)).toEqual({
      remaining: 4,
      total: 4,
      owned: 0,
      percent: 0,
      complete: false,
    })
    expect(themePackProgress(-1, 4)).toEqual({
      remaining: 0,
      total: 4,
      owned: 4,
      percent: 100,
      complete: true,
    })
  })
})
