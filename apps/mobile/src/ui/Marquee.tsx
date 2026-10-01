// One line that doesn't fit, read in full: after a moment it glides to its end, rests, and comes back,
// over and over. Text that fits stays still, and so does any with reduced motion (it ends in "…").
import { ReactNode, useEffect, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

/** How long it rests at each end, and how fast it reads across (dp a second). */
const REST_MS = 1600;
const SPEED = 32;
const BACK_MS = 450;

/** `children`: the line, drawn on one line (numberOfLines={1}), as it would be without this. */
export function Marquee({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  const [box, setBox] = useState(0);
  const [full, setFull] = useState(0);
  const over = full - box;
  const scrolls = !reduce && box > 0 && over > 3;
  const x = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(x);
    x.set(0);
    if (!scrolls) return;
    const across = withTiming(-over, { duration: (over / SPEED) * 1000, easing: Easing.inOut(Easing.quad) });
    const back = withTiming(0, { duration: BACK_MS, easing: Easing.out(Easing.quad) });
    x.set(withRepeat(withSequence(withDelay(REST_MS, across), withDelay(REST_MS, back)), -1));
    return () => cancelAnimation(x);
  }, [scrolls, over, x]);
  const moving = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  return (
    <View style={styles.box} onLayout={(e: LayoutChangeEvent) => setBox(Math.floor(e.nativeEvent.layout.width))}>
      {/* The line at its own width, never seen or read: how far it runs past the box. */}
      <View style={styles.measure} pointerEvents="none" aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {/* A dp or two over: layout widths are rounded, and a hair too narrow ends the line in "…". */}
        <View onLayout={(e: LayoutChangeEvent) => setFull(Math.ceil(e.nativeEvent.layout.width) + 2)}>{children}</View>
      </View>
      <Animated.View style={[scrolls && { width: full }, moving]}>{children}</Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignSelf: 'stretch', overflow: 'hidden' },
  measure: { position: 'absolute', left: 0, top: 0, width: 4000, alignItems: 'flex-start', opacity: 0 },
});
