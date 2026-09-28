import { useEffect } from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { clock } from '@shared/state/clock';
import { useStore } from '../state/store';

/**
 * A bar over the learner's turn or the rating hold (the web's src/ui/PhaseFill.tsx), filling or
 * depleting over the length the machine fixed when the phase started: a real timer, not an
 * estimate. Nothing in other phases or while paused. Decorative.
 */
export function PhaseFill({ style, deplete = false }: { style: ViewStyle; deplete?: boolean }) {
  const { state } = useStore();
  const { status, phaseStartedAt, phaseMs } = state.player;
  const running = status === 'playing' && phaseStartedAt !== null && phaseMs !== null && phaseMs > 0;
  const reduce = useReducedMotion();
  const fraction = useSharedValue(0);
  useEffect(() => {
    if (!running) return;
    const elapsed = Math.min(phaseMs!, Math.max(0, clock.now() - phaseStartedAt!));
    fraction.value = elapsed / phaseMs!;
    if (reduce) {
      const id = setInterval(() => {
        fraction.value = Math.min(1, (clock.now() - phaseStartedAt!) / phaseMs!);
      }, 1000);
      return () => clearInterval(id);
    }
    fraction.value = withTiming(1, { duration: phaseMs! - elapsed, easing: Easing.linear });
    return () => cancelAnimation(fraction);
  }, [running, phaseStartedAt, phaseMs, reduce, fraction]);
  const animated = useAnimatedStyle(() => ({ width: `${(deplete ? 1 - fraction.value : fraction.value) * 100}%` }));
  if (!running) return null;
  return <Animated.View accessible={false} importantForAccessibility="no" style={[StyleSheet.absoluteFill, { right: undefined }, style, animated]} />;
}
