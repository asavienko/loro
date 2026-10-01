// Windows that slide up from the bottom (the player, the queue, Make a set, the account, and the
// sheets) go back down the same way: pulled by their top (a grabber over the header), they follow the
// finger; let go past a quarter of the way, or flung down, they close; less and they spring back.
// Only the top takes the pull, so a scrolling list inside never fights it.
import { createContext, ReactNode, useContext } from 'react';
import { LayoutChangeEvent, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Gesture, GestureDetector, PanGesture } from 'react-native-gesture-handler';
import Animated, { runOnJS, SharedValue, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { thresholdHaptic } from '@shared/ui/haptics';
import { holdClicks, releaseClicks } from './swallowClick';
import { colors, radius } from './theme';

/** Past this share of the window's height (at most CLOSE_MAX), or flung, it closes. */
const CLOSE_SHARE = 0.25;
const CLOSE_MAX = 160;
const FLING = 900;
const FLING_MIN_DISTANCE = 24;
const OUT_MS = 180;
const SPRING = { damping: 30, stiffness: 320 };
/** A window still showing this long after it was asked to close comes back up. */
const STAYED_MS = 700;

/** How far down a window of this height is pulled to close when let go. */
function closeAt(height: number) {
  'worklet';
  return Math.min(CLOSE_MAX, (height > 0 ? height : 800) * CLOSE_SHARE);
}

export interface PullDown {
  /** How far the window is pulled down. */
  y: SharedValue<number>;
  /** Its height, measured: how far it has to go to be gone. */
  height: SharedValue<number>;
  gesture: PanGesture;
  onLayout: (e: LayoutChangeEvent) => void;
}

export function usePullDown(onClose: () => void): PullDown {
  const y = useSharedValue(0);
  const height = useSharedValue(0);
  const reduce = useReducedMotion();
  // Far enough down that letting go closes it: each change is felt.
  const past = useSharedValue(false);
  const close = () => {
    onClose();
    // If something kept it open it comes back to its place; a window gone by then (or a sheet,
    // hidden by then) moves unseen.
    setTimeout(() => y.set(withSpring(0, SPRING)), STAYED_MS);
  };
  const gesture = Gesture.Pan()
    .activeOffsetY(10)
    .failOffsetY(-10)
    .failOffsetX([-24, 24])
    .onStart(() => {
      past.set(false);
      runOnJS(holdClicks)();
    })
    .onUpdate((e) => {
      y.set(Math.max(0, e.translationY));
      const far = y.get() > closeAt(height.get());
      if (far !== past.get()) {
        past.set(far);
        runOnJS(thresholdHaptic)();
      }
    })
    .onEnd((e) => {
      const full = height.get() > 0 ? height.get() : 800;
      const pulled = y.get();
      if (pulled > closeAt(full) || (e.velocityY > FLING && pulled > FLING_MIN_DISTANCE)) {
        y.set(
          withTiming(full, { duration: reduce ? 0 : OUT_MS }, (finished) => {
            if (finished) runOnJS(close)();
          }),
        );
      } else y.set(withSpring(0, SPRING));
    })
    .onFinalize(() => {
      runOnJS(releaseClicks)();
    });
  return { y, height, gesture, onLayout: (e) => height.set(e.nativeEvent.layout.height) };
}

const PullContext = createContext<PanGesture | null>(null);

/** A full-screen window that slid up from the bottom: pulled down by its PullHandle, it closes. */
export function PullDownWindow({ onClose, style, children }: { onClose: () => void; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const pull = usePullDown(onClose);
  const moved = useAnimatedStyle(() => ({ transform: [{ translateY: pull.y.get() }] }));
  return (
    <PullContext.Provider value={pull.gesture}>
      <Animated.View onLayout={pull.onLayout} style={[styles.window, style, moved]}>
        {children}
      </Animated.View>
    </PullContext.Provider>
  );
}

/** Where a window is pulled down from: a grabber, then the header it wraps. */
export function PullHandle({ children, style }: { children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const gesture = useContext(PullContext);
  const handle = (
    <View style={style}>
      <Grabber />
      {children}
    </View>
  );
  return gesture ? <GestureDetector gesture={gesture}>{handle}</GestureDetector> : handle;
}

/** The short bar that says a window can be pulled down. Decorative: Close does the same for everyone. */
export function Grabber() {
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={styles.grabberZone}>
      <View style={styles.grabber} />
    </View>
  );
}

const styles = StyleSheet.create({
  window: { flex: 1 },
  grabberZone: { alignItems: 'center', paddingTop: 6, paddingBottom: 2 },
  grabber: { width: 36, height: 4, borderRadius: radius.full, backgroundColor: colors.outlineVariant },
});
