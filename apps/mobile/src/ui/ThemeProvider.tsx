import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AccessibilityInfo } from 'react-native'
import type { AccentName } from './theme'
import { resolveTheme, type RuntimeTheme, type TextScale } from './themeContext'

const ThemeContext = createContext<RuntimeTheme | null>(null)

function useSystemReducedMotion(enabled: boolean) {
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    if (!enabled) return

    let mounted = true
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReducedMotion(value)
    })
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion)
    return () => {
      mounted = false
      subscription.remove()
    }
  }, [enabled])

  return reducedMotion
}

/**
 * The runtime inspection seam for production UI.
 *
 * Omit `accent` to use the generated default (Coral). Omit `reducedMotion` to follow the
 * platform accessibility preference; workbench specimens can pass either value explicitly
 * without changing learner settings. `textScale` is an inspection-only text multiplier and
 * defaults to the production scale of 1.
 */
export function ThemeProvider({
  children,
  accent,
  reducedMotion,
  textScale,
}: {
  children: ReactNode
  accent?: AccentName | undefined
  reducedMotion?: boolean | undefined
  textScale?: TextScale | undefined
}) {
  const systemReducedMotion = useSystemReducedMotion(reducedMotion === undefined)
  const value = useMemo(
    () => resolveTheme(accent, reducedMotion, systemReducedMotion, textScale),
    [accent, reducedMotion, systemReducedMotion, textScale],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): RuntimeTheme {
  const theme = useContext(ThemeContext)
  if (theme === null) throw new Error('useTheme must be used within ThemeProvider')
  return theme
}

export type { AccentTheme, RuntimeTheme, TextScale } from './themeContext'
