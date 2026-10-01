// The end of a pass through a queue that keeps going (P3-01), said as it is: in repeat mode "played
// through, starting again" with the course's next set one tap away; in continue mode "on to" the next
// set. The player says it in a card over the top of its picture, clear of the grades and the
// controls, until its phrase gives way; with the player closed, a message says it once. In continue
// mode with nothing left to go on with, the card says so for as long as the queue stays ended.
import { usePathname } from 'expo-router';
import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
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
}

const PassNoticeContext = createContext<PassNoticeValue>({ notice: null, dismiss: () => {} });

/** Watches for the end of a pass: the player shows it; anywhere else a message says it. */
export function PassNoticeProvider({ children }: { children: ReactNode }) {
  const c = useCopy();
  const nav = useNav();
  const pathname = usePathname();
  const { state } = useStore();
  const { toast } = useToast();
  const [notice, setNotice] = useState<PassNotice | null>(null);
  const mark = passMark(state.player);
  const moved = `${mark.session}:${mark.passes}:${mark.setId}:${mark.index}:${mark.length}`;
  const latest = useLatest({ state, pathname, c, nav, toast });
  // Where the player was before its latest move.
  const seen = useRef(mark);
  useEffect(() => {
    const { state: s, pathname: path, c: copy, nav: go, toast: show } = latest.current;
    const before = seen.current;
    seen.current = passMark(s.player);
    const found = passNotice(before, s.player, displayLearner(s), clock.now());
    if (!found) return;
    setNotice(found);
    // The player says it in its own card.
    if (path === '/player') return;
    const said = describe(copy, found, s.learner, go);
    show(said.title, { action: said.go ?? { label: copy.player.summary, run: go.openSummary } });
  }, [moved, latest]);
  const value = useMemo(() => ({ notice, dismiss: () => setNotice(null) }), [notice]);
  return <PassNoticeContext.Provider value={value}>{children}</PassNoticeContext.Provider>;
}

interface Said {
  icon: IconName;
  title: string;
  /** Where to go from here: the next set, or the queue again. */
  go?: { label: string; icon?: IconName; run: () => void };
}

/** What a notice says, and the way on it offers. */
function describe(c: Copy, notice: PassNotice, learner: LearnerState, nav: Navigation): Said {
  if (notice.kind === 'again') {
    const next = notice.next;
    const view = next ? findSetView(learner, next.setId) : undefined;
    return {
      icon: 'repeat',
      title: c.player.pass.again,
      go: next && view ? { label: c.player.pass.goOn(view.title), icon: 'skip_next', run: () => nav.playSet(view.id, { phraseIds: next.phraseIds }) } : undefined,
    };
  }
  const view = findSetView(learner, notice.setId);
  return { icon: 'playlist_play', title: view ? c.player.pass.next(view.title) : notice.setId === null ? c.player.pass.nextReview : c.player.end.playedThrough };
}

/** The card at the top of the player: what the end of the pass did, and the way on (or else the session's summary). */
export function PassCard() {
  const c = useCopy();
  const nav = useNav();
  const reduce = useReducedMotion();
  const { state, actions } = useStore();
  const { notice, dismiss } = useContext(PassNoticeContext);
  // An ended queue's card, closed: until the queue moves again.
  const [closedAt, setClosedAt] = useState<number | null>(null);
  const player = state.player;
  let said: Said | null = null;
  let close = dismiss;
  if (player.ended && !playsOnce(player)) {
    // Continue mode found nothing to go on with: the queue stopped on its last phrase.
    if (closedAt === player.cycle) return null;
    said = { icon: 'task_alt', title: c.player.pass.done, go: { label: c.player.end.playAgain, icon: 'replay', run: () => actions.jump(0, true) } };
    close = () => setClosedAt(player.cycle);
  } else if (notice && passNoticeHolds(notice, player)) {
    said = describe(c, notice, state.learner, nav);
  }
  if (!said) return null;
  return (
    <Animated.View
      entering={reduce ? undefined : FadeIn.duration(220)}
      exiting={reduce ? undefined : FadeOut.duration(160)}
      accessibilityLiveRegion="polite"
      style={styles.card}
    >
      <View style={styles.head}>
        <View style={styles.badge}>
          <Icon name={said.icon} size="md" color="primaryContainer" />
        </View>
        <Txt variant="row" weight={600} style={styles.title} accessibilityRole="header">
          {said.title}
        </Txt>
        <Pressable accessibilityRole="button" accessibilityLabel={c.toast.dismiss} onPress={close} style={({ pressed }) => [styles.close, pressed && { backgroundColor: colors.surfaceContainerHigh }]}>
          <Icon name="close" size="md" color="secondary" />
        </Pressable>
      </View>
      <View style={styles.actions}>
        {said.go ? (
          <Button
            variant="tonal"
            icon={said.go.icon}
            label={said.go.label}
            onPress={() => {
              close();
              said.go?.run();
            }}
            style={styles.go}
          />
        ) : (
          <Button variant="text" icon="insights" label={c.player.summary} onPress={nav.openSummary} style={styles.summary} />
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius['2xl'], backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline, paddingVertical: 8, paddingLeft: 12, paddingRight: 2, gap: 2, ...shadow.cover },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: { width: 32, height: 32, borderRadius: radius.full, backgroundColor: colors.primaryFixed, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, minWidth: 0 },
  close: { width: TARGET, height: TARGET, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', paddingLeft: 42, paddingRight: 10, paddingBottom: 4 },
  go: { paddingHorizontal: 14, backgroundColor: colors.surfaceContainerHigh, flexShrink: 1 },
  summary: { paddingHorizontal: 0 },
});
