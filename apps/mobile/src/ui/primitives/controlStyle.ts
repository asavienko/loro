/**
 * The style algebra behind `Chip`, `Segmented`, `Field` and `ListRow` — resolved from (variant, tone,
 * selected) to the exact style object each shape had when it was hand-rolled in a screen.
 *
 * ── Why this is a separate, pure module ──
 * Chip / Field / ListRow pin the pixels the screens used to hold. Segmented pins the v1.2
 * enclosed pill track. The browser E2E suite asserts names, roles and states, not paddings,
 * and no renderer runs in this package's unit tests (`vitest.config.ts` is `environment: 'node'`).
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
  shadow,
  surface,
  type,
  type TypeVariant,
} from '../theme'
import type { AccentTheme } from '../themeContext'
import { accent as defaultAccent } from '../theme'

export type ChipVariant = keyof typeof chip
/**
 * How a selected chip looks. `tint` is the accent wash under an accent border; `solid` fills
 * with the accent and drops the border; `sage` uses the success tokens for verified /
 * recommended marks. All three are real: a multi-select tag uses `tint`, Add's single-choice
 * scenario strip uses `solid`, and a recommended badge uses `sage`.
 */
export type ChipTone = 'tint' | 'solid' | 'sage'

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
  const sage = tone === 'sage'

  return {
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: m.gap,
      paddingHorizontal: m.paddingHorizontal,
      paddingVertical: m.paddingVertical,
      borderRadius: radius.pill,
      backgroundColor: selected
        ? sage
          ? semantic.success.bg
          : solid
            ? variant === 'scenario'
              ? surface.dark
              : accent.accent
            : accent.tint
        : variant === 'scenario'
          ? surface.sunken
          : surface.card,
      // Selected thickens the border unless the fill IS the signal. `toggle` is already at
      // the heavier weight when idle, so toggling it cannot reflow the row it sits in.
      // Sage's success wash is the signal, same as a solid fill.
      borderWidth: selected ? (solid || sage ? 0 : border.selected) : m.idleBorderWidth,
      borderColor: selected && !solid && !sage ? accent.accent : look.idleBorder,
    },
    textColor: selected
      ? sage
        ? semantic.successAlt.text
        : solid
          ? onDark.primary
          : accent.accentInk
      : look.idleInk,
    textVariant: look.text,
  }
}

export type SegmentedVariant = keyof typeof segmented

/** The enclosed stationery groove both variants sit in. */
export function segmentedTrackStyle(variant: SegmentedVariant): ViewStyle {
  const m = segmented[variant]
  return {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    gap: m.gap,
    backgroundColor: surface.track,
    borderRadius: radius.pill,
    padding: m.trackPadding,
  }
}

export function segmentLook(
  variant: SegmentedVariant,
  selected: boolean,
  /** The chosen segment's label colour on a `track` — each difficulty carries its own. */
  selectedColor?: string,
  accent: AccentTheme = defaultAccent,
): ControlLook {
  const m = segmented[variant]
  return {
    // `transparent` is the absence of a colour, not a palette value — the one keyword the
    // colour-literal rule permits (`eslint.config.mjs:167`).
    container: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: m.paddingVertical,
      borderRadius: m.borderRadius,
      backgroundColor: selected ? surface.app : 'transparent',
      ...(selected ? { boxShadow: shadow.card } : null),
    },
    textColor: selected ? (selectedColor ?? accent.accentInk) : ink.ink2,
    textVariant: 'captionSm',
  }
}

/**
 * Settings / More / Music list chrome (`settings.tsx` 206–212, `more.tsx` 59–67,
 * `music.tsx` 447–455). Gap stays a call-site prop.
 */
export function listRowLook(gap: number, last = false): { container: ViewStyle } {
  return {
    container: {
      minHeight: listRow.minHeight,
      flexDirection: 'row',
      alignItems: 'center',
      gap,
      paddingVertical: listRow.paddingVertical,
      ...(last
        ? null
        : {
            borderBottomWidth: border.hairline,
            borderBottomColor: line.subtle,
          }),
    },
  }
}

/** Newsreader only for composed target-language text; everything else stays DM Sans. */
export function fieldFace(literary: boolean, filled: boolean): TextStyle {
  const face = literary && filled ? type.prose : type.bodyMd
  return {
    fontFamily: face.fontFamily,
    fontSize: face.fontSize,
    fontWeight: face.fontWeight,
    lineHeight: face.lineHeight,
  }
}

/** Account email/code and Workbench search — v1.2 parchment well with an espresso baseline. */
export function fieldLook(
  bordered: boolean,
  invalid = false,
  focused = false,
): { input: TextStyle } {
  if (!bordered) {
    return { input: { color: ink.ink, alignSelf: 'stretch' } }
  }
  return {
    input: {
      minHeight: field.minHeight,
      padding: field.padding,
      color: ink.ink,
      alignSelf: 'stretch',
      backgroundColor: surface.app,
      borderRadius: field.borderRadius,
      borderWidth: 0,
      borderBottomWidth: field.baselineWidth,
      borderBottomColor: invalid ? semantic.danger.text : focused ? defaultAccent.accent : ink.ink,
      boxShadow: shadow.fieldInset,
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
