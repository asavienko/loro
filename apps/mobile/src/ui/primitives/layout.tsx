/**
 * The two flex helpers.
 *
 * `Row` defaults to `alignItems: 'center'`, which is right for a row of text and controls and
 * WRONG for a row of bars: a child with no height of its own centres at zero height instead
 * of stretching. `ValueBar` exists for that case — see `./bars.tsx`.
 */

import type { ReactNode } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import { space } from '../theme'

export function Row({
  gap = space['2'],
  align = 'center',
  justify,
  children,
  style,
}: {
  gap?: number | undefined
  align?: ViewStyle['alignItems']
  justify?: ViewStyle['justifyContent']
  children: ReactNode
  style?: StyleProp<ViewStyle>
}) {
  return (
    <View
      style={[{ flexDirection: 'row', gap, alignItems: align, justifyContent: justify }, style]}
    >
      {children}
    </View>
  )
}

export function Stack({
  gap = space['3'],
  children,
  style,
}: {
  gap?: number | undefined
  children: ReactNode
  style?: StyleProp<ViewStyle>
}) {
  return <View style={[{ gap }, style]}>{children}</View>
}
