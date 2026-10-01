// The one player's bar above the tabs (plan 107), the same for a phrase and a song: a card that opens
// the player, plays or pauses and skips. Dragged sideways, the card follows the finger and the next or
// previous item comes in beside it; let go far enough (or flung) and that one takes its place, less and
// the card springs back. Any other change of item (Next, the loop moving on) slides the new card in
// from the side it came from. Its grades float above it, apart (BarGrades), and move with the card
// (barShift). Paused, the bar can be closed: its close button, or dragged down far enough (or flung).
import { ReactNode, useEffect, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { thresholdHaptic } from '@shared/ui/haptics';
import { useCopy } from '../state/store';
import { BarShift, useBarShift } from './barShift';
import { Marquee } from './Marquee';
import { Icon, IconName } from './Icon';
import { Press } from './Press';
import { holdClicks, releaseClicks } from './swallowClick';
import { Txt } from './Txt';
import { colors, radius, shadow, TARGET } from './theme';

/** Which way an item lies from the one showing: 1 is the next (to the right), -1 the previous. */
export type Side = 1 | -1;

/** An item on the bar: what tells it from the others, and its card. */
export interface MiniItem {
  key: string;
  card: ReactNode;
}

/** Between two cards side by side. */
const GAP = 12;
/** Far enough, or flung fast enough, to change items; less springs back. */
const SWIPE_DISTANCE = 72;
const SWIPE_VELOCITY = 500;
const FLING_MIN_DISTANCE = 24;
/** Where nothing lies that way, the card moves this share of the drag and springs back. */
const RESIST = 0.25;
const SLIDE_MS = 220;
const SPRING = { damping: 26, stiffness: 300 };
/** A swipe whose item hasn't changed this long after it said it would comes back. */
const LANDING_MS = 1500;
/** Dragged down this far, or flung down this fast, a paused bar closes; less springs back. */
const CLOSE_DISTANCE = 48;
const CLOSE_VELOCITY = 600;
/** How far the bar travels down as it goes. */
const CLOSE_TRAVEL = 120;

interface Strip {
  /** The item the bar shows, where it is in its queue, and which queue. */
  key: string;
  position: number;
  queue: string;
  /** Where the strip rests. A card is placed when it mounts, relative to it, and keeps that place. */
  rest: number;
  /** Cards on their way out (or back), as they last were. */
  leaving: { key: string }[];
  /** A swipe let go: the neighbour it brought to the middle, until the item becomes it. */
  swiped: { key: string; side: Side } | null;
  /** The move to make once the cards are placed. */
  move: { id: number } | null;
}

export function MiniCarousel({
  item,
  position,
  queue,
  can,
  neighbour,
  onSwipe,
  onClose,
}: {
  item: MiniItem;
  /** Where the item is in its queue, and which queue: a change says which way the bar moved. */
  position: number;
  queue: string;
  /** Whether there may be an item each way, before the neighbours are drawn. */
  can: { next: boolean; previous: boolean };
  /** The neighbour's card, drawn while the bar is dragged; null where there is none. */
  neighbour: (side: Side) => MiniItem | null;
  /** Moves to the neighbour; false when it couldn't (a song that didn't load). */
  onSwipe: (side: Side) => boolean | Promise<boolean>;
  /** Closes the bar (only while paused); dragged down, the bar goes. Undefined, it can't be closed. */
  onClose?: () => void;
}) {
  const reduce = useReducedMotion();
  const [width, setWidth] = useState(0);
  const span = width + GAP;
  const drag = useSharedValue(0);
  const [dragging, setDragging] = useState(false);
  const [strip, setStrip] = useState<Strip>({ key: item.key, position, queue, rest: 0, leaving: [], swiped: null, move: null });
  // The grades above follow the card; with the bar gone, they rest.
  const shift = useBarShift();
  useEffect(() => {
    shift?.span.set(span);
  }, [shift, span]);
  useEffect(() => () => shift?.x.set(0), [shift]);

  // The item changed: the cards are placed for the move here, while rendering, so the new card is
  // never drawn in the middle before it slides in.
  if (strip.key !== item.key) {
    if (strip.swiped?.key === item.key) {
      // The swipe landed: the neighbour in the middle is the item now, where it is.
      setStrip({ ...strip, key: item.key, position, queue, swiped: null });
    } else {
      const side: Side = queue !== strip.queue || position >= strip.position ? 1 : -1;
      const leaving = [...strip.leaving, { key: strip.key }, ...(strip.swiped ? [{ key: strip.swiped.key }] : [])];
      setStrip({
        key: item.key,
        position,
        queue,
        rest: strip.rest - side * span,
        leaving: leaving.filter((card) => card.key !== item.key),
        swiped: null,
        move: { id: (strip.move?.id ?? 0) + 1 },
      });
    }
  }

  const moveId = strip.move?.id;
  const rest = strip.rest;
  useEffect(() => {
    if (moveId === undefined) return;
    const settled = (finished?: boolean) => {
      if (finished) setStrip((s) => (s.move?.id === moveId ? { ...s, leaving: [], move: null } : s));
    };
    drag.set(withTiming(rest, { duration: reduce ? 0 : SLIDE_MS }, (finished) => runOnJS(settled)(finished)));
  }, [moveId, rest, reduce, drag]);

  // The neighbours are drawn only while the bar is dragged; until then `can` says where they may be.
  const next = dragging ? neighbour(1) : null;
  const previous = dragging ? neighbour(-1) : null;
  const nextKey = next && next.key !== item.key ? next.key : null;
  const previousKey = previous && previous.key !== item.key ? previous.key : null;
  const busy = strip.leaving.length > 0 || strip.swiped !== null || strip.move !== null;
  // Read by the gesture on the UI thread, kept current as the neighbours are drawn and the strip moves.
  const past = useSharedValue(false);
  const ways = useSharedValue({ next: nextKey, previous: previousKey, canNext: can.next, canPrevious: can.previous, dragging, rest, busy });
  useEffect(() => {
    ways.set({ next: nextKey, previous: previousKey, canNext: can.next, canPrevious: can.previous, dragging, rest, busy });
  }, [ways, nextKey, previousKey, can.next, can.previous, dragging, rest, busy]);

  // It didn't move after all: the card comes back and the neighbour goes.
  const back = (key: string) =>
    setStrip((s) => (s.swiped?.key !== key ? s : { ...s, rest: s.rest + s.swiped.side * span, leaving: [...s.leaving, { key }], swiped: null, move: { id: (s.move?.id ?? 0) + 1 } }));
  const land = (side: Side, key: string) => {
    setDragging(false);
    setStrip((s) => ({ ...s, rest: s.rest - side * span, swiped: { key, side } }));
    void Promise.resolve(onSwipe(side)).then((moved) => {
      if (!moved) back(key);
      else setTimeout(() => back(key), LANDING_MS);
    });
  };

  // Down and away: the bar follows the finger downwards only, and closes once let go far enough.
  const drop = useSharedValue(0);
  const closable = onClose !== undefined;
  const close = () => {
    onClose?.();
    drop.set(0);
  };
  const down = Gesture.Pan()
    .enabled(closable && !busy)
    .activeOffsetY(12)
    .failOffsetY(-12)
    .failOffsetX([-12, 12])
    .onStart(() => {
      past.set(false);
      runOnJS(holdClicks)();
    })
    .onUpdate((e) => {
      drop.set(Math.max(0, e.translationY));
      const far = e.translationY > CLOSE_DISTANCE;
      if (far !== past.get()) {
        past.set(far);
        runOnJS(thresholdHaptic)();
      }
    })
    .onEnd((e) => {
      if (e.translationY > CLOSE_DISTANCE || (e.translationY > FLING_MIN_DISTANCE && e.velocityY > CLOSE_VELOCITY)) {
        drop.set(
          withTiming(CLOSE_TRAVEL, { duration: reduce ? 0 : SLIDE_MS }, (finished) => {
            if (finished) runOnJS(close)();
          }),
        );
      } else {
        drop.set(withSpring(0, SPRING));
      }
    })
    .onFinalize(() => {
      runOnJS(releaseClicks)();
    });
  const dropped = useAnimatedStyle(() => ({
    opacity: interpolate(drop.get(), [0, CLOSE_TRAVEL], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: drop.get() }],
  }));

  const pan = Gesture.Pan()
    .enabled(width > 0 && !busy)
    .activeOffsetX([-12, 12])
    .failOffsetY([-12, 12])
    .onStart(() => {
      past.set(false);
      runOnJS(holdClicks)();
      runOnJS(setDragging)(true);
    })
    .onUpdate((e) => {
      const way = ways.get();
      // The item changed under the finger: its move has the strip.
      if (way.busy) return;
      // Until the neighbours are drawn, `can` says whether one may be there.
      const open = e.translationX < 0 ? (way.dragging ? way.next !== null : way.canNext) : way.dragging ? way.previous !== null : way.canPrevious;
      drag.set(way.rest + (open ? e.translationX : e.translationX * RESIST));
      // Far enough that letting go moves on, or back from there: felt either way.
      const far = open && Math.abs(e.translationX) > Math.min(SWIPE_DISTANCE, span * 0.3);
      if (far !== past.get()) {
        past.set(far);
        runOnJS(thresholdHaptic)();
      }
    })
    .onEnd((e) => {
      const way = ways.get();
      if (way.busy) {
        runOnJS(setDragging)(false);
        return;
      }
      const side: Side = e.translationX < 0 ? 1 : -1;
      const key = side === 1 ? way.next : way.previous;
      const far = Math.abs(e.translationX) > Math.min(SWIPE_DISTANCE, span * 0.3) || (Math.abs(e.translationX) > FLING_MIN_DISTANCE && -side * e.velocityX > SWIPE_VELOCITY);
      if (key !== null && far) {
        drag.set(
          withTiming(way.rest - side * span, { duration: reduce ? 0 : SLIDE_MS }, (finished) => {
            if (finished) runOnJS(land)(side, key);
          }),
        );
      } else {
        drag.set(
          withSpring(way.rest, SPRING, (finished) => {
            if (finished) runOnJS(setDragging)(false);
          }),
        );
      }
    })
    .onFinalize(() => {
      runOnJS(releaseClicks)();
    });

  // Each card once: the item's own first, then those leaving, the swipe's, and the neighbours.
  const slots: { key: string; at: number; live: boolean; frozen: boolean; node: ReactNode }[] = [];
  const add = (slot: (typeof slots)[number]) => {
    if (!slots.some((s) => s.key === slot.key)) slots.push(slot);
  };
  add({ key: item.key, at: -rest, live: true, frozen: false, node: item.card });
  for (const card of strip.leaving) add({ key: card.key, at: -rest, live: false, frozen: true, node: null });
  if (strip.swiped) add({ key: strip.swiped.key, at: -rest, live: false, frozen: true, node: null });
  if (next && nextKey) add({ key: nextKey, at: span - rest, live: false, frozen: false, node: next.card });
  if (previous && previousKey) add({ key: previousKey, at: -span - rest, live: false, frozen: false, node: previous.card });

  return (
    <GestureDetector gesture={Gesture.Race(pan, down)}>
      <Animated.View style={dropped} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
        {/* The item's own card last, over the others. */}
        {[...slots.slice(1), slots[0]].map((slot) => (
          <Slide key={slot.key} drag={drag} at={slot.at} span={span} live={slot.live} frozen={slot.frozen} shift={shift}>
            {slot.node}
          </Slide>
        ))}
      </Animated.View>
    </GestureDetector>
  );
}

/**
 * A card on the strip: placed once, at `at`, and moved with it; fading as it leaves the middle. The
 * item's own card says where it is, for its grades (`shift`).
 */
function Slide({
  drag,
  at,
  span,
  live,
  frozen,
  shift,
  children,
}: {
  drag: SharedValue<number>;
  at: number;
  span: number;
  live: boolean;
  frozen: boolean;
  shift: BarShift | null;
  children: ReactNode;
}) {
  const [base] = useState(at);
  useAnimatedReaction(
    () => base + drag.get(),
    (x) => {
      if (live && shift) shift.x.set(x);
    },
    [live, shift, base],
  );
  // The card as it last was, kept while it leaves.
  const [last, setLast] = useState(children);
  if (!frozen && last !== children) setLast(children);
  const moved = useAnimatedStyle(() => {
    const x = base + drag.get();
    return { opacity: interpolate(Math.abs(x), [0, span], [1, 0], Extrapolation.CLAMP), transform: [{ translateX: x }] };
  });
  return (
    <Animated.View
      accessibilityElementsHidden={!live}
      importantForAccessibility={live ? 'auto' : 'no-hide-descendants'}
      style={[live ? styles.live : styles.beside, moved]}
    >
      {frozen ? last : children}
    </Animated.View>
  );
}

/** One item's card: its cover and words open the player; play or pause; next; close, while paused; how far it has played. */
export function MiniCard({
  cover,
  badge,
  title,
  status,
  open,
  playing,
  onToggle,
  next,
  onClose,
  progress,
}: {
  cover: ReactNode;
  /** The small icon on the cover: what is playing (a step of the loop, a song). */
  badge: IconName | null;
  title: ReactNode;
  status: string;
  open: { label: string; hint?: string; onPress?: () => void };
  playing: boolean;
  onToggle?: () => void;
  next: { label: string; onPress?: () => void; disabled?: boolean };
  /** Closes the bar; shown while paused. */
  onClose?: () => void;
  /** Along the bottom: how far the item has played. */
  progress: ReactNode;
}) {
  const c = useCopy();
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Press accessibilityRole="button" accessibilityLabel={open.label} accessibilityHint={open.hint} onPress={open.onPress} style={styles.open}>
          <View>
            {cover}
            {badge && (
              <View style={styles.badge}>
                <Icon name={badge} size={14} color="onPrimaryFixed" />
              </View>
            )}
          </View>
          <View style={styles.text}>
            {/* A title too long for the bar reads across, so it can be read in full. */}
            <Marquee>{title}</Marquee>
            <Txt variant="label" color="secondaryFixedDim" numberOfLines={1}>
              {status}
            </Txt>
          </View>
        </Press>
        <Press
          accessibilityRole="button"
          accessibilityLabel={playing ? c.common.pause : c.common.play}
          onPress={onToggle}
          style={({ pressed }) => [styles.play, pressed && { opacity: 0.8 }]}
        >
          <Icon name={playing ? 'pause' : 'play_arrow'} fill size="lg" color="onPrimaryFixed" />
        </Press>
        <Press
          accessibilityRole="button"
          accessibilityLabel={next.label}
          disabled={next.disabled}
          onPress={next.onPress}
          style={({ pressed }) => [styles.next, pressed && { opacity: 0.7 }, next.disabled && { opacity: 0.4 }]}
        >
          <Icon name="skip_next" fill size="lg" color="inverseOnSurface" />
        </Press>
        {!playing && onClose && (
          <Press accessibilityRole="button" accessibilityLabel={c.player.close} onPress={onClose} style={({ pressed }) => [styles.next, pressed && { opacity: 0.7 }]}>
            <Icon name="close" size="lg" color="inverseOnSurface" />
          </Press>
        )}
      </View>
      <View style={styles.track} accessible={false}>
        {progress}
      </View>
    </View>
  );
}

/** The track's fill: a share of the item played. */
export function MiniProgress({ share }: { share: number }) {
  return <View style={[styles.fill, { width: `${Math.round(Math.min(1, Math.max(0, share)) * 100)}%` }]} />;
}

/** The fill's look, for a timed fill (PhaseFill) in the same track. */
export const miniFill = { height: 4, backgroundColor: colors.primaryFixed, borderRadius: radius.full };

const styles = StyleSheet.create({
  live: { pointerEvents: 'auto' },
  beside: { position: 'absolute', left: 0, right: 0, bottom: 0, pointerEvents: 'none' },
  card: { borderRadius: radius['2xl'], backgroundColor: colors.inverseSurface, overflow: 'hidden', ...shadow.float },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 8 },
  open: { flex: 1, minWidth: 0, minHeight: TARGET, flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 20,
    height: 20,
    borderRadius: radius.full,
    backgroundColor: colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.inverseSurface,
  },
  text: { flex: 1, minWidth: 0 },
  play: { width: TARGET, height: TARGET, borderRadius: radius.full, backgroundColor: colors.primaryFixed, alignItems: 'center', justifyContent: 'center' },
  next: { width: TARGET, height: TARGET, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  track: { position: 'absolute', left: 8, right: 8, bottom: 0, height: 4, borderRadius: radius.full, backgroundColor: 'rgba(243,240,235,0.2)', overflow: 'hidden' },
  fill: miniFill,
});
