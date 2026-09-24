import { PointerEvent, useRef, useState } from 'react';
import { AnimatePresence, motion, PanInfo, useDragControls } from 'motion/react';
import { findSet, getLanguage, getPhrase, getSet, PhraseNotes } from '../content';
import { NOTE_TABS, NoteBody } from '../components/PhraseDetailsSheet';
import { SetCover } from '../components/SetCover';
import { easyCue, hardCue, learnedCue } from '../audio/feedbackSounds';
import { voiceName } from '../audio/speech';
import { floatingChip } from '../lib/feedback';
import { isTargetRevealed, PHASE_ICONS, phaseInstruction, phaseStepLabel } from '../lib/phase';
import { useDialog } from '../lib/useDialog';
import { DAY, formatElapsed, formatInterval } from '../state/clock';
import { PHASES, SPEEDS } from '../state/machine';
import { applyGrade, Grade, newMemory, previewInterval } from '../state/memory';
import { listenedMs } from '../state/selectors';
import { useCurrentPhraseId, useNow, useStore } from '../state/store';

type NoteTab = keyof PhraseNotes;

interface NowPlayingScreenProps {
  onClose: () => void;
  onOpenQueue: () => void;
}

export function NowPlayingScreen({ onClose, onOpenQueue }: NowPlayingScreenProps) {
  const { state, actions } = useStore();
  const phraseId = useCurrentPhraseId()!;
  const now = useNow(250);
  const dragControls = useDragControls();
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialog(dialogRef, onClose);
  const [openNote, setOpenNote] = useState<NoteTab | null>(null);
  const [noteFor, setNoteFor] = useState(phraseId);
  // Notes start closed for every new phrase.
  if (noteFor !== phraseId) {
    setNoteFor(phraseId);
    setOpenNote(null);
  }

  const phrase = getPhrase(phraseId);
  const queueSet = findSet(state.player.setId);
  const { status, phase, repetition, repeats, speed, shuffle, ratedCurrent, index, order, audioError } = state.player;
  const playing = status === 'playing';
  const revealed = isTargetRevealed(state.player);
  const saved = state.learner.savedPhraseIds.includes(phrase.id);
  const memory = state.learner.phrases[phrase.id];
  const target = getLanguage(phrase.target.lang);
  const voice = voiceName(phrase.target.lang);
  const notes = phrase.notes ?? {};
  const noteTabs = NOTE_TABS.filter((t) => notes[t.id]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 100 || info.velocity.y > 500) onClose();
  };
  const startDrag = (e: PointerEvent) => dragControls.start(e);

  const rate = (grade: Grade, anchor: HTMLElement) => {
    const result = applyGrade(memory ?? newMemory(now), grade, now);
    actions.rate(grade);
    if (result.becameLearned) learnedCue();
    else if (grade === 'easy') easyCue();
    else hardCue();
    const next = formatInterval(result.memory.stabilityDays! * DAY);
    floatingChip(
      anchor,
      result.becameLearned ? `Learned · +${result.points + result.bonus}` : `${grade === 'easy' ? 'Easy' : 'Hard'} · next in ${next}`,
      grade === 'easy' ? 'success' : 'info',
    );
  };

  return (
    <motion.div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Now playing"
      tabIndex={-1}
      drag="y"
      dragListener={false}
      dragControls={dragControls}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.8 }}
      onDragEnd={onDragEnd}
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed inset-0 z-50 bg-surface flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] outline-none"
    >
      {/* The grab bar and the title drag the player closed; the buttons never start a drag. */}
      <div onPointerDown={startDrag} className="shrink-0 h-4 touch-none cursor-grab active:cursor-grabbing" aria-hidden="true">
        <div className="w-10 h-1 rounded-full bg-outline-variant mx-auto mt-2" />
      </div>
      <header className="shrink-0 flex items-center gap-2 px-2 h-12 max-w-lg w-full mx-auto">
        <button
          type="button"
          aria-label="Close player"
          onClick={onClose}
          className="w-11 h-11 flex items-center justify-center rounded-full active:bg-surface-container"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[28px]">keyboard_arrow_down</span>
        </button>
        <h1
          onPointerDown={startDrag}
          className="flex-1 min-w-0 self-stretch flex items-center justify-center font-serif text-base font-bold text-on-surface truncate touch-none"
        >
          {queueSet?.title ?? `Queue · ${order.length} phrases`}
        </h1>
        <button
          type="button"
          aria-label="Open queue"
          onClick={onOpenQueue}
          className="w-11 h-11 flex items-center justify-center rounded-full active:bg-surface-container"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[26px]">queue_music</span>
        </button>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-lg mx-auto px-5 pb-4 flex flex-col gap-4">
          <div className="relative mx-auto w-full max-w-[min(100%,34dvh)] aspect-square">
            <SetCover set={getSet(phrase.setId)} size="lg" className="w-full h-full rounded-3xl shadow-xl" />
            <span
              role="img"
              aria-label={target.name}
              className="absolute bottom-3 left-3 w-9 h-9 rounded-full bg-surface/70 flex items-center justify-center text-lg"
            >
              {target.flag}
            </span>
          </div>

          {/* Phrase: the target stays hidden until it is heard, so the learner recalls it first. */}
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              {revealed ? (
                <h2 lang={phrase.target.lang} className="font-serif italic text-2xl font-bold text-on-surface leading-snug">
                  {phrase.target.text}
                </h2>
              ) : (
                // A redaction bar the length of the phrase: something is there, not yet shown.
                <h2 className="h-8 flex items-center">
                  <span
                    aria-hidden="true"
                    className="block h-6 rounded-md bg-surface-container-highest"
                    style={{ width: `${Math.min(100, 12 + phrase.target.text.length * 2.4)}%` }}
                  />
                  <span className="sr-only">{target.name} hidden until you hear it</span>
                </h2>
              )}
              <p className="text-sm text-secondary mt-0.5">{phrase.native.text}</p>
              {voice && <p className="text-xs text-on-surface-variant mt-1">Device voice · {voice}</p>}
            </div>
            <button
              type="button"
              aria-label={saved ? 'Remove from saved phrases' : 'Save phrase'}
              aria-pressed={saved}
              onClick={() => actions.toggleSavePhrase(phrase.id)}
              className="w-11 h-11 shrink-0 flex items-center justify-center rounded-full text-primary-container active:bg-primary-fixed/40"
            >
              <span aria-hidden="true" className={`material-symbols-outlined text-[26px] ${saved ? 'material-symbols-fill' : ''}`}>favorite</span>
            </button>
          </div>

          {noteTabs.length > 0 && (
            <div>
              <div className="scroll-row flex gap-2 overflow-x-auto -mx-5 px-5">
                {noteTabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    aria-expanded={openNote === t.id}
                    onClick={() => setOpenNote(openNote === t.id ? null : t.id)}
                    className={`shrink-0 min-h-11 px-3 rounded-full text-[13px] font-semibold flex items-center gap-1 border ${
                      openNote === t.id
                        ? 'bg-primary-container text-on-primary border-primary-container'
                        : 'bg-surface-container-low text-on-surface border-outline-variant/50'
                    }`}
                  >
                    <span aria-hidden="true" className="material-symbols-outlined text-[18px]">{t.icon}</span>
                    {t.label}
                  </button>
                ))}
              </div>
              <AnimatePresence initial={false}>
                {openNote && (
                  <motion.div
                    key={openNote}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 rounded-2xl bg-surface-container-low p-3">
                      <NoteBody notes={notes} tab={openNote} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* The loop: native → your turn → target, with real repetition and time */}
          <div>
            <ol className="grid grid-cols-3 gap-1.5" aria-label="Steps">
              {PHASES.map((p) => {
                const active = playing && p === phase;
                const done = PHASES.indexOf(p) < PHASES.indexOf(phase);
                return (
                  <li
                    key={p}
                    aria-current={active ? 'step' : undefined}
                    className={`min-h-11 rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold border ${
                      active
                        ? 'bg-primary-container text-on-primary border-primary-container'
                        : done && playing
                        ? 'bg-primary-fixed/50 text-on-primary-fixed-variant border-transparent'
                        : 'bg-surface-container-low text-secondary border-surface-container-high'
                    }`}
                  >
                    <span aria-hidden="true" className="material-symbols-outlined text-[18px]">{PHASE_ICONS[p]}</span>
                    {phaseStepLabel(p, phrase)}
                  </li>
                );
              })}
            </ol>
            {audioError ? (
              <p role="alert" className="mt-2 rounded-xl bg-error-container/60 text-on-error-container text-sm p-3 flex gap-2">
                <span aria-hidden="true" className="material-symbols-outlined text-[20px]">volume_off</span>
                <span>
                  This device has no {getLanguage(audioError).name} voice, so the phrase can’t play. Add one in your
                  system’s speech settings, then press Play.
                </span>
              </p>
            ) : (
              <div className="flex items-center justify-between mt-2 text-xs text-secondary">
                <span aria-live="polite" className="font-semibold text-on-surface">
                  {playing ? phaseInstruction(phase, phrase) : 'Paused'}
                </span>
                <span className="tabular-nums">
                  Repetition {repetition} of {repeats} · {formatElapsed(listenedMs(state.player, now))}
                </span>
              </div>
            )}
          </div>

          {/* Rating: offered once per play, never preselected, hidden once given */}
          <div className="min-h-[76px]">
            {ratedCurrent === null ? (
              <div>
                <p className="text-xs text-secondary text-center mb-1.5">How did saying it go?</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={(e) => rate('hard', e.currentTarget)}
                    className="min-h-12 rounded-full border-2 border-error/40 bg-error-container/60 text-on-error-container font-bold flex items-center justify-center gap-1.5 active:opacity-80"
                  >
                    <span aria-hidden="true" className="material-symbols-outlined text-[20px]">replay</span>
                    Hard · {formatInterval(previewInterval(memory, 'hard', now))}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => rate('easy', e.currentTarget)}
                    className="min-h-12 rounded-full border-2 border-tertiary/40 bg-tertiary-fixed text-on-tertiary-fixed font-bold flex items-center justify-center gap-1.5 active:opacity-80"
                  >
                    <span aria-hidden="true" className="material-symbols-outlined text-[20px]">check</span>
                    Easy · {formatInterval(previewInterval(memory, 'easy', now))}
                  </button>
                </div>
              </div>
            ) : (
              <p className="min-h-12 mt-6 flex items-center justify-center gap-1.5 text-sm text-secondary">
                <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-tertiary">task_alt</span>
                Rated {ratedCurrent === 'easy' ? 'Easy' : 'Hard'} — back in{' '}
                {formatInterval((memory?.stabilityDays ?? 0) * DAY)}
              </p>
            )}
          </div>

          {/* Transport */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              aria-label="Shuffle"
              aria-pressed={shuffle}
              onClick={actions.toggleShuffle}
              className={`w-11 h-11 flex items-center justify-center rounded-full ${shuffle ? 'text-primary-container' : 'text-secondary'}`}
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[26px]">shuffle</span>
            </button>
            <button
              type="button"
              aria-label="Previous phrase"
              onClick={actions.prev}
              className="w-12 h-12 flex items-center justify-center rounded-full active:bg-surface-container"
            >
              <span aria-hidden="true" className="material-symbols-outlined material-symbols-fill text-[34px]">skip_previous</span>
            </button>
            <button
              type="button"
              aria-label={playing ? 'Pause' : 'Play'}
              onClick={playing ? actions.pause : actions.play}
              className="w-16 h-16 rounded-full bg-primary-container text-on-primary flex items-center justify-center shadow-lg active:scale-95 transition-transform"
            >
              <span aria-hidden="true" className="material-symbols-outlined material-symbols-fill text-[40px]">{playing ? 'pause' : 'play_arrow'}</span>
            </button>
            <button
              type="button"
              aria-label="Next phrase"
              onClick={actions.next}
              disabled={index >= order.length - 1}
              className="w-12 h-12 flex items-center justify-center rounded-full active:bg-surface-container disabled:opacity-40"
            >
              <span aria-hidden="true" className="material-symbols-outlined material-symbols-fill text-[34px]">skip_next</span>
            </button>
            <button
              type="button"
              aria-label={`Repeat each phrase 3 times: ${repeats === 3 ? 'on' : 'off'}`}
              aria-pressed={repeats === 3}
              onClick={actions.toggleRepeat}
              className={`relative w-11 h-11 flex items-center justify-center rounded-full ${
                repeats === 3 ? 'text-primary-container' : 'text-secondary'
              }`}
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[26px]">{repeats === 3 ? 'repeat_on' : 'repeat'}</span>
              <span aria-hidden="true" className="absolute top-0.5 right-0 text-[11px] font-black">{repeats}×</span>
            </button>
          </div>

          {/* Speed: the only speed control in the app */}
          <div role="radiogroup" aria-label="Speed" className="grid grid-cols-3 gap-1 p-1 bg-surface-container-low rounded-full">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={speed === s}
                onClick={() => actions.setSpeed(s)}
                className={`min-h-11 rounded-full text-sm tabular-nums ${
                  speed === s ? 'bg-surface-container-lowest text-on-surface font-bold shadow-sm' : 'text-secondary font-medium'
                }`}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
