import { describe, expect, it } from 'vitest'
import { CreateAlbumSchema, ProfileSchema, UpdateSetSchema } from './library.js'

describe('text other learners read', () => {
  it('keeps names, titles and descriptions free of links', () => {
    for (const title of [
      'Visit https://spam.example',
      'www.cheap-deals',
      'best prices at deals.com',
    ])
      expect(CreateAlbumSchema.safeParse({ title, targetLang: 'es-ES' }).success, title).toBe(false)
    expect(ProfileSchema.safeParse({ displayName: 'shop.xyz' }).success).toBe(false)
    expect(UpdateSetSchema.safeParse({ description: 'see http://x.io' }).success).toBe(false)
  })

  it('lets ordinary text through, dots and all', () => {
    expect(
      CreateAlbumSchema.safeParse({ title: 'Café & Mañanas', targetLang: 'es-ES' }).success,
    ).toBe(true)
    expect(ProfileSchema.safeParse({ displayName: 'Anna M.' }).success).toBe(true)
    expect(
      UpdateSetSchema.safeParse({ description: 'Mr. Smith orders at 9.30 a.m.' }).success,
    ).toBe(true)
    expect(UpdateSetSchema.safeParse({ description: null }).success).toBe(true)
    for (const description of ['Awww. So cute', 'Unit 3.Top phrases', 'Кафе.Ресторант.Бар'])
      expect(UpdateSetSchema.safeParse({ description }).success, description).toBe(true)
  })
})
