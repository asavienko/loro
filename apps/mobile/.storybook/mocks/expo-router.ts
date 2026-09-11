import { useEffect, type EffectCallback } from 'react'

/** Storybook is outside Expo Router. Focus-owned chrome still needs the effect lifecycle. */
export function useFocusEffect(effect: EffectCallback): void {
  useEffect(effect)
}
