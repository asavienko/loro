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

import { describe, expect, it } from 'vitest'
import {
  MIN_TAP,
  accent,
  border,
  difficultyCard,
  ink,
  line,
  onDark,
  phraseRow,
  pillSize,
  radius,
  statRow,
  surface,
} from '../theme'
import { chipLook, segmentLook, segmentedTrackStyle } from './controlStyle'

describe('chipLook · the tag toggle (app/add.tsx:473-483, app/phrase/[id].tsx:205-212)', () => {
  // `flexDirection`, `alignItems` and `gap` are the shared chip shape. `add.tsx` set all
  // three; phrase detail set none of them, and with a single Text child they are no-ops —
  // the container hugs the label either way.
  const shape = { flexDirection: 'row', alignItems: 'center', gap: 6 } as const
  const metrics = { paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.lg } as const

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
  const metrics = { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.lg } as const

  it('idle — note line.default, one step lighter than the tag chip', () => {
    expect(chipLook('scenario', 'solid', false)).toEqual({
      container: {
        ...shape,
        ...metrics,
        backgroundColor: surface.card,
        borderWidth: 1,
        borderColor: line.default,
      },
      textColor: ink.ink2,
      textVariant: 'captionSm',
    })
  })

  it('selected — the accent FILL, no border, white text', () => {
    expect(chipLook('scenario', 'solid', true)).toEqual({
      container: {
        ...shape,
        ...metrics,
        backgroundColor: accent.accent,
        borderWidth: 0,
        borderColor: line.default,
      },
      textColor: onDark.primary,
      textVariant: 'captionSm',
    })
  })
})

describe('chipLook · the love toggle (app/practice/stream.tsx:209-216)', () => {
  const shape = { flexDirection: 'row', alignItems: 'center', gap: 6 } as const
  const metrics = { paddingHorizontal: 11, paddingVertical: 8, borderRadius: radius.lg } as const

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

describe('segmented · the pill pair (app/add.tsx:151-159)', () => {
  it('lays out on a bare row with a 6 px gap — no track', () => {
    expect(segmentedTrackStyle('pill')).toEqual({
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    })
  })

  it('idle is a bordered card; selected goes dark and drops the border', () => {
    expect(segmentLook('pill', false)).toEqual({
      container: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 9,
        borderRadius: radius.lg,
        backgroundColor: surface.card,
        borderWidth: 1,
        borderColor: line.default,
      },
      textColor: ink.ink3,
      textVariant: 'labelSm',
    })
    expect(segmentLook('pill', true).container).toEqual({
      flex: 1,
      alignItems: 'center',
      paddingVertical: 9,
      borderRadius: radius.lg,
      backgroundColor: surface.dark,
      borderWidth: 0,
      borderColor: line.default,
    })
    expect(segmentLook('pill', true).textColor).toBe(onDark.primary)
  })
})

describe('segmented · the sunken track (app/practice/stream.tsx:243-265)', () => {
  it('is a groove with a 3 px inset', () => {
    expect(segmentedTrackStyle('track')).toEqual({
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: surface.sunken2,
      borderRadius: radius.lg,
      padding: 3,
    })
  })

  it('the thumb is white on transparent, and takes the chosen option own colour', () => {
    expect(segmentLook('track', false)).toEqual({
      container: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 10,
        borderRadius: radius.md,
        backgroundColor: 'transparent',
      },
      // ink3, not muted: muted on sunken2 is 4.41:1, under AA for 12 px text.
      textColor: ink.ink3,
      textVariant: 'captionSm',
    })
    expect(segmentLook('track', true, ink.ink4)).toEqual({
      container: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 10,
        borderRadius: radius.md,
        backgroundColor: surface.card,
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

  it('the phrase row: the queue is a pixel tighter and a type step smaller', () => {
    // app/practice/stream.tsx:309-318 and app/add.tsx:312-321.
    expect(phraseRow.queue).toEqual({ padding: 11, gap: 10, emojiSize: 16 })
    expect(phraseRow.suggestion).toEqual({ padding: 12, gap: 10, emojiSize: 17 })
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
