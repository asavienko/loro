import { motion, PanInfo } from 'motion/react';
import { useId } from 'react';
import { languageLabel } from '../copy';
import { useClickBlockerDuringDrag } from '../lib/suppressClick';
import { findPhrase, findSetView, promptOf } from '../state/catalog';
import { currentPhraseId } from '../state/selectors';
import { useCopy, useStore } from '../state/store';
import { Icon } from './Icon';
import { isTargetRevealed, phaseInstruction } from './phase';
import { SetCover } from './SetCover';

const SWIPE_DISTANCE = 60;
const SWIPE_VELOCITY = 400;
const STEPS_PER_REPETITION = 3;

/** Docked player: tap to open, swipe for next/previous, play/pause and next. */
export function MiniPlayer({ onOpenPlayer }: { onOpenPlayer: () => void }) {
  const c = useCopy();
  const { state, actions } = useStore();
  const clicks = useClickBlockerDuringDrag();
  const statusId = useId();
  const phrase = findPhrase(state.learner, currentPhraseId(state.player));
  if (!phrase) return null;

  const { status, phase, repetition, repeats, audioError } = state.player;
  const playing = status === 'playing';
  const stepIndex = phase === 'rate' ? STEPS_PER_REPETITION : ['native', 'pause', 'target'].indexOf(phase);
  const step = (repetition - 1) * STEPS_PER_REPETITION + stepIndex;
  const progress = playing || step > 0 ? Math.min(1, step / (repeats * STEPS_PER_REPETITION)) : 0;
  const prompt = promptOf(phrase, state.learner.profile.nativeLang);
  // While the learner is recalling it, the docked player shows the prompt, not the answer.
  const revealed = isTargetRevealed(state.player);
  const title = revealed ? phrase.target : prompt.text;
  const set = findSetView(state.learner, phrase.setId) ?? findSetView(state.learner, state.player.setId);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    clicks.release();
    if (info.offset.x < -SWIPE_DISTANCE || info.velocity.x < -SWIPE_VELOCITY) actions.next();
    else if (info.offset.x > SWIPE_DISTANCE || info.velocity.x > SWIPE_VELOCITY) actions.prev();
  };

  return (
    <motion.div
      drag="x"
      dragSnapToOrigin
      dragElastic={0.4}
      onDragStart={clicks.block}
      onDragEnd={onDragEnd}
      className="on-dark relative rounded-2xl bg-inverse-surface text-inverse-on-surface shadow-xl overflow-hidden touch-pan-y forced-colors:border-2"
    >
      <div className="flex items-center gap-1 p-2 phone-landscape:py-1">
        <button
          type="button"
          onClick={onOpenPlayer}
          aria-label={`${c.player.dialog}: ${title}`}
          // The status line (including "No voice…" or "Speech stopped") and the course's
          // language are its description; the label alone would hide them.
          aria-describedby={statusId}
          className="flex-1 min-w-0 min-h-11 flex items-center gap-3 text-left rounded-xl"
        >
          <SetCover set={set ?? { topicId: null, coverIcon: 'edit_note' }} size="sm" className="w-11 h-11 rounded-lg shrink-0" />
          <span className="min-w-0">
            <span lang={revealed ? phrase.targetLang : prompt.lang} className={`block text-row truncate ${revealed ? 'font-serif italic' : 'font-medium'}`}>
              {title}
            </span>
            <span id={statusId} className="block text-label text-secondary-fixed-dim truncate">
              {audioError
                ? audioError.reason === 'no-voice'
                  ? c.player.noVoice
                  : c.player.silent
                : playing
                  ? phaseInstruction(c, phase, prompt.lang, phrase.targetLang)
                  : c.player.paused}
              <span className="sr-only">. {languageLabel(phrase.targetLang, c.locale)}</span>
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={playing ? actions.pause : actions.play}
          aria-label={playing ? c.common.pause : c.common.play}
          className="w-11 h-11 shrink-0 rounded-full bg-primary-fixed text-on-primary-fixed flex items-center justify-center active:opacity-80"
        >
          <Icon name={playing ? 'pause' : 'play_arrow'} fill className="text-icon-lg" />
        </button>
        <button
          type="button"
          onClick={actions.next}
          aria-label={c.player.next}
          className="w-11 h-11 shrink-0 rounded-full flex items-center justify-center active:bg-inverse-on-surface/10"
        >
          <Icon name="skip_next" fill className="text-icon-lg" />
        </button>
      </div>
      <div className="absolute bottom-0 inset-x-2 h-0.5 bg-inverse-on-surface/20 rounded-full" aria-hidden="true">
        <div className="h-full bg-primary-fixed rounded-full" style={{ width: `${progress * 100}%` }} />
      </div>
    </motion.div>
  );
}
