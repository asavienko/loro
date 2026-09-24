import { motion, PanInfo, Reorder, useDragControls } from 'motion/react';
import { KeyboardEvent, useId, useRef, useState } from 'react';
import { useClickBlockerDuringDrag } from '../lib/suppressClick';
import { useDialog } from '../lib/useDialog';
import { useNav } from '../nav/NavContext';
import { findPhrase, findSetView, promptOf } from '../state/catalog';
import { formatAgo } from '../state/clock';
import { currentPhraseId, previouslyPlayed, upNextIds } from '../state/selectors';
import { useCopy, useNow, useStore } from '../state/store';
import { Icon } from '../ui/Icon';
import { isTargetRevealed } from '../ui/phase';
import { PhraseRow } from '../ui/PhraseRow';
import { Sheet, SheetOption } from '../ui/Sheet';
import { useToast } from '../ui/Toast';

const SWIPE = 80;

export function QueueScreen({ onClose }: { onClose: () => void }) {
  const c = useCopy();
  const nav = useNav();
  const { state, actions } = useStore();
  const { toast, announce } = useToast();
  const now = useNow(30_000);
  const currentId = currentPhraseId(state.player);
  const current = findPhrase(state.learner, currentId);
  const upNext = upNextIds(state.player);
  const previous = previouslyPlayed(state);
  const set = findSetView(state.learner, state.player.setId);
  const playing = state.player.status === 'playing';
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialog(dialogRef, onClose);
  const hintId = useId();
  // The up-next row whose options are open: the single-tap route to what drag and swipe do (WCAG 2.5.7).
  const [menu, setMenu] = useState<number | null>(null);
  const menuPhrase = menu === null ? undefined : findPhrase(state.learner, upNext[menu]);
  // Up next starts right after the current phrase in the queue order.
  const positionOf = (i: number) => state.player.index + 1 + i;
  // A phrase can be queued twice (a missed phrase comes back), so each row's identity includes its copy number.
  const items = upNext.map((id, i) => `${id}#${upNext.slice(0, i).filter((x) => x === id).length}`);
  const idOf = (item: string) => item.slice(0, item.lastIndexOf('#'));

  const move = (from: number, to: number) => {
    if (to < 0 || to >= upNext.length) return;
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
    toast(c.toast.removed, { action: { label: c.common.undo, run: () => actions.insertInQueue(position, phraseId) } });
  };

  const saveAsSet = () => {
    const title = set ? `${set.title} · ${c.queue.defaultSetName}` : c.queue.defaultSetName;
    actions.createSet(title, state.player.order);
    toast(c.toast.saved(title));
  };

  return (
    <motion.div
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={c.queue.title}
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed inset-0 z-50 bg-surface flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
    >
      <header className="shrink-0 flex items-center gap-2 px-2 h-14 border-b border-surface-container-high max-w-lg w-full mx-auto">
        <button type="button" aria-label={c.queue.back} onClick={onClose} className="w-11 h-11 flex items-center justify-center rounded-full active:bg-surface-container">
          <Icon name="keyboard_arrow_down" className="text-icon-xl" />
        </button>
        <div className="flex-1 min-w-0 text-center">
          <h1 className="font-serif text-lg font-semibold leading-tight">{c.queue.title}</h1>
          <p className="text-label text-secondary truncate">
            {c.queue.left(upNext.length)}
            {set ? ` · ${set.title}` : ''}
          </p>
        </div>
        <button
          type="button"
          aria-label={c.queue.shuffle}
          aria-pressed={state.player.shuffle}
          onClick={actions.toggleShuffle}
          className={`w-11 h-11 flex items-center justify-center rounded-full active:bg-surface-container ${state.player.shuffle ? 'text-primary-container' : 'text-secondary'}`}
        >
          <Icon name="shuffle" className="text-icon-lg" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-3 py-4 flex flex-col gap-5">
          {current && (
            <section>
              <h2 className="px-2 mb-1 text-label font-bold uppercase tracking-wider text-secondary">{c.queue.nowPlaying}</h2>
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
            </section>
          )}

          <section>
            <h2 className="px-2 mb-1 text-label font-bold uppercase tracking-wider text-secondary">{c.queue.upNext(upNext.length)}</h2>
            {upNext.length === 0 ? (
              <p className="px-2 py-3 text-body text-secondary">{c.queue.nothing}</p>
            ) : (
              <>
                <p className="px-2 mb-2 text-label text-secondary">{c.queue.hint}</p>
                <p id={hintId} hidden>
                  {c.queue.handleHint}
                </p>
                <Reorder.Group axis="y" values={items} onReorder={(next) => actions.reorderUpNext(next.map(idOf))} className="flex flex-col gap-2">
                  {items.map((item, i) => (
                    <QueueItem
                      key={item}
                      item={item}
                      phraseId={idOf(item)}
                      hintId={hintId}
                      onPlayNow={() => actions.jump(positionOf(i), true)}
                      onRemove={() => remove(i)}
                      onMove={(delta) => move(i, i + delta)}
                      onMenu={() => setMenu(i)}
                    />
                  ))}
                </Reorder.Group>
              </>
            )}
            <div className="flex gap-2 mt-3 px-1">
              <button type="button" onClick={saveAsSet} className="min-h-11 px-4 rounded-full bg-surface-container text-on-surface text-body font-semibold flex items-center gap-1.5">
                <Icon name="playlist_add" className="text-icon-md" />
                {c.queue.saveAsSet}
              </button>
              {upNext.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const before = [...state.player.order];
                    const index = state.player.index;
                    actions.clearQueue();
                    toast(c.toast.cleared, {
                      action: {
                        label: c.common.undo,
                        run: () => before.slice(index + 1).forEach((pid, k) => actions.insertInQueue(1 + k, pid)),
                      },
                    });
                  }}
                  className="min-h-11 px-4 rounded-full bg-surface-container text-on-surface text-body font-semibold flex items-center gap-1.5"
                >
                  <Icon name="clear_all" className="text-icon-md" />
                  {c.queue.clear}
                </button>
              )}
            </div>
          </section>

          {previous.length > 0 && (
            <section>
              <h2 className="px-2 mb-1 text-label font-bold uppercase tracking-wider text-secondary">{c.queue.previously}</h2>
              {previous.map((entry) => {
                const phrase = findPhrase(state.learner, entry.phraseId)!;
                return (
                  <PhraseRow
                    key={entry.phraseId}
                    phrase={phrase}
                    detail={formatAgo(entry.at, now, c.locale)}
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
            </section>
          )}
        </div>
      </div>

      <Sheet open={menu !== null && Boolean(menuPhrase)} title={menuPhrase?.target ?? ''} onClose={() => setMenu(null)}>
        {menu !== null && (
          <div className="flex flex-col">
            <SheetOption icon="arrow_upward" label={c.queue.moveUp} disabled={menu === 0} onClick={() => { move(menu, menu - 1); setMenu(null); }} />
            <SheetOption icon="arrow_downward" label={c.queue.moveDown} disabled={menu === upNext.length - 1} onClick={() => { move(menu, menu + 1); setMenu(null); }} />
            <SheetOption icon="delete" tone="danger" label={c.queue.removeFromQueue} onClick={() => { remove(menu); setMenu(null); }} />
          </div>
        )}
      </Sheet>
    </motion.div>
  );
}

interface QueueItemProps {
  item: string;
  phraseId: string;
  hintId: string;
  onPlayNow: () => void;
  onRemove: () => void;
  onMove: (delta: -1 | 1) => void;
  /** A tap on the handle (not a drag) opens the row's options. */
  onMenu: () => void;
}

function QueueItem({ item, phraseId, hintId, onPlayNow, onRemove, onMove, onMenu }: QueueItemProps) {
  const c = useCopy();
  const { state } = useStore();
  const controls = useDragControls();
  const clicks = useClickBlockerDuringDrag();
  const dragged = useRef(false);
  const phrase = findPhrase(state.learner, phraseId);
  if (!phrase) return null;
  const prompt = promptOf(phrase, state.learner.profile.nativeLang);

  const onSwipeEnd = (_: unknown, info: PanInfo) => {
    clicks.release();
    if (info.offset.x > SWIPE) onPlayNow();
    else if (info.offset.x < -SWIPE) onRemove();
  };

  // The keyboard and screen-reader route to what the gestures do.
  const onHandleKey = (event: KeyboardEvent) => {
    const keys: Record<string, () => void> = {
      ArrowUp: () => onMove(-1),
      ArrowDown: () => onMove(1),
      Delete: onRemove,
      Backspace: onRemove,
    };
    const action = keys[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  };

  return (
    <Reorder.Item value={item} dragListener={false} dragControls={controls} onDragStart={() => (dragged.current = true)} className="relative flex items-stretch rounded-2xl bg-surface-container-high overflow-hidden">
      {/* Revealed under the row while swiping */}
      <div className="absolute inset-0 flex items-center justify-between px-4 text-body font-bold pointer-events-none" aria-hidden="true">
        <span className="flex items-center gap-1 text-tertiary">
          <Icon name="play_circle" fill className="text-icon-md" />
          {c.queue.swipePlay}
        </span>
        <span className="flex items-center gap-1 text-on-surface-variant">
          {c.queue.swipeRemove}
          <Icon name="delete" className="text-icon-md" />
        </span>
      </div>
      <motion.div drag="x" dragSnapToOrigin dragElastic={0.5} onDragStart={clicks.block} onDragEnd={onSwipeEnd} className="relative flex-1 min-w-0 flex items-center bg-surface-container-low touch-pan-y">
        <button type="button" onClick={onPlayNow} aria-label={c.queue.playNow(phrase.target)} className="flex-1 min-w-0 min-h-14 px-3 py-2 text-left">
          <span lang={phrase.targetLang} className="font-serif italic text-row font-medium break-words">
            {phrase.target}
          </span>
          <span lang={prompt.lang} className="block text-label text-secondary truncate">{prompt.text}</span>
        </button>
      </motion.div>
      <button
        type="button"
        aria-label={c.queue.move(phrase.target)}
        aria-describedby={hintId}
        aria-haspopup="dialog"
        onPointerDown={(e) => {
          dragged.current = false;
          controls.start(e);
        }}
        onClick={() => {
          if (!dragged.current) onMenu();
        }}
        onKeyDown={onHandleKey}
        className="relative w-12 shrink-0 flex items-center justify-center bg-surface-container-low text-secondary touch-none cursor-grab active:cursor-grabbing"
      >
        <Icon name="drag_handle" className="text-icon-lg" />
      </button>
    </Reorder.Item>
  );
}
