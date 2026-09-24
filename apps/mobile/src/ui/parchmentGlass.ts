/**
 * v1.2 parchment glass.
 *
 * The authored 28-px spine, stack header and Today header use Today-phone 85% glass plus a
 * 1 px warm hairline. DESIGN.md's Floating Island Navigation is the suspended ActionBar —
 * 92% parchment, the same 12 px blur, and `shadow.float`. This helper does not invent a
 * 64-px Study Desk bar or a 4-tab dock, and it does not change spine opacity or height.
 */

import { Platform, type ViewStyle } from 'react-native'
import { stationeryElevation } from './elevation'
import { GLASS_BLUR_PX, chromeHairlineFill, glassFill, islandGlassFill } from './parchmentInk'

export {
  CHROME_GUTTER,
  GLASS_ALPHA,
  GLASS_BLUR_PX,
  ISLAND_GLASS_ALPHA,
  chromeHairlineFill,
  glassFill,
  hexAlpha,
  islandGlassFill,
} from './parchmentInk'

function glassStyle(fill: string): ViewStyle {
  const style: ViewStyle = {
    backgroundColor: fill,
  }
  if (Platform.OS === 'web') {
    Object.assign(style, {
      backdropFilter: `blur(${GLASS_BLUR_PX}px)`,
      WebkitBackdropFilter: `blur(${GLASS_BLUR_PX}px)`,
    })
  }
  return style
}

/** 85% spine / stack / Today header glass. */
export function parchmentGlassStyle(): ViewStyle {
  return glassStyle(glassFill)
}

/** 92% DESIGN.md floating island — ActionBar only. */
export function parchmentIslandGlassStyle(): ViewStyle {
  return glassStyle(islandGlassFill)
}

/** Today / Review header `0 1px 8px` — generated `shadow.headerHairline`. */
export function chromeHairlineShadow(): ViewStyle {
  return stationeryElevation('headerHairline')
}
