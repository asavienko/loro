/**
 * `Segmented` — one choice out of a short list, laid side by side.
 *
 * ── Two variants, and neither is a skin of the other ──
 * Add's discover / browse pair is two CARDS on the page: the chosen one goes dark and loses its
 * border. The stream's difficulty control is a THUMB in a sunken groove: the chosen one goes
 * white, the others go transparent, and the track itself is a surface. Forcing one look on both
 * would change a screen, so `variant` picks between them; the metrics are named in
 * `src/ui/tokens/control.ts` and resolved in `./controlStyle.ts`.
 *
 * ── Roles ──
 * `pill` is a pair of buttons — a mode switch, where "chosen" is a navigation state. `track` is
 * used with `accessibilityRole="radio"`, which promises `aria-checked`; `Pressable` emits both
 * forms of it from `selected`.
 */

import { Platform, View } from 'react-native'
import { segmentLook, segmentedTrackStyle, type SegmentedVariant } from './controlStyle'
import { Pressable } from './Pressable'
import { Text } from './Text'

export interface SegmentedOption<T extends string> {
  value: T
  /** The visible text. Also the accessible name unless `accessibilityLabel` is set. */
  label: string
  accessibilityLabel?: string | undefined
  /**
   * The label's colour when this option is the chosen one — the `track` variant only, where
   * each difficulty carries its own semantic colour. Defaults to `ink.ink`.
   */
  selectedColor?: string | undefined
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  variant = 'pill',
  accessibilityRole = 'button',
}: {
  options: readonly SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  variant?: SegmentedVariant | undefined
  accessibilityRole?: 'button' | 'radio' | undefined
}) {
  return (
    <View style={segmentedTrackStyle(variant)}>
      {options.map((o) => {
        const selected = o.value === value
        const look = segmentLook(variant, selected, o.selectedColor)
        return (
          <Pressable
            key={o.value}
            feedback={variant === 'track' ? 'row' : 'button'}
            accessibilityRole={accessibilityRole}
            accessibilityLabel={o.accessibilityLabel ?? o.label}
            selected={selected}
            onPress={() => {
              onChange(o.value)
            }}
            style={[look.container, Platform.OS === 'web' && { minWidth: 'auto' }]}
          >
            <Text
              variant={look.textVariant}
              color={look.textColor}
              align="center"
              style={{ maxWidth: '100%', flexShrink: 1 }}
            >
              {o.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
