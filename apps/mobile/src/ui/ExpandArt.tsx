// An artwork that grows in place (the player's picture, a set's, an album's or a song's cover): small
// by default, so the page fits; tapped, or pulled down, it shows whole, edge to edge, and the page
// moves down under it without changing screen. Opened, it follows the page's scroll: scrolled down it
// shrinks back as far as the page has moved, held where the scroll stops, and scrolled back up it
// grows again. Tapped again it closes. Both sizes are drawn as themselves (a phrase's picture is composed
// for its shape), and the small one gives way to the large as the frame grows.
import { ReactNode, useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  AnimatedRef,
  Easing,
  interpolate,
  runOnJS,
  runOnUI,
  scrollTo,
  SharedValue,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Press } from './Press';
import { holdClicks, releaseClicks } from './swallowClick';

export interface ArtSize {
  width: number;
  height: number;
}

const MS = 260;
/** A pull this far (or flung) opens it. */
const PULL = 24;
const FLING = 600;
/** The large drawing takes over from the small this close to small, so a scroll held anywhere else shows one drawing. */
const SWAP = 0.12;

export interface ArtExpansion {
  open: boolean;
  setOpen: (open: boolean) => void;
  /** The page's scroll, which the opened artwork follows. */
  scrollY: SharedValue<number>;
  /** The page's Animated.ScrollView, scrolled back to the artwork. */
  scroller: AnimatedRef<Animated.ScrollView>;
  /** For the page's Animated.ScrollView. */
  onScroll: ReturnType<typeof useAnimatedScrollHandler>;
}

/** Whether the artwork is shown large, and the scrolling page it sits at the top of. */
export function useArtExpansion(): ArtExpansion {
  const [open, setOpen] = useState(false);
  const scrollY = useSharedValue(0);
  const scroller = useAnimatedRef<Animated.ScrollView>();
  const onScroll = useAnimatedScrollHandler({ onScroll: (e) => scrollY.set(e.contentOffset.y) });
  return { open, setOpen, scrollY, scroller, onScroll };
}

/** Larger by enough to be worth the control. */
const grows = (small: ArtSize, large: ArtSize) => large.width * large.height > small.width * small.height * 1.15;

export function ExpandArt({
  art,
  small,
  large,
  bleed = 0,
  align = 'center',
  children,
}: {
  art: ArtExpansion;
  small: ArtSize;
  large: ArtSize;
  /** The page's side padding, which the large artwork reaches over to run edge to edge. */
  bleed?: number;
  /** Where the small artwork sits in the large one's room: the start of a row, or its middle. */
  align?: 'start' | 'center';
  /** The artwork drawn at a size. */
  children: (size: ArtSize) => ReactNode;
}) {
  const reduce = useReducedMotion();
  const { open, setOpen, scrollY, scroller } = art;
  const can = grows(small, large);
  const shown = open && can;
  // p: opened (the room it takes in the page); the scroll then takes it back down to small.
  const p = useSharedValue(shown ? 1 : 0);
  // The large drawing is there only while it shows or is on its way.
  const [drawn, setDrawn] = useState(shown);
  if (shown && !drawn) setDrawn(true);
  // Closed while scrolled: the page's room shrinks at once, and the scroll keeps what was in view.
  const scrollAfterClose = useSharedValue(-1);
  useEffect(() => {
    const after = scrollAfterClose.get();
    scrollAfterClose.set(-1);
    if (after >= 0) {
      p.set(0);
      runOnUI(() => {
        'worklet';
        scrollTo(scroller, 0, after, false);
        runOnJS(setDrawn)(false);
      })();
      return;
    }
    p.set(
      withTiming(shown ? 1 : 0, { duration: reduce ? 0 : MS, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished && !shown) runOnJS(setDrawn)(false);
      }),
    );
  }, [shown, reduce, p, scroller, scrollAfterClose]);

  const range = Math.max(0, large.height - small.height);
  // Each style reads the opening and the scroll itself, so it follows both as they change.
  /** How far a scroll of `y` takes it back: 0 (whole) to 1 (small). */
  const taken = (y: number) => {
    'worklet';
    return range > 0 ? Math.min(1, Math.max(0, y / range)) : 0;
  };
  /** How large it shows, 0 to 1: opened `o`, less what a scroll of `y` took back. */
  const shows = (o: number, y: number) => {
    'worklet';
    return o * (1 - taken(y));
  };
  // Mostly small on screen, a tap shows it whole again; past SWAP the large drawing is the one on
  // screen, and its buttons (a new cover) are the ones pressed.
  const [mostlyWhole, setMostlyWhole] = useState(shown);
  const [largeOnTop, setLargeOnTop] = useState(shown);
  useAnimatedReaction(
    () => shows(p.get(), scrollY.get()),
    (now, before) => {
      if (before === null || now > 0.5 !== before > 0.5) runOnJS(setMostlyWhole)(now > 0.5);
      if (before === null || now > SWAP !== before > SWAP) runOnJS(setLargeOnTop)(now > SWAP);
    },
  );

  // The room in the page: it grows as it opens and keeps its size while the scroll moves the artwork.
  const room = useAnimatedStyle(() => {
    const o = p.get();
    return {
      width: interpolate(o, [0, 1], [small.width, large.width]),
      height: interpolate(o, [0, 1], [small.height, large.height]),
      ...(align === 'start' ? { marginLeft: -bleed * o } : { marginHorizontal: -bleed * o }),
    };
  });
  // The artwork: held at the top of the page as the page scrolls up under it, the size it shows.
  const frame = useAnimatedStyle(() => {
    const o = p.get();
    const y = scrollY.get();
    const s = shows(o, y);
    const w = interpolate(s, [0, 1], [small.width, large.width]);
    const roomWidth = interpolate(o, [0, 1], [small.width, large.width]);
    return { width: w, height: interpolate(s, [0, 1], [small.height, large.height]), top: taken(y) * range * o, left: align === 'start' ? 0 : (roomWidth - w) / 2 };
  });
  // Each drawing scaled to the frame, centred: the large one covers it (a band shows its middle), the small one fits.
  const layer = (size: ArtSize, cover: boolean, s: number) => {
    'worklet';
    const w = interpolate(s, [0, 1], [small.width, large.width]);
    const h = interpolate(s, [0, 1], [small.height, large.height]);
    const scale = cover ? Math.max(w / size.width, h / size.height) : Math.min(w / size.width, h / size.height);
    return { left: (w - size.width) / 2, top: (h - size.height) / 2, transform: [{ scale }] };
  };
  const smallLayer = useAnimatedStyle(() => {
    const s = shows(p.get(), scrollY.get());
    return { ...layer(small, false, s), opacity: interpolate(s, [0, SWAP], [1, 0], 'clamp') };
  });
  const largeLayer = useAnimatedStyle(() => {
    const s = shows(p.get(), scrollY.get());
    return { ...layer(large, true, s), opacity: interpolate(s, [0, SWAP], [0, 1], 'clamp') };
  });

  if (!can) return <>{children(small)}</>;

  const toggle = () => {
    const y = scrollY.get();
    if (!open) {
      // Opened from further down the page: back to its top, where the artwork is.
      if (y > 0)
        runOnUI(() => {
          'worklet';
          scrollTo(scroller, 0, 0, true);
        })();
      setOpen(true);
    } else if (!mostlyWhole) {
      // Scrolled small: shown whole again by scrolling back to it.
      runOnUI(() => {
        'worklet';
        scrollTo(scroller, 0, 0, true);
      })();
    } else {
      if (y > 0) scrollAfterClose.set(Math.max(0, y - range));
      setOpen(false);
    }
  };
  // Pulled down, it opens; opened, the page's own scroll moves it.
  const pull = Gesture.Pan()
    .enabled(!open)
    .runOnJS(true)
    .activeOffsetY(10)
    .failOffsetY(-10)
    .failOffsetX([-20, 20])
    .onStart(holdClicks)
    .onEnd((e) => {
      if (e.translationY > PULL || e.velocityY > FLING) toggle();
    })
    .onFinalize(releaseClicks);
  // A band changes shape as it grows, so it is cut to its frame; a square only changes size.
  const clip = Math.abs(small.width / small.height - large.width / large.height) > 0.01;

  return (
    <Animated.View style={[room, styles.room]}>
      <GestureDetector gesture={pull}>
        <Animated.View style={[styles.frame, frame, clip && styles.clip]}>
          {/* The picture is the control: a tap anywhere on it opens or closes it. Only the drawing on
              screen takes presses of its own (a new cover). */}
          <Press accessible={false} haptic="none" onPress={toggle} style={StyleSheet.absoluteFill}>
            <Animated.View pointerEvents={largeOnTop ? 'none' : 'box-none'} style={[styles.layer, { width: small.width, height: small.height }, smallLayer]}>
              {children(small)}
            </Animated.View>
            {drawn && (
              <Animated.View pointerEvents={largeOnTop ? 'box-none' : 'none'} style={[styles.layer, { width: large.width, height: large.height }, largeLayer]}>
                {children(large)}
              </Animated.View>
            )}
          </Press>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Over what follows it while the page scrolls up under it.
  room: { zIndex: 1 },
  frame: { position: 'absolute' },
  clip: { overflow: 'hidden' },
  layer: { position: 'absolute' },
});
