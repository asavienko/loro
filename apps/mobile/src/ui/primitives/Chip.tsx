/**
 * `Chip` — a selectable label. The shape five screens were hand-rolling.
 *
 * ── Why the selection is not just a background colour ──
 * Every hand-rolled copy wrote `active ? accent.tint : surface.card` with
 * `borderWidth: active ? 1.5 : 1`, and the ones that carry a role got their `aria-checked`
 * from `Pressable`'s `selected`. Both halves matter and neither is optional: the border weight
 * is the non-colour signal WCAG asks for, and `selected` is what a screen reader announces. A
 * chip with a `radio` or `checkbox` role and no `selected` is a bug — see that prop's note on
 * `Pressable`.
 *
 * `label` is what is SHOWN and `accessibilityLabel` is what is ANNOUNCED, because they differ
 * at real call sites: the tag chips append a ✓ to the visible text, and the stream's love
 * button reads "Remove from loved" while showing "♥ Loved".
 *
 * The resolved styles live in `./controlStyle.ts`, which is pure so that a unit test can pin
 * them against the values the screens used to hold.
 */

import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { chipGrid } from '../theme'
import { chipLook, type ChipTone, type ChipVariant } from './controlStyle'
import { Pressable } from './Pressable'
import { Text } from './Text'

export function Chip({
  label,
  emoji,
  selected,
  onPress,
  variant = 'tag',
  tone = 'tint',
  accessibilityLabel,
  accessibilityRole = 'button',
}: {
  /** The visible text. */
  label: string
  /** Rendered before the label, at the label's own size and its default ink. Decorative. */
  emoji?: string | undefined
  selected: boolean
  onPress: () => void
  /** The chip's metrics — `src/ui/tokens/control.ts` names each one and where it came from. */
  variant?: ChipVariant | undefined
  /** How the selected state looks. See `ChipTone`. */
  tone?: ChipTone | undefined
  /** Defaults to `label`. Set it whenever the two differ. */
  accessibilityLabel?: string | undefined
  accessibilityRole?: 'button' | 'radio' | 'checkbox' | undefined
}) {
  const look = chipLook(variant, tone, selected)

  return (
    <Pressable
      feedback="smallButton"
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel ?? label}
      selected={selected}
      onPress={onPress}
      style={look.container}
    >
      {emoji !== undefined && <Text variant={look.textVariant}>{emoji}</Text>}
      <Text variant={look.textVariant} color={look.textColor}>
        {label}
      </Text>
    </Pressable>
  )
}

/**
 * The wrapping grid chip-sized things are laid out in: the tag grids on Add and phrase detail,
 * and phrase detail's word-by-word cards.
 *
 * It wraps rather than scrolls on purpose — at 310% text one chip is wider than the screen, and
 * `e2e/text-scale.spec.ts` asserts nothing overflows.
 */
export function ChipGrid({ children }: { children: ReactNode }) {
  return <View style={s.grid}>{children}</View>
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: chipGrid.gap },
})
