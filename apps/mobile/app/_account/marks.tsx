import { StyleSheet, View } from 'react-native'

/** Token-colored HTML marks. No hex literals, no brand-logo SVGs. */

export function LoroBird({
  size,
  fill,
  eye,
  beak,
}: {
  size: number
  fill: string
  eye: string
  beak: string
}) {
  const u = size / 32
  return (
    <View testID="account-emblem-bird" style={{ width: size, height: size }}>
      <View
        style={{
          position: 'absolute',
          left: 6 * u,
          top: 6 * u,
          width: 20 * u,
          height: 20 * u,
          backgroundColor: fill,
          borderTopLeftRadius: 11 * u,
          borderBottomRightRadius: 11 * u,
          borderTopRightRadius: 2 * u,
          borderBottomLeftRadius: 2 * u,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: 15 * u,
          top: 11 * u,
          width: 6 * u,
          height: 6 * u,
          borderRadius: 6 * u,
          backgroundColor: eye,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: 6 * u,
          top: 20 * u,
          width: 8 * u,
          height: 6 * u,
          backgroundColor: beak,
          borderBottomLeftRadius: 2 * u,
        }}
      />
    </View>
  )
}

export function SpinnerMark({
  size,
  color,
  testID = 'account-emblem-spinner',
}: {
  size: number
  color: string
  testID?: string | undefined
}) {
  /** HTML spinner: faint ring + quarter annulus (`stroke-width="4"` in a 24 viewBox). */
  const stroke = size * (4 / 24)
  return (
    <View testID={testID} style={{ width: size, height: size }}>
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: size,
            borderWidth: stroke,
            borderColor: color,
            opacity: 0.25,
          },
        ]}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: size,
            borderWidth: stroke,
            borderColor: 'transparent',
            borderTopColor: color,
            borderLeftColor: color,
            opacity: 0.75,
          },
        ]}
      />
    </View>
  )
}

export function ShieldCheck({ size, color }: { size: number; color: string }) {
  const stroke = Math.max(1.8, size * 0.08)
  return (
    <View testID="account-emblem-shield" style={{ width: size, height: size }}>
      <View
        style={{
          position: 'absolute',
          left: size * 0.18,
          top: size * 0.08,
          width: size * 0.64,
          height: size * 0.72,
          borderWidth: stroke,
          borderColor: color,
          borderTopLeftRadius: size * 0.18,
          borderTopRightRadius: size * 0.18,
          borderBottomLeftRadius: size * 0.28,
          borderBottomRightRadius: size * 0.28,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: size * 0.3,
          top: size * 0.38,
          width: size * 0.16,
          height: stroke,
          backgroundColor: color,
          transform: [{ rotate: '45deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: size * 0.38,
          top: size * 0.34,
          width: size * 0.28,
          height: stroke,
          backgroundColor: color,
          transform: [{ rotate: '-50deg' }],
        }}
      />
    </View>
  )
}

export function LogoutMark({ size, color }: { size: number; color: string }) {
  /** HTML sign-out badge mark `w-3.5` `stroke-width="2.5"` in a 24 viewBox. */
  const stroke = size * (2.5 / 24)
  return (
    <View testID="account-emblem-logout" style={{ width: size, height: size }}>
      <View
        style={{
          position: 'absolute',
          left: size * 0.08,
          top: size * 0.2,
          width: size * 0.38,
          height: size * 0.6,
          borderWidth: stroke,
          borderRightWidth: 0,
          borderColor: color,
          borderRadius: stroke,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: size * 0.22,
          top: size * 0.48,
          width: size * 0.62,
          height: stroke,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          right: size * 0.08,
          top: size * 0.34,
          width: size * 0.28,
          height: stroke,
          backgroundColor: color,
          transform: [{ rotate: '40deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          right: size * 0.08,
          top: size * 0.58,
          width: size * 0.28,
          height: stroke,
          backgroundColor: color,
          transform: [{ rotate: '-40deg' }],
        }}
      />
    </View>
  )
}

export function WarnTriangle({
  size,
  color,
  knockout,
}: {
  size: number
  color: string
  knockout: string
}) {
  /** HTML warning mark `stroke-width="2.5"` outline triangle, not a filled CSS wedge. */
  const stroke = size * (2.5 / 24)
  const outerW = size * 0.42
  const outerH = size * 0.7
  const innerW = outerW - stroke
  const innerH = outerH - stroke * 1.6
  return (
    <View
      testID="account-emblem-warn"
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: outerW,
          borderRightWidth: outerW,
          borderBottomWidth: outerH,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: 0,
          height: 0,
          top: (size - innerH) / 2 + stroke * 0.7,
          borderLeftWidth: innerW,
          borderRightWidth: innerW,
          borderBottomWidth: innerH,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: knockout,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: size * 0.32,
          width: stroke,
          height: size * 0.22,
          borderRadius: stroke,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: size * 0.58,
          width: stroke,
          height: stroke,
          borderRadius: stroke,
          backgroundColor: color,
        }}
      />
    </View>
  )
}

export function InfoMark({ size, color }: { size: number; color: string }) {
  /** HTML cancelled notice `w-4` circle + i, stroke-width 2 in a 24 viewBox. */
  const stroke = size * (2 / 24)
  return (
    <View
      testID="account-cancelled-info"
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size,
          borderWidth: stroke,
          borderColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: size * 0.22,
          width: stroke,
          height: stroke,
          borderRadius: stroke,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: size * 0.42,
          width: stroke,
          height: size * 0.32,
          borderRadius: stroke,
          backgroundColor: color,
        }}
      />
    </View>
  )
}

export function CloseMark({ size, color }: { size: number; color: string }) {
  const stroke = Math.max(2, size * 0.12)
  return (
    <View testID="account-emblem-close" style={{ width: size, height: size }}>
      <View
        style={{
          position: 'absolute',
          left: size * 0.18,
          top: size * 0.46,
          width: size * 0.64,
          height: stroke,
          backgroundColor: color,
          transform: [{ rotate: '45deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: size * 0.18,
          top: size * 0.46,
          width: size * 0.64,
          height: stroke,
          backgroundColor: color,
          transform: [{ rotate: '-45deg' }],
        }}
      />
    </View>
  )
}

export function BoltMark({ size, color }: { size: number; color: string }) {
  /** HTML idle badge bolt `w-4` — tight zigzag, not a fat filled slab. */
  const bar = size * 0.18
  return (
    <View testID="account-emblem-bolt" style={{ width: size, height: size }}>
      <View
        style={{
          position: 'absolute',
          left: size * 0.4,
          top: size * 0.08,
          width: bar,
          height: size * 0.46,
          backgroundColor: color,
          transform: [{ skewX: '-22deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: size * 0.3,
          top: size * 0.46,
          width: bar,
          height: size * 0.46,
          backgroundColor: color,
          transform: [{ skewX: '-22deg' }],
        }}
      />
    </View>
  )
}
