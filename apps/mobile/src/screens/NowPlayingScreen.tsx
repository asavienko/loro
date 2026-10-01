// The player (the web prototype's src/screens/NowPlayingScreen.tsx): the phrase's picture as large as
// the page allows, the prompt (the target stays hidden until it is heard), the loop's three steps,
// the grades, and the transport. Every figure comes from the state machine; when a rated phrase comes
// back is the core's to decide, and the grades don't show it.
import { useRouter } from 'expo-router';
import { ReactNode, useState } from 'react';
import { LayoutChangeEvent, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { languageName } from '@shared/copy';
import { getTopic, Phrase } from '@shared/content';
import { useNav } from '@shared/nav/NavContext';
import { findPhrase, findSetView, promptOf } from '@shared/state/catalog';
import { formatElapsed, formatWhen } from '@shared/state/clock';
import { playsOnce, REPEAT_SETTINGS, SPEEDS } from '@shared/state/machine';
import { RATING_WINDOW_MS } from '@shared/state/memory';
import {
  currentPhraseId,
  displayLearner,
  isLiked,
  learnerStats,
  listenedMs,
  pendingFor,
  phraseFullPlayMs,
  playableIds,
  sessionSummary,
  setProgress,
  suggestedSetId,
  upNextIds,
  windowLeft,
} from '@shared/state/selectors';
import type { LearnerState, Phase } from '@shared/state/types';
import { endTitle, isTargetRevealed, PHASE_ICONS, phaseInstruction, phaseStepLabel, queueTitle } from '@shared/ui/phase';
import { recentLoopRating } from '@shared/ui/rating';
import { playerArtSize } from '@shared/ui/room';
import { PassCard } from '../nav/PassNotice';
import { useCopy, useNow, useStore } from '../state/store';
import { Button } from '../ui/Button';
import { Icon, IconName } from '../ui/Icon';
import { PhraseNotesView } from '../ui/Notes';
import { PhaseFill } from '../ui/PhaseFill';
import { PhraseImage } from '../ui/PhraseImage';
import { Press } from '../ui/Press';
import { PullDownWindow, PullHandle } from '../ui/PullDown';
import { GradeRow, RatedLine, RatedPanel, RatingLine } from '../ui/Rating';
import { Sheet } from '../ui/Sheet';
import { ToastOffsetContext, useToast } from '../ui/Toast';
import { Txt } from '../ui/Txt';
import { colors, ColorName, radius, shadow, TARGET } from '../ui/theme';
import { useRoom } from '../ui/useRoom';
import { useRate } from './useRate';

const STEPS: Exclude<Phase, 'rate'>[] = ['native', 'pause', 'target'];
/** The page: at most this wide, with these sides (a little less on a compact screen). */
const MAX_WIDTH = 512;
const GUTTER = 20;
const COMPACT_GUTTER = 12;
/** The header, and the dock under the page (the line over the grades, the grades, the transport), before the page is measured. */
const HEADER = 52;
const DOCK = 200;
/** The coach's line for a learner's first phrases, at 100% text: room kept for it, so the picture keeps its size. */
const COACH = 64;

export function NowPlayingScreen() {
  const c = useCopy();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const room = useRoom();
  const { state } = useStore();
  const now = useNow(60_000);
  const [notesOpen, setNotesOpen] = useState(false);
  const [shownAnyway, setShownAnyway] = useState<string | null>(null);
  // The page's height between the header and the dock.
  const [stage, setStage] = useState<number | null>(null);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const phrase = findPhrase(state.learner, currentPhraseId(state.player));
  // Nothing queued (the course changed, or the page was opened directly): only the way out.
  if (!phrase)
    return (
      <PullDownWindow onClose={close} style={[styles.screen, { paddingTop: insets.top }]}>
        <PullHandle>
          <View style={styles.header}>
            <HeaderButton label={c.player.close} icon="keyboard_arrow_down" onPress={close} />
          </View>
        </PullHandle>
      </PullDownWindow>
    );
  const { status, phase, index, order, audioError } = state.player;
  const playing = status === 'playing';
  const cannotSay = audioError?.reason === 'no-clip' && audioError.lang === phrase.targetLang;
  const revealed = isTargetRevealed(state.player) || (cannotSay && shownAnyway === phrase.id);
  const prompt = promptOf(phrase, state.learner.profile.nativeLang);
  const targetName = languageName(phrase.targetLang, c.locale);
  const queueSet = findSetView(state.learner, state.player.setId);
  const coverSet = findSetView(state.learner, phrase.setId) ?? queueSet;
  const tone = (coverSet?.topicId && getTopic(coverSet.topicId)?.tone) || 'secondary';
  const endedOnce = state.player.ended && playsOnce(state.player);
  // The picture runs edge to edge under the header, as tall as the room above the words allows: up
  // to square, less on a short screen or with large text.
  const side = room.compact ? COMPACT_GUTTER : GUTTER;
  const width = Math.min(room.width, MAX_WIDTH);
  const height = stage ?? room.height - insets.top - insets.bottom - HEADER - DOCK;
  const coaching = coaches(state.learner, now);
  const cover = playerArtSize(width, height, room.fontScale, coaching ? COACH : 0);
  const gutter = room.compact ? styles.compactGutter : null;

  return (
    <ToastOffsetContext.Provider value={16}>
      <PullDownWindow onClose={close} style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <PullHandle>
          <View style={styles.header}>
            <HeaderButton label={c.player.close} icon="keyboard_arrow_down" onPress={close} />
            <View style={styles.headerText}>
              <Txt variant="row" face="serif" weight={600} numberOfLines={2} align="center" accessibilityRole="header" lang={queueSet?.targetLang}>
                {queueTitle(c, state.player, queueSet)}
              </Txt>
              <Txt variant="label" color="secondary" align="center">
                {queueSet && order.some((id) => !queueSet.phraseIds.includes(id)) ? c.player.positionInQueue(index + 1, order.length) : c.player.position(index + 1, order.length)}
              </Txt>
            </View>
            <HeaderButton label={c.player.openQueue} icon="queue_music" onPress={() => router.push('/queue')} />
          </View>
        </PullHandle>

        <ScrollView
          style={styles.stage}
          contentContainerStyle={[styles.stageContent, gutter]}
          onLayout={(e: LayoutChangeEvent) => setStage(Math.round(e.nativeEvent.layout.height))}
        >
          <View style={[styles.cover, { marginHorizontal: -side }, cover === 0 && styles.gone]}>
            <PhraseImage icons={phrase.image} tone={tone} width={width} height={cover} rounded={0} phrase={phrase} redraw />
          </View>
          <View style={[styles.about, cover > 0 && styles.underCover]}>
            <PhraseBlock phrase={phrase} revealed={revealed} />
            <ActionRow phrase={phrase} onNotes={() => setNotesOpen(true)} />
          </View>
          {/* The end of a pass, over the top of the picture: clear of the grades and the controls. */}
          {!endedOnce && (
            <View style={[styles.notice, { left: side, right: side }]} pointerEvents="box-none">
              <PassCard />
            </View>
          )}
          {/* What room is left goes here: the loop sits over the controls, as a music player's progress does. */}
          <View style={styles.spring} />
          {!endedOnce && (
            <View style={styles.loop}>
              {audioError ? (
                <View style={styles.error} accessibilityRole="alert">
                  <View style={styles.row}>
                    <Icon name="volume_off" size="md" color="error" />
                    <Txt style={styles.flex}>{audioError.reason === 'no-clip' ? c.player.audioError(languageName(audioError.lang, c.locale)) : c.player.audioSilent}</Txt>
                  </View>
                  {cannotSay && !revealed && <Button variant="text" label={c.player.showText(targetName)} onPress={() => setShownAnyway(phrase.id)} />}
                </View>
              ) : (
                <Txt variant="title" weight={600} accessibilityLiveRegion="polite">
                  {playing ? phaseInstruction(c, phase, prompt.lang, phrase.targetLang) : c.player.paused}
                </Txt>
              )}
              <Coach />
              <Steps phrase={phrase} promptLang={prompt.lang} />
              <PlayTime phrase={phrase} />
            </View>
          )}
        </ScrollView>

        <View style={[styles.dock, gutter, !endedOnce && styles.dockLine]}>
          {endedOnce ? <EndPanel onClose={close} /> : <Rating phrase={phrase} />}
          {!endedOnce && <Transport />}
        </View>

        <Sheet open={notesOpen} title={c.phrase.notesTitle} onClose={() => setNotesOpen(false)}>
          <PhraseNotesView phrase={phrase} />
        </Sheet>
      </PullDownWindow>
    </ToastOffsetContext.Provider>
  );
}

function HeaderButton({ label, icon, onPress }: { label: string; icon: IconName; onPress: () => void }) {
  return (
    <Press accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.headerButton, pressed && { backgroundColor: colors.surfaceContainer }]}>
      <Icon name={icon} size={26} />
    </Press>
  );
}

/** While the learner recalls it, the prompt leads and the target is a dashed slot; once heard, the target leads. */
function PhraseBlock({ phrase, revealed }: { phrase: Phrase; revealed: boolean }) {
  const c = useCopy();
  const { state } = useStore();
  const prompt = promptOf(phrase, state.learner.profile.nativeLang);
  return revealed ? (
    <View>
      <Txt variant="displaySm" face="serif" italic weight={600} lang={phrase.targetLang}>
        {phrase.target}
      </Txt>
      <Txt color="secondary" lang={prompt.lang}>
        {prompt.text}
      </Txt>
    </View>
  ) : (
    <View>
      <View accessible accessibilityLabel={c.player.hidden(languageName(phrase.targetLang, c.locale))} style={styles.hidden}>
        <Txt variant="displaySm" face="serif" italic color="outlineVariant" numberOfLines={1}>
          {' '.repeat(Math.min(12, Math.max(4, Math.round(phrase.target.length / 3))))}
        </Txt>
      </View>
      <Txt variant="displaySm" weight={600} lang={prompt.lang} style={styles.promptText}>
        {prompt.text}
      </Txt>
    </View>
  );
}

/** The speed on the left; like, add to set and notes on the right. */
function ActionRow({ phrase, onNotes }: { phrase: Phrase; onNotes: () => void }) {
  const c = useCopy();
  const nav = useNav();
  const { state, actions } = useStore();
  const liked = isLiked(state.learner, 'phrase', phrase.id);
  return (
    <View style={styles.actions}>
      <SpeedButton />
      <View style={styles.flex} />
      <Press accessibilityRole="togglebutton" accessibilityLabel={c.phrase.likeLabel} accessibilityState={{ checked: liked }} onPress={() => actions.toggleLike('phrase', phrase.id)} style={styles.iconButton}>
        <Icon name="favorite" fill={liked} size={24} color={liked ? 'primaryContainer' : 'secondary'} />
      </Press>
      <Press accessibilityRole="button" accessibilityLabel={c.phrase.addToSet} onPress={() => nav.addToSet([phrase.id])} style={styles.iconButton}>
        <Icon name="playlist_add" size={24} color="secondary" />
      </Press>
      <Press accessibilityRole="button" accessibilityLabel={c.phrase.notesTitle} onPress={onNotes} style={styles.iconButton}>
        <Icon name="lightbulb" size={24} color="secondary" />
      </Press>
    </View>
  );
}

/**
 * The three steps as a track under the instruction, which names the one playing: each its icon, the
 * current one filled while it plays; the learner's turn fills over its real length. No names in the
 * steps, so none is ever cut short.
 */
function Steps({ phrase, promptLang }: { phrase: Phrase; promptLang: Phrase['targetLang'] }) {
  const c = useCopy();
  const { state } = useStore();
  const { phase, status } = state.player;
  const playing = status === 'playing';
  return (
    <View accessibilityLabel={c.player.steps} style={styles.steps}>
      {STEPS.map((p) => {
        const current = p === phase;
        const done = phase === 'rate' || STEPS.indexOf(p) < STEPS.indexOf(phase as Exclude<Phase, 'rate'>);
        const look = current && playing ? styles.stepPlaying : current ? styles.stepCurrent : done ? styles.stepDone : styles.stepIdle;
        const ink: ColorName = current && playing ? 'onPrimary' : current || done ? 'onPrimaryFixed' : 'secondary';
        const label = phaseStepLabel(c, p, promptLang, phrase.targetLang);
        return (
          <View key={p} accessible accessibilityLabel={label} accessibilityState={{ selected: current }} style={[styles.step, look]}>
            {current && p === 'pause' && <PhaseFill style={{ backgroundColor: colors.primary, height: '100%' }} />}
            <Icon name={current && !playing ? 'pause' : PHASE_ICONS[p]} size="sm" color={ink} />
          </View>
        );
      })}
    </View>
  );
}

/** Whether the learner is new enough for the coach: their first three phrases. */
function coaches(learner: LearnerState, now: number): boolean {
  return learnerStats(learner, now).started < 3;
}

/** For a learner's first phrases: the method in one line, while it's their turn. */
function Coach() {
  const c = useCopy();
  const { state } = useStore();
  const now = useNow(60_000);
  const { phase, status } = state.player;
  if (status !== 'playing' || phase !== 'pause' || !coaches(state.learner, now)) return null;
  return <Txt color="secondary">{c.player.coach}</Txt>;
}

/** Under the steps, as a music player's times: the repetition; the time listened, of the full play at 1× once measured. */
function PlayTime({ phrase }: { phrase: Phrase }) {
  const c = useCopy();
  const { state } = useStore();
  const now = useNow(250);
  const elapsed = listenedMs(state.player, now);
  const full = state.prefs.speed === 1 ? phraseFullPlayMs(state, phrase, state.player.repeats) : null;
  const total = full !== null && elapsed <= full ? full : null;
  return (
    <View style={styles.times}>
      <Txt variant="label" color="secondary" numberOfLines={1} style={styles.shrink}>
        {c.player.repetition(state.player.repetition, state.player.repeats)}
      </Txt>
      <Txt variant="label" color="secondary" numberOfLines={1} style={styles.clock}>
        {formatElapsed(elapsed)}
        {total !== null ? ` / ${c.common.fullPlay(formatElapsed(total))}` : ''}
      </Txt>
    </View>
  );
}

/**
 * Three grades, never preselected and without times. Once one is given they go for the rating's
 * five-minute window: in their place, the grade given, what it did and Undo. A rating given in the
 * hold moves the loop on: then the line over the next phrase's grades offers Undo for that phrase for
 * a few seconds.
 */
function Rating({ phrase }: { phrase: Phrase }) {
  const c = useCopy();
  const { state, actions } = useStore();
  const now = useNow(1000);
  const rate = useRate();
  const pending = pendingFor(state, phrase.id);
  const left = pending ? Math.min(RATING_WINDOW_MS, windowLeft(pending, Math.max(now, pending.at))) : 0;
  const active = pending && left > 0 ? pending : undefined;
  const recent = active ? null : recentLoopRating(state.pending, now);
  const previous = recent && recent.phraseId !== phrase.id ? recent : null;
  const hold = state.player.phase === 'rate' && state.player.status === 'playing';
  const beforeTurn = state.player.repetition === 1 && (state.player.phase === 'native' || state.player.phase === 'pause');
  return (
    <View style={[styles.rating, hold && styles.ratingHold]}>
      {active ? (
        <RatedPanel
          grade={active.grade}
          title={c.player.ratedAs(c.common.grade[active.grade])}
          text={upNextIds(state.player).includes(phrase.id) ? c.player.backLater : c.player.scheduled}
          undo={{ label: c.player.undoFor(formatElapsed(left)), accessibilityLabel: c.player.undoLabel(formatElapsed(left)), onPress: () => actions.unrate() }}
        />
      ) : (
        <>
          {previous ? (
            <RatedLine text={c.player.ratedPrevious(c.common.grade[previous.grade])} undo={{ label: c.common.undo, onPress: () => actions.unrate(previous.phraseId) }} />
          ) : (
            <RatingLine>
              <Txt variant={hold ? 'body' : 'label'} weight={hold ? 700 : 500} color={hold ? 'onSurface' : 'secondary'} align="center" numberOfLines={2}>
                {beforeTurn ? c.player.rateAfterTurn : c.player.howDidItGo}
              </Txt>
            </RatingLine>
          )}
          <GradeRow onRate={rate} />
        </>
      )}
      {hold && (
        <View style={styles.holdTrack}>
          <PhaseFill deplete style={{ backgroundColor: colors.primaryContainer, height: 4, borderRadius: radius.full }} />
        </View>
      )}
    </View>
  );
}

/** Where a queue with a natural end stops: the session's own figures, and what to do next. */
function EndPanel({ onClose }: { onClose: () => void }) {
  const c = useCopy();
  const nav = useNav();
  const { state, actions } = useStore();
  const now = useNow(30_000);
  const source = state.player.source;
  const summary = sessionSummary(state, now);
  const rated = summary ? summary.ratings.missed + summary.ratings.hard + summary.ratings.easy : 0;
  const learner = displayLearner(state);
  const suggested = findSetView(learner, suggestedSetId(learner, now));
  const next = !summary
    ? c.player.end.nothingDue
    : summary.dueNow > 0
      ? c.home.reviewBody(summary.dueNow)
      : summary.nextDue
        ? c.player.end.nextReview(formatWhen(summary.nextDue.at, now, c.locale))
        : c.player.end.nothingDue;
  const demo = source?.kind === 'demo';
  const startSuggested = () => {
    if (!suggested) return;
    const ids = playableIds(learner, suggested.phraseIds, now);
    nav.playSet(suggested.id, { phraseIds: ids.length > 0 ? ids : suggested.phraseIds });
  };
  return (
    <View style={styles.end} accessibilityLiveRegion="polite">
      <Txt variant="heading" face="serif" weight={600} align="center" accessibilityRole="header">
        {endTitle(c, source, rated)}
      </Txt>
      <Txt color="secondary" align="center">
        {demo ? c.player.end.demoBody : `${c.player.end.rated(rated)} · ${next}`}
      </Txt>
      {source?.kind === 'library' ? (
        <Button variant="primary" icon="replay" label={c.player.end.playAgain} onPress={() => actions.jump(0, true)} style={styles.endButton} />
      ) : (
        suggested && (
          <Button
            variant="primary"
            icon="play_arrow"
            iconFill
            label={demo || setProgress(learner, suggested.phraseIds, now).started === 0 ? c.player.end.startSet(suggested.title) : c.player.end.continueSet(suggested.title)}
            onPress={startSuggested}
            style={styles.endButton}
          />
        )
      )}
      <Button variant="text" label={demo ? c.player.end.notNow : c.common.close} onPress={onClose} />
    </View>
  );
}

/** Play mode, previous, play/pause, next, repetitions. */
function Transport() {
  const c = useCopy();
  const { state, actions } = useStore();
  const { toast } = useToast();
  const playing = state.player.status === 'playing';
  const mode = state.prefs.playMode;
  const setting = state.prefs.repeats;
  const nextRepeats = REPEAT_SETTINGS[(REPEAT_SETTINGS.indexOf(setting) + 1) % REPEAT_SETTINGS.length];
  return (
    <View style={styles.transport}>
      <SettingButton
        label={c.player.playMode[mode]}
        caption={mode === 'repeat' ? c.player.captions.again : c.player.captions.continue}
        onPress={() => {
          const next = mode === 'repeat' ? 'continue' : 'repeat';
          actions.setPrefs({ playMode: next });
          toast(c.player.playModeToast[next]);
        }}
      >
        <Icon name={mode === 'repeat' ? 'repeat' : 'playlist_play'} size={26} color="primaryContainer" />
      </SettingButton>
      <Press accessibilityRole="button" accessibilityLabel={c.player.previous} onPress={actions.prev} style={styles.skip}>
        <Icon name="skip_previous" fill size={34} />
      </Press>
      <Press
        accessibilityRole="button"
        accessibilityLabel={playing ? c.common.pause : c.common.play}
        onPress={playing ? actions.pause : actions.play}
        style={({ pressed }) => [styles.play, pressed && { transform: [{ scale: 0.95 }] }]}
      >
        <Icon name={playing ? 'pause' : 'play_arrow'} fill size={40} color="onPrimary" />
      </Press>
      <Press accessibilityRole="button" accessibilityLabel={c.player.next} onPress={actions.next} style={styles.skip}>
        <Icon name="skip_next" fill size={34} />
      </Press>
      <SettingButton
        label={setting === 'auto' ? c.player.repeats.auto : setting === 1 ? c.player.repeats.one : c.player.repeats.three}
        caption={c.player.captions.reps}
        onPress={() => {
          actions.setPrefs({ repeats: nextRepeats });
          toast(nextRepeats === 'auto' ? c.player.repeatsToast.auto : nextRepeats === 1 ? c.player.repeatsToast.one : c.player.repeatsToast.three);
        }}
      >
        <View style={styles.repeats}>
          <Txt variant="label" weight={700} color="primaryContainer" numberOfLines={1}>
            {setting === 'auto' ? c.player.captions.auto : String(setting)}
          </Txt>
        </View>
      </SettingButton>
    </View>
  );
}

function SettingButton({ label, caption, onPress, children }: { label: string; caption: string; onPress: () => void; children: ReactNode }) {
  return (
    <Press accessibilityRole="button" accessibilityLabel={label} haptic="select" onPress={onPress} style={({ pressed }) => [styles.setting, pressed && { backgroundColor: colors.surfaceContainer }]}>
      {children}
      <Txt variant="caption" weight={600} color="primaryContainer" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
        {caption}
      </Txt>
    </Press>
  );
}

/** Speed, the only speed control in the app: one button that says the speed and steps to the next. */
function SpeedButton() {
  const c = useCopy();
  const { state, actions } = useStore();
  const speed = state.prefs.speed;
  const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={c.player.speedIs(speed)}
      haptic="select"
      onPress={() => actions.setPrefs({ speed: next })}
      style={({ pressed }) => [styles.speedTarget, pressed && { opacity: 0.7 }]}
    >
      <View style={[styles.speed, speed !== 1 && styles.speedChanged]}>
        <Txt variant="body" weight={700} color={speed !== 1 ? 'inverseOnSurface' : 'onSurface'}>{`${speed}×`}</Txt>
      </View>
    </Press>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, minHeight: HEADER, width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center' },
  headerText: { flex: 1, minWidth: 0 },
  headerButton: { width: TARGET, height: TARGET, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  stage: { flex: 1 },
  stageContent: { flexGrow: 1, paddingHorizontal: GUTTER, paddingTop: 4, paddingBottom: 12, width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center' },
  spring: { flexGrow: 1, minHeight: 12 },
  compactGutter: { paddingHorizontal: COMPACT_GUTTER },
  notice: { position: 'absolute', top: 4 },
  cover: { alignItems: 'center', marginTop: -4 },
  gone: { display: 'none' },
  about: { gap: 4 },
  underCover: { marginTop: 20 },
  hidden: { borderBottomWidth: 2, borderStyle: 'dashed', borderColor: colors.outlineVariant, alignSelf: 'flex-start' },
  promptText: { marginTop: 4 },
  actions: { flexDirection: 'row', alignItems: 'center', minHeight: TARGET, marginRight: -10 },
  iconButton: { width: TARGET, height: TARGET, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  loop: { gap: 8 },
  steps: { flexDirection: 'row', gap: 6 },
  step: { flex: 1, height: 32, borderRadius: radius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  stepPlaying: { backgroundColor: colors.primaryContainer, borderColor: colors.primaryContainer },
  stepCurrent: { backgroundColor: colors.primaryFixed, borderColor: colors.primaryContainer, borderStyle: 'dashed' },
  stepDone: { backgroundColor: 'rgba(255,219,207,0.5)', borderColor: 'transparent' },
  stepIdle: { backgroundColor: colors.surfaceContainerLow, borderColor: colors.hairline },
  times: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: -2 },
  clock: { flexShrink: 0, fontVariant: ['tabular-nums'] },
  error: { borderRadius: radius.xl, backgroundColor: 'rgba(255,218,214,0.6)', padding: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  shrink: { flexShrink: 1 },
  flex: { flex: 1, minWidth: 0 },
  dock: { paddingHorizontal: GUTTER, paddingTop: 4, paddingBottom: 8, gap: 6, width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center' },
  dockLine: { borderTopWidth: 1, borderTopColor: colors.hairline },
  rating: { borderRadius: radius['3xl'], paddingHorizontal: 6, paddingBottom: 10, borderWidth: 2, borderColor: 'transparent', marginHorizontal: -8 },
  ratingHold: { backgroundColor: 'rgba(255,219,207,0.4)', borderColor: colors.primaryContainer },
  holdTrack: { position: 'absolute', left: 16, right: 16, bottom: 3, height: 4, borderRadius: radius.full, overflow: 'hidden' },
  end: { borderRadius: radius['3xl'], backgroundColor: colors.surfaceContainerLow, padding: 16, gap: 8, alignItems: 'center' },
  endButton: { alignSelf: 'stretch', borderRadius: radius['3xl'] },
  transport: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  skip: { width: 48, height: 48, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  play: { width: 64, height: 64, borderRadius: radius.full, backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center', ...shadow.float },
  setting: { minWidth: 56, height: 56, paddingHorizontal: 4, borderRadius: radius['2xl'], alignItems: 'center', justifyContent: 'center', gap: 2 },
  repeats: { minWidth: 40, height: 26, paddingHorizontal: 6, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center' },
  speedTarget: { minWidth: TARGET, minHeight: TARGET, justifyContent: 'center' },
  speed: { minHeight: 32, paddingHorizontal: 12, borderRadius: radius.full, borderWidth: 1, borderColor: colors.hairline, backgroundColor: colors.surfaceContainerLow, alignItems: 'center', justifyContent: 'center' },
  speedChanged: { backgroundColor: colors.inverseSurface, borderColor: colors.inverseSurface },
});
