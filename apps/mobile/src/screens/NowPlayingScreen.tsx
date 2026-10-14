// The phrase player, around the play button (v2-prototype-decisions.md, "Player"): a night screen
// over the phrase's picture, the phrase's three steps (Listen, Say it, Check), the phrase, and the
// controls around one large play button. The loop still plays by itself: Next step, Hint and Show
// answer only move it on. Every figure comes from the state machine; when a rated phrase comes back
// is the core's to decide, and is said only once it is rated.
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { languageName } from '@shared/copy';
import { getTopic, Phrase, TopicTone } from '@shared/content';
import { useNav } from '@shared/nav/NavContext';
import { findPhrase, findSetView, promptOf } from '@shared/state/catalog';
import { formatWhen } from '@shared/state/clock';
import { playsOnce, REPEAT_SETTINGS, SPEEDS } from '@shared/state/machine';
import { RATING_WINDOW_MS } from '@shared/state/memory';
import {
  currentPhraseId,
  displayLearner,
  isLiked,
  learnerStats,
  pendingFor,
  playableIds,
  previewDue,
  sessionSummary,
  setProgress,
  suggestedSetId,
  upNextIds,
  windowLeft,
} from '@shared/state/selectors';
import type { Grade, LearnerState, RepeatsSetting } from '@shared/state/types';
import { hintOf } from '@shared/ui/hint';
import { endTitle, isTargetRevealed, phaseInstruction, PlayerStep, playerStep, queueTitle } from '@shared/ui/phase';
import { recentLoopRating } from '@shared/ui/rating';
import { useClipMaking } from '../audio/clipMaking';
import { PassCard } from '../nav/PassNotice';
import { useCopy, useNow, useStore } from '../state/store';
import { Button } from '../ui/Button';
import { Icon, IconName } from '../ui/Icon';
import { PhraseNotesView } from '../ui/Notes';
import { PhaseFill } from '../ui/PhaseFill';
import { PhraseImage } from '../ui/PhraseImage';
import { Press } from '../ui/Press';
import { PullDownWindow, PullHandle } from '../ui/PullDown';
import { Sheet } from '../ui/Sheet';
import { ToastOffsetContext, useToast } from '../ui/Toast';
import { Toggle } from '../ui/Toggle';
import { Txt } from '../ui/Txt';
import { colors, radius, TARGET } from '../ui/theme';
import { useRoom } from '../ui/useRoom';
import { useRate } from './useRate';

const STEPS: PlayerStep[] = ['listen', 'say', 'check'];
type NoteKind = keyof Phrase['notes'];
const NOTE_KINDS: NoteKind[] = ['mnemonic', 'grammar', 'pronunciation'];
/** The page: at most this wide. */
const MAX_WIDTH = 512;
/** The picture behind the page: this share of the screen, fading into the night. */
const BACKDROP = 0.6;
/** How long a closing sheet takes to go, before another may open (a modal can't open while one closes on iOS). */
const SHEET_GONE_MS = 350;

/** The controls' sizes: the design's on a full screen, a little smaller on a compact one. */
function sizes(compact: boolean) {
  return compact
    ? { play: 88, vote: 68, round: 60, tool: 56, grade: 96, show: 80, phrase: 32, phraseLine: 40 }
    : { play: 112, vote: 80, round: 72, tool: 64, grade: 120, show: 96, phrase: 40, phraseLine: 48 };
}
type Sizes = ReturnType<typeof sizes>;

export function NowPlayingScreen() {
  const c = useCopy();
  const router = useRouter();
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const room = useRoom();
  const { state, actions } = useStore();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shownAnyway, setShownAnyway] = useState<string | null>(null);
  /** The phrase (by its place in the queue) whose hint is showing. */
  const [hintFor, setHintFor] = useState<string | null>(null);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const phrase = findPhrase(state.learner, currentPhraseId(state.player));
  // A recording the server is making for this step (P3-01): said, with a spinner and no number.
  const making = useClipMaking(state.player.cycle, phrase?.id ?? null);
  // Nothing queued (the course changed, or the page was opened directly): only the way out.
  if (!phrase)
    return (
      <PullDownWindow onClose={close} style={[styles.screen, { paddingTop: insets.top }]}>
        <StatusBar style="light" />
        <PullHandle>
          <View style={styles.header}>
            <HeaderButton label={c.player.close} icon="keyboard_arrow_down" onPress={close} />
          </View>
        </PullHandle>
      </PullDownWindow>
    );
  const { status, phase, index, order, audioError, cycle } = state.player;
  const playing = status === 'playing';
  const ask = state.prefs.askEasyOrHard;
  const size = sizes(room.compact);
  const cannotSay = (audioError?.reason === 'no-clip' || audioError?.reason === 'unmade') && audioError.lang === phrase.targetLang;
  const revealed = isTargetRevealed(state.player) || (cannotSay && shownAnyway === phrase.id);
  const step = playerStep(phase);
  const prompt = promptOf(phrase, state.learner.profile.nativeLang);
  const targetName = languageName(phrase.targetLang, c.locale);
  const queueSet = findSetView(state.learner, state.player.setId);
  const coverSet = findSetView(state.learner, phrase.setId) ?? queueSet;
  const tone = (coverSet?.topicId && getTopic(coverSet.topicId)?.tone) || 'secondary';
  const endedOnce = state.player.ended && playsOnce(state.player);
  const hintKey = `${index}:${phrase.id}`;
  const hinted = hintFor === hintKey && step !== 'check' && !revealed;

  /** Moves the loop on by `steps` of its phases, as if each had ended; a paused loop plays on from there. */
  const skip = (steps: number) => {
    if (state.player.ended) return actions.play();
    let at = cycle;
    // Playing again starts a new cycle of the same phase (the machine's PLAY).
    if (!playing) {
      actions.play();
      at += 1;
    }
    // Unconfirmed: a step cut short is never measured, and a target cut short isn't heard.
    for (let i = 0; i < steps; i++) actions.phaseDone(at + i, { unconfirmed: true });
  };
  const toggle = playing ? actions.pause : actions.play;

  return (
    <ToastOffsetContext.Provider value={16}>
      <PullDownWindow onClose={close} style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <StatusBar style="light" />
        <Backdrop phrase={phrase} tone={tone} width={room.width} height={Math.round(room.height * BACKDROP)} />
        <View style={styles.page}>
          <PullHandle>
            <View style={styles.header}>
              <HeaderButton label={c.player.close} icon="keyboard_arrow_down" onPress={close} />
              <View style={styles.headerText}>
                <Txt weight={600} color="inverseOnSurface" align="center" numberOfLines={1} accessibilityRole="header" lang={queueSet?.targetLang} style={styles.title}>
                  {queueTitle(c, state.player, queueSet)}
                </Txt>
                <Txt variant="label" color="inverseOnSurface" align="center" numberOfLines={1}>
                  {queueSet && order.some((id) => !queueSet.phraseIds.includes(id)) ? c.player.positionInQueue(index + 1, order.length) : c.player.position(index + 1, order.length)}
                </Txt>
              </View>
              <Press accessibilityRole="button" onPress={() => setSettingsOpen(true)} style={({ pressed }) => [styles.pill, pressed && styles.glassPressed]}>
                <Txt weight={600} color="inverseOnSurface" numberOfLines={1} style={styles.title}>
                  {c.player.round.settings}
                </Txt>
              </Press>
            </View>
          </PullHandle>

          {!endedOnce && (
            <StepTrack
              step={step}
              // What the instruction line said: nothing over an error (it says it), the recording being made, the step, or Paused.
              label={
                audioError
                  ? null
                  : making && playing
                    ? c.player.makingAudio(languageName(making.lang, c.locale))
                    : playing
                      ? phaseInstruction(c, phase, prompt.lang, phrase.targetLang)
                      : c.player.paused
              }
            />
          )}

          <ScrollView style={styles.stage} contentContainerStyle={[styles.stageContent, room.compact && styles.compactSides]}>
            {!endedOnce && <PassCard />}
            <View style={styles.spring} />
            {!endedOnce && <RatedToast ask={ask} />}
            {audioError ? (
              <View style={styles.alert} accessibilityRole="alert">
                <View style={styles.row}>
                  <Icon name="volume_off" size="md" color="errorContainer" />
                  <Txt color="inverseOnSurface" style={styles.flex}>
                    {audioError.reason === 'no-clip'
                      ? c.player.audioError(languageName(audioError.lang, c.locale))
                      : audioError.reason === 'unmade'
                        ? c.player.audioUnmade(languageName(audioError.lang, c.locale))
                        : c.player.audioSilent}
                  </Txt>
                </View>
                {cannotSay && !revealed && <GlassButton label={c.player.showText(targetName)} onPress={() => setShownAnyway(phrase.id)} />}
              </View>
            ) : (
              making &&
              playing && (
                <View style={styles.row} accessibilityLiveRegion="polite">
                  <ActivityIndicator color={colors.primaryFixedDim} />
                  <Txt color="inverseOnSurface" style={styles.flex}>
                    {c.player.makingAudio(languageName(making.lang, c.locale))}
                  </Txt>
                </View>
              )
            )}
            {step === 'listen' && !endedOnce && <RepeatChip />}
            {revealed ? (
              <>
                <Txt face="serif" italic weight={500} color="inverseOnSurface" lang={phrase.targetLang} style={{ fontSize: size.phrase - 4, lineHeight: size.phraseLine - 4 }}>
                  {phrase.target}
                </Txt>
                <Txt weight={500} color="inverseOnSurface" lang={prompt.lang} style={styles.sub}>
                  {prompt.text}
                </Txt>
              </>
            ) : hinted ? (
              <>
                <Txt weight={600} color="inverseOnSurface" lang={step === 'listen' ? prompt.lang : undefined} style={styles.hintTitle}>
                  {step === 'listen' ? prompt.text : c.player.round.sayIt(targetName)}
                </Txt>
                <HintCard phrase={phrase} tone={tone} />
                <HintNotes phrase={phrase} />
              </>
            ) : step === 'listen' ? (
              <Txt weight={600} color="inverseOnSurface" lang={prompt.lang} style={{ fontSize: size.phrase, lineHeight: size.phraseLine }}>
                {prompt.text}
              </Txt>
            ) : (
              <>
                <Txt weight={600} color="inverseOnSurface" style={{ fontSize: size.phrase, lineHeight: size.phraseLine }}>
                  {c.player.round.sayIt(targetName)}
                </Txt>
                <Countdown />
                <Coach />
              </>
            )}
          </ScrollView>

          <View style={[styles.footer, room.compact && styles.compactSides]}>
            {endedOnce ? (
              <EndPanel onClose={close} />
            ) : hinted ? (
              <>
                <Press accessibilityRole="button" onPress={() => skip(step === 'listen' ? 2 : 1)} style={({ pressed }) => [styles.showAnswer, { height: size.show }, pressed && styles.accentPressed]}>
                  <Icon name="visibility" size={36} color="onPrimaryFixed" />
                  <Txt weight={700} color="onPrimaryFixed" numberOfLines={1} adjustsFontSizeToFit style={styles.big}>
                    {c.player.round.showAnswer}
                  </Txt>
                </Press>
                <Tool
                  icon="hearing"
                  label={c.player.round.backToListening}
                  height={size.tool}
                  onPress={() => {
                    // From the prompt again, playing.
                    setHintFor(null);
                    actions.restart();
                    actions.play();
                  }}
                />
              </>
            ) : step === 'check' ? (
              <CheckControls size={size} ask={ask} phrase={phrase} onToggle={toggle} />
            ) : (
              <>
                <View style={styles.playRow}>
                  <Vote grade={ask ? 'hard' : 'missed'} label={ask ? c.common.grade.hard : c.player.round.again} size={size} phrase={phrase} />
                  <Press
                    accessibilityRole="button"
                    accessibilityLabel={playing ? c.common.pause : c.common.play}
                    onPress={toggle}
                    style={({ pressed }) => [styles.glass, styles.circle, { width: size.play, height: size.play }, pressed && styles.glassPressed]}
                  >
                    <Icon name={playing ? 'pause' : 'play_arrow'} fill size={Math.round(size.play * 0.46)} color="inverseOnSurface" />
                  </Press>
                  <Vote grade="easy" label={ask ? c.common.grade.easy : c.player.round.gotIt} size={size} phrase={phrase} />
                </View>
                <View style={styles.tools}>
                  <Tool icon="replay" label={c.player.round.replay} height={size.tool} onPress={actions.restart} />
                  <Tool
                    icon="lightbulb"
                    accent
                    label={c.player.round.hint}
                    height={size.tool}
                    onPress={() => {
                      // The loop waits while the hint and its notes are read.
                      if (playing) actions.pause();
                      setHintFor(hintKey);
                    }}
                  />
                  <Tool icon="skip_next" fill label={c.player.round.nextStep} height={size.tool} onPress={() => skip(1)} />
                </View>
              </>
            )}
          </View>
        </View>

        <PlayerSettings
          open={settingsOpen}
          phrase={phrase}
          onClose={() => setSettingsOpen(false)}
          onAddToSet={() => {
            setSettingsOpen(false);
            setTimeout(() => nav.addToSet([phrase.id]), SHEET_GONE_MS);
          }}
          onQueue={() => {
            setSettingsOpen(false);
            router.push('/queue');
          }}
        />
      </PullDownWindow>
    </ToastOffsetContext.Provider>
  );
}

/** The phrase's picture behind the header and the steps, dimmed, and fading into the night below them. */
function Backdrop({ phrase, tone, width, height }: { phrase: Phrase; tone: TopicTone; width: number; height: number }) {
  return (
    <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={[styles.backdrop, { height }]}>
      <View style={styles.dim}>
        <PhraseImage icons={phrase.image} tone={tone} width={width} height={height} rounded={0} phrase={phrase} />
      </View>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 1 1" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="player-veil" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.night} stopOpacity={0.6} />
            <Stop offset="0.28" stopColor={colors.night} stopOpacity={0.1} />
            <Stop offset="0.45" stopColor={colors.night} stopOpacity={0.15} />
            <Stop offset="0.8" stopColor={colors.night} stopOpacity={0.85} />
            <Stop offset="1" stopColor={colors.night} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="1" height="1" fill="url(#player-veil)" />
      </Svg>
    </View>
  );
}

function HeaderButton({ label, icon, onPress }: { label: string; icon: IconName; onPress: () => void }) {
  return (
    <Press accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.headerButton, pressed && styles.glassPressed]}>
      <Icon name={icon} size={28} color="inverseOnSurface" />
    </Press>
  );
}

/**
 * The three steps, each its name over a bar: done ones ticked in green, the current one in the
 * accent. The learner's turn fills over its real length. The current step reads as what to do now.
 */
function StepTrack({ step, label }: { step: PlayerStep; label: string | null }) {
  const c = useCopy();
  const { state } = useStore();
  const at = STEPS.indexOf(step);
  const filling = step === 'say' && state.player.status === 'playing';
  return (
    <View accessibilityLabel={c.player.steps} style={styles.steps}>
      {STEPS.map((s, i) => {
        const current = i === at;
        const done = i < at;
        const name = c.player.round.steps[s];
        return (
          <View key={s} accessible accessibilityLabel={current && label !== null ? label : name} accessibilityState={{ selected: current }} style={styles.step}>
            <View style={styles.row}>
              {done && <Icon name="check" size={18} color="tertiaryFixed" />}
              <Txt weight={current ? 700 : 600} color={done ? 'tertiaryFixed' : 'inverseOnSurface'} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.stepName}>
                {done ? name : `${i + 1} ${name}`}
              </Txt>
            </View>
            <View style={[styles.bar, { backgroundColor: done ? colors.tertiaryFixed : current && !filling ? colors.primaryFixedDim : colors.nightTrack }]}>
              {current && filling && <PhaseFill style={{ backgroundColor: colors.primaryFixedDim, height: '100%' }} />}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** How many times the phrase plays, and which play this is; it steps the setting on (Auto, 1 to 5). */
function RepeatChip() {
  const c = useCopy();
  const { state, actions } = useStore();
  const { toast } = useToast();
  const { repetition, repeats } = state.player;
  const setting = state.prefs.repeats;
  const next = REPEAT_SETTINGS[(REPEAT_SETTINGS.indexOf(setting) + 1) % REPEAT_SETTINGS.length];
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={repeatsLabel(c, setting)}
      accessibilityValue={{ text: c.player.repetition(repetition, repeats) }}
      haptic="select"
      onPress={() => {
        actions.setPrefs({ repeats: next });
        toast(next === 'auto' ? c.player.repeatsToast.auto : next === 1 ? c.player.repeatsToast.one : c.player.repeatsToast.times(next));
      }}
      style={({ pressed }) => [styles.chip, pressed && styles.glassPressed]}
    >
      <Icon name="repeat" size={18} color="primaryFixedDim" />
      <Txt weight={600} color="inverseOnSurface" numberOfLines={1} style={styles.chipText}>
        {repeats === 1 ? c.player.round.playsOnce : c.player.round.playOf(repetition, repeats)}
      </Txt>
      {repeats > 1 && (
        <View style={styles.dots}>
          {Array.from({ length: repeats }, (_, j) => (
            <View key={j} style={[styles.dot, { backgroundColor: j < repetition ? colors.primaryFixedDim : colors.nightTrack }]} />
          ))}
        </View>
      )}
    </Press>
  );
}

function repeatsLabel(c: ReturnType<typeof useCopy>, setting: RepeatsSetting): string {
  return setting === 'auto' ? c.player.repeats.auto : setting === 1 ? c.player.repeats.one : c.player.repeats.times(setting);
}

/** The learner's turn: how long until the answer plays, from the length the machine fixed for it. */
function Countdown() {
  const c = useCopy();
  const { state } = useStore();
  const now = useNow(250);
  const { status, phaseStartedAt, phaseMs, audioError } = state.player;
  if (audioError) return null;
  if (status !== 'playing') {
    return (
      <Txt weight={500} color="inverseOnSurface" style={styles.sub}>
        {c.player.paused}
      </Txt>
    );
  }
  if (phaseStartedAt === null || phaseMs === null) return null;
  const left = Math.max(1, Math.ceil((phaseStartedAt + phaseMs - now) / 1000));
  return (
    <Txt weight={500} color="inverseOnSurface" style={styles.sub}>
      {c.player.round.answerIn(left)}
    </Txt>
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
  if (state.player.status !== 'playing' || !coaches(state.learner, now)) return null;
  return <Txt color="outlineVariant">{c.player.coach}</Txt>;
}

/** The hint: the phrase's picture, and how the phrase starts. */
function HintCard({ phrase, tone }: { phrase: Phrase; tone: TopicTone }) {
  const c = useCopy();
  return (
    <View style={[styles.glassStrong, styles.hint]}>
      <PhraseImage icons={phrase.image} tone={tone} width={96} height={96} rounded={16} phrase={phrase} redraw />
      <View style={styles.hintText}>
        <Txt weight={500} color="inverseOnSurface">
          {c.player.round.hintStart}
        </Txt>
        <Txt face="serif" italic weight={500} color="inverseOnSurface" lang={phrase.targetLang} style={styles.hintPhrase}>
          {hintOf(phrase.target)}
        </Txt>
      </View>
    </View>
  );
}

/**
 * Under the hint, the phrase's notes as three tabs: its mnemonic, its rule and its sounds, in the
 * learner's language where there is a version in it. The notes sheet (Settings) has the rest.
 */
function HintNotes({ phrase }: { phrase: Phrase }) {
  const c = useCopy();
  const { state } = useStore();
  const [tab, setTab] = useState<NoteKind>('mnemonic');
  const native = state.learner.profile.nativeLang;
  const translated = native.startsWith('en-') ? undefined : phrase.noteTranslations[tab]?.[native];
  const note = translated ?? phrase.notes[tab];
  return (
    <View style={[styles.glassStrong, styles.notesCard]}>
      <View accessibilityRole="tablist" accessibilityLabel={c.phrase.notesTitle} style={styles.noteTabs}>
        {NOTE_KINDS.map((k) => {
          const on = k === tab;
          return (
            <Press
              key={k}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              haptic="select"
              onPress={() => setTab(k)}
              style={[styles.noteTab, on && styles.accent]}
            >
              <Txt variant="label" weight={700} color={on ? 'onPrimaryFixed' : 'inverseOnSurface'} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                {c.phrase.notes[k]}
              </Txt>
            </Press>
          );
        })}
      </View>
      <Txt weight={700} color="inverseOnSurface" lang={translated ? native : 'en'}>
        {note.title}
      </Txt>
      <Txt color="outlineVariant" lang={translated ? native : 'en'}>
        {note.text}
      </Txt>
    </View>
  );
}

/** The current phrase's rating while it can still be changed, and a tap on it again takes it back. */
function useVote(phraseId: string): { chosen: Grade | null; vote: (grade: Grade) => void } {
  const { state, actions } = useStore();
  const now = useNow(1000);
  const rate = useRate();
  const pending = pendingFor(state, phraseId);
  const open = pending ? Math.min(RATING_WINDOW_MS, windowLeft(pending, Math.max(now, pending.at))) > 0 : false;
  const chosen = pending && open ? pending.grade : null;
  return { chosen, vote: (grade) => (grade === chosen ? actions.unrate() : rate(grade)) };
}

/** A grade beside the play button (Hard / Easy, or Again / Got it): given at once, and shown as given. */
function Vote({ grade, label, size, phrase }: { grade: Grade; label: string; size: Sizes; phrase: Phrase }) {
  const { chosen, vote } = useVote(phrase.id);
  const on = chosen === grade;
  return (
    <Press
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      aria-checked={on}
      haptic="none"
      onPress={() => vote(grade)}
      style={({ pressed }) => [styles.glass, styles.circle, { width: size.vote, height: size.vote }, on && styles.accent, pressed && (on ? styles.accentPressed : styles.glassPressed)]}
    >
      <Txt weight={700} color={on ? 'onPrimaryFixed' : 'inverseOnSurface'} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.voteText}>
        {label}
      </Txt>
    </Press>
  );
}

/** Check: replay, play or pause, the next phrase; the hold's timer; the grades. */
function CheckControls({ size, ask, phrase, onToggle }: { size: Sizes; ask: boolean; phrase: Phrase; onToggle: () => void }) {
  const c = useCopy();
  const { state, actions } = useStore();
  const { chosen, vote } = useVote(phrase.id);
  const playing = state.player.status === 'playing';
  const hold = state.player.phase === 'rate' && playing;
  const grades: { grade: Grade; label: string; accent: boolean }[] = ask
    ? [
        { grade: 'hard', label: c.common.grade.hard, accent: false },
        { grade: 'easy', label: c.common.grade.easy, accent: true },
      ]
    : [
        { grade: 'missed', label: c.player.round.again, accent: false },
        { grade: 'easy', label: c.player.round.gotIt, accent: true },
      ];
  return (
    <>
      <View style={styles.playRow}>
        <Round icon="replay" label={c.player.round.replay} size={size.round} onPress={actions.restart} />
        <Round icon={playing ? 'pause' : 'play_arrow'} fill label={playing ? c.common.pause : c.common.play} size={size.round} onPress={onToggle} />
        <Round icon="skip_next" fill label={c.player.next} size={size.round} onPress={actions.next} />
      </View>
      <View style={styles.holdTrack}>{hold && <PhaseFill deplete style={{ backgroundColor: colors.primaryFixedDim, height: 4, borderRadius: radius.full }} />}</View>
      <View accessibilityRole="radiogroup" accessibilityLabel={c.player.howDidItGo} style={styles.grades}>
        {grades.map(({ grade, label, accent }) => {
          const on = chosen === grade;
          return (
            <Press
              key={grade}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              aria-checked={on}
              haptic="none"
              onPress={() => vote(grade)}
              style={({ pressed }) => [
                styles.grade,
                { height: size.grade },
                accent ? styles.accent : styles.glass,
                on && styles.chosen,
                pressed && (accent ? styles.accentPressed : styles.glassPressed),
              ]}
            >
              {on && <Icon name="check" size={30} color={accent ? 'onPrimaryFixed' : 'inverseOnSurface'} />}
              <Txt weight={700} color={accent ? 'onPrimaryFixed' : 'inverseOnSurface'} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.big}>
                {label}
              </Txt>
            </Press>
          );
        })}
      </View>
    </>
  );
}

/**
 * The latest rating, for a few seconds: what it was, when the phrase comes back (the core's own
 * schedule, or the end of this queue), and Undo.
 */
function RatedToast({ ask }: { ask: boolean }) {
  const c = useCopy();
  const { state, actions } = useStore();
  const now = useNow(1000);
  const recent = recentLoopRating(state.pending, now);
  if (!recent) return null;
  const what = !ask && recent.grade === 'easy' ? c.player.round.gotIt : !ask && recent.grade === 'missed' ? c.player.round.again : c.player.round.marked[recent.grade];
  const back = upNextIds(state.player).includes(recent.phraseId)
    ? c.player.backLater
    : c.player.round.back(formatWhen(previewDue(state.learner, recent.phraseId, recent.grade, recent.at, recent.day), now, c.locale));
  return (
    <View style={[styles.glassStrong, styles.toast]}>
      <View style={styles.toastMark}>
        <Icon name="check" size={22} color="onTertiaryFixed" />
      </View>
      <Txt weight={500} color="inverseOnSurface" accessibilityLiveRegion="polite" style={[styles.flex, styles.toastText]}>
        {c.player.round.toast(what, back)}
      </Txt>
      <Press
        accessibilityRole="button"
        accessibilityLabel={c.player.undoGrade(c.common.grade[recent.grade])}
        onPress={() => actions.unrate(recent.phraseId)}
        style={({ pressed }) => [styles.undo, pressed && styles.washPressed]}
      >
        <Txt weight={700} color="primaryFixedDim" style={styles.title}>
          {c.common.undo}
        </Txt>
      </Press>
    </View>
  );
}

function Tool({ icon, label, onPress, height, accent = false, fill = false }: { icon: IconName; label: string; onPress: () => void; height: number; accent?: boolean; fill?: boolean }) {
  return (
    <Press accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.tool, { height }, pressed && styles.washPressed]}>
      <Icon name={icon} fill={fill} size={26} color={accent ? 'primaryFixedDim' : 'inverseOnSurface'} />
      <Txt variant="body" weight={600} color="inverseOnSurface" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
        {label}
      </Txt>
    </Press>
  );
}

function Round({ icon, label, onPress, size, fill = false }: { icon: IconName; label: string; onPress: () => void; size: number; fill?: boolean }) {
  return (
    <Press accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.glass, styles.circle, { width: size, height: size }, pressed && styles.glassPressed]}>
      <Icon name={icon} fill={fill} size={Math.round(size * 0.42)} color="inverseOnSurface" />
    </Press>
  );
}

function GlassButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Press accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.glass, styles.glassButton, pressed && styles.glassPressed]}>
      <Txt weight={600} color="primaryFixedDim">
        {label}
      </Txt>
    </Press>
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
    <View style={[styles.glassStrong, styles.end]} accessibilityLiveRegion="polite">
      <Txt variant="heading" face="serif" weight={600} align="center" color="inverseOnSurface" accessibilityRole="header">
        {endTitle(c, source, rated)}
      </Txt>
      <Txt color="outlineVariant" align="center">
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
      <GlassButton label={demo ? c.player.end.notNow : c.common.close} onPress={onClose} />
    </View>
  );
}

/**
 * The player's settings, in a night sheet: whether to ask easy or hard, how many plays, speed, what
 * happens at the end; and the phrase's own actions (like, add to a set, notes, the queue). Notes open
 * in the same sheet, so one sheet never waits on another.
 */
function PlayerSettings({ open, phrase, onClose, onAddToSet, onQueue }: { open: boolean; phrase: Phrase; onClose: () => void; onAddToSet: () => void; onQueue: () => void }) {
  const c = useCopy();
  const { state, actions } = useStore();
  const { toast } = useToast();
  const [notes, setNotes] = useState(false);
  const wasOpen = useRef(open);
  // Each opening starts on the settings.
  useEffect(() => {
    if (open && !wasOpen.current) setNotes(false);
    wasOpen.current = open;
  }, [open]);
  const prefs = state.prefs;
  const liked = isLiked(state.learner, 'phrase', phrase.id);
  return (
    <Sheet night open={open} title={notes ? c.phrase.notesTitle : c.player.round.settings} onClose={onClose}>
      {notes ? (
        <View style={styles.notes}>
          <PhraseNotesView phrase={phrase} />
        </View>
      ) : (
        <View style={styles.settings}>
          <Press accessibilityRole="switch" accessibilityState={{ checked: prefs.askEasyOrHard }} haptic="none" onPress={() => actions.setPrefs({ askEasyOrHard: !prefs.askEasyOrHard })} style={styles.setting}>
            <View style={styles.flex}>
              <Txt variant="field" weight={600} color="inverseOnSurface">
                {c.player.round.ask}
              </Txt>
              <Txt color="outlineVariant">{c.player.round.askOff}</Txt>
            </View>
            <Toggle
              accessible={false}
              importantForAccessibility="no"
              value={prefs.askEasyOrHard}
              onValueChange={(on) => actions.setPrefs({ askEasyOrHard: on })}
              trackColor={{ false: colors.nightTrack, true: colors.primaryFixedDim }}
              thumbColor={prefs.askEasyOrHard ? colors.onPrimaryFixed : colors.outline}
              ios_backgroundColor={colors.nightTrack}
              // react-native-web colours an on switch's thumb by this, not thumbColor.
              {...({ activeThumbColor: colors.onPrimaryFixed } as object)}
            />
          </Press>
          <Choice
            title={c.player.round.playEach}
            options={REPEAT_SETTINGS.map((r) => ({
              key: String(r),
              label: r === 'auto' ? c.player.round.auto : `${r}×`,
              accessibilityLabel: repeatsLabel(c, r),
              selected: prefs.repeats === r,
              onPress: () => actions.setPrefs({ repeats: r }),
            }))}
          />
          <Choice
            title={c.player.round.speed}
            options={SPEEDS.map((s) => ({ key: String(s), label: `${s}×`, accessibilityLabel: c.player.speedIs(s), selected: prefs.speed === s, onPress: () => actions.setPrefs({ speed: s }) }))}
          />
          <Choice
            title={c.player.round.atTheEnd}
            options={(['repeat', 'continue'] as const).map((m) => ({
              key: m,
              label: m === 'repeat' ? c.player.round.playAgain : c.player.round.goOn,
              accessibilityLabel: c.player.playMode[m],
              selected: prefs.playMode === m,
              onPress: () => {
                actions.setPrefs({ playMode: m });
                toast(c.player.playModeToast[m]);
              },
            }))}
          />
          <View style={styles.section}>
            <Txt variant="field" weight={600} color="inverseOnSurface" accessibilityRole="header">
              {c.player.round.thisPhrase}
            </Txt>
            <View style={styles.actions}>
              <Action icon="favorite" fill={liked} label={c.player.round.like} accessibilityLabel={c.phrase.likeLabel} checked={liked} onPress={() => actions.toggleLike('phrase', phrase.id)} />
              <Action icon="playlist_add" label={c.player.round.addTo} accessibilityLabel={c.phrase.addToSet} onPress={onAddToSet} />
              <Action icon="edit_note" label={c.player.round.notes} accessibilityLabel={c.phrase.notesTitle} onPress={() => setNotes(true)} />
              <Action icon="queue_music" label={c.player.round.upNext} accessibilityLabel={c.player.openQueue} onPress={onQueue} />
            </View>
          </View>
        </View>
      )}
    </Sheet>
  );
}

function Choice({ title, options }: { title: string; options: { key: string; label: string; accessibilityLabel: string; selected: boolean; onPress: () => void }[] }) {
  return (
    <View style={styles.section}>
      <Txt variant="field" weight={600} color="inverseOnSurface" accessibilityRole="header">
        {title}
      </Txt>
      <View accessibilityRole="radiogroup" accessibilityLabel={title} style={styles.segments}>
        {options.map((o) => (
          <Press
            key={o.key}
            accessibilityRole="radio"
            accessibilityLabel={o.accessibilityLabel}
            accessibilityState={{ checked: o.selected }}
            aria-checked={o.selected}
            haptic="select"
            onPress={o.onPress}
            style={[styles.segment, o.selected && styles.accent]}
          >
            <Txt variant="field" weight={700} color={o.selected ? 'onPrimaryFixed' : 'inverseOnSurface'} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {o.label}
            </Txt>
          </Press>
        ))}
      </View>
    </View>
  );
}

function Action({
  icon,
  label,
  accessibilityLabel,
  onPress,
  fill = false,
  checked,
}: {
  icon: IconName;
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  fill?: boolean;
  checked?: boolean;
}) {
  return (
    <Press
      accessibilityRole={checked === undefined ? 'button' : 'togglebutton'}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={checked === undefined ? undefined : { checked }}
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && styles.washPressed]}
    >
      <Icon name={icon} fill={fill} size={26} color={fill ? 'primaryFixedDim' : 'inverseOnSurface'} />
      <Txt variant="label" weight={600} color="inverseOnSurface" align="center" numberOfLines={2}>
        {label}
      </Txt>
    </Press>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.night },
  page: { flex: 1, width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' },
  dim: { opacity: 0.55 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 10, paddingBottom: 6, paddingHorizontal: 12, width: '100%' },
  headerText: { flex: 1, minWidth: 0, alignItems: 'center' },
  headerButton: { width: 48, height: 48, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, lineHeight: 20 },
  pill: { height: 48, paddingHorizontal: 18, borderRadius: radius.full, justifyContent: 'center', backgroundColor: colors.nightGlass, borderWidth: 1, borderColor: colors.nightLine, flexShrink: 0 },
  steps: { flexDirection: 'row', gap: 6, paddingTop: 14, paddingHorizontal: 16 },
  step: { flex: 1, minWidth: 0, gap: 8 },
  stepName: { fontSize: 16, lineHeight: 22, flexShrink: 1 },
  bar: { height: 6, borderRadius: radius.full, overflow: 'hidden' },
  stage: { flex: 1 },
  stageContent: { flexGrow: 1, gap: 12, paddingTop: 20, paddingBottom: 16, paddingHorizontal: 24 },
  compactSides: { paddingHorizontal: 12 },
  spring: { flexGrow: 1 },
  sub: { fontSize: 19, lineHeight: 27 },
  hintTitle: { fontSize: 30, lineHeight: 38 },
  chip: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: TARGET, paddingLeft: 10, paddingRight: 12, borderRadius: radius.full, backgroundColor: colors.nightGlass },
  chipText: { fontSize: 14, lineHeight: 18, flexShrink: 1 },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { width: 7, height: 7, borderRadius: radius.full },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderRadius: radius['3xl'] },
  hintText: { flex: 1, minWidth: 0, gap: 4 },
  hintPhrase: { fontSize: 28, lineHeight: 36 },
  toast: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingLeft: 12, paddingRight: 10, borderRadius: radius['3xl'] },
  toastMark: { width: 36, height: 36, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.tertiaryFixed },
  toastText: { fontSize: 15, lineHeight: 21 },
  undo: { minHeight: TARGET, paddingHorizontal: 14, borderRadius: radius.full, justifyContent: 'center', flexShrink: 0 },
  alert: { gap: 8, padding: 12, borderRadius: radius.xl, backgroundColor: 'rgba(186,26,26,0.28)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flex: { flex: 1, minWidth: 0 },
  footer: { gap: 10, paddingHorizontal: 16, paddingBottom: 24 },
  playRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, paddingVertical: 4 },
  glass: { backgroundColor: colors.nightGlass, borderWidth: 1, borderColor: colors.nightLine },
  glassStrong: { backgroundColor: colors.nightGlassStrong, borderWidth: 1, borderColor: colors.nightLine },
  glassPressed: { backgroundColor: colors.nightGlassPressed },
  washPressed: { backgroundColor: colors.nightWash },
  accent: { backgroundColor: colors.primaryFixedDim, borderColor: colors.primaryFixedDim },
  accentPressed: { backgroundColor: colors.primaryFixed },
  chosen: { borderWidth: 3, borderColor: colors.inverseOnSurface },
  circle: { borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  voteText: { fontSize: 17, paddingHorizontal: 6 },
  tools: { flexDirection: 'row', gap: 6 },
  tool: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 4 },
  showAnswer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, borderRadius: 32, paddingHorizontal: 16, backgroundColor: colors.primaryFixedDim },
  big: { fontSize: 26, lineHeight: 32, flexShrink: 1 },
  holdTrack: { height: 4, marginHorizontal: 16, borderRadius: radius.full, overflow: 'hidden' },
  grades: { flexDirection: 'row', gap: 10 },
  grade: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 32, paddingHorizontal: 12 },
  glassButton: { alignSelf: 'center', minHeight: TARGET, paddingHorizontal: 18, borderRadius: radius.full, justifyContent: 'center' },
  end: { borderRadius: radius['3xl'], padding: 16, gap: 8, alignItems: 'center' },
  endButton: { alignSelf: 'stretch', borderRadius: radius['3xl'] },
  settings: { gap: 18, paddingBottom: 8 },
  setting: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 20, backgroundColor: colors.nightGlassStrong },
  section: { gap: 10 },
  segments: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: radius.full, backgroundColor: colors.nightGlassStrong },
  segment: { flex: 1, minWidth: 0, height: 48, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  actions: { flexDirection: 'row', gap: 6 },
  action: { flex: 1, minWidth: 0, minHeight: 72, alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 4, backgroundColor: colors.nightGlassStrong },
  notesCard: { gap: 8, padding: 12, borderRadius: radius['3xl'] },
  noteTabs: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: radius.full, backgroundColor: colors.nightGlass },
  noteTab: { flex: 1, minWidth: 0, minHeight: 36, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  notes: { borderRadius: radius['3xl'], padding: 12, backgroundColor: colors.surface },
});
