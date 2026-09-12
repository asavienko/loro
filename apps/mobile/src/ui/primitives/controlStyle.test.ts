/**
 * The pixel-fidelity test for the refactor that introduced `Chip` and `Segmented`.
 *
 * Each expectation below is the style object a SCREEN used to hold inline, transcribed from
 * the source it was lifted from and cited by line. The point is not that the resolver agrees
 * with itself — it is that seven hand-rolled controls survived being replaced by two
 * components without a single value moving. If a future tidy-up rounds an 11 to a 12 or swaps
 * `line.strong` for `line.default`, this fails and names the screen that regressed.
 *
 * Colours are asserted as TOKENS, deliberately: which token a state uses is the accessibility
 * decision (`accent.tint` for the wash and `accentInk` for the text on it), and the generated
 * palette is drift-checked by its own package.
 */

import { accents } from '@loro/design-tokens'
import { describe, expect, it } from 'vitest'
import {
  MIN_TAP,
  accent,
  border,
  difficultyCard,
  field,
  ink,
  line,
  listRow,
  onDark,
  phraseRow,
  pillSize,
  radius,
  semantic,
  space,
  type,
  statRow,
  surface,
} from '../theme'
import {
  chipLook,
  fieldA11y,
  fieldFace,
  fieldLook,
  listRowLook,
  segmentLook,
  segmentedTrackStyle,
} from './controlStyle'

describe('chipLook · the tag toggle (app/add.tsx:473-483, app/phrase/[id].tsx:205-212)', () => {
  // `flexDirection`, `alignItems` and `gap` are the shared chip shape. `add.tsx` set all
  // three; phrase detail set none of them, and with a single Text child they are no-ops —
  // the container hugs the label either way.
  const shape = { flexDirection: 'row', alignItems: 'center', gap: 6 } as const
  const metrics = { paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.pill } as const

  it('uses the runtime accent supplied by the theme provider seam', () => {
    const themed = chipLook('tag', 'tint', true, accents.berry)
    expect(themed.container).toMatchObject({
      backgroundColor: accents.berry.tint,
      borderColor: accents.berry.accent,
    })
    expect(themed.textColor).toBe(accents.berry.accentInk)
  })

  it('idle', () => {
    expect(chipLook('tag', 'tint', false)).toEqual({
      container: {
        ...shape,
        ...metrics,
        backgroundColor: surface.card,
        borderWidth: 1,
        borderColor: line.strong,
      },
      textColor: ink.ink2,
      textVariant: 'captionSm',
    })
  })

  it('selected — the accent wash, a heavier border, and accentInk for the text', () => {
    expect(chipLook('tag', 'tint', true)).toEqual({
      container: {
        ...shape,
        ...metrics,
        backgroundColor: accent.tint,
        borderWidth: 1.5,
        borderColor: accent.accent,
      },
      textColor: accent.accentInk,
      textVariant: 'captionSm',
    })
  })
})

describe('chipLook · the scenario strip (app/add.tsx:209-219)', () => {
  const shape = { flexDirection: 'row', alignItems: 'center', gap: 5 } as const
  const metrics = { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill } as const

  it('idle — note line.default, one step lighter than the tag chip', () => {
    expect(chipLook('scenario', 'solid', false)).toEqual({
      container: {
        ...shape,
        ...metrics,
        backgroundColor: surface.sunken,
        borderWidth: 1,
        borderColor: line.default,
      },
      textColor: ink.ink2,
      textVariant: 'captionSm',
    })
  })

  it('selected — inverse fill, no border, white text', () => {
    expect(chipLook('scenario', 'solid', true)).toEqual({
      container: {
        ...shape,
        ...metrics,
        backgroundColor: surface.dark,
        borderWidth: 0,
        borderColor: line.default,
      },
      textColor: onDark.primary,
      textVariant: 'captionSm',
    })
  })
})

describe('chipLook · sage verified / recommended (semantic.success)', () => {
  const shape = { flexDirection: 'row', alignItems: 'center', gap: 6 } as const
  const metrics = { paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.pill } as const

  it('selected uses the success wash and successAlt ink — no new hex', () => {
    expect(chipLook('tag', 'sage', true)).toEqual({
      container: {
        ...shape,
        ...metrics,
        backgroundColor: semantic.success.bg,
        borderWidth: 0,
        borderColor: line.strong,
      },
      textColor: semantic.successAlt.text,
      textVariant: 'captionSm',
    })
  })

  it('idle sage keeps the same card rest as tint', () => {
    expect(chipLook('tag', 'sage', false)).toEqual(chipLook('tag', 'tint', false))
  })
})

describe('chipLook · the love toggle (app/practice/stream.tsx:209-216)', () => {
  const shape = { flexDirection: 'row', alignItems: 'center', gap: 6 } as const
  const metrics = { paddingHorizontal: 11, paddingVertical: 8, borderRadius: radius.pill } as const

  it('carries the heavier border in BOTH states, so toggling cannot reflow the row', () => {
    expect(chipLook('toggle', 'tint', false).container).toEqual({
      ...shape,
      ...metrics,
      backgroundColor: surface.card,
      borderWidth: 1.5,
      borderColor: line.strong,
    })
    expect(chipLook('toggle', 'tint', true).container).toEqual({
      ...shape,
      ...metrics,
      backgroundColor: accent.tint,
      borderWidth: 1.5,
      borderColor: accent.accent,
    })
  })

  it('uses ink3 and labelSm for the idle label', () => {
    expect(chipLook('toggle', 'tint', false).textColor).toBe(ink.ink3)
    expect(chipLook('toggle', 'tint', false).textVariant).toBe('labelSm')
    expect(chipLook('toggle', 'tint', true).textColor).toBe(accent.accentInk)
  })
})

describe('segmented · Add mode pills (v1.2 discover / browse / import)', () => {
  it('is an enclosed stationery groove with a 4 px inset', () => {
    expect(segmentedTrackStyle('pill')).toEqual({
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'stretch',
      gap: 0,
      backgroundColor: surface.track,
      borderRadius: radius.pill,
      padding: 4,
    })
  })

  it('selected lifts to the desk with terracotta type; idle is espresso at rest', () => {
    expect(segmentLook('pill', false)).toEqual({
      container: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 8,
        borderRadius: radius.pill,
        backgroundColor: 'transparent',
      },
      textColor: ink.ink2,
      textVariant: 'captionSm',
    })
    expect(segmentLook('pill', true).container).toEqual({
      flex: 1,
      alignItems: 'center',
      paddingVertical: 8,
      borderRadius: radius.pill,
      backgroundColor: surface.app,
      boxShadow: expect.stringContaining('0 2px 8px'),
    })
    expect(segmentLook('pill', true).textColor).toBe(accent.accentInk)
  })
})

describe('segmented · the sunken track (v1.2 stationery groove)', () => {
  it('is a full-pill groove with a 4 px inset', () => {
    expect(segmentedTrackStyle('track')).toEqual({
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'stretch',
      gap: 0,
      backgroundColor: surface.track,
      borderRadius: radius.pill,
      padding: 4,
    })
  })

  it('the thumb lifts to the desk surface and takes the chosen option own colour', () => {
    expect(segmentLook('track', false)).toEqual({
      container: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 8,
        borderRadius: radius.pill,
        backgroundColor: 'transparent',
      },
      textColor: ink.ink2,
      textVariant: 'captionSm',
    })
    expect(segmentLook('track', true).textColor).toBe(accent.accentInk)
    expect(segmentLook('track', true, ink.ink4)).toEqual({
      container: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 8,
        borderRadius: radius.pill,
        backgroundColor: surface.app,
        boxShadow: expect.stringContaining('0 2px 8px'),
      },
      textColor: ink.ink4,
      textVariant: 'captionSm',
    })
  })
})

/**
 * The values that are NOT resolved by a function — they are read straight out of the token
 * table by a component. Asserted here so the number and the screen it came from stay tied
 * together: several of them are one pixel off a `space` step, which is exactly the kind of
 * thing a later cleanup "fixes".
 */
describe('control tokens keep the value the screen had', () => {
  it('the difficulty cards: 12 in the add sheet, 11 on phrase detail', () => {
    // app/add.tsx:433 and app/phrase/[id].tsx:168. One pixel apart, and preserved: unifying
    // them would move every row below the selector on one of the two screens.
    expect(difficultyCard.default).toEqual({ gap: 8, paddingVertical: 12 })
    expect(difficultyCard.tight).toEqual({ gap: 8, paddingVertical: 11 })
  })

  it('the phrase row: queue and suggestions share the 16 px stationery card pad', () => {
    expect(phraseRow.queue).toEqual({ padding: space['4'], gap: space['2'], emojiSize: 16 })
    expect(phraseRow.suggestion).toEqual({ padding: space['4'], gap: space['2'], emojiSize: 16 })
  })

  it('the pill sizes, and the alignSelf that made stream keep its own copy', () => {
    // `md` is the standalone pill (phrase detail's theme label); `sm` is the one that sits in a
    // row of other content, which is what stream.tsx hand-rolled a second Pill to get; `xs` is
    // Today's `Locked` badge. The paddings are the three the screens shipped with, and the
    // alignSelf difference is the whole reason the duplicate existed.
    expect(pillSize.md).toMatchObject({
      paddingHorizontal: 9,
      paddingVertical: 4,
      alignSelf: 'flex-start',
    })
    expect(pillSize.sm).toMatchObject({
      paddingHorizontal: 8,
      paddingVertical: 4,
      alignSelf: 'auto',
    })
    expect(pillSize.xs).toMatchObject({
      paddingHorizontal: 7,
      paddingVertical: 3,
      alignSelf: 'auto',
    })
  })

  it('the stat row gap is 9, not a space step', () => {
    expect(statRow.gap).toBe(9)
  })

  it('the tap floor and the selected border weight', () => {
    expect(MIN_TAP).toBe(44)
    expect(border).toEqual({ hairline: 1, selected: 1.5 })
  })
})

describe('listRowLook · Settings / More / Music chrome (settings.tsx:206-212)', () => {
  const chrome = {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: line.subtle,
  } as const

  it('keeps the 48 / 13 / hairline cluster and leaves gap as a prop', () => {
    expect(listRow.minHeight).toBe(48)
    expect(listRow.paddingVertical).toBe(13)
    expect(listRowLook(space['3'])).toEqual({
      container: { ...chrome, gap: space['3'] },
    })
    expect(listRowLook(space['2.5'])).toEqual({
      container: { ...chrome, gap: space['2.5'] },
    })
  })

  it('drops the hairline when the row sits on a card floor', () => {
    expect(listRowLook(space['3'], true)).toEqual({
      container: {
        minHeight: 48,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 13,
        gap: space['3'],
      },
    })
  })
})

describe('fieldFace · DESIGN.md target vs utility type', () => {
  it('keeps DM Sans until a literary field has composed text', () => {
    expect(fieldFace(false, true)).toMatchObject({
      fontFamily: type.bodyMd.fontFamily,
      fontSize: type.bodyMd.fontSize,
    })
    expect(fieldFace(true, false)).toMatchObject({
      fontFamily: type.bodyMd.fontFamily,
    })
    expect(fieldFace(true, true)).toMatchObject({
      fontFamily: type.prose.fontFamily,
      fontSize: type.prose.fontSize,
    })
  })
})

describe('fieldLook · Account / Workbench chrome (v1.2 parchment well)', () => {
  it('bordered idle is an inset parchment field with an espresso baseline', () => {
    expect(field.minHeight).toBe(44)
    expect(field.padding).toBe(space['3'])
    expect(fieldLook(true)).toEqual({
      input: {
        minHeight: 44,
        padding: space['3'],
        color: ink.ink,
        alignSelf: 'stretch',
        backgroundColor: surface.app,
        borderRadius: radius.lg,
        borderWidth: 0,
        borderBottomWidth: field.baselineWidth,
        borderBottomColor: ink.ink,
        boxShadow: expect.stringContaining('inset'),
      },
    })
  })

  it('focus turns the baseline terracotta; invalid uses the danger text token', () => {
    expect(fieldLook(true, false, true).input.borderBottomColor).toBe(accent.accent)
    expect(fieldLook(true, true).input.borderBottomColor).toBe(semantic.danger.text)
  })

  it('unbordered leaves Discover / sheet / Import wrappers to supply chrome', () => {
    expect(fieldLook(false)).toEqual({
      input: {
        color: ink.ink,
        alignSelf: 'stretch',
      },
    })
  })

  it('announces invalid and disabled in both accessibility forms', () => {
    expect(fieldA11y(false, true)).toEqual({
      accessibilityState: { disabled: false, invalid: false },
      'aria-disabled': false,
      'aria-invalid': false,
    })
    expect(fieldA11y(true, false)).toEqual({
      accessibilityState: { disabled: true, invalid: true },
      'aria-disabled': true,
      'aria-invalid': true,
    })
  })
})
