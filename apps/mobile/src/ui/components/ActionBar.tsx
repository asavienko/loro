/**
 * `ActionBar` — the fixed bar that holds a screen's primary action.
 *
 * It reads the safe-area inset itself, because forgetting to add it is how a button ends up under
 * the home indicator, and three screens were each adding it by hand.
 *
 * ── It does NOT measure itself, and must not start ──
 * The bar is absolutely positioned, so it reserves no space in the scroll view above it. Each
 * screen pads its own `contentContainerStyle` to clear it, and those numbers are guesses that
 * disagree with each other: Today 96, phrase detail 110, the Refrain 120, for bars of similar
 * height. They are named in `actionBar.clearance` (`src/ui/tokens/control.ts`) and every one is
 * kept exactly as the screen had it.
 *
 * Replacing them with an `onLayout` measurement is a real improvement and a LAYOUT BEHAVIOUR
 * CHANGE — the kind `e2e/text-scale.spec.ts` is written to catch — so it belongs to a follow-up
 * plan, not to a refactor that promises to change nothing. The clearance is deliberately not a prop
 * on this component: the bar would have nothing to do with it, and a prop that is only documentation
 * rots. It is a token because the value belongs to the pair, not to either half.
 */

import type { ReactNode } from 'react'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { actionBar, border, line, surface } from '../theme'

export function ActionBar({
  children,
  direction = 'column',
  gap,
}: {
  children: ReactNode
  /** `row` lays the actions side by side — phrase detail's Remove + Practice pair. */
  direction?: 'row' | 'column' | undefined
  gap?: number | undefined
}) {
  const insets = useSafeAreaInsets()

  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        flexDirection: direction,
        gap,
        padding: actionBar.padding,
        paddingBottom: insets.bottom + actionBar.paddingBottom,
        backgroundColor: surface.app,
        borderTopWidth: border.hairline,
        borderTopColor: line.default,
      }}
    >
      {children}
    </View>
  )
}
