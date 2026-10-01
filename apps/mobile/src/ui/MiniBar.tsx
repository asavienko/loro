// The one player's bar above the tabs (plan 107), the same for a phrase and a song: a card that opens
// the player, plays or pauses, skips, and takes a rating. Dragged sideways, the card follows the
// finger and the next or previous item comes in beside it; let go far enough (or flung) and that one
// takes its place, less and the card springs back. Any other change of item (Next, the loop moving on)
// slides the new card in from the side it came from, and a rating that moved the loop on shows on the
// rated card for a moment first. The grades give way to the grade given while it can be undone.
import { ReactNode, useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  FadeIn,
  interpolate,
  runOnJS,
  SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { Grade } from '@shared/state/types';
import { useCopy } from '../state/store';
import { GRADES } from './grades';
import { Icon, IconName } from './Icon';
import { holdClicks, releaseClicks } from './swallowClick';
import { Txt } from './Txt';
import { colors, radius, shadow, TARGET } from './theme';
import { useRoom } from './useRoom';

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
/** How long a rated card stays, saying its grade, before the next one slides in. */
const HOLD_MS = 900;
const SPRING = { damping: 26, stiffness: 300 };
/** A swipe whose item hasn't changed this long after it said it would comes back. */
const LANDING_MS = 1500;

interface Strip {
  /** The item the bar shows, where it is in its queue, and which queue. */
  key: string;
  position: number;
  queue: string;
  /** Where the strip rests. A card is placed when it mounts, relative to it, and keeps that place. */
  rest: number;
  /** Cards on their way out (or back): as they last were, or as `node` says. */
  leaving: { key: string; node?: ReactNode }[];
  /** A swipe let go: the neighbour it brought to the middle, until the item becomes it. */
  swiped: { key: string; side: Side } | null;
  /** The move to make once the cards are placed. */
  move: { id: number; delay: number } | null;
  /** The held card already shown, so it is shown once. */
  heldShown: MiniItem | null;
}

export function MiniCarousel({
  item,
  position,
  queue,
  can,
  neighbour,
  onSwipe,
  held,
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
  /** The rated card, shown in place of the item's own as it leaves: a rating that moved the loop on. */
  held: MiniItem | null;
}) {
  const reduce = useReducedMotion();
  const [width, setWidth] = useState(0);
  const span = width + GAP;
  const drag = useSharedValue(0);
  const [dragging, setDragging] = useState(false);
  const [strip, setStrip] = useState<Strip>({ key: item.key, position, queue, rest: 0, leaving: [], swiped: null, move: null, heldShown: null });

  // The item changed: the cards are placed for the move here, while rendering, so the new card is
  // never drawn in the middle before it slides in.
  if (strip.key !== item.key) {
    if (strip.swiped?.key === item.key) {
      // The swipe landed: the neighbour in the middle is the item now, where it is.
      setStrip({ ...strip, key: item.key, position, queue, swiped: null });
    } else {
      const side: Side = queue !== strip.queue || position >= strip.position ? 1 : -1;
      const holding = held !== null && held.key === strip.key && held !== strip.heldShown;
      const leaving = [...strip.leaving, { key: strip.key, node: holding ? held.card : undefined }, ...(strip.swiped ? [{ key: strip.swiped.key }] : [])];
      setStrip({
        key: item.key,
        position,
        queue,
        rest: strip.rest - side * span,
        leaving: leaving.filter((card) => card.key !== item.key),
        swiped: null,
        move: { id: (strip.move?.id ?? 0) + 1, delay: holding ? HOLD_MS : 0 },
        heldShown: holding ? held : strip.heldShown,
      });
    }
  }

  const moveId = strip.move?.id;
  const moveDelay = strip.move?.delay ?? 0;
  const rest = strip.rest;
  useEffect(() => {
    if (moveId === undefined) return;
    const settled = (finished?: boolean) => {
      if (finished) setStrip((s) => (s.move?.id === moveId ? { ...s, leaving: [], move: null } : s));
    };
    drag.set(withDelay(moveDelay, withTiming(rest, { duration: reduce ? 0 : SLIDE_MS }, (finished) => runOnJS(settled)(finished))));
  }, [moveId, moveDelay, rest, reduce, drag]);

  // The neighbours are drawn only while the bar is dragged; until then `can` says where they may be.
  const next = dragging ? neighbour(1) : null;
  const previous = dragging ? neighbour(-1) : null;
  const nextKey = next && next.key !== item.key ? next.key : null;
  const previousKey = previous && previous.key !== item.key ? previous.key : null;
  const busy = strip.leaving.length > 0 || strip.swiped !== null || strip.move !== null;
  // Read by the gesture on the UI thread, kept current as the neighbours are drawn and the strip moves.
  const ways = useSharedValue({ next: nextKey, previous: previousKey, canNext: can.next, canPrevious: can.previous, dragging, rest, busy });
  useEffect(() => {
    ways.set({ next: nextKey, previous: previousKey, canNext: can.next, canPrevious: can.previous, dragging, rest, busy });
  }, [ways, nextKey, previousKey, can.next, can.previous, dragging, rest, busy]);

  // It didn't move after all: the card comes back and the neighbour goes.
  const back = (key: string) =>
    setStrip((s) => (s.swiped?.key !== key ? s : { ...s, rest: s.rest + s.swiped.side * span, leaving: [...s.leaving, { key }], swiped: null, move: { id: (s.move?.id ?? 0) + 1, delay: 0 } }));
  const land = (side: Side, key: string) => {
    setDragging(false);
    setStrip((s) => ({ ...s, rest: s.rest - side * span, swiped: { key, side } }));
    void Promise.resolve(onSwipe(side)).then((moved) => {
      if (!moved) back(key);
      else setTimeout(() => back(key), LANDING_MS);
    });
  };

  const pan = Gesture.Pan()
    .enabled(width > 0 && !busy)
    .activeOffsetX([-12, 12])
    .failOffsetY([-12, 12])
    .onStart(() => {
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
  for (const card of strip.leaving) add({ key: card.key, at: -rest, live: false, frozen: card.node === undefined, node: card.node ?? null });
  if (strip.swiped) add({ key: strip.swiped.key, at: -rest, live: false, frozen: true, node: null });
  if (next && nextKey) add({ key: nextKey, at: span - rest, live: false, frozen: false, node: next.card });
  if (previous && previousKey) add({ key: previousKey, at: -span - rest, live: false, frozen: false, node: previous.card });

  return (
    <GestureDetector gesture={pan}>
      <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
        {/* The item's own card last, over the others. */}
        {[...slots.slice(1), slots[0]].map((slot) => (
          <Slide key={slot.key} drag={drag} at={slot.at} span={span} live={slot.live} frozen={slot.frozen}>
            {slot.node}
          </Slide>
        ))}
      </View>
    </GestureDetector>
  );
}

/** A card on the strip: placed once, at `at`, and moved with it; fading as it leaves the middle. */
function Slide({ drag, at, span, live, frozen, children }: { drag: SharedValue<number>; at: number; span: number; live: boolean; frozen: boolean; children: ReactNode }) {
  const [base] = useState(at);
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

/** One item's card: its cover and words open the player; play or pause; next; the grades; how far it has played. */
export function MiniCard({
  cover,
  badge,
  title,
  status,
  open,
  playing,
  onToggle,
  next,
  rating,
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
  /** The grades, or the grade given (MiniRating); nothing for an item with nothing to rate. */
  rating?: ReactNode;
  /** Along the bottom: how far the item has played. */
  progress: ReactNode;
}) {
  const c = useCopy();
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" accessibilityLabel={open.label} accessibilityHint={open.hint} onPress={open.onPress} style={styles.open}>
          <View>
            {cover}
            {badge && (
              <View style={styles.badge}>
                <Icon name={badge} size={14} color="onPrimaryFixed" />
              </View>
            )}
          </View>
          <View style={styles.text}>
            {title}
            <Txt variant="label" color="secondaryFixedDim" numberOfLines={1}>
              {status}
            </Txt>
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={playing ? c.common.pause : c.common.play}
          onPress={onToggle}
          style={({ pressed }) => [styles.play, pressed && { opacity: 0.8 }]}
        >
          <Icon name={playing ? 'pause' : 'play_arrow'} fill size="lg" color="onPrimaryFixed" />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={next.label}
          disabled={next.disabled}
          onPress={next.onPress}
          style={({ pressed }) => [styles.next, pressed && { opacity: 0.7 }, next.disabled && { opacity: 0.4 }]}
        >
          <Icon name="skip_next" fill size="lg" color="inverseOnSurface" />
        </Pressable>
      </View>
      {rating}
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

/** A grade given: what the bar shows of it, and the whole sentence for screen readers. */
export interface MiniRated {
  grade: Grade;
  /** After the grade's name: when the phrase comes back, or how many phrases a song reviewed. */
  detail: string;
  label: string;
}

/**
 * The three grades on the bar, never preselected; once one is given, the grade (its name always
 * whole) and what it does in their place while it can be undone (a rating given in the player shows
 * here too).
 */
export function MiniRating({ rated, onRate, onUndo }: { rated: MiniRated | null; onRate?: (grade: Grade) => void; onUndo?: () => void }) {
  const c = useCopy();
  const reduce = useReducedMotion();
  const { compact } = useRoom();
  if (rated) {
    const look = GRADES.find((g) => g.grade === rated.grade) ?? GRADES[0];
    return (
      <Animated.View key="rated" entering={reduce ? undefined : FadeIn.duration(180)} style={styles.rating}>
        <View accessible accessibilityLabel={rated.label} accessibilityLiveRegion="polite" style={[styles.rated, { backgroundColor: look.bg }]}>
          <Icon name={look.icon} size="sm" color={look.ink} />
          <Txt variant="body" weight={700} color={look.ink} numberOfLines={1}>
            {c.common.grade[rated.grade]}
          </Txt>
          <Txt variant="label" color={look.ink} numberOfLines={1} style={styles.flex}>
            {rated.detail}
          </Txt>
        </View>
        {onUndo && (
          // On a compact screen Undo is its icon, so the grade keeps the room.
          <Pressable accessibilityRole="button" accessibilityLabel={c.common.undo} onPress={onUndo} style={({ pressed }) => [compact ? styles.undoIcon : styles.undo, pressed && { opacity: 0.7 }]}>
            {compact ? (
              <Icon name="undo" size="md" color="primaryFixedDim" />
            ) : (
              <Txt variant="body" weight={700} color="primaryFixedDim">
                {c.common.undo}
              </Txt>
            )}
          </Pressable>
        )}
      </Animated.View>
    );
  }
  return (
    <View style={styles.rating}>
      {GRADES.map(({ grade, icon, bg, ink }) => (
        <Pressable
          key={grade}
          accessibilityRole="button"
          onPress={onRate && (() => onRate(grade))}
          style={({ pressed }) => [styles.grade, { backgroundColor: bg }, pressed && { opacity: 0.8 }]}
        >
          {/* A compact screen keeps the words whole and lets the colours tell the grades apart. */}
          {!compact && <Icon name={icon} size="sm" color={ink} />}
          <Txt variant="body" weight={600} color={ink} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.shrink}>
            {c.common.grade[grade]}
          </Txt>
        </Pressable>
      ))}
    </View>
  );
}

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
  rating: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingBottom: 12 },
  grade: { flex: 1, minWidth: 0, minHeight: TARGET, paddingHorizontal: 8, borderRadius: radius.full, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  rated: { flex: 1, minWidth: 0, minHeight: TARGET, paddingHorizontal: 14, borderRadius: radius.full, flexDirection: 'row', alignItems: 'center', gap: 6 },
  undo: { minHeight: TARGET, paddingHorizontal: 12, borderRadius: radius.full, justifyContent: 'center' },
  undoIcon: { width: TARGET, height: TARGET, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  track: { position: 'absolute', left: 8, right: 8, bottom: 0, height: 4, borderRadius: radius.full, backgroundColor: 'rgba(243,240,235,0.2)', overflow: 'hidden' },
  fill: miniFill,
});
