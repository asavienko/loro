import { describe, expect, it } from 'vitest'
import { nonempty, stageNoteFields } from './stageNotes'

describe('stageNoteFields', () => {
  it('splits hint to mnemonic and note to grammar, inventing nothing', () => {
    expect(
      stageNoteFields({
        note: null,
        catalog: {
          hint: 'break-fast',
          note: "Watch the soft 'd' in cortado.",
          resp: '[me ˈpo.ne]',
        },
      }),
    ).toEqual({
      mnemonic: 'break-fast',
      grammar: "Watch the soft 'd' in cortado.",
      phonetics: '[me ˈpo.ne]',
    })
  })

  it('does not fold note into mnemonic when hint is empty', () => {
    expect(
      stageNoteFields({
        note: null,
        catalog: { note: "Watch the soft 'd' in cortado." },
      }),
    ).toEqual({
      mnemonic: undefined,
      grammar: "Watch the soft 'd' in cortado.",
      phonetics: undefined,
    })
  })

  it('uses the learner note only when the catalog has none', () => {
    expect(
      stageNoteFields({
        note: 'my own reminder',
        catalog: { hint: 'shared root' },
      }),
    ).toEqual({
      mnemonic: 'shared root',
      grammar: 'my own reminder',
      phonetics: undefined,
    })
  })

  it('prefers the catalog teaching note over the learner note', () => {
    expect(
      stageNoteFields({
        note: 'my own reminder',
        catalog: { note: 'authored coaching' },
      }).grammar,
    ).toBe('authored coaching')
  })

  it('treats blank strings as missing', () => {
    expect(nonempty('')).toBeUndefined()
    expect(nonempty('   ')).toBe('   ')
    expect(
      stageNoteFields({
        note: '',
        catalog: { hint: '', note: '', resp: '', respIpa: 'ipa' },
      }),
    ).toEqual({
      mnemonic: undefined,
      grammar: undefined,
      phonetics: 'ipa',
    })
  })
})
