import { View } from 'react-native'
import { Text } from '../../../src/ui/primitives'
import { radius, space } from '../../../src/ui/theme'

export function PlayMark({
  wide,
  half,
  color,
}: {
  wide: number
  half: number
  color: string
}) {
  return (
    <View
      testID="stream-play-mark"
      style={{
        width: 0,
        height: 0,
        marginLeft: space['0.5'],
        borderTopWidth: half,
        borderBottomWidth: half,
        borderLeftWidth: wide,
        borderTopColor: 'transparent',
        borderBottomColor: 'transparent',
        borderLeftColor: color,
      }}
    />
  )
}

export function OptionsMark({
  glyph,
  face,
  color,
}: {
  glyph: string
  face: number
  color: string
}) {
  return (
    <View testID="stream-options-mark">
      <Text color={color} style={{ fontSize: face, lineHeight: face }}>
        {glyph}
      </Text>
    </View>
  )
}

export function PauseMark({
  width,
  height,
  gap,
  color,
}: {
  width: number
  height: number
  gap: number
  color: string
}) {
  const bar = {
    width,
    height,
    borderRadius: radius.pill,
    backgroundColor: color,
  }
  return (
    <View
      testID="stream-pause-mark"
      style={{ flexDirection: 'row', alignItems: 'center', gap }}
    >
      <View style={bar} />
      <View style={bar} />
    </View>
  )
}
