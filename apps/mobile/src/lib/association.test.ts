import { describe, expect, it, vi } from 'vitest'
import {
  catalogAssociationFlags,
  highestOwnedCefr,
  orderAssociatedIds,
  ownedCountsByTheme,
} from './association'

vi.mock('./core', () => ({
  coreCall: vi.fn(),
}))

import { coreCall } from './core'

const mockedCall = vi.mocked(coreCall)

describe('Discover association adapter', () => {
  it('reads respIpa, syl, teaching hint and cloud audio', () => {
    expect(
      catalogAssociationFlags({
        audio: { uri: 'https://cdn.loro.test/din2.m4a' },
        respIpa: '/ke me rekoˈmjenda/',
        syl: [{ t: 'qué' }],
        teaching: { en: { hint: 'ask the waiter' } },
      }),
    ).toEqual({
      hasAudio: true,
      hasRespIpa: true,
      hasSyl: true,
      hasHint: true,
    })
    expect(
      catalogAssociationFlags({
        hint: '"Perdido" shares a root with "lost / perish."',
      }),
    ).toEqual({
      hasAudio: false,
      hasRespIpa: false,
      hasSyl: false,
      hasHint: true,
    })
    expect(catalogAssociationFlags({ audio: { uri: 'file:///tmp/din2.m4a' } })).toEqual({
      hasAudio: false,
      hasRespIpa: false,
      hasSyl: false,
      hasHint: false,
    })
    expect(catalogAssociationFlags({})).toEqual({
      hasAudio: false,
      hasRespIpa: false,
      hasSyl: false,
      hasHint: false,
    })
  })

  it('counts owned rows once per theme', () => {
    const counts = ownedCountsByTheme(
      [
        { phraseId: 'din1', ownTheme: undefined },
        { phraseId: null, ownTheme: 'Dining' },
        { phraseId: 'cafe1', ownTheme: undefined },
      ] as never,
      [
        { id: 'din1', theme: 'Dining' },
        { id: 'cafe1', theme: 'Café' },
      ],
    )
    expect(counts.get('Dining')).toBe(2)
    expect(counts.get('Café')).toBe(1)
  })

  it('tracks the highest owned CEFR', () => {
    expect(
      highestOwnedCefr([{ phraseId: 'din1' }, { phraseId: 'din3' }] as never, [
        { id: 'din1', cefr: 'A1' },
        { id: 'din3', cefr: 'A2' },
      ]),
    ).toBe('A2')
  })

  it('fails closed when the core throws or returns a bad payload', () => {
    mockedCall.mockImplementation(() => {
      throw new Error('InvalidInput')
    })
    expect(orderAssociatedIds({ anchor: { id: '' } })).toEqual([])
    mockedCall.mockReturnValue('not-an-array')
    expect(orderAssociatedIds({})).toEqual([])
    mockedCall.mockReturnValue(['din2', 'din4'])
    expect(orderAssociatedIds({})).toEqual(['din2', 'din4'])
  })
})
