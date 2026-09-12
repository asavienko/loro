import { Platform, type ViewStyle } from 'react-native'
import { shadow } from '@loro/design-tokens'
import {
  formatWebStationeryShadows,
  nativeShadowStyle,
  nativeStationeryShadow,
  parseStationeryShadowLayers,
  reduceStationeryShadow,
} from './stationeryShadow'

export {
  DEBOSS_TRANSLATE_Y,
  formatWebStationeryShadow,
  formatWebStationeryShadows,
  mixStationeryShadow,
  nativeShadowStyle,
  nativeStationeryShadow,
  parseStationeryShadow,
  parseStationeryShadowLayers,
  reduceStationeryShadow,
} from './stationeryShadow'
export type { StationeryShadow } from './stationeryShadow'

/** Web keeps the generated CSS string; native maps it onto RN shadow props. */
export function stationeryElevation(kind: keyof typeof shadow, pressed = false): ViewStyle {
  if (!pressed) {
    if (Platform.OS === 'web') return { boxShadow: shadow[kind] }
    return nativeStationeryShadow(shadow[kind])
  }
  const reduced = parseStationeryShadowLayers(shadow[kind]).map((layer) =>
    layer.inset ? layer : reduceStationeryShadow(layer),
  )
  if (Platform.OS === 'web') return { boxShadow: formatWebStationeryShadows(reduced) }
  const contact = reduced.find((layer) => !layer.inset)
  return contact === undefined ? {} : nativeShadowStyle(contact)
}
