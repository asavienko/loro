/**
 * Control metrics — the padding, gap and radius of each interactive shape.
 *
 * One table per component, one entry per VARIANT, and a variant exists because a real screen
 * renders that shape. The numbers are transcribed from the screens they came from; none of them
 * was rounded on the way in. Where two screens render the same shape one pixel apart, that is
 * preserved as two named entries rather than averaged away — see `difficultyCard` and `pillSize`.
 *
 * Colours are NOT here. A control's colours encode accessibility decisions (`accentInk` for text
 * on a tint, `ink3` rather than `muted` on a sunken track) and belong next to the reasoning, in
 * the component. See `src/ui/tokens/sizing.ts` for why this directory exists.
 */

import { radius, size, space } from '@loro/design-tokens'
import { MIN_TAP, barRadius, border } from './sizing'

/**
 * `Pill` — five shapes, keyed by size. The first three are the flat label; the two capsules are
 * the rounded emoji-and-value badge.
 *
 * `alignSelf` is part of the size because it is what made `practice/stream.tsx` keep its own copy
 * of `Pill` (plans/48 §3a): `flex-start` lets a pill in a column hug its own text, and breaks the
 * vertical centring of a pill INSIDE a row. `'auto'` is what omitting it does.
 *
 * `gap` and `emoji` only matter when a leading emoji is passed; the flat sizes carry values for
 * them so the table has no holes, and no call site exercises them today.
 */
export const pillSize = {
  /** Today's `Locked` badge — the tightest. */
  xs: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.sm,
    gap: 5,
    text: 'labelSm',
    emoji: 'captionSm',
    alignSelf: 'auto',
  },
  /** Inside a row of other content — the stream's roll-up and difficulty pills. */
  sm: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    gap: 5,
    text: 'labelSm',
    emoji: 'captionSm',
    alignSelf: 'auto',
  },
  /** On its own, hugging its text — phrase detail's theme pill. The default. */
  md: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.sm,
    gap: 5,
    text: 'labelSm',
    emoji: 'captionSm',
    alignSelf: 'flex-start',
  },
  /** Today's streak badge: 🔥 and a number. */
  capsule: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radius['2xl'],
    gap: 5,
    text: 'bodySm',
    emoji: 'caption',
    alignSelf: 'auto',
  },
  /** The stream's now-playing theme badge — a pixel shorter, a wider gap, a smaller label. */
  capsuleSm: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: radius['2xl'],
    gap: 7,
    text: 'labelSm',
    emoji: 'captionSm',
    alignSelf: 'auto',
  },
} as const

/**
 * `Chip` — a selectable label.
 *
 * `idleBorderWidth` is part of the shape, not the tone: the `toggle` chip carries the heavier
 * border in BOTH states so that toggling it cannot reflow the row it sits in, while `tag` and
 * `scenario` thicken only on selection.
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
 * Both variants sit in the v1.2 enclosed pill track (`DESIGN.md` Rounded Pill Tabs). `pill` is
 * the mode switch (Add discover / browse / import); `track` is the same groove with a
 * per-option selected colour for difficulty.
 */
export const segmented = {
  /** Add discover / browse / import — enclosed track, selected thumb lifts. */
  pill: {
    gap: 0,
    paddingVertical: 8,
    borderRadius: radius.pill,
    trackPadding: 4,
  },
  /** Enclosed stationery groove — difficulty and other short choices. */
  track: {
    gap: 0,
    paddingVertical: 8,
    borderRadius: radius.pill,
    trackPadding: 4,
    trackRadius: radius.pill,
  },
} as const

/**
 * `DifficultySelector`'s card layout, at the two densities the app renders it. `segmented` reuses
 * `segmented.track`.
 *
 * `tight` is one pixel shorter and exists because phrase detail was built apart from the add
 * sheet. Kept rather than unified: changing either moves every row below the selector.
 */
export const difficultyCard = {
  /** The add sheet. */
  default: { gap: 8, paddingVertical: 12 },
  /** Phrase detail. */
  tight: { gap: 8, paddingVertical: 11 },
} as const

/** `Grid`'s default gap — the tag and word-by-word grids. Add's theme grid passes 9. */
export const grid = { gap: 8 } as const

/** `Sheet` — the bottom sheet's frame and its grabber. */
export const sheet = {
  padding: space['5'],
  gap: space['3.5'],
  /** Visual grabber inside the sheet's touch-sized pull target. */
  handle: { ...size.sheetHandle, borderRadius: barRadius },
} as const

/**
 * `PhraseRow` — the bilingual stationery card every list in the app is made of.
 *
 * Stream "up next" and Add suggestions share the 16 px card pad. Suggestion keeps the
 * trailing affordance on its own row; queue keeps the difficulty pill beside the phrase.
 */
export const phraseRow = {
  /** Stream "up next" — padded stationery card, Newsreader target. */
  queue: { padding: space['4'], gap: space['2'], emojiSize: 16 },
  /** Add's suggestion list — same card, trailing action below. */
  suggestion: { padding: space['4'], gap: space['2'], emojiSize: 16 },
} as const

/**
 * `ActionBar` — the fixed bottom bar.
 *
 * `padding` / `paddingBottom` are the bar's own; `paddingBottom` is added to the safe-area inset.
 *
 * `clearance` preserves each screen's authored minimum scroll padding before the first layout.
 * Plan 84 adds measured ActionBar height plus breathing room as the other side of Math.max, so
 * enlarged buttons cannot hide the final row. These fallback numbers are not measurements.
 */
export const actionBar = {
  padding: space['4'],
  paddingBottom: space['4'],
  inset: space['5'],
  clearance: { today: 96, phraseDetail: 110, refrain: 120 },
} as const

/** `StatRow` — three `StatTile`s. 9, not 8: the tiles are 1 px tighter than a `space` step. */
export const statRow = { gap: 9 } as const

/** `SectionHeader` — a label with a hint beside it, aligned on their baselines. */
export const sectionHeader = { gap: 7 } as const

/** `CardHeader` — a title with a meta value opposite, and the gap to the card's body. */
export const cardHeader = { marginBottom: space['3'] } as const

/** `EmptyState`'s defaults. Both are overridable — two screens run tighter. */
export const emptyState = { padding: space['5'], gap: space['3'] } as const

/**
 * `Field` — the labelled text input Account, Discover, Import and Workbench were hand-rolling.
 *
 * `minHeight` is the tap floor. Discover's 46, the tagging sheet's 38 and Import's 132 sit on
 * the call site as `style` overrides so those pixels do not get averaged into this token.
 * Border colour is an accessibility decision and lives on `fieldLook`, not here.
 */
export const field = {
  minHeight: MIN_TAP,
  padding: space['3'],
  borderWidth: 1,
  baselineWidth: border.selected,
  borderRadius: radius.lg,
} as const

/**
 * `ListRow` — Settings, More and Music share 48 / 13 / hairline. Gap is a prop
 * (Settings `space['3']`, More/Music `space['2.5']`) so this token does not average them.
 * Hairline width lives on `border`; the colour is an accessibility decision on `listRowLook`.
 * Card groups pass `last` so the floor row drops that hairline.
 */
export const listRow = {
  minHeight: 48,
  paddingVertical: 13,
} as const
