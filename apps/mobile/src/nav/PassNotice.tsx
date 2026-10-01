// The end of a pass through a queue that keeps going (P3-01), said as it is: in repeat mode "played
// through, starting again" with the course's next set one tap away; in continue mode "on to" the next
// set. Until its phrase gives way, the player says it in a card over the top of its picture, clear of
// the grades and the controls; with the player closed, the bar above the tabs offers only the way on,
// as a button before its grades. Elsewhere a message says it once. In continue mode with nothing left
// to go on with, they say so for as long as the queue stays ended.
import { usePathname } from 'expo-router';
import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';
import type { Copy } from '@shared/copy';
import { useLatest } from '@shared/lib/useLatest';
import { Navigation, useNav } from '@shared/nav/NavContext';
import { findSetView } from '@shared/state/catalog';
import { clock } from '@shared/state/clock';
import { playsOnce } from '@shared/state/machine';
import { displayLearner } from '@shared/state/selectors';
import type { LearnerState } from '@shared/state/types';
import { PassNotice, passMark, passNotice, passNoticeHolds } from '@shared/ui/passNotice';
import { useCopy, useStore } from '../state/store';
import { Button } from '../ui/Button';
import { Icon, IconName } from '../ui/Icon';
import { useToast } from '../ui/Toast';
import { Txt } from '../ui/Txt';
import { colors, radius, shadow, TARGET } from '../ui/theme';

interface PassNoticeValue {
  notice: PassNotice | null;
  dismiss: () => void;
  /** An ended queue's card or button, closed: until the queue moves again (its cycle). */
  closedAt: number | null;
  closeEnded: (cycle: number) => void;
}

const PassNoticeContext = createContext<PassNoticeValue>({ notice: null, dismiss: () => {}, closedAt: null, closeEnded: () => {} });

/** Watches for the end of a pass: the player shows it; anywhere else a message says it. */
export function PassNoticeProvider({ children }: { children: ReactNode }) {
  const c = useCopy();
  const nav = useNav();
  const pathname = usePathname();
  const { state } = useStore();
  const { toast, announce } = useToast();
  const [notice, setNotice] = useState<PassNotice | null>(null);
  const [closedAt, setClosedAt] = useState<number | null>(null);
  const mark = passMark(state.player);
  const moved = `${mark.session}:${mark.passes}:${mark.setId}:${mark.index}:${mark.length}`;
  const latest = useLatest({ state, pathname, c, nav, toast, announce });
  // Where the player was before its latest move.
  const seen = useRef(mark);
  useEffect(() => {
    const { state: s, pathname: path, c: copy, nav: go, toast: show, announce: say } = latest.current;
    const before = seen.current;
    seen.current = passMark(s.player);
    const found = passNotice(before, s.player, displayLearner(s), clock.now());
    if (!found) return;
    setNotice(found);
    // The player says it in its card; on the tabs the bar offers the way on, and a screen reader hears it.
    if (path === '/player') return;
    const said = describe(copy, found, s.learner, go);
    const text = said.line ? `${copy.player.pass.title}. ${said.line}` : copy.player.pass.title;
    if (!OUTSIDE_TABS.test(path)) say(text);
    else show(text, { action: said.go ?? { label: copy.player.summary, run: go.openSummary } });
  }, [moved, latest]);
  const value = useMemo(() => ({ notice, dismiss: () => setNotice(null), closedAt, closeEnded: setClosedAt }), [notice, closedAt]);
  return <PassNoticeContext.Provider value={value}>{children}</PassNoticeContext.Provider>;
}

/** Pages over the tabs, where no bar shows the card: a message says it there. */
const OUTSIDE_TABS = /^\/(player|queue|song|make|account|shared)(\/|$)/;

interface Said {
  icon: IconName;
  /** Under "Played through": what happens now. */
  line?: string;
  /** Where to go from here: the next set, or the queue again; `short` on the bar's button. */
  go?: { label: string; short: string; icon: IconName; run: () => void };
}

/** What a notice says, and the way on it offers. */
function describe(c: Copy, notice: PassNotice, learner: LearnerState, nav: Navigation): Said {
  if (notice.kind === 'again') {
    const next = notice.next;
    const view = next ? findSetView(learner, next.setId) : undefined;
    return {
      icon: 'repeat',
      line: c.player.pass.again,
      go: next && view ? { label: c.player.pass.goOn(view.title), short: view.title, icon: 'skip_next', run: () => nav.playSet(view.id, { phraseIds: next.phraseIds }) } : undefined,
    };
  }
  const view = findSetView(learner, notice.setId);
  return { icon: 'playlist_play', line: view ? c.player.pass.next(view.title) : notice.setId === null ? c.player.pass.nextReview : undefined };
}

/** What the end of a pass says now, and how it is closed; null when it says nothing. */
function usePassSaid(): { said: Said; close: () => void } | null {
  const c = useCopy();
  const nav = useNav();
  const { state, actions } = useStore();
  const { notice, dismiss, closedAt, closeEnded } = useContext(PassNoticeContext);
  const player = state.player;
  if (player.ended && !playsOnce(player)) {
    // Continue mode found nothing to go on with: the queue stopped on its last phrase.
    if (closedAt === player.cycle) return null;
    const again = c.player.end.playAgain;
    return { said: { icon: 'task_alt', line: c.player.pass.done, go: { label: again, short: again, icon: 'replay', run: () => actions.jump(0, true) } }, close: () => closeEnded(player.cycle) };
  }
  if (notice && passNoticeHolds(notice, player)) return { said: describe(c, notice, state.learner, nav), close: dismiss };
  return null;
}

/** The way on, for the button before the bar's grades: the next set or the queue again; null when there is none. */
export function usePassAction(): { label: string; accessibilityLabel: string; icon: IconName; onPress: () => void } | null {
  const pass = usePassSaid();
  const go = pass?.said.go;
  if (!pass || !go) return null;
  return {
    label: go.short,
    accessibilityLabel: go.label,
    icon: go.icon,
    onPress: () => {
      pass.close();
      go.run();
    },
  };
}

/** The card at the top of the player: "Played through", what happens now, and the way on (or else the session's summary). */
export function PassCard({ style }: { style?: ViewStyle }) {
  const c = useCopy();
  const nav = useNav();
  const reduce = useReducedMotion();
  const pass = usePassSaid();
  if (!pass) return null;
  const { said, close } = pass;
  const go = said.go;
  return (
    <Animated.View
      entering={reduce ? undefined : FadeIn.duration(220)}
      exiting={reduce ? undefined : FadeOut.duration(160)}
      accessibilityLiveRegion="polite"
      style={[styles.card, style]}
    >
      <View style={styles.head}>
        <View style={styles.badge}>
          <Icon name={said.icon} size="md" color="onPrimaryFixed" />
        </View>
        <View style={styles.words}>
          <Txt variant="row" weight={700} accessibilityRole="header">
            {c.player.pass.title}
          </Txt>
          {said.line && (
            <Txt variant="label" color="secondary">
              {said.line}
            </Txt>
          )}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={c.toast.dismiss} onPress={close} style={({ pressed }) => [styles.close, pressed && { backgroundColor: colors.surfaceContainerHigh }]}>
          <Icon name="close" size="md" color="secondary" />
        </Pressable>
      </View>
      {go ? (
        <Button
          variant="primarySm"
          icon={go.icon}
          label={go.label}
          onPress={() => {
            close();
            go.run();
          }}
          style={styles.go}
        />
      ) : (
        <Button variant="text" icon="insights" label={c.player.summary} onPress={nav.openSummary} style={styles.summary} />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius['2xl'], backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline, padding: 12, paddingRight: 6, gap: 10, ...shadow.cover },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.primaryFixed, alignItems: 'center', justifyContent: 'center' },
  words: { flex: 1, minWidth: 0, gap: 2 },
  close: { width: TARGET, height: TARGET, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start', marginTop: -4 },
  go: { alignSelf: 'stretch', marginRight: 6 },
  summary: { alignSelf: 'flex-start', paddingHorizontal: 4, marginLeft: 48 },
});
