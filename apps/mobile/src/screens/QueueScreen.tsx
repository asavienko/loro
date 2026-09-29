// The queue (the web prototype's src/screens/QueueScreen.tsx): this session so far, now playing, up
// next and what played before. Up next swipes (right plays now, left removes) and drags by its
// handle; a tap on the handle opens the same moves as options, and screen readers get them as
// actions (WCAG 2.5.7), so no move needs a gesture.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { AccessibilityActionEvent, LayoutChangeEvent, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { languageName } from '@shared/copy';
import { useNav } from '@shared/nav/NavContext';
import { findPhrase, findSetView, promptOf } from '@shared/state/catalog';
import { formatAgo, MINUTE } from '@shared/state/clock';
import { currentPhraseId, previouslyPlayed, sessionSummary, upNextIds } from '@shared/state/selectors';
import { isTargetRevealed, queueTitle } from '@shared/ui/phase';
import { useCopy, useNow, useStore } from '../state/store';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { PhraseRow } from '../ui/PhraseRow';
import { Sheet, SheetOption } from '../ui/Sheet';
import { ToastOffsetContext, useToast } from '../ui/Toast';
import { Txt } from '../ui/Txt';
import { colors, radius, TARGET } from '../ui/theme';

const SWIPE = 80;

export function QueueScreen() {
  const c = useCopy();
  const nav = useNav();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state, actions } = useStore();
  const { toast, announce } = useToast();
  const now = useNow(30_000);
  const onClose = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const currentId = currentPhraseId(state.player);
  const current = findPhrase(state.learner, currentId);
  const upNext = upNextIds(state.player);
  const previous = previouslyPlayed(state);
  const set = findSetView(state.learner, state.player.setId);
  const playing = state.player.status === 'playing';
  // Up next starts right after the current phrase in the queue order.
  const positionOf = (i: number) => state.player.index + 1 + i;
  // A phrase can be queued twice (a missed phrase comes back), so each row's identity includes its copy number.
  const items = upNext.map((id, i) => `${id}#${upNext.slice(0, i).filter((x) => x === id).length}`);
  // The up-next row whose options are open: the single-tap route to what drag and swipe do
  // (WCAG 2.5.7). Kept by the row's key, not its position: playback shifts the list.
  const [menuKey, setMenuKey] = useState<string | null>(null);
  const menu = menuKey === null || !items.includes(menuKey) ? null : items.indexOf(menuKey);
  const menuPhrase = menu === null ? undefined : findPhrase(state.learner, upNext[menu]);
  // Up next hasn't been heard yet: the row, and its options, go by the prompt.
  const menuTitle = menuPhrase ? promptOf(menuPhrase, state.learner.profile.nativeLang).text : '';
  const summary = sessionSummary(state, now);
  // The swipe-and-drag hint folds away once a swipe or drag has worked (a device setting).
  const learnedGestures = () => {
    if (!state.prefs.queueHintDone) actions.setPrefs({ queueHintDone: true });
  };
  const setMenu = (i: number | null) => setMenuKey(i === null ? null : items[i]);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= upNext.length || to === from) return;
    const next = [...upNext];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    actions.reorderUpNext(next);
    announce(c.queue.moved(to + 1, upNext.length));
  };

  const remove = (i: number) => {
    const position = positionOf(i);
    const phraseId = upNext[i];
    actions.removeFromQueue(position);
    // Undo puts it back as far ahead of the playing phrase as it was, even if playback moved on.
    toast(c.toast.removed, { action: { label: c.common.undo, run: () => actions.restoreUpNext([phraseId], i) } });
  };

  const saveAsSet = () => {
    const title = set ? `${set.title} · ${c.queue.defaultSetName}` : c.queue.defaultSetName;
    actions.createSet(title, state.player.order);
    toast(c.toast.saved(title));
  };

  return (
    <ToastOffsetContext.Provider value={16}>
      <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.headerLine}>
          <View style={styles.header}>
            <Pressable accessibilityRole="button" accessibilityLabel={c.queue.back} onPress={onClose} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
              <Icon name="keyboard_arrow_down" size="xl" />
            </Pressable>
            <View style={styles.headerText}>
              <Txt variant="title" face="serif" weight={600} align="center" accessibilityRole="header">
                {c.queue.title}
              </Txt>
              <Txt variant="label" color="secondary" align="center" numberOfLines={1}>
                {c.queue.left(upNext.length)} ·{' '}
                <Txt variant="label" color="secondary" lang={set?.targetLang}>
                  {queueTitle(c, state.player, set)}
                </Txt>
              </Txt>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={c.queue.shuffle}
              accessibilityState={{ selected: state.player.shuffle }}
              aria-pressed={state.player.shuffle}
              onPress={actions.toggleShuffle}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            >
              <Icon name="shuffle" size="lg" color={state.player.shuffle ? 'primaryContainer' : 'secondary'} />
            </Pressable>
          </View>
        </View>

        <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
          {/* This session so far, the way into its summary (the player's header no longer has one). */}
          {summary && (
            <Pressable accessibilityRole="button" onPress={nav.openSummary} style={({ pressed }) => [styles.summary, pressed && styles.pressed]}>
              <Icon name="insights" size="md" color="primaryContainer" />
              <Txt style={styles.flex}>
                <Txt weight={600}>{c.summary.title}</Txt>
                <Txt color="secondary">{` · ${c.history.run(summary.phrasesPlayed, summary.points)}`}</Txt>
              </Txt>
              <Icon name="chevron_right" size="md" color="secondary" />
            </Pressable>
          )}
          {current && (
            <View>
              <SectionTitle>{c.queue.nowPlaying}</SectionTitle>
              <PhraseRow
                phrase={current}
                leading={String(state.player.index + 1)}
                isCurrent
                isPlaying={playing}
                hideTarget={!isTargetRevealed(state.player)}
                detail={c.player.repetition(state.player.repetition, state.player.repeats)}
                playLabel={playing ? c.common.pause : c.common.play}
                onPlay={playing ? actions.pause : actions.play}
                onMore={() => nav.showDetails(current.id)}
              />
            </View>
          )}

          <View>
            <SectionTitle>{c.queue.upNext(upNext.length)}</SectionTitle>
            {upNext.length === 0 ? (
              <Txt color="secondary" style={styles.nothing}>
                {c.queue.nothing}
              </Txt>
            ) : (
              <>
                {!state.prefs.queueHintDone && (
                  <Txt variant="caption" color="secondary" style={styles.hint}>
                    {c.queue.hint}
                  </Txt>
                )}
                <View style={styles.items}>
                  {items.map((item, i) => (
                    <QueueItem
                      key={item}
                      phraseId={upNext[i]}
                      position={positionOf(i) + 1}
                      again={state.player.order.slice(0, positionOf(i)).includes(upNext[i])}
                      first={i === 0}
                      last={i === upNext.length - 1}
                      onPlayNow={() => actions.jump(positionOf(i), true)}
                      onRemove={() => remove(i)}
                      onGesture={learnedGestures}
                      onMove={(delta) => move(i, Math.max(0, Math.min(upNext.length - 1, i + delta)))}
                      onMenu={() => setMenu(i)}
                    />
                  ))}
                </View>
              </>
            )}
            <View style={styles.buttons}>
              <Button variant="tonal" icon="playlist_add" label={c.queue.saveAsSet} onPress={saveAsSet} />
              {upNext.length > 0 && (
                <Button
                  variant="tonal"
                  icon="clear_all"
                  label={c.queue.clear}
                  onPress={() => {
                    const before = [...state.player.order];
                    const index = state.player.index;
                    actions.clearQueue();
                    toast(c.toast.cleared, {
                      action: {
                        label: c.common.undo,
                        // After whatever plays by then: in continue mode the player may have moved on.
                        run: () => actions.restoreUpNext(before.slice(index + 1)),
                      },
                    });
                  }}
                />
              )}
            </View>
          </View>

          {previous.length > 0 && (
            <View>
              <SectionTitle>{c.queue.previously}</SectionTitle>
              {previous.map((entry) => {
                const phrase = findPhrase(state.learner, entry.phraseId);
                if (!phrase) return null;
                return (
                  <PhraseRow
                    key={entry.phraseId}
                    phrase={phrase}
                    // "now" reads oddly in a list: under a minute is "just now".
                    detail={now - entry.at < MINUTE ? c.queue.justNow : formatAgo(entry.at, now, c.locale)}
                    playLabel={c.queue.playNext(phrase.target)}
                    // Queues it next rather than replacing the queue.
                    onPlay={() => {
                      actions.enqueue([phrase.id], phrase.setId, 'next');
                      toast(c.set.addedNext);
                    }}
                    onMore={() => nav.showDetails(phrase.id)}
                  />
                );
              })}
            </View>
          )}
        </ScrollView>

        <Sheet open={menu !== null && Boolean(menuPhrase)} title={menuTitle} onClose={() => setMenu(null)}>
          {menu !== null && (
            <>
              <SheetOption
                icon="arrow_upward"
                label={c.queue.moveUp}
                disabled={menu === 0}
                onPress={() => {
                  move(menu, menu - 1);
                  setMenu(null);
                }}
              />
              <SheetOption
                icon="arrow_downward"
                label={c.queue.moveDown}
                disabled={menu === upNext.length - 1}
                onPress={() => {
                  move(menu, menu + 1);
                  setMenu(null);
                }}
              />
              <SheetOption
                icon="delete"
                tone="danger"
                label={c.queue.removeFromQueue}
                onPress={() => {
                  remove(menu);
                  setMenu(null);
                }}
              />
            </>
          )}
        </Sheet>
      </View>
    </ToastOffsetContext.Provider>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Txt variant="label" weight={700} color="secondary" accessibilityRole="header" style={styles.sectionTitle}>
      {children}
    </Txt>
  );
}

interface QueueItemProps {
  phraseId: string;
  /** Its place in the whole queue, as the player counts ("4 of 9"). */
  position: number;
  /** Already played earlier in this queue: a Missed or Hard phrase coming back. */
  again: boolean;
  first: boolean;
  last: boolean;
  onPlayNow: () => void;
  onRemove: () => void;
  /** A swipe or a drag did its job (the hint can fold away). */
  onGesture: () => void;
  /** By this many rows; a drag can move a row several at once. */
  onMove: (delta: number) => void;
  /** A tap on the handle (not a drag) opens the row's options. */
  onMenu: () => void;
}

function QueueItem({ phraseId, position, again, first, last, onPlayNow, onRemove, onGesture, onMove, onMenu }: QueueItemProps) {
  const c = useCopy();
  const { state } = useStore();
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const lifted = useSharedValue(0);
  const height = useSharedValue(64);
  // A drag or swipe that ends over a control must not also press it.
  const moved = useSharedValue(false);

  const swiped = (dx: number) => {
    if (Math.abs(dx) > SWIPE) onGesture();
    if (dx > SWIPE) onPlayNow();
    else if (dx < -SWIPE) onRemove();
  };
  const dropped = (rows: number) => {
    if (rows !== 0) {
      onGesture();
      onMove(rows);
    }
  };

  // Horizontal only: a vertical move scrolls the list.
  const swipe = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-10, 10])
    .onStart(() => {
      moved.set(true);
    })
    .onUpdate((e) => {
      x.value = e.translationX * 0.5;
    })
    .onEnd((e) => {
      runOnJS(swiped)(e.translationX);
      x.value = withSpring(0);
    });
  // The handle drags the row up or down; it lands where it is let go, a whole row at a time.
  const drag = Gesture.Pan()
    .activeOffsetY([-6, 6])
    .onStart(() => {
      lifted.value = 1;
      moved.set(true);
    })
    .onUpdate((e) => {
      y.value = e.translationY;
    })
    .onEnd((e) => {
      runOnJS(dropped)(Math.round(e.translationY / Math.max(1, height.value)));
    })
    .onFinalize(() => {
      y.value = 0;
      lifted.value = 0;
    });

  const swipeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const dragStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }], zIndex: lifted.value ? 10 : 0, opacity: lifted.value ? 0.92 : 1 }));

  const phrase = findPhrase(state.learner, phraseId);
  if (!phrase) return null;
  const prompt = promptOf(phrase, state.learner.profile.nativeLang);

  // The same moves for screen readers, as the row's actions.
  const onAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'moveUp') onMove(-1);
    else if (event.nativeEvent.actionName === 'moveDown') onMove(1);
    else if (event.nativeEvent.actionName === 'remove') onRemove();
  };
  const moves = [...(first ? [] : [{ name: 'moveUp', label: c.queue.moveUp }]), ...(last ? [] : [{ name: 'moveDown', label: c.queue.moveDown }]), { name: 'remove', label: c.queue.swipeRemove }];
  // And for a keyboard on the web: arrows move, Delete removes (react-native-web passes onKeyDown on).
  const onKeyDown = (event: { key: string; preventDefault: () => void }) => {
    const keys: Record<string, () => void> = { ArrowUp: () => onMove(-1), ArrowDown: () => onMove(1), Delete: onRemove, Backspace: onRemove };
    const action = keys[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  };

  return (
    <Animated.View style={[styles.item, dragStyle]} onLayout={(e: LayoutChangeEvent) => (height.value = e.nativeEvent.layout.height + 4)}>
      {/* Revealed under the row while swiping. */}
      <View style={styles.under} accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <View style={styles.underSide}>
          <Icon name="play_circle" fill size="md" color="tertiary" />
          <Txt weight={700} color="tertiary">
            {c.queue.swipePlay}
          </Txt>
        </View>
        <View style={styles.underSide}>
          <Txt weight={700} color="onSurfaceVariant">
            {c.queue.swipeRemove}
          </Txt>
          <Icon name="delete" size="md" color="onSurfaceVariant" />
        </View>
      </View>
      <GestureDetector gesture={swipe}>
        {/* Flat on the page like the rows around it; the tint under it shows only while swiping. */}
        <Animated.View style={[styles.front, swipeStyle]}>
          {/* Not heard yet in this play: led by the prompt, with the target a dashed line (the recall rule). */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={c.queue.playNow(prompt.text)}
            accessibilityHint={c.player.hidden(languageName(phrase.targetLang, c.locale))}
            accessibilityActions={moves}
            onAccessibilityAction={onAction}
            onPressIn={() => moved.set(false)}
            onPress={() => !moved.get() && onPlayNow()}
            style={({ pressed }) => [styles.play, pressed && styles.pressed]}
          >
            <Txt variant="label" color="secondary" align="center" style={styles.position}>
              {String(position)}
            </Txt>
            <View style={styles.flex}>
              <View style={styles.promptLine}>
                <Txt variant="row" weight={500} lang={prompt.lang} style={styles.flex}>
                  {prompt.text}
                </Txt>
                {again && (
                  <View style={styles.again}>
                    <Txt variant="caption" weight={700}>
                      {c.queue.again}
                    </Txt>
                  </View>
                )}
              </View>
              <View style={[styles.hidden, { width: `${Math.min(90, Math.max(30, phrase.target.length * 2.5))}%` }]} />
            </View>
          </Pressable>
        </Animated.View>
      </GestureDetector>
      <GestureDetector gesture={drag}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={c.queue.move(prompt.text)}
          accessibilityHint={c.queue.handleHint}
          accessibilityActions={moves}
          onAccessibilityAction={onAction}
          {...({ onKeyDown } as object)}
          onPressIn={() => moved.set(false)}
          onPress={() => !moved.get() && onMenu()}
          style={({ pressed }) => [styles.handle, pressed && styles.pressed]}
        >
          <Icon name="drag_handle" size="lg" color="secondary" />
        </Pressable>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1, minWidth: 0 },
  headerLine: { borderBottomWidth: 1, borderBottomColor: colors.surfaceContainerHigh },
  header: { height: 56, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%', maxWidth: 512, alignSelf: 'center' },
  headerText: { flex: 1, minWidth: 0 },
  iconButton: { width: TARGET, height: TARGET, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  pressed: { backgroundColor: colors.surfaceContainer },
  content: { width: '100%', maxWidth: 512, alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 16, gap: 20 },
  summary: { minHeight: 48, marginTop: -8, paddingHorizontal: 12, borderRadius: radius['2xl'], backgroundColor: colors.surfaceContainerLow, flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { paddingHorizontal: 8, marginBottom: 4 },
  nothing: { paddingHorizontal: 8, paddingVertical: 12 },
  hint: { paddingHorizontal: 8, marginBottom: 8 },
  items: { gap: 4 },
  item: { flexDirection: 'row', alignItems: 'stretch', borderRadius: radius['2xl'], backgroundColor: colors.surfaceContainerHigh, overflow: 'hidden' },
  under: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  underSide: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  front: { flex: 1, minWidth: 0, backgroundColor: colors.surface },
  play: { flex: 1, minHeight: 56, paddingLeft: 8, paddingRight: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  position: { width: 24, paddingTop: 2, fontVariant: ['tabular-nums'] },
  promptLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  again: { marginTop: 2, paddingHorizontal: 6, borderRadius: 4, backgroundColor: colors.secondaryContainer },
  hidden: { height: 12, marginVertical: 4, borderRadius: radius.full, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.outlineVariant },
  handle: { width: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, paddingHorizontal: 4 },
});
