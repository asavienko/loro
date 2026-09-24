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
export function stationeryElevations(
  kinds: readonly (keyof typeof shadow)[],
  pressed = false,
): ViewStyle {
  if (kinds.length === 0) return {}
  if (!pressed) {
    const recipe = kinds.map((kind) => shadow[kind]).join(', ')
    if (Platform.OS === 'web') return { boxShadow: recipe }
    return nativeStationeryShadow(recipe)
  }
  const layers = kinds.flatMap((kind) => parseStationeryShadowLayers(shadow[kind]))
  const next = layers.map((layer) =>
    layer.inset || layer.spread > 0 ? layer : reduceStationeryShadow(layer),
  )
  if (Platform.OS === 'web') return { boxShadow: formatWebStationeryShadows(next) }
  const contact = next.find((layer) => !layer.inset && layer.spread === 0)
  const ring = next.find((layer) => !layer.inset && layer.spread > 0)
  return {
    ...(contact === undefined ? {} : nativeShadowStyle(contact)),
    ...(ring === undefined ? {} : nativeShadowStyle(ring)),
  }
}

export function stationeryElevation(kind: keyof typeof shadow, pressed = false): ViewStyle {
  return stationeryElevations([kind], pressed)
}
