import { describe, expect, it } from 'vitest'
import {
  CreateAlbumSchema,
  GenerateCoverSchema,
  ProfileSchema,
  UpdateSetSchema,
  WearCoverSchema,
} from './library.js'

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

describe('a cover request', () => {
  it('goes on an item, or is for a titled set or album', () => {
    const ok = (body: unknown) => GenerateCoverSchema.safeParse(body).success
    expect(ok({ kind: 'set', title: 'Hotel' })).toBe(true)
    expect(ok({ kind: 'album', attachTo: 'album-loro-es' })).toBe(true)
    expect(ok({ kind: 'phrase', attachTo: 'cafe-01', nativeLang: 'ru-RU' })).toBe(true)
    // Nothing to draw it for, or a phrase's or song's cover with nowhere to go.
    expect(ok({ kind: 'set' })).toBe(false)
    expect(ok({ kind: 'song', title: 'A song' })).toBe(false)
    expect(ok({ kind: 'word', attachTo: 'cafe-01' })).toBe(false)
  })

  it('may say, in the learner’s words, what to picture', () => {
    const ok = (body: unknown) => GenerateCoverSchema.safeParse(body).success
    expect(ok({ kind: 'set', attachTo: 'set-u-1a2b3c', prompt: 'A red bicycle by the sea' })).toBe(
      true,
    )
    expect(ok({ kind: 'set', attachTo: 'set-u-1a2b3c', prompt: '   ' })).toBe(false)
    expect(ok({ kind: 'set', attachTo: 'set-u-1a2b3c', prompt: 'x'.repeat(201) })).toBe(false)
    expect(ok({ kind: 'set', attachTo: 'set-u-1a2b3c', prompt: 'see www.cheap-deals' })).toBe(false)
  })

  it('puts an earlier cover back on an item', () => {
    const ok = (body: unknown) => WearCoverSchema.safeParse(body).success
    expect(ok({ kind: 'phrase', attachTo: 'cafe-01' })).toBe(true)
    expect(ok({ kind: 'phrase' })).toBe(false)
    expect(ok({ kind: 'set', attachTo: 'set-u-1a2b3c', prompt: 'more' })).toBe(false)
  })
})
