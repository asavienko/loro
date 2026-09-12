import { describe, expect, it } from 'vitest'
import { type } from './theme'

describe('type scale', () => {
  it('maps DESIGN.md body-md onto a 16 / 400 / 24 DM Sans step', () => {
    expect(type.bodyMd).toMatchObject({
      fontFamily: 'DM Sans',
      fontSize: 16,
      fontWeight: '400',
      lineHeight: 24,
    })
  })

  it('keeps label-lg CTAs on body and body-sm helpers on caption', () => {
    expect(type.body).toMatchObject({ fontSize: 14, fontWeight: '600' })
    expect(type.caption).toMatchObject({ fontSize: 14, fontWeight: '400' })
    expect(type.prose).toMatchObject({ fontFamily: 'Newsreader', fontSize: 19 })
    expect(type.title3).toMatchObject({ fontFamily: 'Newsreader', fontSize: 20, fontWeight: '600' })
  })
})
