/**
 * The style algebra behind `Chip`, `Segmented`, `Field` and `ListRow` — resolved from (variant, tone,
 * selected) to the exact style object each shape had when it was hand-rolled in a screen.
 *
 * ── Why this is a separate, pure module ──
 * These two components replace five hand-rolled chips and two hand-rolled segmented controls,
 * and the whole promise of that replacement is that not one pixel moves. Nothing else can
 * check it: the browser E2E suite asserts names, roles and states, not paddings, and no
 * renderer runs in this package's unit tests (`vitest.config.ts` is `environment: 'node'`).
 *
 * Keeping the resolution here — pure, with only type-level imports from react-native — means
 * `controlStyle.test.ts` can pin every branch against the values the screens used to hold. It
 * is the only regression test the refactor gets, so it earns the indirection.
 */

import type { TextStyle, ViewStyle } from 'react-native'
import {
  border,
  chip,
  field,
  ink,
  line,
  listRow,
  onDark,
  radius,
  segmented,
  semantic,
  surface,
  type TypeVariant,
} from '../theme'
import type { AccentTheme } from '../themeContext'
import { accent as defaultAccent } from '../theme'

export type ChipVariant = keyof typeof chip
/**
 * How a selected chip looks. `tint` is the accent wash under an accent border; `solid` fills
 * with the accent and drops the border. Both are real: a multi-select tag uses `tint`, Add's
 * single-choice scenario strip uses `solid`.
 */
export type ChipTone = 'tint' | 'solid'

export interface ControlLook {
  container: ViewStyle
  textColor: string
  textVariant: TypeVariant
}

/**
 * The colour half of each chip variant. Here rather than in `src/ui/tokens/` because these are
 * accessibility decisions, not measurements: `ink3` for the `toggle` chip's idle label, where
 * `muted` on `surface.card` is fine but the same pairing on a sunken surface is 4.41:1 — under
 * AA for 10 px text — so the app uses one idle ink per shape and this is where it is recorded.
 */
const CHIP_INK: Record<ChipVariant, { text: TypeVariant; idleInk: string; idleBorder: string }> = {
  tag: { text: 'captionSm', idleInk: ink.ink2, idleBorder: line.strong },
  scenario: { text: 'captionSm', idleInk: ink.ink2, idleBorder: line.default },
  toggle: { text: 'labelSm', idleInk: ink.ink3, idleBorder: line.strong },
}

export function chipLook(
  variant: ChipVariant,
  tone: ChipTone,
  selected: boolean,
  accent: AccentTheme = defaultAccent,
): ControlLook {
  const m = chip[variant]
  const look = CHIP_INK[variant]
  const solid = tone === 'solid'

  return {
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: m.gap,
      paddingHorizontal: m.paddingHorizontal,
      paddingVertical: m.paddingVertical,
      borderRadius: radius.lg,
      backgroundColor: selected ? (solid ? accent.accent : accent.tint) : surface.card,
      // Selected thickens the border unless the fill IS the signal. `toggle` is already at
      // the heavier weight when idle, so toggling it cannot reflow the row it sits in.
      borderWidth: selected ? (solid ? 0 : border.selected) : m.idleBorderWidth,
      borderColor: selected && !solid ? accent.accent : look.idleBorder,
    },
    textColor: selected ? (solid ? onDark.primary : accent.accentInk) : look.idleInk,
    textVariant: look.text,
  }
}

export type SegmentedVariant = keyof typeof segmented

/** The sunken groove the `track` variant's segments sit in. `undefined` for `pill`. */
export function segmentedTrackStyle(variant: SegmentedVariant): ViewStyle {
  const base: ViewStyle = {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    gap: segmented[variant].gap,
  }
  if (variant !== 'track') return base
  return {
    ...base,
    backgroundColor: surface.sunken2,
    borderRadius: segmented.track.trackRadius,
    padding: segmented.track.trackPadding,
  }
}

export function segmentLook(
  variant: SegmentedVariant,
  selected: boolean,
  /** The chosen segment's label colour on a `track` — each difficulty carries its own. */
  selectedColor?: string,
): ControlLook {
  const m = segmented[variant]
  const shared: ViewStyle = {
    flex: 1,
    alignItems: 'center',
    paddingVertical: m.paddingVertical,
    borderRadius: m.borderRadius,
  }

  if (variant === 'track') {
    return {
      // `transparent` is the absence of a colour, not a palette value — the one keyword the
      // colour-literal rule permits (`eslint.config.mjs:167`).
      container: { ...shared, backgroundColor: selected ? surface.card : 'transparent' },
      // `ink.ink3`, not `ink.muted`: this row sits on `surface.sunken2`, where muted is
      // 4.41:1 — under AA for 12 px text.
      textColor: selected ? (selectedColor ?? ink.ink) : ink.ink3,
      textVariant: 'captionSm',
    }
  }

  return {
    container: {
      ...shared,
      backgroundColor: selected ? surface.dark : surface.card,
      borderWidth: selected ? 0 : border.hairline,
      borderColor: line.default,
    },
    textColor: selected ? onDark.primary : ink.ink3,
    textVariant: 'labelSm',
  }
}

/**
 * Settings / More / Music list chrome (`settings.tsx` 206–212, `more.tsx` 59–67,
 * `music.tsx` 447–455). Gap stays a call-site prop.
 */
export function listRowLook(gap: number): { container: ViewStyle } {
  return {
    container: {
      minHeight: listRow.minHeight,
      flexDirection: 'row',
      alignItems: 'center',
      gap,
      paddingVertical: listRow.paddingVertical,
      borderBottomWidth: border.hairline,
      borderBottomColor: line.subtle,
    },
  }
}

/** Account email/code and Workbench search (`account.tsx` 862–871, `Workbench.tsx` 552–561). */
export function fieldLook(bordered: boolean, invalid = false): { input: TextStyle } {
  if (!bordered) {
    return { input: { color: ink.ink, alignSelf: 'stretch' } }
  }
  return {
    input: {
      minHeight: field.minHeight,
      padding: field.padding,
      color: ink.ink,
      alignSelf: 'stretch',
      borderWidth: field.borderWidth,
      borderColor: invalid ? semantic.danger.text : line.strong,
      borderRadius: field.borderRadius,
      backgroundColor: surface.card,
    },
  }
}

/**
 * Dual a11y for Field's valued states. Nested `accessibilityState` is what native readers
 * use; RNW's `createDOMProps` only forwards flat `aria-invalid` / `aria-disabled`.
 */
export function fieldA11y(
  invalid: boolean,
  editable: boolean,
): {
  accessibilityState: { disabled: boolean; invalid: boolean }
  'aria-disabled': boolean
  'aria-invalid': boolean
} {
  const disabled = !editable
  return {
    accessibilityState: { disabled, invalid },
    'aria-disabled': disabled,
    'aria-invalid': invalid,
  }
}
