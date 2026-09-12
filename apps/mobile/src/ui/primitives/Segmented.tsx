/**
 * `Segmented` — one choice out of a short list, laid side by side.
 *
 * ── Two variants, and neither is a skin of the other ──
 * Both variants share the v1.2 enclosed pill track. `pill` is a mode switch (Add discover /
 * browse / import); `track` is the same groove and lets a chosen option carry its own colour
 * (difficulty). Metrics live in `src/ui/tokens/control.ts` and resolve in `./controlStyle.ts`.
 *
 * ── Roles ──
 * `pill` is a pair of buttons — a mode switch, where "chosen" is a navigation state. `track` is
 * used with `accessibilityRole="radio"`, which promises `aria-checked`; `Pressable` emits both
 * forms of it from `selected`.
 */

import { Platform, View } from 'react-native'
import { stationeryElevation } from '../elevation'
import { useTheme } from '../ThemeProvider'
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
  const { accent } = useTheme()
  return (
    <View style={segmentedTrackStyle(variant)}>
      {options.map((o) => {
        const selected = o.value === value
        const look = segmentLook(variant, selected, o.selectedColor, accent)
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
            style={[
              look.container,
              selected && Platform.OS !== 'web' ? stationeryElevation('card') : null,
              Platform.OS === 'web' && { minWidth: 'auto' },
            ]}
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
