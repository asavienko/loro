import { motion, PanInfo } from 'motion/react';
import { getPhrase, getSet } from '../content';
import { SetCover } from './SetCover';
import { isTargetRevealed, phaseInstruction } from '../lib/phase';
import { useClickBlockerDuringDrag } from '../lib/suppressClick';
import { PHASES } from '../state/machine';
import { useCurrentPhraseId, useStore } from '../state/store';

const SWIPE_DISTANCE = 60;
const SWIPE_VELOCITY = 400;

/** Docked player: tap to open, swipe for next/previous, play/pause and next. */
export function MiniPlayer({ onOpenPlayer }: { onOpenPlayer: () => void }) {
  const { state, actions } = useStore();
  const phraseId = useCurrentPhraseId();
  const clicks = useClickBlockerDuringDrag();
  if (!phraseId) return null;

  const phrase = getPhrase(phraseId);
  const { status, phase, repetition, repeats, index, order } = state.player;
  const playing = status === 'playing';
  const step = (repetition - 1) * PHASES.length + PHASES.indexOf(phase);
  const progress = playing || step > 0 ? step / (repeats * PHASES.length) : 0;
  const hasNext = index < order.length - 1;
  // While the learner is recalling it, the docked player shows the prompt, not the answer.
  const revealed = isTargetRevealed(state.player);
  const title = revealed ? phrase.target.text : phrase.native.text;

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
      className="relative rounded-2xl bg-inverse-surface text-inverse-on-surface shadow-xl overflow-hidden touch-pan-y"
    >
      <div className="flex items-center gap-1 p-2">
        <button
          type="button"
          onClick={onOpenPlayer}
          aria-label={`Open player: ${title}`}
          className="flex-1 min-w-0 min-h-11 flex items-center gap-3 text-left"
        >
          <SetCover set={getSet(phrase.setId)} size="sm" className="w-11 h-11 rounded-lg shrink-0" />
          <span className="min-w-0">
            <span
              lang={revealed ? phrase.target.lang : phrase.native.lang}
              className={`block text-[15px] truncate ${revealed ? 'font-serif italic' : 'font-medium'}`}
            >
              {title}
            </span>
            <span className="block text-xs text-secondary-fixed-dim truncate">
              {state.player.audioError ? 'No voice for this language' : playing ? phaseInstruction(phase, phrase) : 'Paused'}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={playing ? actions.pause : actions.play}
          aria-label={playing ? 'Pause' : 'Play'}
          className="w-11 h-11 shrink-0 rounded-full bg-primary-fixed text-on-primary-fixed flex items-center justify-center active:opacity-80"
        >
          <span aria-hidden="true" className="material-symbols-outlined material-symbols-fill text-[26px]">{playing ? 'pause' : 'play_arrow'}</span>
        </button>
        <button
          type="button"
          onClick={actions.next}
          disabled={!hasNext}
          aria-label="Next phrase"
          className="w-11 h-11 shrink-0 rounded-full flex items-center justify-center active:bg-inverse-on-surface/10 disabled:opacity-40"
        >
          <span aria-hidden="true" className="material-symbols-outlined material-symbols-fill text-[26px]">skip_next</span>
        </button>
      </div>
      <div className="absolute bottom-0 inset-x-2 h-0.5 bg-inverse-on-surface/20 rounded-full" aria-hidden="true">
        <div className="h-full bg-primary-fixed rounded-full" style={{ width: `${progress * 100}%` }} />
      </div>
    </motion.div>
  );
}
