/**
 * `ListRow` — a selectable or navigable row. The 48 / 13 / hairline shape Settings, More
 * and Music were hand-rolling.
 *
 * ── Why gap is a prop ──
 * Settings uses `space['3']`; More and Music use `space['2.5']`. Those are two real
 * densities, not a rounding error. The token names only the shared chrome so a later
 * tidy-up cannot snap one gap onto the other. NavigationMenu and listen-export consent
 * share 13 / hairline at `MIN_TAP` (44) and stay local until a second 44-px wave.
 *
 * Domain-free slots: Settings keeps its marker as a child; Music bilingual lines are
 * children, not a `PhraseRow`. Every string is a prop; this file does not import `copy`.
 *
 * The resolved chrome lives in `./controlStyle.ts` so a unit test can pin 48 / 13 /
 * hairline against the values the screens used to hold.
 */

import type { ReactNode } from 'react'
import { Pressable } from './Pressable'
import { listRowLook } from './controlStyle'

export function ListRow({
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = 'button',
  selected,
  disabled,
  onPress,
  gap,
  last = false,
  children,
}: {
  accessibilityLabel: string
  accessibilityHint?: string | undefined
  accessibilityRole?: 'button' | 'link' | 'radio' | 'checkbox' | undefined
  selected?: boolean | undefined
  disabled?: boolean | undefined
  onPress: () => void
  /** Settings `space['3']`; More and Music `space['2.5']`. */
  gap: number
  /** Hide the hairline when this row sits on a card floor. */
  last?: boolean | undefined
  children: ReactNode
}) {
  const look = listRowLook(gap, last)
  return (
    <Pressable
      feedback="row"
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      selected={selected}
      disabled={disabled}
      onPress={onPress}
      style={look.container}
    >
      {children}
    </Pressable>
  )
}
