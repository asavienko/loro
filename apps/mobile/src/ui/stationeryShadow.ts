import type { ViewStyle } from 'react-native'

export interface StationeryShadow {
  inset: boolean
  offsetX: number
  offsetY: number
  blur: number
  r: number
  g: number
  b: number
  opacity: number
}

const LENGTH = '(-?\\d+(?:\\.\\d+)?)(?:px)?'
const LAYER = new RegExp(
  `(inset\\s+)?${LENGTH}\\s+${LENGTH}\\s+${LENGTH}\\s+rgba\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d*\\.?\\d+)\\s*\\)`,
  'g',
)

/** Read every layer from a generated CSS shadow recipe, including DESIGN.md dual shadows. */
export function parseStationeryShadowLayers(recipe: string): StationeryShadow[] {
  const trimmed = recipe.trim()
  const layers: StationeryShadow[] = []
  LAYER.lastIndex = 0
  let cursor = 0
  let match: RegExpExecArray | null
  while ((match = LAYER.exec(trimmed)) !== null) {
    const between = trimmed.slice(cursor, match.index).trim()
    if (between !== '' && between !== ',') {
      throw new Error(`unrecognised stationery shadow: ${recipe}`)
    }
    layers.push({
      inset: match[1] !== undefined,
      offsetX: Number(match[2]),
      offsetY: Number(match[3]),
      blur: Number(match[4]),
      r: Number(match[5]),
      g: Number(match[6]),
      b: Number(match[7]),
      opacity: Number(match[8]),
    })
    cursor = match.index + match[0].length
  }
  if (layers.length === 0 || trimmed.slice(cursor).trim() !== '') {
    throw new Error(`unrecognised stationery shadow: ${recipe}`)
  }
  return layers
}

/** Read the first layer from a generated CSS shadow recipe. */
export function parseStationeryShadow(recipe: string): StationeryShadow {
  const layer = parseStationeryShadowLayers(recipe)[0]
  if (layer === undefined) throw new Error(`unrecognised stationery shadow: ${recipe}`)
  return layer
}

function hexFromRgb(r: number, g: number, b: number): string {
  const byte = (n: number): string => n.toString(16).padStart(2, '0')
  return `#${byte(r)}${byte(g)}${byte(b)}`
}

/** DESIGN.md flashcard / primary press: translate-y 1px with a reduced contact shadow. */
export const DEBOSS_TRANSLATE_Y = 1

/** Halve the ambient recipe so a press reads as paper pushed into the desk. */
export function reduceStationeryShadow(parsed: StationeryShadow): StationeryShadow {
  if (parsed.inset) return parsed
  return {
    ...parsed,
    offsetY: parsed.offsetY > 1 ? 1 : parsed.offsetY,
    blur: Math.max(2, Math.round(parsed.blur / 2)),
    opacity: parsed.opacity / 2,
  }
}

export function mixStationeryShadow(
  from: StationeryShadow,
  to: StationeryShadow,
  t: number,
): StationeryShadow {
  const amount = t < 0 ? 0 : t > 1 ? 1 : t
  const lerp = (a: number, b: number): number => a + (b - a) * amount
  return {
    inset: from.inset,
    offsetX: lerp(from.offsetX, to.offsetX),
    offsetY: lerp(from.offsetY, to.offsetY),
    blur: lerp(from.blur, to.blur),
    r: from.r,
    g: from.g,
    b: from.b,
    opacity: lerp(from.opacity, to.opacity),
  }
}

export function formatWebStationeryShadow(parsed: StationeryShadow): string {
  const inset = parsed.inset ? 'inset ' : ''
  return `${inset}${parsed.offsetX}px ${parsed.offsetY}px ${parsed.blur}px rgba(${parsed.r},${parsed.g},${parsed.b},${parsed.opacity})`
}

export function formatWebStationeryShadows(layers: readonly StationeryShadow[]): string {
  return layers.map(formatWebStationeryShadow).join(', ')
}

export function nativeShadowStyle(parsed: StationeryShadow): ViewStyle {
  if (parsed.inset) return {}
  return {
    shadowColor: hexFromRgb(parsed.r, parsed.g, parsed.b),
    shadowOffset: { width: parsed.offsetX, height: parsed.offsetY },
    shadowOpacity: parsed.opacity,
    shadowRadius: parsed.blur,
    elevation: Math.max(0, Math.round(Math.abs(parsed.offsetY))),
  }
}

/** iOS contact shadow + Android elevation, derived from the generated recipe. */
export function nativeStationeryShadow(recipe: string): ViewStyle {
  const layer = parseStationeryShadowLayers(recipe).find((item) => !item.inset)
  return layer === undefined ? {} : nativeShadowStyle(layer)
}
