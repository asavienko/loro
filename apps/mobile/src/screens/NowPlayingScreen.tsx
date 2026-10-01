// The player (the web prototype's src/screens/NowPlayingScreen.tsx): the phrase's picture, the
// prompt (the target stays hidden until it is heard), the loop's three steps, the grades, and the
// transport. Every figure comes from the state machine; the rating's return comes from the core.
import { useRouter } from 'expo-router';
import { ReactNode, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
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
  previewDue,
  sessionSummary,
  setProgress,
  suggestedSetId,
  upNextIds,
  windowLeft,
} from '@shared/state/selectors';
import type { Grade, Phase } from '@shared/state/types';
import { backIn, endTitle, isTargetRevealed, PHASE_ICONS, phaseInstruction, phaseStepLabel, queueTitle } from '@shared/ui/phase';
import { useCopy, useNow, useStore } from '../state/store';
import { Button } from '../ui/Button';
import { Icon, IconName } from '../ui/Icon';
import { PhraseNotesView } from '../ui/Notes';
import { PhaseFill } from '../ui/PhaseFill';
import { PhraseImage } from '../ui/PhraseImage';
import { Sheet } from '../ui/Sheet';
import { ToastOffsetContext, useToast } from '../ui/Toast';
import { Txt } from '../ui/Txt';
import { colors, ColorName, radius, shadow, TARGET } from '../ui/theme';
import { GRADES } from './grades';
import { useRate } from './useRate';

const STEPS: Exclude<Phase, 'rate'>[] = ['native', 'pause', 'target'];
const COVER = 200;


export function NowPlayingScreen() {
  const c = useCopy();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state } = useStore();
  const [notesOpen, setNotesOpen] = useState(false);
  const [shownAnyway, setShownAnyway] = useState<string | null>(null);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const phrase = findPhrase(state.learner, currentPhraseId(state.player));
  // Nothing queued (the course changed, or the page was opened directly): only the way out.
  if (!phrase)
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <HeaderButton label={c.player.close} icon="keyboard_arrow_down" onPress={close} />
        </View>
      </View>
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

  return (
    <ToastOffsetContext.Provider value={16}>
      <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
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

        <ScrollView style={styles.stage} contentContainerStyle={styles.stageContent}>
          <View style={styles.cover}>
            <PhraseImage icons={phrase.image} tone={tone} width={COVER} height={COVER} rounded={24} style={shadow.cover} />
          </View>
          <PhraseBlock phrase={phrase} revealed={revealed} />
          <ActionRow phrase={phrase} onNotes={() => setNotesOpen(true)} />
          {!endedOnce && (
            <View style={styles.loop}>
              <PlayTime phrase={phrase} />
              <Steps phrase={phrase} promptLang={prompt.lang} />
              {audioError ? (
                <View style={styles.error} accessibilityRole="alert">
                  <View style={styles.row}>
                    <Icon name="volume_off" size="md" color="error" />
                    <Txt style={styles.flex}>{audioError.reason === 'no-clip' ? c.player.audioError(languageName(audioError.lang, c.locale)) : c.player.audioSilent}</Txt>
                  </View>
                  {cannotSay && !revealed && <Button variant="text" label={c.player.showText(targetName)} onPress={() => setShownAnyway(phrase.id)} />}
                </View>
              ) : (
                <Txt variant="heading" weight={600} accessibilityLiveRegion="polite">
                  {playing ? phaseInstruction(c, phase, prompt.lang, phrase.targetLang) : c.player.paused}
                </Txt>
              )}
              <Coach />
            </View>
          )}
        </ScrollView>

        <View style={[styles.dock, !endedOnce && styles.dockLine]}>
          {endedOnce ? <EndPanel onClose={close} /> : <Rating phrase={phrase} />}
          {!endedOnce && <Transport />}
          {!endedOnce && <SpeedRow />}
        </View>

        <Sheet open={notesOpen} title={c.phrase.notesTitle} onClose={() => setNotesOpen(false)}>
          <PhraseNotesView phrase={phrase} />
        </Sheet>
      </View>
    </ToastOffsetContext.Provider>
  );
}

function HeaderButton({ label, icon, onPress }: { label: string; icon: IconName; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.headerButton, pressed && { backgroundColor: colors.surfaceContainer }]}>
      <Icon name={icon} size={26} />
    </Pressable>
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

/** Like, add to set and notes, on the right. */
function ActionRow({ phrase, onNotes }: { phrase: Phrase; onNotes: () => void }) {
  const c = useCopy();
  const nav = useNav();
  const { state, actions } = useStore();
  const liked = isLiked(state.learner, 'phrase', phrase.id);
  return (
    <View style={styles.actions}>
      <View style={styles.flex} />
      <Pressable accessibilityRole="togglebutton" accessibilityLabel={c.phrase.likeLabel} accessibilityState={{ checked: liked }} onPress={() => actions.toggleLike('phrase', phrase.id)} style={styles.iconButton}>
        <Icon name="favorite" fill={liked} size={24} color={liked ? 'primaryContainer' : 'secondary'} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={c.phrase.addToSet} onPress={() => nav.addToSet([phrase.id])} style={styles.iconButton}>
        <Icon name="playlist_add" size={24} color="secondary" />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={c.phrase.notesTitle} onPress={onNotes} style={styles.iconButton}>
        <Icon name="lightbulb" size={24} color="secondary" />
      </Pressable>
    </View>
  );
}

/** The three steps: the current one filled while it plays; the learner's turn fills over its real length. */
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
        return (
          <View key={p} accessibilityState={{ selected: current }} style={[styles.step, look]}>
            {current && p === 'pause' && <PhaseFill style={{ backgroundColor: colors.primary, height: '100%' }} />}
            <Icon name={current && !playing ? 'pause' : PHASE_ICONS[p]} size="sm" color={ink} />
            <Txt variant="label" weight={600} color={ink} numberOfLines={1}>
              {phaseStepLabel(c, p, promptLang, phrase.targetLang)}
            </Txt>
          </View>
        );
      })}
    </View>
  );
}

/** For a learner's first phrases: the method in one line, while it's their turn. */
function Coach() {
  const c = useCopy();
  const { state } = useStore();
  const now = useNow(60_000);
  const { phase, status } = state.player;
  if (status !== 'playing' || phase !== 'pause' || learnerStats(state.learner, now).started >= 3) return null;
  return <Txt color="secondary">{c.player.coach}</Txt>;
}

/** Repetition, elapsed listening time, and the full play at 1× once measured. */
function PlayTime({ phrase }: { phrase: Phrase }) {
  const c = useCopy();
  const { state } = useStore();
  const now = useNow(250);
  const elapsed = listenedMs(state.player, now);
  const full = state.prefs.speed === 1 ? phraseFullPlayMs(state, phrase, state.player.repeats) : null;
  const total = full !== null && elapsed <= full ? full : null;
  return (
    <Txt variant="label" color="secondary" align="right">
      {c.player.repetition(state.player.repetition, state.player.repeats)} · {formatElapsed(elapsed)}
      {total !== null ? ` / ${c.common.fullPlay(formatElapsed(total))}` : ''}
    </Txt>
  );
}

/** Three grades, never preselected; each says when the phrase comes back. A rating can be undone for five minutes. */
function Rating({ phrase }: { phrase: Phrase }) {
  const c = useCopy();
  const { state, actions } = useStore();
  const now = useNow(1000);
  const rate = useRate();
  const pending = pendingFor(state, phrase.id);
  const left = pending ? Math.min(RATING_WINDOW_MS, windowLeft(pending, Math.max(now, pending.at))) : 0;
  const active = pending && left > 0 ? pending : undefined;
  const from = active ? Math.max(now, active.at) : now;
  const dueOf = (grade: Grade) => previewDue(state.learner, phrase.id, grade, active?.at ?? now, active?.day);
  const hold = state.player.phase === 'rate' && state.player.status === 'playing';
  const beforeTurn = state.player.repetition === 1 && (state.player.phase === 'native' || state.player.phase === 'pause');
  return (
    <View style={[styles.rating, hold && styles.ratingHold]}>
      <View style={styles.ratingLine}>
        {active ? (
          <>
            <Txt style={styles.flex}>
              {c.player.rated(c.common.grade[active.grade], backIn(c, dueOf(active.grade), from))}
              {upNextIds(state.player).includes(phrase.id) ? ` ${c.player.requeued}` : ''}
            </Txt>
            <Button variant="text" label={c.player.undoFor(formatElapsed(left))} accessibilityLabel={c.player.undoLabel(formatElapsed(left))} onPress={() => actions.unrate()} />
          </>
        ) : (
          <Txt weight={hold ? 700 : 400} color={hold ? 'onSurface' : 'secondary'} align="center" style={styles.flex}>
            {beforeTurn ? c.player.rateAfterTurn : c.player.howDidItGo}
          </Txt>
        )}
      </View>
      <View style={styles.grades}>
        {GRADES.map(({ grade, icon, bg, ink }) => {
          const selected = active?.grade === grade;
          return (
            <Pressable
              key={grade}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => rate(grade)}
              style={({ pressed }) => [styles.grade, { backgroundColor: bg }, selected && styles.gradeSelected, pressed && { opacity: 0.8 }]}
            >
              <View style={styles.row}>
                <Icon name={selected ? 'task_alt' : icon} size="sm" color={ink} />
                <Txt weight={selected ? 700 : 600} color={ink}>
                  {c.common.grade[grade]}
                </Txt>
              </View>
              <Txt variant="caption" color={ink}>
                {backIn(c, dueOf(grade), from)}
              </Txt>
            </Pressable>
          );
        })}
      </View>
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
      <Pressable accessibilityRole="button" accessibilityLabel={c.player.previous} onPress={actions.prev} style={styles.skip}>
        <Icon name="skip_previous" fill size={34} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={playing ? c.common.pause : c.common.play}
        onPress={playing ? actions.pause : actions.play}
        style={({ pressed }) => [styles.play, pressed && { transform: [{ scale: 0.95 }] }]}
      >
        <Icon name={playing ? 'pause' : 'play_arrow'} fill size={40} color="onPrimary" />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={c.player.next} onPress={actions.next} style={styles.skip}>
        <Icon name="skip_next" fill size={34} />
      </Pressable>
      <SettingButton
        label={setting === 'auto' ? c.player.repeats.auto : setting === 1 ? c.player.repeats.one : c.player.repeats.three}
        caption={c.player.captions.reps}
        onPress={() => {
          actions.setPrefs({ repeats: nextRepeats });
          toast(nextRepeats === 'auto' ? c.player.repeatsToast.auto : nextRepeats === 1 ? c.player.repeatsToast.one : c.player.repeatsToast.three);
        }}
      >
        <View style={styles.repeats}>
          <Txt variant="label" weight={700} color="primaryContainer">
            {setting === 'auto' ? c.player.captions.auto : String(setting)}
          </Txt>
        </View>
      </SettingButton>
    </View>
  );
}

function SettingButton({ label, caption, onPress, children }: { label: string; caption: string; onPress: () => void; children: ReactNode }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.setting, pressed && { backgroundColor: colors.surfaceContainer }]}>
      {children}
      <Txt variant="caption" weight={600} color="primaryContainer" numberOfLines={1}>
        {caption}
      </Txt>
    </Pressable>
  );
}

/** Speed: the only speed control in the app. */
function SpeedRow() {
  const c = useCopy();
  const { state, actions } = useStore();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={c.player.speed} style={styles.speeds}>
      {SPEEDS.map((s) => {
        const on = state.prefs.speed === s;
        return (
          <Pressable key={s} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => actions.setPrefs({ speed: s })} style={[styles.speed, on && styles.speedOn]}>
            <Txt weight={on ? 700 : 500} color={on ? 'onSurface' : 'secondary'}>{`${s}×`}</Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, minHeight: 52, width: '100%', maxWidth: 512, alignSelf: 'center' },
  headerText: { flex: 1, minWidth: 0 },
  headerButton: { width: TARGET, height: TARGET, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  stage: { flex: 1 },
  stageContent: { paddingHorizontal: 20, paddingBottom: 16, gap: 12, width: '100%', maxWidth: 512, alignSelf: 'center' },
  cover: { alignItems: 'center', paddingVertical: 4 },
  hidden: { borderBottomWidth: 2, borderStyle: 'dashed', borderColor: colors.outlineVariant, alignSelf: 'flex-start' },
  promptText: { marginTop: 4 },
  actions: { flexDirection: 'row', alignItems: 'center', minHeight: TARGET },
  iconButton: { width: TARGET, height: TARGET, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  loop: { gap: 6 },
  steps: { flexDirection: 'row', gap: 6 },
  step: { flex: 1, minHeight: TARGET, paddingHorizontal: 4, borderRadius: radius.xl, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, overflow: 'hidden' },
  stepPlaying: { backgroundColor: colors.primaryContainer, borderColor: colors.primaryContainer },
  stepCurrent: { backgroundColor: colors.primaryFixed, borderColor: colors.primaryContainer, borderStyle: 'dashed' },
  stepDone: { backgroundColor: 'rgba(255,219,207,0.5)', borderColor: 'transparent' },
  stepIdle: { backgroundColor: colors.surfaceContainerLow, borderColor: colors.hairline },
  error: { borderRadius: radius.xl, backgroundColor: 'rgba(255,218,214,0.6)', padding: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1, minWidth: 0 },
  dock: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8, gap: 8, width: '100%', maxWidth: 512, alignSelf: 'center' },
  dockLine: { borderTopWidth: 1, borderTopColor: colors.hairline },
  rating: { borderRadius: radius['3xl'], paddingHorizontal: 6, paddingBottom: 10, borderWidth: 2, borderColor: 'transparent' },
  ratingHold: { backgroundColor: 'rgba(255,219,207,0.4)', borderColor: colors.primaryContainer },
  ratingLine: { minHeight: TARGET, flexDirection: 'row', alignItems: 'center', gap: 8 },
  grades: { flexDirection: 'row', gap: 8 },
  grade: { flex: 1, minHeight: 56, borderRadius: radius['2xl'], alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  gradeSelected: { borderWidth: 2, borderColor: colors.onSurface },
  holdTrack: { position: 'absolute', left: 16, right: 16, bottom: 3, height: 4, borderRadius: radius.full, overflow: 'hidden' },
  end: { borderRadius: radius['3xl'], backgroundColor: colors.surfaceContainerLow, padding: 16, gap: 8, alignItems: 'center' },
  endButton: { alignSelf: 'stretch', borderRadius: radius['3xl'] },
  transport: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  skip: { width: 48, height: 48, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  play: { width: 64, height: 64, borderRadius: radius.full, backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center', ...shadow.float },
  setting: { width: 56, height: 56, borderRadius: radius['2xl'], alignItems: 'center', justifyContent: 'center', gap: 2 },
  repeats: { minWidth: 40, height: 26, paddingHorizontal: 6, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center' },
  speeds: { flexDirection: 'row', gap: 4, padding: 2, width: '100%', maxWidth: 288, alignSelf: 'center', backgroundColor: colors.surfaceContainerLow, borderRadius: radius.full },
  speed: { flex: 1, minHeight: TARGET, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  speedOn: { backgroundColor: colors.surfaceContainerLowest, ...shadow.card },
});
