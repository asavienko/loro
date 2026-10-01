import { ReactNode } from 'react';
import { languageLabel } from '@shared/copy';
import type { Phrase } from '@shared/content';
import { findPhrase, findSetView, promptOf } from '@shared/state/catalog';
import { clock } from '@shared/state/clock';
import { playsOnce } from '@shared/state/machine';
import { continuation, currentPhraseId, displayLearner, pendingFor, sessionSummary, windowLeft } from '@shared/state/selectors';
import { endTitle, isTargetRevealed, PHASE_ICONS, phaseStepLabel } from '@shared/ui/phase';
import { barLoopRating, barRating } from '@shared/ui/rating';
import { useRate } from '../screens/useRate';
import { useCopy, useNow, useStore } from '../state/store';
import { BarGrades, BarLead, useRedrawIn } from './BarGrades';
import { IconName } from './Icon';
import { MiniCard, MiniCarousel, MiniItem, miniFill, MiniProgress, Side } from './MiniBar';
import { PhaseFill } from './PhaseFill';
import { SetCover } from './SetCover';
import { Txt } from './Txt';

const STEPS_PER_REPETITION = 4;

/**
 * The docked player for the phrase loop (the web's src/ui/MiniPlayer.tsx), on the shared bar
 * (MiniBar): tap to open, swipe for the next or previous phrase; its grades float above it
 * (PhraseBarGrades). The target stays hidden here, as everywhere, until it has been heard.
 */
export function MiniPlayer({ onOpenPlayer }: { onOpenPlayer: () => void }) {
  const c = useCopy();
  const { state, actions } = useStore();
  const now = useNow(60_000);

  const player = state.player;
  const phrase = findPhrase(state.learner, currentPhraseId(player));
  if (!phrase) return null;
  const { phase, repetition, repeats, audioError, index, order } = player;
  const playing = player.status === 'playing';
  const ended = player.ended && playsOnce(player);
  const key = `${index}:${phrase.id}`;

  /** A phrase's card: the playing one, or a neighbour as it will start. */
  const card = (p: Phrase, look: { revealed: boolean; status: string; badge: IconName | null; progress: ReactNode }) => {
    const prompt = promptOf(p, state.learner.profile.nativeLang);
    const title = look.revealed ? p.target : prompt.text;
    const set = findSetView(state.learner, p.setId) ?? findSetView(state.learner, player.setId);
    return (
      <MiniCard
        cover={<SetCover set={set ?? { topicId: null, coverIcon: 'edit_note' }} px={44} rounded={8} badges={false} />}
        badge={look.badge}
        title={
          <Txt
            variant="row"
            face={look.revealed ? 'serif' : 'sans'}
            italic={look.revealed}
            weight={500}
            color="inverseOnSurface"
            numberOfLines={1}
            lang={look.revealed ? p.targetLang : prompt.lang}
          >
            {title}
          </Txt>
        }
        status={look.status}
        open={{ label: `${c.player.dialog}: ${title}`, hint: `${look.status}. ${languageLabel(p.targetLang, c.locale)}`, onPress: onOpenPlayer }}
        playing={playing}
        onToggle={playing ? actions.pause : actions.play}
        next={{ label: c.player.next, onPress: actions.next }}
        progress={look.progress}
      />
    );
  };

  const stepIndex = phase === 'rate' ? STEPS_PER_REPETITION : ['native', 'pause', 'target', 'echo'].indexOf(phase);
  const step = (repetition - 1) * STEPS_PER_REPETITION + stepIndex;
  const progress = playing || step > 0 ? Math.min(1, step / (repeats * STEPS_PER_REPETITION)) : 0;
  const prompt = promptOf(phrase, state.learner.profile.nativeLang);
  const timed = playing && (phase === 'pause' || phase === 'echo' || phase === 'rate') && player.phaseMs !== null;
  const summary = ended ? sessionSummary(state, now) : null;
  const status = audioError
    ? audioError.reason === 'no-clip'
      ? c.player.noClip
      : c.player.silent
    : ended
      ? endTitle(c, player.source, summary ? summary.ratings.missed + summary.ratings.hard + summary.ratings.easy : 0)
      : !playing
        ? c.player.paused
        : phase === 'rate'
          ? c.player.howDidItGo
          : // The step in a word, as the player's steps name it: the language, or "Your turn".
            phaseStepLabel(c, phase, prompt.lang, phrase.targetLang);
  const own = card(phrase, {
    revealed: isTargetRevealed(player),
    status,
    badge: playing && !audioError ? (phase === 'rate' ? 'task_alt' : PHASE_ICONS[phase]) : null,
    progress: timed ? <PhaseFill deplete={phase === 'rate'} style={miniFill} /> : <MiniProgress share={progress} />,
  });

  /** Where Next goes, as the loop's NEXT does: the next phrase, the queue again, or the course's next ones. */
  const nextAt = (): { index: number; id: string } | null => {
    if (index < order.length - 1) return { index: index + 1, id: order[index + 1] };
    if (playsOnce(player)) return null;
    if (state.prefs.playMode === 'repeat') return order.length > 1 ? { index: 0, id: order[0] } : null;
    const more = continuation(displayLearner(state), player, now);
    return more && more.phraseIds.length > 0 ? { index: index + 1, id: more.phraseIds[0] } : null;
  };
  const neighbour = (side: Side): MiniItem | null => {
    const at = side === 1 ? nextAt() : index > 0 ? { index: index - 1, id: order[index - 1] } : null;
    const p = at ? findPhrase(state.learner, at.id) : undefined;
    if (!at || !p) return null;
    // Moving in the queue keeps play or pause; the phrase starts from its prompt.
    const pPrompt = promptOf(p, state.learner.profile.nativeLang);
    return {
      key: `${at.index}:${p.id}`,
      card: card(p, {
        revealed: false,
        status: playing ? phaseStepLabel(c, 'native', pPrompt.lang, p.targetLang) : c.player.paused,
        badge: playing ? PHASE_ICONS.native : null,
        progress: <MiniProgress share={0} />,
      }),
    };
  };

  return (
    <MiniCarousel
      item={{ key, card: own }}
      // A pass through the queue again (repeat) is forward, as is a new queue.
      position={(player.session?.passes ?? 0) * 100_000 + index}
      queue={player.session?.id ?? ''}
      can={{ next: !ended && (index < order.length - 1 || !playsOnce(player)), previous: index > 0 }}
      neighbour={neighbour}
      onSwipe={(side) => {
        if (side === 1) actions.next();
        else actions.jump(index - 1);
        return true;
      }}
    />
  );
}

/**
 * The phrase loop's grades above the bar: the phrase playing can be rated unless its queue has ended
 * or it has a rating in its window; Undo follows a rating for a few seconds, even once the loop has
 * moved on from the phrase it rated.
 */
export function PhraseBarGrades({ lead }: { lead?: BarLead | null }) {
  const { state, actions } = useStore();
  const rate = useRate();
  const player = state.player;
  const id = currentPhraseId(player);
  const now = clock.now();
  const pending = id === null ? undefined : pendingFor(state, id);
  const windowOpen = pending ? windowLeft(pending, now) : 0;
  const recent = barLoopRating(state.pending, id, now);
  const ratable = findPhrase(state.learner, id) !== undefined && player.status !== 'idle' && !(player.ended && playsOnce(player));
  const view = barRating({ ratable, rated: windowOpen > 0 }, recent, now);
  // Drawn again as Undo runs out, and as the window closes and the grades come back.
  useRedrawIn(view.kind === 'undo' ? view.left : windowOpen > 0 ? windowOpen : null);
  return <BarGrades view={view} onRate={rate} onUndo={() => recent && actions.unrate(recent.phraseId)} lead={lead} />;
}
