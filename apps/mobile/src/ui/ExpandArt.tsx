// An artwork that grows in place (the player's picture, a set's, an album's or a song's cover): small
// by default, so the page fits; tapped, or pulled down, it shows whole at its large size, and the page
// moves down under it without changing screen. Tapped again, pushed up, or the page scrolled down, it
// goes back. The chip in its corner does the same for anyone who can't tap the picture or doesn't
// know to. Both sizes are drawn as themselves (a phrase's picture is composed for its shape), and the
// small one gives way to the large as the frame grows.
import { ReactNode, useEffect, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, interpolate, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useCopy } from '../state/store';
import { Icon } from './Icon';
import { Press } from './Press';
import { holdClicks, releaseClicks } from './swallowClick';
import { colors, radius } from './theme';

export interface ArtSize {
  width: number;
  height: number;
}

const MS = 260;
/** A pull this far (or flung) opens or closes it. */
const PULL = 24;
const FLING = 600;
/** The page scrolled this far down closes it. */
const SCROLL_CLOSES = 24;

/** Whether the artwork is shown large, and the page scroll that puts it back. */
export function useArtExpansion() {
  const [open, setOpen] = useState(false);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (open && e.nativeEvent.contentOffset.y > SCROLL_CLOSES) setOpen(false);
  };
  return { open, setOpen, onScroll };
}

/** A square cover's large side on a page `page` wide: the page's width, short of most of the window's height. */
export function wholeSide(page: number, windowHeight: number): number {
  return Math.round(Math.min(page, 480, windowHeight * 0.6));
}

/** Larger by enough to be worth the control. */
const grows = (small: ArtSize, large: ArtSize) => large.width * large.height > small.width * small.height * 1.15;

export function ExpandArt({
  open,
  onOpenChange,
  small,
  large,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  small: ArtSize;
  large: ArtSize;
  /** The artwork drawn at a size. */
  children: (size: ArtSize) => ReactNode;
}) {
  const c = useCopy();
  const reduce = useReducedMotion();
  const can = grows(small, large);
  const shown = open && can;
  const p = useSharedValue(shown ? 1 : 0);
  // The large drawing is there only while it shows or is on its way.
  const [drawn, setDrawn] = useState(shown);
  if (shown && !drawn) setDrawn(true);
  useEffect(() => {
    p.set(
      withTiming(shown ? 1 : 0, { duration: reduce ? 0 : MS, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished && !shown) runOnJS(setDrawn)(false);
      }),
    );
  }, [shown, reduce, p]);

  const frame = useAnimatedStyle(() => ({
    width: interpolate(p.get(), [0, 1], [small.width, large.width]),
    height: interpolate(p.get(), [0, 1], [small.height, large.height]),
  }));
  // Each drawing scaled to the frame, centred: the large one covers it (a band shows its middle), the small one fits.
  const layer = (size: ArtSize, cover: boolean) => {
    'worklet';
    const w = interpolate(p.get(), [0, 1], [small.width, large.width]);
    const h = interpolate(p.get(), [0, 1], [small.height, large.height]);
    const scale = cover ? Math.max(w / size.width, h / size.height) : Math.min(w / size.width, h / size.height);
    return { left: (w - size.width) / 2, top: (h - size.height) / 2, transform: [{ scale }] };
  };
  const smallLayer = useAnimatedStyle(() => ({ ...layer(small, false), opacity: interpolate(p.get(), [0.5, 1], [1, 0], 'clamp') }));
  const largeLayer = useAnimatedStyle(() => ({ ...layer(large, true), opacity: interpolate(p.get(), [0, 0.5], [0, 1], 'clamp') }));

  if (!can) return <>{children(small)}</>;

  const toggle = () => onOpenChange(!open);
  // Down opens, up closes; any other drag is the page's.
  const pull = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetY(open ? -10 : 10)
    .failOffsetY(open ? 10 : -10)
    .failOffsetX([-20, 20])
    .onStart(holdClicks)
    .onEnd((e) => {
      if (Math.abs(e.translationY) > PULL || Math.abs(e.velocityY) > FLING) onOpenChange(!open);
    })
    .onFinalize(releaseClicks);
  // A band changes shape as it grows, so it is cut to its frame; a square only changes size.
  const clip = Math.abs(small.width / small.height - large.width / large.height) > 0.01;
  const chip = Math.round(Math.max(28, Math.min(36, Math.min(small.width, small.height) * 0.16)));
  const inset = Math.max(4, Math.round(Math.min(small.width, small.height) * 0.04));

  return (
    <GestureDetector gesture={pull}>
      <Animated.View style={[frame, clip && styles.clip]}>
        <Press accessible={false} haptic="none" onPress={toggle} style={StyleSheet.absoluteFill}>
          <Animated.View style={[styles.layer, { width: small.width, height: small.height, pointerEvents: shown ? 'none' : 'box-none' }, smallLayer]}>{children(small)}</Animated.View>
          {drawn && <Animated.View style={[styles.layer, { width: large.width, height: large.height, pointerEvents: shown ? 'box-none' : 'none' }, largeLayer]}>{children(large)}</Animated.View>}
        </Press>
        <Press
          accessibilityRole="button"
          accessibilityLabel={open ? c.common.showSmallerPicture : c.common.showWholePicture}
          accessibilityState={{ expanded: open }}
          onPress={toggle}
          hitSlop={Math.max(0, Math.ceil((44 - chip) / 2))}
          style={({ pressed }) => [styles.chip, { width: chip, height: chip, right: inset, top: inset }, pressed && styles.pressed]}
        >
          <Icon name={open ? 'close_fullscreen' : 'open_in_full'} size={Math.round(chip * 0.5)} color="onSurface" />
        </Press>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  layer: { position: 'absolute' },
  chip: {
    position: 'absolute',
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#57423b',
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  pressed: { backgroundColor: colors.surfaceContainer },
});
