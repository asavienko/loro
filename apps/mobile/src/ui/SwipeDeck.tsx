// A stack of cards to decide one at a time (the web prototype's src/ui/SwipeDeck.tsx), like a dating
// app's: drag the top card right for yes, left for no. The stamps say which while it is dragged.
// Buttons and keys elsewhere throw the card the same way (through `ref`), and `travel` says how the
// next card arrives. Domain-free: the caller draws each card's face.
import { ReactNode, RefObject, useEffect, useImperativeHandle, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Extrapolation, interpolate, runOnJS, SharedValue, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Txt } from './Txt';
import { colors, radius, shadow } from './theme';

/** Right is yes (add), left is no (skip). */
export type SwipeDirection = 1 | -1;

/** How cards move: which way the last one left, and whether the top card is one coming back (undo). */
export interface SwipeTravel {
  direction: SwipeDirection;
  returning: boolean;
}

export interface SwipeCard {
  key: string;
  node: ReactNode;
}

/** Decides the top card from a button or a key: it flies off that side, then `onSwipe` runs. */
export interface SwipeDeckHandle {
  throwCard: (direction: SwipeDirection) => void;
}

/** Far enough, or flung fast enough, to count; less springs back. */
const SWIPE_DISTANCE = 110;
const SWIPE_VELOCITY = 600;
const FLING_MIN_DISTANCE = 30;
const OFF = 440;

/** A new card rises from under the old one; a card taken back flies in from the side it left by. */
const arrival = (t: SwipeTravel) => (t.returning ? { x: t.direction * 380, y: 0, scale: 1, opacity: 0 } : { x: 0, y: 12, scale: 0.95, opacity: 1 });

export function SwipeDeck({
  ref,
  top,
  under,
  travel,
  stamps,
  onSwipe,
  disabled = false,
}: {
  ref?: RefObject<SwipeDeckHandle | null>;
  top: SwipeCard | null;
  under: SwipeCard | null;
  travel: SwipeTravel;
  stamps: { yes: string; no: string };
  onSwipe: (direction: SwipeDirection) => void;
  /** While a card is being corrected it stays put. */
  disabled?: boolean;
}) {
  return (
    <View>
      {/* The next card waits under the top one, a picture only. */}
      {under && (
        <View style={[styles.card, styles.under]} accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden pointerEvents="none">
          {under.node}
        </View>
      )}
      {top && (
        <TopCard key={top.key} handle={ref} travel={travel} stamps={stamps} onSwipe={onSwipe} disabled={disabled}>
          {top.node}
        </TopCard>
      )}
    </View>
  );
}

function TopCard({
  children,
  handle,
  travel,
  stamps,
  onSwipe,
  disabled,
}: {
  children: ReactNode;
  handle?: RefObject<SwipeDeckHandle | null>;
  travel: SwipeTravel;
  stamps: { yes: string; no: string };
  onSwipe: (direction: SwipeDirection) => void;
  disabled: boolean;
}) {
  const reduceMotion = useReducedMotion();
  // Where it arrives from is fixed when it mounts; it then settles into place.
  const [from] = useState(() => (reduceMotion ? arrival({ direction: 1, returning: false }) : arrival(travel)));
  const x = useSharedValue(from.x);
  const y = useSharedValue(from.y);
  const scale = useSharedValue(from.scale);
  const shown = useSharedValue(from.opacity);
  useEffect(() => {
    const settle = { duration: reduceMotion ? 0 : 240 };
    x.set(withTiming(0, settle));
    y.set(withTiming(0, settle));
    scale.set(withTiming(1, settle));
    shown.set(withTiming(1, settle));
  }, [x, y, scale, shown, reduceMotion]);
  // Decided: it is flying off its side, and takes no second decision on the way.
  const [thrown, setThrown] = useState(false);

  const decide = (direction: SwipeDirection) => onSwipe(direction);
  const fly = (direction: SwipeDirection) => {
    'worklet';
    x.set(withTiming(direction * OFF, { duration: reduceMotion ? 0 : 200 }, (finished) => {
      if (finished) runOnJS(decide)(direction);
    }));
  };
  useImperativeHandle(handle, () => ({
    throwCard: (direction) => {
      if (thrown || disabled) return;
      setThrown(true);
      fly(direction);
    },
  }));
  const pan = Gesture.Pan()
    .enabled(!disabled && !thrown)
    .activeOffsetX([-10, 10])
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      x.set(e.translationX * 0.85);
    })
    .onEnd((e) => {
      const dx = e.translationX;
      const vx = e.velocityX;
      const direction: SwipeDirection | 0 =
        dx > SWIPE_DISTANCE || (vx > SWIPE_VELOCITY && dx > FLING_MIN_DISTANCE) ? 1 : dx < -SWIPE_DISTANCE || (vx < -SWIPE_VELOCITY && dx < -FLING_MIN_DISTANCE) ? -1 : 0;
      if (direction === 0) {
        x.set(withSpring(0, { damping: 28, stiffness: 320 }));
        return;
      }
      runOnJS(setThrown)(true);
      fly(direction);
    });

  const moved = useAnimatedStyle(() => ({
    opacity: shown.value * interpolate(Math.abs(x.value), [OFF * 0.6, OFF], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateX: x.value }, { translateY: y.value }, { rotate: `${interpolate(x.value, [-260, 0, 260], [-14, 0, 14])}deg` }, { scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={pan}>
      {/* While it can be dragged, a press on its words starts the drag rather than selecting them. */}
      <Animated.View style={[styles.card, styles.top, !disabled && (styles.noSelect as object), moved]}>
        <Stamp x={x} side="yes">
          {stamps.yes}
        </Stamp>
        <Stamp x={x} side="no">
          {stamps.no}
        </Stamp>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

/** What a drag will do, shown on the card as it goes: a stamp that firms up with the distance. */
function Stamp({ x, side, children }: { x: SharedValue<number>; side: 'yes' | 'no'; children: string }) {
  const shown = useAnimatedStyle(() => ({
    opacity: side === 'yes' ? interpolate(x.value, [24, SWIPE_DISTANCE], [0, 1], Extrapolation.CLAMP) : interpolate(x.value, [-SWIPE_DISTANCE, -24], [1, 0], Extrapolation.CLAMP),
  }));
  return (
    <Animated.View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      pointerEvents="none"
      style={[styles.stamp, side === 'yes' ? styles.stampYes : styles.stampNo, shown]}
    >
      <Txt variant="title" weight={700} color={side === 'yes' ? 'onTertiaryFixed' : 'inverseOnSurface'}>
        {children}
      </Txt>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  top: { zIndex: 10 },
  card: { borderRadius: radius['3xl'], backgroundColor: colors.surfaceContainerLowest, ...shadow.float },
  under: { ...StyleSheet.absoluteFillObject, opacity: 0.8, transform: [{ translateY: 12 }, { scale: 0.95 }] },
  // A web style (react-native-web): not in the native style types.
  noSelect: { userSelect: 'none' },
  stamp: { position: 'absolute', top: 20, zIndex: 10, paddingHorizontal: 12, paddingVertical: 4, borderRadius: radius.xl, borderWidth: 2 },
  stampYes: { left: 20, transform: [{ rotate: '-12deg' }], borderColor: colors.tertiaryContainer, backgroundColor: colors.tertiaryFixed },
  stampNo: { right: 20, transform: [{ rotate: '12deg' }], borderColor: colors.inverseSurface, backgroundColor: colors.inverseSurface },
});
