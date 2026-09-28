import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { languageLabel } from '@shared/copy';
import { findPhrase, findSetView, promptOf } from '@shared/state/catalog';
import { playsOnce } from '@shared/state/machine';
import { currentPhraseId, sessionSummary } from '@shared/state/selectors';
import { endTitle, isTargetRevealed, PHASE_ICONS, phaseInstruction } from '@shared/ui/phase';
import { useCopy, useNow, useStore } from '../state/store';
import { Icon } from './Icon';
import { PhaseFill } from './PhaseFill';
import { SetCover } from './SetCover';
import { Txt } from './Txt';
import { colors, radius, shadow, TARGET } from './theme';

const SWIPE_DISTANCE = 60;
const SWIPE_VELOCITY = 400;
const STEPS_PER_REPETITION = 3;

/** The docked player (the web's src/ui/MiniPlayer.tsx): tap to open, swipe for next or previous. */
export function MiniPlayer({ onOpenPlayer }: { onOpenPlayer: () => void }) {
  const c = useCopy();
  const { state, actions } = useStore();
  const now = useNow(60_000);
  const x = useSharedValue(0);
  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      x.value = e.translationX * 0.4;
    })
    .onEnd((e) => {
      if (e.translationX < -SWIPE_DISTANCE || e.velocityX < -SWIPE_VELOCITY) runOnJS(actions.next)();
      else if (e.translationX > SWIPE_DISTANCE || e.velocityX > SWIPE_VELOCITY) runOnJS(actions.prev)();
      x.value = withSpring(0);
    });
  const moved = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  const phrase = findPhrase(state.learner, currentPhraseId(state.player));
  if (!phrase) return null;
  const { phase, repetition, repeats, audioError } = state.player;
  const playing = state.player.status === 'playing';
  const stepIndex = phase === 'rate' ? STEPS_PER_REPETITION : ['native', 'pause', 'target'].indexOf(phase);
  const step = (repetition - 1) * STEPS_PER_REPETITION + stepIndex;
  const progress = playing || step > 0 ? Math.min(1, step / (repeats * STEPS_PER_REPETITION)) : 0;
  const prompt = promptOf(phrase, state.learner.profile.nativeLang);
  const revealed = isTargetRevealed(state.player);
  const title = revealed ? phrase.target : prompt.text;
  const set = findSetView(state.learner, phrase.setId) ?? findSetView(state.learner, state.player.setId);
  const timed = playing && (phase === 'pause' || phase === 'rate') && state.player.phaseMs !== null;
  const ended = state.player.ended && playsOnce(state.player);
  const summary = ended ? sessionSummary(state, now) : null;
  const status = audioError
    ? audioError.reason === 'no-voice'
      ? c.player.noVoice
      : c.player.silent
    : ended
      ? endTitle(c, state.player.source, summary ? summary.ratings.missed + summary.ratings.hard + summary.ratings.easy : 0)
      : !playing
        ? c.player.paused
        : phase === 'rate'
          ? c.player.miniRate
          : phaseInstruction(c, phase, prompt.lang, phrase.targetLang);

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.player, moved]}>
        <View style={styles.row}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${c.player.dialog}: ${title}`}
            accessibilityHint={`${status}. ${languageLabel(phrase.targetLang, c.locale)}`}
            onPress={onOpenPlayer}
            style={styles.open}
          >
            <View>
              <SetCover set={set ?? { topicId: null, coverIcon: 'edit_note' }} px={44} rounded={8} />
              {playing && !audioError && (
                <View style={styles.badge}>
                  <Icon name={phase === 'rate' ? 'task_alt' : PHASE_ICONS[phase]} size={14} color="onPrimaryFixed" />
                </View>
              )}
            </View>
            <View style={styles.text}>
              <Txt variant="row" face={revealed ? 'serif' : 'sans'} italic={revealed} weight={500} color="inverseOnSurface" numberOfLines={1} lang={revealed ? phrase.targetLang : prompt.lang}>
                {title}
              </Txt>
              <Txt variant="label" color="secondaryFixedDim" numberOfLines={1}>
                {status}
              </Txt>
            </View>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={playing ? c.common.pause : c.common.play}
            onPress={playing ? actions.pause : actions.play}
            style={({ pressed }) => [styles.play, pressed && { opacity: 0.8 }]}
          >
            <Icon name={playing ? 'pause' : 'play_arrow'} fill size="lg" color="onPrimaryFixed" />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={c.player.next} onPress={actions.next} style={({ pressed }) => [styles.next, pressed && { opacity: 0.7 }]}>
            <Icon name="skip_next" fill size="lg" color="inverseOnSurface" />
          </Pressable>
        </View>
        <View style={styles.track}>
          {timed ? <PhaseFill deplete={phase === 'rate'} style={styles.fill} /> : <View style={[styles.fill, { width: `${progress * 100}%` }]} />}
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  player: { borderRadius: radius['2xl'], backgroundColor: colors.inverseSurface, overflow: 'hidden', ...shadow.float },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 8 },
  open: { flex: 1, minWidth: 0, minHeight: TARGET, flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: { position: 'absolute', right: -4, bottom: -4, width: 20, height: 20, borderRadius: radius.full, backgroundColor: colors.primaryFixed, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.inverseSurface },
  text: { flex: 1, minWidth: 0 },
  play: { width: TARGET, height: TARGET, borderRadius: radius.full, backgroundColor: colors.primaryFixed, alignItems: 'center', justifyContent: 'center' },
  next: { width: TARGET, height: TARGET, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  track: { position: 'absolute', left: 8, right: 8, bottom: 0, height: 4, borderRadius: radius.full, backgroundColor: 'rgba(243,240,235,0.2)', overflow: 'hidden' },
  fill: { height: 4, backgroundColor: colors.primaryFixed, borderRadius: radius.full },
});
