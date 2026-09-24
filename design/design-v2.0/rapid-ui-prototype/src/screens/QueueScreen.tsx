import { KeyboardEvent, useRef } from 'react';
import { motion, PanInfo, Reorder, useDragControls } from 'motion/react';
import { findSet, getPhrase } from '../content';
import { PhraseRow } from '../components/PhraseRow';
import type { Navigation } from '../App';
import { useClickBlockerDuringDrag } from '../lib/suppressClick';
import { useDialog } from '../lib/useDialog';
import { formatAgo } from '../state/clock';
import { previouslyPlayed, upNextIds } from '../state/selectors';
import { useCurrentPhraseId, useNow, useStore } from '../state/store';

const SWIPE = 80;

interface QueueScreenProps {
  onClose: () => void;
  nav: Navigation;
}

export function QueueScreen({ onClose, nav }: QueueScreenProps) {
  const { state, actions } = useStore();
  const now = useNow(30_000);
  const currentId = useCurrentPhraseId();
  const upNext = upNextIds(state.player);
  const previous = previouslyPlayed(state);
  const set = findSet(state.player.setId);
  const playing = state.player.status === 'playing';
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialog(dialogRef, onClose);
  // Up next starts right after the current phrase in the queue order.
  const positionOf = (i: number) => state.player.index + 1 + i;
  const move = (from: number, to: number) => {
    if (to < 0 || to >= upNext.length) return;
    const next = [...upNext];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    actions.reorderUpNext(next);
  };

  return (
    <motion.div
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Queue"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed inset-0 z-50 bg-surface flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] outline-none"
    >
      <header className="shrink-0 flex items-center gap-2 px-2 h-14 border-b border-surface-container-high max-w-lg w-full mx-auto">
        <button
          type="button"
          aria-label="Back to player"
          onClick={onClose}
          className="w-11 h-11 flex items-center justify-center rounded-full active:bg-surface-container"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[28px]">keyboard_arrow_down</span>
        </button>
        <div className="flex-1 min-w-0 text-center">
          <h1 className="font-serif text-lg font-semibold leading-tight">Queue</h1>
          <p className="text-xs text-secondary truncate">
            {set ? `${set.title} · ` : ''}
            {state.player.order.length} phrases
          </p>
        </div>
        {/* Balances the close button so the title stays centred. */}
        <span className="w-11 shrink-0" aria-hidden="true" />
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-3 py-4 flex flex-col gap-5">
          {currentId && (
            <section>
              <h2 className="px-2 mb-1 text-xs font-bold uppercase tracking-wider text-secondary">Now playing</h2>
              <PhraseRow
                phrase={getPhrase(currentId)}
                leading={String(state.player.index + 1)}
                isCurrent
                isPlaying={playing}
                detail={`repetition ${state.player.repetition} of ${state.player.repeats}`}
                onPlay={playing ? actions.pause : actions.play}
                onMore={() => nav.showDetails(currentId)}
              />
            </section>
          )}

          <section>
            <h2 className="px-2 mb-1 text-xs font-bold uppercase tracking-wider text-secondary">
              Up next · {upNext.length}
            </h2>
            {upNext.length === 0 ? (
              <p className="px-2 py-3 text-sm text-secondary">Nothing queued after this phrase.</p>
            ) : (
              <>
                <p className="px-2 mb-2 text-xs text-secondary">
                  Swipe right to play now, left to remove. Drag the handle to reorder.
                </p>
                <Reorder.Group axis="y" values={upNext} onReorder={actions.reorderUpNext} className="flex flex-col gap-2">
                  {upNext.map((id, i) => (
                    <QueueItem
                      key={id}
                      phraseId={id}
                      onPlayNow={() => actions.jump(positionOf(i))}
                      onRemove={() => actions.removeFromQueue(positionOf(i))}
                      onMove={(delta) => move(i, i + delta)}
                    />
                  ))}
                </Reorder.Group>
              </>
            )}
          </section>

          {previous.length > 0 && (
            <section>
              <h2 className="px-2 mb-1 text-xs font-bold uppercase tracking-wider text-secondary">Previously played</h2>
              {previous.map((entry) => (
                <PhraseRow
                  key={entry.phraseId}
                  phrase={getPhrase(entry.phraseId)}
                  detail={formatAgo(now - entry.at)}
                  onPlay={() => nav.playPhraseInSet(entry.phraseId)}
                  onMore={() => nav.showDetails(entry.phraseId)}
                />
              ))}
            </section>
          )}
        </div>
      </div>
    </motion.div>
  );
}

interface QueueItemProps {
  phraseId: string;
  onPlayNow: () => void;
  onRemove: () => void;
  onMove: (delta: -1 | 1) => void;
}

function QueueItem({ phraseId, onPlayNow, onRemove, onMove }: QueueItemProps) {
  const controls = useDragControls();
  const clicks = useClickBlockerDuringDrag();
  const phrase = getPhrase(phraseId);

  const onSwipeEnd = (_: unknown, info: PanInfo) => {
    clicks.release();
    if (info.offset.x > SWIPE) onPlayNow();
    else if (info.offset.x < -SWIPE) onRemove();
  };

  // The keyboard and screen-reader route to what the gestures do.
  const onHandleKey = (event: KeyboardEvent) => {
    const actions: Record<string, () => void> = {
      ArrowUp: () => onMove(-1),
      ArrowDown: () => onMove(1),
      Delete: onRemove,
      Backspace: onRemove,
    };
    const action = actions[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  };

  return (
    <Reorder.Item value={phraseId} dragListener={false} dragControls={controls} className="relative flex items-stretch rounded-2xl bg-surface-container-high overflow-hidden">
      {/* Revealed under the row while swiping */}
      <div className="absolute inset-0 flex items-center justify-between px-4 text-sm font-bold pointer-events-none" aria-hidden="true">
        <span className="flex items-center gap-1 text-tertiary">
          <span aria-hidden="true" className="material-symbols-outlined material-symbols-fill text-[20px]">play_circle</span>
          Play now
        </span>
        <span className="flex items-center gap-1 text-error">
          Remove
          <span aria-hidden="true" className="material-symbols-outlined text-[20px]">delete</span>
        </span>
      </div>
      <motion.div
        drag="x"
        dragSnapToOrigin
        dragElastic={0.5}
        onDragStart={clicks.block}
        onDragEnd={onSwipeEnd}
        className="relative flex-1 min-w-0 flex items-center bg-surface-container-low touch-pan-y"
      >
        <button
          type="button"
          onClick={onPlayNow}
          aria-label={`Play ${phrase.target.text} now`}
          className="flex-1 min-w-0 min-h-14 px-3 py-2 text-left"
        >
          <span lang={phrase.target.lang} className="block font-serif italic text-[15px] font-medium truncate">
            {phrase.target.text}
          </span>
          <span className="block text-xs text-secondary truncate">{phrase.native.text}</span>
        </button>
      </motion.div>
      <button
        type="button"
        aria-label={`Move ${phrase.target.text}`}
        aria-description="Arrow up or down to move, Delete to remove"
        onPointerDown={(e) => controls.start(e)}
        onKeyDown={onHandleKey}
        className="relative w-12 shrink-0 flex items-center justify-center bg-surface-container-low text-secondary touch-none cursor-grab active:cursor-grabbing"
      >
        <span aria-hidden="true" className="material-symbols-outlined text-[24px]">drag_handle</span>
      </button>
    </Reorder.Item>
  );
}
