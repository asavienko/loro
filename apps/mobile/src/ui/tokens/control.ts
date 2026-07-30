/**
 * Control metrics — the padding, gap and radius of each interactive shape.
 *
 * One table per component, one entry per VARIANT, and a variant exists because a real
 * screen renders that shape. The numbers are transcribed from the screens they came from;
 * none of them was rounded on the way in. Where two screens render the same shape one pixel
 * apart, that is preserved as two named variants rather than averaged away — see
 * `difficultyCard.cards` and `.cardsTight`.
 *
 * Colours are NOT here. A control's colours encode accessibility decisions (`accentInk` for
 * text on a tint, `ink3` rather than `muted` on a sunken track) and belong next to the
 * reasoning, in the component. See `src/ui/tokens/sizing.ts` for why this directory exists.
 */

import { radius, space } from '@loro/design-tokens'
import { barRadius, border } from './sizing'

/**
 * `Pill` — a static label.
 *
 * `standalone` is the original: it sets `alignSelf: 'flex-start'` so a pill dropped into a
 * column hugs its own text. `inline` drops that (`'auto'` inherits the parent's
 * `alignItems`, which is what omitting it does) because a pill INSIDE a row must ride the
 * row's vertical centring — this is the whole difference between the shared primitive and
 * the copy `practice/stream.tsx` used to keep beside it.
 */
export const pill = {
  standalone: { paddingHorizontal: 9, paddingVertical: 4, alignSelf: 'flex-start' },
  inline: { paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'auto' },
  /** Today's `Locked` badge — the tightest of the three. */
  compact: { paddingHorizontal: 7, paddingVertical: 3, alignSelf: 'auto' },
} as const

/**
 * `Chip` — a selectable label.
 *
 * `idleBorderWidth` is part of the shape, not the tone: the `toggle` chip carries the
 * heavier border in BOTH states so that toggling it cannot reflow the row it sits in, while
 * `tag` and `scenario` thicken only on selection.
 */
export const chip = {
  /** "What's tricky about it?" — the add sheet and phrase detail. */
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
    idleBorderWidth: border.hairline,
  },
  /** Add's horizontal scenario strip. */
  scenario: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 5,
    idleBorderWidth: border.hairline,
  },
  /** A small state toggle — the stream's love button. */
  toggle: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    gap: 6,
    idleBorderWidth: border.selected,
  },
} as const

/**
 * `Segmented` — one choice out of two or three, laid side by side.
 *
 * Two genuinely different looks, and neither is a skin of the other: `pill` is a pair of
 * cards on the page, `track` is a thumb inside a sunken groove.
 */
export const segmented = {
  /** Add's discover / browse pair: two cards, no track. */
  pill: { gap: 6, paddingVertical: 9, borderRadius: radius.lg },
  /** The stream's difficulty control: an inset thumb on a sunken groove. */
  track: {
    gap: 3,
    paddingVertical: 10,
    borderRadius: radius.md,
    trackPadding: 3,
    trackRadius: radius.lg,
  },
} as const

/** `DifficultySelector`'s card layouts. `segmented` reuses `segmented.track`. */
export const difficultyCard = {
  /** The add sheet. */
  cards: { gap: 8, paddingVertical: 12 },
  /**
   * Phrase detail — one pixel shorter than the sheet's. Kept rather than unified: the two
   * screens were built apart, and changing either moves the rows below it.
   */
  cardsTight: { gap: 8, paddingVertical: 11 },
} as const

/** The wrapping chip grid `TagSelector` lays out. */
export const chipGrid = { gap: 8 } as const

/** `Sheet` — the bottom sheet's frame and its grabber. */
export const sheet = {
  padding: space['5'],
  gap: space['3.5'],
  /** Drawn, and inert: the drag gesture is plans/48's, not this component's. */
  handle: { width: 42, height: 5, borderRadius: barRadius },
} as const

/**
 * `PhraseRow` — the bilingual row every list in the app is made of.
 *
 * The two variants differ by a pixel of padding and a step of type size, which is the
 * difference between a queue you scan and a suggestion you tap.
 */
export const phraseRow = {
  /** The stream's "up next". */
  queue: { padding: 11, gap: 10, emojiSize: 16 },
  /** Add's suggestion list. */
  suggestion: { padding: 12, gap: 10, emojiSize: 17 },
} as const

/** `BottomActionBar` — the fixed bar. `paddingBottom` is added to the safe-area inset. */
export const bottomBar = { padding: space['4'], paddingBottom: space['3'] } as const

/** `StatRow` — three `StatTile`s. 9, not 8: the tiles are 1 px tighter than a `space` step. */
export const statRow = { gap: 9 } as const

/** `EmptyState`'s defaults. Both are overridable — two screens run tighter. */
export const emptyState = { padding: space['5'], gap: space['3'] } as const
