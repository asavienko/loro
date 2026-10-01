// The grades above the bar (plan 107): three round icon buttons floating over the page, apart from the
// bar itself. A tap rates at once, with no message: the grade tapped turns into Undo for a few seconds,
// its ring running down, and then they step aside until the item showing can be rated again
// (barRating in @shared/ui/rating). The same for a phrase and a song. Swiping the bar takes them with
// its card, and the next item's come in with its own (barShift). Before them, a way on may show
// (`lead`): the next set at the end of a pass.
import { useEffect, useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';
import Animated, { Extrapolation, FadeIn, FadeInDown, FadeOut, interpolate, useAnimatedStyle, useReducedMotion, ZoomIn } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { clock } from '@shared/state/clock';
import type { Grade } from '@shared/state/types';
import { BarRating, UNDO_OFFER_MS } from '@shared/ui/rating';
import { useCopy } from '../state/store';
import { useBarShift } from './barShift';
import { GRADES } from './grades';
import { Icon, IconName } from './Icon';
import { Press } from './Press';
import { Txt } from './Txt';
import { colors, TARGET } from './theme';

/** A grade's button: round, a little over a finger's target. */
const SIZE = 48;
const GAP = 10;
const RING = 3;
/** How high the row stands when it shows, for what sits above it (the snackbar). */
export const BAR_GRADES_HEIGHT = SIZE;

/** A button before the grades: a short label, what it says in full, and what it does. */
export interface BarLead {
  label: string;
  accessibilityLabel: string;
  icon: IconName;
  onPress: () => void;
}

export function BarGrades({ view, onRate, onUndo, lead }: { view: BarRating; onRate: (grade: Grade) => void; onUndo: () => void; lead?: BarLead | null }) {
  const c = useCopy();
  const reduce = useReducedMotion();
  const typing = useKeyboardShown();
  const shift = useBarShift();
  // Where the bar's card is: the grades go with it, fading as it does.
  const withCard = useAnimatedStyle(() => {
    if (!shift) return {};
    const x = shift.x.get();
    const span = shift.span.get();
    return { opacity: span > 0 ? interpolate(Math.abs(x), [0, span], [1, 0], Extrapolation.CLAMP) : 1, transform: [{ translateX: x }] };
  });
  // Rating isn't what a learner typing is doing; the buttons would sit over the field.
  if ((view.kind === 'none' && !lead) || typing) return null;
  return (
    <Animated.View style={withCard} pointerEvents="box-none">
      <Animated.View entering={reduce ? undefined : FadeInDown.duration(200)} exiting={reduce ? undefined : FadeOut.duration(180)} style={styles.row} pointerEvents="box-none">
        {lead && (
          <Animated.View entering={reduce ? undefined : FadeIn.duration(160)} exiting={reduce ? undefined : FadeOut.duration(140)} style={styles.leadSlot}>
            <Press
              accessibilityRole="button"
              accessibilityLabel={lead.accessibilityLabel}
              onPress={lead.onPress}
              style={({ pressed }) => [styles.button, styles.lead, pressed && styles.pressed]}
            >
              <Icon name={lead.icon} size="base" color="onPrimary" />
              <Txt variant="label" weight={700} color="onPrimary" numberOfLines={1} style={styles.leadText}>
                {lead.label}
              </Txt>
            </Press>
          </Animated.View>
        )}
        {view.kind !== 'none' && GRADES.map(({ grade, icon, bg, ink }) => {
          if (view.kind === 'undo') {
            // The others make way; the one given keeps its place, as Undo.
            if (grade !== view.grade) return <View key={grade} style={styles.slot} pointerEvents="none" />;
            return (
              <Animated.View key={`undo:${view.at}`} entering={reduce ? undefined : ZoomIn.duration(160)} exiting={reduce ? undefined : FadeOut.duration(160)}>
                <Press
                  accessibilityRole="button"
                  accessibilityLabel={c.player.undoGrade(c.common.grade[grade])}
                  onPress={onUndo}
                  style={({ pressed }) => [styles.button, { backgroundColor: bg }, pressed && styles.pressed]}
                >
                  <Countdown at={view.at} color={colors[ink]} />
                  <Icon name="undo" size="base" color={ink} />
                </Press>
              </Animated.View>
            );
          }
          return (
            <Animated.View key={grade} entering={reduce ? undefined : FadeIn.duration(160)} exiting={reduce ? undefined : FadeOut.duration(140)}>
              <Press
                accessibilityRole="button"
                haptic="none"
                accessibilityLabel={c.player.rateAs(c.common.grade[grade])}
                onPress={() => onRate(grade)}
                style={({ pressed }) => [styles.button, { backgroundColor: bg }, pressed && styles.pressed]}
              >
                <Icon name={icon} size="base" color={ink} />
              </Press>
            </Animated.View>
          );
        })}
      </Animated.View>
    </Animated.View>
  );
}

/**
 * The ring round Undo, running down over the seconds it is offered. Drawn from the clock a few times a
 * frame's worth apart, so it is the same on a phone and in a browser; still, with reduced motion.
 */
function Countdown({ at, color }: { at: number; color: string }) {
  const reduce = useReducedMotion();
  const share = () => Math.min(1, Math.max(0, (at + UNDO_OFFER_MS - clock.now()) / UNDO_OFFER_MS));
  const [left, setLeft] = useState(share);
  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => {
      const next = Math.min(1, Math.max(0, (at + UNDO_OFFER_MS - clock.now()) / UNDO_OFFER_MS));
      setLeft(next);
      if (next <= 0) clearInterval(id);
    }, 40);
    return () => clearInterval(id);
  }, [at, reduce]);
  const r = (SIZE - RING) / 2;
  const around = 2 * Math.PI * r;
  return (
    <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Circle cx={SIZE / 2} cy={SIZE / 2} r={r} fill="none" stroke={color} strokeOpacity={0.15} strokeWidth={RING} />
      <Circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={RING}
        strokeLinecap="round"
        strokeDasharray={`${around} ${around}`}
        strokeDashoffset={around * (1 - (reduce ? 1 : left))}
        transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
      />
    </Svg>
  );
}

/** Draws the caller again `ms` from now (when what it shows changes: Undo runs out, a window closes). */
export function useRedrawIn(ms: number | null) {
  const [, redraw] = useState(0);
  useEffect(() => {
    if (ms === null) return;
    const id = setTimeout(() => redraw((n) => n + 1), Math.max(0, ms) + 20);
    return () => clearTimeout(id);
  }, [ms]);
}

/** Whether the on-screen keyboard is up (never, in a browser). */
function useKeyboardShown(): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setShown(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setShown(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return shown;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'flex-end', gap: GAP },
  slot: { width: SIZE, height: SIZE },
  button: {
    width: SIZE,
    height: SIZE,
    minWidth: TARGET,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(49,48,45,0.12)',
    shadowColor: colors.inverseSurface,
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  pressed: { transform: [{ scale: 0.94 }] },
  leadSlot: { flexShrink: 1, minWidth: 0 },
  lead: { width: 'auto', flexDirection: 'row', gap: 6, paddingLeft: 14, paddingRight: 16, backgroundColor: colors.primaryContainer },
  leadText: { flexShrink: 1 },
});
