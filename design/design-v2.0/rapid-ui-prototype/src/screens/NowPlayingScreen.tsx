import { motion, PanInfo, useDragControls } from 'motion/react';
import { PointerEvent, useRef, useState } from 'react';
import { voiceName } from '../audio/speech';
import { easyCue, gentleCue } from '../audio/cues';
import { languageLabel, languageName } from '../copy';
import { getLanguage, Phrase } from '../content';
import { useDialog } from '../lib/useDialog';
import { useClickBlockerDuringDrag } from '../lib/suppressClick';
import { useNav } from '../nav/NavContext';
import { findPhrase, findSetView, promptOf } from '../state/catalog';
import { formatElapsed, formatInterval, formatWhen } from '../state/clock';
import { REPEAT_SETTINGS, SPEEDS } from '../state/machine';
import {
  currentPhraseId,
  isLiked,
  listenedMs,
  pendingFor,
  phraseFullPlayMs,
  previewDue,
  windowLeft,
} from '../state/selectors';
import { useCopy, useNow, useStore } from '../state/store';
import type { Grade, Phase } from '../state/types';
import { Icon, IconName } from '../ui/Icon';
import { PhraseNotesView } from '../ui/Notes';
import { isTargetRevealed, PHASE_ICONS, phaseInstruction, phaseStepLabel } from '../ui/phase';
import { GlossedPhrase, HiddenPhrase } from '../ui/PhraseText';
import { SetCover } from '../ui/SetCover';
import { usePlayerKeys } from './usePlayerKeys';
import { Sheet } from '../ui/Sheet';

const STEPS: Exclude<Phase, 'rate'>[] = ['native', 'pause', 'target'];
const SWIPE = 70;

const GRADES: { grade: Grade; icon: IconName; tone: string }[] = [
  { grade: 'missed', icon: 'replay', tone: 'bg-surface-container-high text-on-surface' },
  { grade: 'hard', icon: 'hourglass_empty', tone: 'bg-secondary-container text-on-secondary-fixed' },
  { grade: 'easy', icon: 'check', tone: 'bg-tertiary-fixed text-on-tertiary-fixed' },
];

interface NowPlayingScreenProps {
  onClose: () => void;
  onOpenQueue: () => void;
}

export function NowPlayingScreen({ onClose, onOpenQueue }: NowPlayingScreenProps) {
  const c = useCopy();
  const nav = useNav();
  const { state, actions } = useStore();
  const dragControls = useDragControls();
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialog(dialogRef, onClose);
  usePlayerKeys();
  const [notesOpen, setNotesOpen] = useState(false);
  const clicks = useClickBlockerDuringDrag();

  const phrase = findPhrase(state.learner, currentPhraseId(state.player));
  if (!phrase) return null;
  const { status, phase, index, order, audioError } = state.player;
  const playing = status === 'playing';
  const revealed = isTargetRevealed(state.player);
  const liked = isLiked(state.learner, 'phrase', phrase.id);
  const prompt = promptOf(phrase, state.learner.profile.nativeLang);
  const targetName = languageName(phrase.targetLang, c.locale);
  const queueSet = findSetView(state.learner, state.player.setId);
  const coverSet = findSetView(state.learner, phrase.setId) ?? queueSet;
  const voice = voiceName(phrase.targetLang);
  const quiet = !state.prefs.announceEveryStep;

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 100 || info.velocity.y > 500) onClose();
  };
  const startDrag = (e: PointerEvent) => dragControls.start(e);
  const onSwipe = (_: unknown, info: PanInfo) => {
    clicks.release();
    if (info.offset.x < -SWIPE) actions.next();
    else if (info.offset.x > SWIPE) actions.prev();
  };

  // What a screen reader hears: every step, or only "your turn" and the reveal.
  const announcement = !playing
    ? ''
    : !quiet
      ? phaseInstruction(c, phase, prompt.lang, phrase.targetLang)
      : phase === 'pause'
        ? phaseInstruction(c, 'pause', prompt.lang, phrase.targetLang)
        : phase === 'target' && state.player.repetition === 1
          ? phrase.target
          : '';

  return (
    <motion.div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={c.player.dialog}
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
      className="fixed inset-0 z-50 bg-surface flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
    >
      {/* The grab bar and the title drag the player closed; the buttons never start a drag. */}
      <div onPointerDown={startDrag} className="shrink-0 h-4 touch-none cursor-grab active:cursor-grabbing" aria-hidden="true">
        <div className="w-10 h-1 rounded-full bg-outline-variant mx-auto mt-2" />
      </div>
      <header className="shrink-0 flex items-center gap-1 px-2 min-h-12 py-0.5 max-w-5xl w-full mx-auto">
        <HeaderButton label={c.player.close} icon="keyboard_arrow_down" onClick={onClose} />
        <div onPointerDown={startDrag} className="flex-1 min-w-0 self-stretch flex flex-col items-center justify-center touch-none">
          <h1 className="font-serif text-row font-bold text-on-surface line-clamp-2 break-words text-center max-w-full leading-tight">
            {/* The count is already in the position line below. */}
            {queueSet?.title ?? c.queue.title}
          </h1>
          <p className="text-label text-secondary tabular-nums">{c.player.position(index + 1, order.length)}</p>
        </div>
        <HeaderButton label={c.player.summary} icon="insights" onClick={nav.openSummary} />
        <HeaderButton label={c.player.openQueue} icon="queue_music" onClick={onOpenQueue} />
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-lg md:max-w-4xl phone-landscape:max-w-4xl mx-auto px-5 pb-3 h-full grid grid-cols-1 gap-3 md:grid-cols-2 md:items-center md:gap-8">
          <motion.div
            drag="x"
            dragSnapToOrigin
            dragElastic={0.3}
            onDragStart={clicks.block}
            onDragEnd={onSwipe}
            className="relative mx-auto w-full max-w-[min(100%,26dvh)] short:hidden phone-landscape:hidden md:max-w-[min(100%,52dvh)] aspect-square touch-pan-y"
          >
            <SetCover set={coverSet ?? { topicId: null, coverIcon: 'edit_note' }} size="lg" className="w-full h-full rounded-3xl shadow-xl" />
            <span role="img" aria-label={languageLabel(phrase.targetLang, c.locale)} className="absolute bottom-3 left-3 w-9 h-9 rounded-full bg-surface/70 flex items-center justify-center text-lg">
              {getLanguage(phrase.targetLang).flag}
            </span>
          </motion.div>

          {/* Phone landscape has no room for the cover: the phrase and its steps on the left, controls on the right. */}
          <div className="flex flex-col gap-3 min-w-0 phone-landscape:grid phone-landscape:grid-cols-2 phone-landscape:gap-x-6 phone-landscape:content-start">
            {/* The target stays hidden until it is heard, so the learner recalls it first. */}
            <div className="flex items-start gap-1 short:flex-col short:gap-0 phone-landscape:col-start-1 phone-landscape:row-start-1">
              <div className="flex-1 min-w-0">
                {revealed ? (
                  <GlossedPhrase phrase={phrase} className="font-serif italic text-display-sm font-bold text-on-surface leading-snug" />
                ) : (
                  <HiddenPhrase text={phrase.target} label={c.player.hidden(targetName)} className="font-serif italic text-display-sm font-bold leading-snug" />
                )}
                <p lang={prompt.lang} className="text-body text-secondary">{prompt.text}</p>
                {voice && !phrase.audio && <p className="text-label text-on-surface-variant mt-0.5">{c.player.voice(voice)}</p>}
              </div>
              <div className="flex flex-col shrink-0 short:flex-row short:-ml-2 short:order-first">
                <button
                  type="button"
                  aria-label={liked ? c.phrase.unlikeLabel : c.phrase.likeLabel}
                  aria-pressed={liked}
                  onClick={() => actions.toggleLike('phrase', phrase.id)}
                  className="w-11 h-11 flex items-center justify-center rounded-full text-primary-container active:bg-primary-fixed/40"
                >
                  <Icon name="favorite" fill={liked} className="text-icon-lg" />
                </button>
                <button
                  type="button"
                  aria-label={c.phrase.addToSet}
                  onClick={() => nav.addToSet([phrase.id])}
                  className="w-11 h-11 flex items-center justify-center rounded-full text-secondary active:bg-surface-container"
                >
                  <Icon name="playlist_add" className="text-icon-lg" />
                </button>
                {phrase.notes && (
                  <button
                    type="button"
                    aria-label={c.phrase.notesTitle}
                    onClick={() => setNotesOpen(true)}
                    className="w-11 h-11 flex items-center justify-center rounded-full text-secondary active:bg-surface-container"
                  >
                    <Icon name="lightbulb" className="text-icon-lg" />
                  </button>
                )}
              </div>
            </div>

            {/* The loop: prompt → your turn → target, with real repetition and time */}
            <div className="phone-landscape:col-start-1 phone-landscape:row-start-2">
              {/* At large text the three pills are too narrow for icon and label side by side. */}
              <ol className="@container grid grid-cols-3 gap-1.5" aria-label={c.player.steps}>
                {STEPS.map((p) => {
                  const current = p === phase;
                  const done = phase === 'rate' || STEPS.indexOf(p) < STEPS.indexOf(phase as Exclude<Phase, 'rate'>);
                  return (
                    <li
                      key={p}
                      aria-current={current ? 'step' : undefined}
                      className={`min-h-11 px-1 rounded-xl flex items-center justify-center gap-1.5 @max-[15rem]:flex-col @max-[15rem]:gap-0 @max-[15rem]:py-1 text-center leading-tight text-label font-semibold border ${
                        current && playing
                          ? 'bg-primary-container text-on-primary border-primary-container'
                          : current
                            ? 'bg-primary-fixed text-on-primary-fixed border-primary-container border-dashed'
                            : done
                              ? 'bg-primary-fixed/50 text-on-primary-fixed-variant border-transparent'
                              : 'bg-surface-container-low text-secondary border-surface-container-high'
                      }`}
                    >
                      <Icon name={current && !playing ? 'pause' : PHASE_ICONS[p]} className="text-icon-sm" />
                      {phaseStepLabel(c, p, prompt.lang, phrase.targetLang)}
                    </li>
                  );
                })}
              </ol>
              {audioError ? (
                <p role="alert" className="mt-2 rounded-xl bg-error-container/60 text-on-error-container text-body p-3 flex gap-2">
                  <Icon name="volume_off" className="text-icon-md" />
                  <span>{audioError.reason === 'no-voice' ? c.player.audioError(languageName(audioError.lang, c.locale)) : c.player.audioSilent}</span>
                </p>
              ) : (
                <div className="flex items-center justify-between gap-2 mt-2 text-label text-secondary">
                  <span className="font-semibold text-on-surface">{playing ? phaseInstruction(c, phase, prompt.lang, phrase.targetLang) : c.player.paused}</span>
                  <PlayTime phrase={phrase} />
                </div>
              )}
              <p aria-live="polite" className="sr-only">{announcement}</p>
            </div>

            <div className="phone-landscape:col-start-2 phone-landscape:row-start-2">
              <Rating phrase={phrase} />
            </div>

            {/* Transport */}
            <div className="flex items-center justify-between phone-landscape:col-start-2 phone-landscape:row-start-1">
              <PlayModeButton />
              <button type="button" aria-label={c.player.previous} aria-keyshortcuts="ArrowLeft" onClick={actions.prev} className="w-12 h-12 flex items-center justify-center rounded-full active:bg-surface-container">
                <Icon name="skip_previous" fill className="text-icon-2xl" />
              </button>
              <button
                type="button"
                aria-label={playing ? c.common.pause : c.common.play}
                aria-keyshortcuts="Space"
                onClick={playing ? actions.pause : actions.play}
                className="w-16 h-16 rounded-full bg-primary-container text-on-primary flex items-center justify-center shadow-lg active:scale-95 transition-transform"
              >
                <Icon name={playing ? 'pause' : 'play_arrow'} fill className="text-icon-3xl" />
              </button>
              <button type="button" aria-label={c.player.next} aria-keyshortcuts="ArrowRight" onClick={actions.next} className="w-12 h-12 flex items-center justify-center rounded-full active:bg-surface-container">
                <Icon name="skip_next" fill className="text-icon-2xl" />
              </button>
              <RepeatsButton />
            </div>

            {/* Speed: the only speed control in the app */}
            <div role="radiogroup" aria-label={c.player.speed} className="grid grid-cols-3 gap-1 p-1 bg-surface-container-low rounded-full phone-landscape:col-start-2 phone-landscape:row-start-3">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={state.prefs.speed === s}
                  onClick={() => actions.setPrefs({ speed: s })}
                  className={`min-h-11 rounded-full text-body tabular-nums ${
                    state.prefs.speed === s ? 'bg-surface-container-lowest text-on-surface font-bold shadow-sm' : 'text-secondary font-medium'
                  }`}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Sheet open={notesOpen} title={c.phrase.notesTitle} onClose={() => setNotesOpen(false)}>
        <PhraseNotesView phrase={phrase} prefix="player-notes" />
      </Sheet>
    </motion.div>
  );
}

function HeaderButton({ label, icon, onClick }: { label: string; icon: IconName; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="w-11 h-11 shrink-0 flex items-center justify-center rounded-full active:bg-surface-container">
      <Icon name={icon} className="text-icon-lg" />
    </button>
  );
}

/** Repetition, elapsed listening time, and the full play at 1× once measured. Re-renders on its own clock. */
function PlayTime({ phrase }: { phrase: Phrase }) {
  const c = useCopy();
  const { state } = useStore();
  const now = useNow(250);
  const full = phraseFullPlayMs(state, phrase, state.player.repeats);
  return (
    <span className="tabular-nums text-right">
      {c.player.repetition(state.player.repetition, state.player.repeats)} · {formatElapsed(listenedMs(state.player, now))}
      {full !== null && ` / ${c.common.fullPlay(formatElapsed(full))}`}
    </span>
  );
}

/** Three grades, never preselected. A rating can be changed or undone for five minutes, then it counts. */
function Rating({ phrase }: { phrase: Phrase }) {
  const c = useCopy();
  const { state, actions } = useStore();
  const now = useNow(1000);
  const pending = pendingFor(state, phrase.id);
  const left = pending ? windowLeft(pending, now) : 0;
  const active = pending && left > 0 ? pending : undefined;

  const rate = (grade: Grade) => {
    actions.rate(grade);
    if (grade === 'easy') easyCue();
    else gentleCue();
  };

  return (
    <div className="h-[7.5rem] flex flex-col justify-between">
      <p className="text-label text-secondary text-center" aria-live="polite">
        {active
          ? c.player.rated(c.common.grade[active.grade], formatWhen(previewDue(state.learner, phrase.id, active.grade, active.at), now, c.locale))
          : c.player.howDidItGo}
      </p>
      <div className="@container grid grid-cols-3 gap-2">
        {GRADES.map(({ grade, icon, tone }, i) => {
          const selected = active?.grade === grade;
          const interval = formatInterval(previewDue(state.learner, phrase.id, grade, active?.at ?? now) - (active?.at ?? now), c.locale);
          return (
            <button
              key={grade}
              type="button"
              aria-pressed={selected}
              aria-keyshortcuts={String(i + 1)}
              onClick={() => rate(grade)}
              className={`min-h-12 px-1 rounded-2xl flex flex-col items-center justify-center leading-tight active:opacity-80 ${tone} ${
                selected ? 'ring-2 ring-primary-container ring-offset-2 ring-offset-surface font-bold' : 'font-semibold'
              }`}
            >
              <span className="flex items-center gap-1 text-body">
                <Icon name={selected ? 'task_alt' : icon} className="text-icon-sm @max-[15rem]:hidden" />
                {c.common.grade[grade]}
              </span>
              <span className="text-caption opacity-80 tabular-nums">{interval}</span>
            </button>
          );
        })}
      </div>
      <div className="h-11 flex items-center justify-center gap-1 text-label text-secondary">
        {active && (
          <>
            <span className="tabular-nums">{c.player.changeFor(formatElapsed(left))}</span>
            <button type="button" onClick={actions.unrate} className="min-h-11 px-3 rounded-full font-bold text-primary-container underline underline-offset-2">
              {c.common.undo}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function PlayModeButton() {
  const c = useCopy();
  const { state, actions } = useStore();
  const mode = state.prefs.playMode;
  return (
    <button
      type="button"
      aria-label={c.player.playMode[mode]}
      title={c.player.playMode[mode]}
      onClick={() => actions.setPrefs({ playMode: mode === 'repeat' ? 'continue' : 'repeat' })}
      className="w-11 h-11 flex items-center justify-center rounded-full text-primary-container active:bg-surface-container"
    >
      <Icon name={mode === 'repeat' ? 'repeat' : 'playlist_play'} className="text-icon-lg" />
    </button>
  );
}

function RepeatsButton() {
  const c = useCopy();
  const { state, actions } = useStore();
  const setting = state.prefs.repeats;
  const label = setting === 'auto' ? c.player.repeats.auto : setting === 1 ? c.player.repeats.one : c.player.repeats.three;
  const next = REPEAT_SETTINGS[(REPEAT_SETTINGS.indexOf(setting) + 1) % REPEAT_SETTINGS.length];
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => actions.setPrefs({ repeats: next })}
      className="w-11 h-11 flex items-center justify-center rounded-full active:bg-surface-container"
    >
      <span aria-hidden="true" className="min-w-9 h-7 px-1.5 rounded-lg border-2 border-primary-container text-primary-container text-label font-black flex items-center justify-center tabular-nums">
        {setting === 'auto' ? 'A' : `${setting}×`}
      </span>
    </button>
  );
}
