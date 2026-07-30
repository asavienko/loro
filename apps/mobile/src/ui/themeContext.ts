import { accents, defaultAccent, type AccentName } from '@loro/design-tokens'

export type AccentTheme = (typeof accents)[AccentName]
export type TextScale = 1 | 2 | 3.1

export interface RuntimeTheme {
  accentName: AccentName
  accent: AccentTheme
  reducedMotion: boolean
  textScale: TextScale
}

/** Pure resolution kept separate from React Native so every fallback is cheap to pin in tests. */
export function resolveTheme(
  accentName: AccentName | undefined,
  reducedMotion: boolean | undefined,
  systemReducedMotion: boolean,
  textScale: TextScale | undefined,
): RuntimeTheme {
  const resolvedAccent = accentName ?? defaultAccent
  return {
    accentName: resolvedAccent,
    accent: accents[resolvedAccent],
    reducedMotion: reducedMotion ?? systemReducedMotion,
    textScale: textScale ?? 1,
  }
}
