import { motion, PanInfo, useDragControls } from 'motion/react';
import { PointerEvent, ReactNode, useEffect, useRef, useState } from 'react';
import { voiceName, voicesFor } from '../audio/speech';
import { languageLabel, languageName } from '../copy';
import { getLanguage, getTopic, Phrase } from '../content';
import { useDialog } from '../lib/useDialog';
import { useClickBlockerDuringDrag } from '../lib/suppressClick';
import { useNav } from '../nav/NavContext';
import { findPhrase, findSetView, promptOf } from '../state/catalog';
import { formatElapsed, formatWhen } from '../state/clock';
import { playsOnce, REPEAT_SETTINGS, SPEEDS } from '../state/machine';
import { RATING_WINDOW_MS } from '../state/memory';
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
} from '../state/selectors';
import { useCopy, useNow, useStore } from '../state/store';
import type { Grade, Phase } from '../state/types';
import { Icon, IconName } from '../ui/Icon';
import { PhraseNotesView } from '../ui/Notes';
import { backIn, endTitle, isTargetRevealed, PHASE_ICONS, phaseInstruction, phaseStepLabel, queueTitle } from '../ui/phase';
import { GlossedPhrase, HiddenPhrase } from '../ui/PhraseText';
import { PhraseImage } from '../ui/PhraseImage';
import { SetCover } from '../ui/SetCover';
import { PhaseFill } from '../ui/PhaseFill';
import { usePlayerKeys } from './usePlayerKeys';
import { useRate } from './useRate';
import { Sheet } from '../ui/Sheet';
import { useToast } from '../ui/Toast';
import { btnPrimary, btnText } from '../ui/button';

const STEPS: Exclude<Phase, 'rate'>[] = ['native', 'pause', 'target'];
/** The end panel's action: Home's hero radius, so a set title that wraps at large text stays inside it. */
const PANEL_PRIMARY = `${btnPrimary.replace('rounded-full', 'rounded-3xl')} py-2`;
const SWIPE = 70;

const GRADES: { grade: Grade; icon: IconName; tone: string }[] = [
  { grade: 'missed', icon: 'replay', tone: 'bg-surface-container-high text-on-surface' },
  { grade: 'hard', icon: 'hourglass_empty', tone: 'bg-secondary-container text-on-secondary-fixed' },
  { grade: 'easy', icon: 'check', tone: 'bg-tertiary-fixed text-on-tertiary-fixed' },
];

/**
 * Two shapes. Roomy: the cover shows and speed is a segmented row in the dock. Compact (a
 * short phone, or a narrow one in text units — i.e. large text): no cover, and speed is one
 * chip in the action row, so every control is on screen without scrolling.
 */
const ROOMY_ONLY = 'short:hidden @max-[22rem]/player:hidden';
const COMPACT_ONLY = 'hidden short:flex @max-[22rem]/player:flex';

interface NowPlayingScreenProps {
  onClose: () => void;
  onOpenQueue: () => void;
}

export function NowPlayingScreen({ onClose, onOpenQueue }: NowPlayingScreenProps) {
  const c = useCopy();
  const { state, actions } = useStore();
  const dragControls = useDragControls();
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialog(dialogRef, onClose);
  usePlayerKeys();
  const [notesOpen, setNotesOpen] = useState(false);
  // With no voice for the target, the learner can still choose to read it.
  const [shownAnyway, setShownAnyway] = useState<string | null>(null);
  const clicks = useClickBlockerDuringDrag();

  const phrase = findPhrase(state.learner, currentPhraseId(state.player));
  if (!phrase) return null;
  const { status, phase, index, order, audioError } = state.player;
  const playing = status === 'playing';
  const cannotSay = audioError?.reason === 'no-voice' && audioError.lang === phrase.targetLang;
  const revealed = isTargetRevealed(state.player) || (cannotSay && shownAnyway === phrase.id);
  const prompt = promptOf(phrase, state.learner.profile.nativeLang);
  const targetName = languageName(phrase.targetLang, c.locale);
  const queueSet = findSetView(state.learner, state.player.setId);
  const coverSet = findSetView(state.learner, phrase.setId) ?? queueSet;
  // A review, the demo or a Library list played through: an end panel instead of the loop.
  const endedOnce = state.player.ended && playsOnce(state.player);
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

  // What a screen reader hears: every step (the learner's choice), or, by default, as
  // little as possible over the audio: a short "your turn" while the learner speaks, and
  // the phrase once it has been heard, in its own language, during the hold for a rating.
  const reveal = playing && quiet && phase === 'rate';
  const announcement = !playing
    ? ''
    : !quiet
      ? phaseInstruction(c, phase, prompt.lang, phrase.targetLang)
      : phase === 'pause'
        ? c.player.yourTurn
        : reveal
          ? phrase.target
          : '';

  return (
    <motion.div
      ref={dialogRef}
      role="dialog"
      data-player
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
      className="fixed inset-0 z-50 bg-surface flex flex-col pt-[env(safe-area-inset-top)]"
    >
      {/* The grab bar and the title drag the player closed; the buttons never start a drag. */}
      <div onPointerDown={startDrag} className="shrink-0 h-4 touch-none cursor-grab active:cursor-grabbing" aria-hidden="true">
        <div className="w-10 h-1 rounded-full bg-outline-variant mx-auto mt-2" />
      </div>
      {/* Same column as the body below, so the close button lines up with the content. */}
      <header className="shrink-0 flex items-center gap-1 px-2 min-h-12 py-0.5 max-w-lg lg:max-w-4xl phone-landscape:max-w-4xl w-full mx-auto">
        <HeaderButton label={c.player.close} icon="keyboard_arrow_down" onClick={onClose} />
        <div onPointerDown={startDrag} className="flex-1 min-w-0 self-stretch flex flex-col items-center justify-center touch-none">
          <h1
            lang={queueSet ? queueSet.targetLang : undefined}
            className="font-serif text-row font-semibold text-on-surface line-clamp-2 break-normal hyphens-auto text-center max-w-full leading-tight"
          >
            {/* The count is already in the position line below. */}
            {queueTitle(c, state.player, queueSet)}
          </h1>
          <p className="text-label text-secondary tabular-nums">
            {/* A set's own count, or the whole queue's once continue mode has added another set. */}
            {queueSet && order.some((id) => !queueSet.phraseIds.includes(id)) ? c.player.positionInQueue(index + 1, order.length) : c.player.position(index + 1, order.length)}
          </p>
        </div>
        <HeaderButton label={c.player.openQueue} icon="queue_music" onClick={onOpenQueue} />
      </header>

      {/* The stage scrolls when it doesn't fit (large text, a short phone); the dock never
          moves, so Pause and the grades are always on screen. Two columns in phone landscape
          (stage | dock) and from 1024 px (cover | phrase over dock). Once a queue has ended,
          the end panel sits right under the phrase and the two are centred together: a finish,
          not a card at the foot of an empty stage. */}
      <div
        className={`@container/player flex-1 min-h-0 w-full max-w-lg mx-auto flex flex-col phone-landscape:max-w-4xl phone-landscape:grid phone-landscape:grid-cols-2 phone-landscape:grid-rows-[minmax(0,1fr)] lg:max-w-4xl lg:grid lg:grid-cols-2 lg:gap-x-10 lg:px-5 lg:overflow-y-auto ${
          // Ended, it is one column that scrolls as a whole (large text), centred when it fits.
          endedOnce ? 'justify-center-safe overflow-y-auto lg:grid-rows-2' : 'lg:grid-rows-[minmax(0,1fr)_auto]'
        }`}
      >
        {/* When it scrolls, its last lines fade under the dock's edge, which says there's more. */}
        <div
          className={`${
            endedOnce ? 'flex-initial' : 'flex-1 min-h-0 overflow-y-auto [mask-image:linear-gradient(to_bottom,black_calc(100%-1.25rem),transparent)]'
          } scroll-pb-6 px-5 pt-1 pb-6 flex flex-col gap-3 short:gap-2 lg:contents`}
        >
          <motion.div
            drag="x"
            dragSnapToOrigin
            dragElastic={0.3}
            onDragStart={clicks.block}
            onDragEnd={onSwipe}
            className={`relative mx-auto w-full shrink-0 max-w-[min(100%,21dvh)] aspect-square ${ROOMY_ONLY} phone-landscape:hidden md:max-w-[min(100%,34dvh)] lg:max-w-[min(100%,52dvh)] lg:col-start-1 lg:row-span-2 lg:self-center touch-pan-y`}
          >
            {/* The phrase's own picture, on its set's colour; a phrase without one shows its set's cover. */}
            {phrase.image ? (
              <PhraseImage icons={phrase.image} tone={(coverSet?.topicId && getTopic(coverSet.topicId)?.tone) || 'secondary'} size="lg" className="w-full h-full rounded-3xl shadow-cover" />
            ) : (
              <SetCover set={coverSet ?? { topicId: null, coverIcon: 'edit_note' }} size="lg" className="w-full h-full rounded-3xl shadow-cover" />
            )}
            <span role="img" aria-label={languageLabel(phrase.targetLang, c.locale)} className="absolute bottom-3 left-3 w-9 h-9 rounded-full bg-surface/70 flex items-center justify-center text-icon-sm">
              {getLanguage(phrase.targetLang).flag}
            </span>
          </motion.div>

          <div className="flex flex-col gap-3 short:gap-2 min-w-0 lg:col-start-2 lg:row-start-1 lg:self-end lg:pt-4">
            {/* The target stays hidden until it is heard, so the learner recalls it first. */}
            <PhraseBlock phrase={phrase} revealed={revealed} />
            <ActionRow phrase={phrase} onNotes={() => setNotesOpen(true)} />

            {/* The loop: prompt → your turn → target, with real repetition and time */}
            <div className={`flex flex-col gap-1.5 ${endedOnce ? 'hidden' : ''}`}>
              <PlayTime phrase={phrase} />
              <Steps phrase={phrase} promptLang={prompt.lang} />
              {audioError ? (
                <div className="rounded-xl bg-error-container/60 text-on-error-container text-body p-3">
                  <p role="alert" className="flex gap-2">
                    <Icon name="volume_off" className="text-icon-md" />
                    <span>{audioError.reason === 'no-voice' ? c.player.audioError(languageName(audioError.lang, c.locale)) : c.player.audioSilent}</span>
                  </p>
                  {cannotSay && !revealed && (
                    <button type="button" onClick={() => setShownAnyway(phrase.id)} className="mt-1 ml-7 min-h-11 font-bold underline underline-offset-2">
                      {c.player.showText(targetName)}
                    </button>
                  )}
                </div>
              ) : (
                // What to do now is the headline; "how long" is the step's fill and the hold's bar.
                <p className="text-heading font-semibold text-on-surface">{playing ? phaseInstruction(c, phase, prompt.lang, phrase.targetLang) : c.player.paused}</p>
              )}
              <Coach />
              <p aria-live="polite" lang={reveal ? phrase.targetLang : undefined} className="sr-only">
                {announcement}
              </p>
            </div>
          </div>
        </div>

        <div className={`shrink-0 px-5 pt-2 pb-[max(env(safe-area-inset-bottom),0.75rem)] ${endedOnce ? '' : 'border-t border-hairline max-h-[60dvh] overflow-y-auto'} flex flex-col gap-2 phone-landscape:border-t-0 phone-landscape:self-center phone-landscape:max-h-full phone-landscape:py-2 lg:col-start-2 lg:row-start-2 lg:px-0 lg:border-t-0 lg:max-h-none lg:overflow-visible lg:pb-6`}>
          {endedOnce ? <EndPanel onClose={onClose} /> : <Rating phrase={phrase} />}
          {!endedOnce && <Transport />}
          {/* Speed: the only speed control in the app (a chip in the action row when compact). */}
          <div role="radiogroup" aria-label={c.player.speed} className={`grid grid-cols-3 gap-1 p-0.5 w-full max-w-[18rem] mx-auto bg-surface-container-low rounded-full ${ROOMY_ONLY} ${endedOnce ? '!hidden' : ''}`}>
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={state.prefs.speed === s}
                onClick={() => actions.setPrefs({ speed: s })}
                className={`min-h-11 rounded-full text-body tabular-nums ${
                  state.prefs.speed === s ? 'bg-surface-container-lowest text-on-surface font-bold shadow-card' : 'text-secondary font-medium'
                }`}
              >
                {s}×
              </button>
            ))}
          </div>
          {/* Only with a mouse or trackpad, where a keyboard is likely. */}
          <p className="hidden fine-pointer:block text-label text-secondary text-center">{c.player.keys}</p>
        </div>
      </div>

      <Sheet open={notesOpen} title={c.phrase.notesTitle} onClose={() => setNotesOpen(false)}>
        <PhraseNotesView phrase={phrase} prefix="player-notes" />
      </Sheet>
    </motion.div>
  );
}

function HeaderButton({ label, icon, onClick }: { label: string; icon: IconName; onClick: () => void }) {
  // Pixel sizes: an icon button doesn't grow with the text size, so at 200% the title keeps its room.
  return (
    <button type="button" aria-label={label} onClick={onClick} className="size-[44px] shrink-0 flex items-center justify-center rounded-full active:bg-surface-container">
      <Icon name={icon} className="text-[26px]" />
    </button>
  );
}

/**
 * While the learner recalls it, the prompt is the content and the target is a dashed slot as
 * wide as the phrase really is. Once heard, the target leads, glossed, over a quieter prompt.
 */
function PhraseBlock({ phrase, revealed }: { phrase: Phrase; revealed: boolean }) {
  const c = useCopy();
  const { state } = useStore();
  const prompt = promptOf(phrase, state.learner.profile.nativeLang);
  return (
    <div className="min-w-0">
      {revealed ? (
        <>
          <GlossedPhrase phrase={phrase} className="font-serif italic text-display-sm font-semibold text-on-surface leading-snug" />
          <p lang={prompt.lang} className="text-body text-secondary">{prompt.text}</p>
        </>
      ) : (
        <>
          <HiddenPhrase phrase={phrase} label={c.player.hidden(languageName(phrase.targetLang, c.locale))} className="font-serif italic text-display-sm font-semibold leading-snug" />
          <p lang={prompt.lang} className="mt-1 text-display-sm short:text-heading @max-[22rem]/player:text-heading font-semibold text-on-surface">{prompt.text}</p>
        </>
      )}
    </div>
  );
}

/** One row, the same at every size: the voice on the left; like, add to set, notes (and speed when compact) on the right. */
function ActionRow({ phrase, onNotes }: { phrase: Phrase; onNotes: () => void }) {
  const c = useCopy();
  const nav = useNav();
  const { state, actions } = useStore();
  const liked = isLiked(state.learner, 'phrase', phrase.id);
  const voice = phrase.audio ? null : voiceName(phrase.targetLang);
  return (
    <div className="flex flex-wrap items-center gap-y-1 min-h-11">
      <div className="flex-1 min-w-[5.5rem] flex">
        {voice && voicesFor(phrase.targetLang).length > 1 ? (
          // Where there's a choice, the voice line leads to Settings' voice picker.
          <button
            type="button"
            onClick={nav.openVoiceSettings}
            aria-label={c.player.changeVoice(voice)}
            className="min-h-11 min-w-0 max-w-full inline-flex items-center gap-0.5 text-label text-on-surface-variant"
          >
            {/* Only the words are dotted: an underline on the chevron's font draws a stray "····". */}
            <span className="truncate underline decoration-dotted decoration-outline underline-offset-2">{c.player.voice(voice)}</span>
            <Icon name="chevron_right" className="text-icon-xs shrink-0" />
          </button>
        ) : (
          voice && <p className="min-h-11 flex items-center min-w-0 text-label text-on-surface-variant"><span className="truncate">{c.player.voice(voice)}</span></p>
        )}
      </div>
      <div className="ml-auto flex items-center shrink-0">
        <SpeedChip className={COMPACT_ONLY} />
        <button
          type="button"
          // One name; the pressed state says whether it's liked.
          aria-label={c.phrase.likeLabel}
          aria-pressed={liked}
          onClick={() => actions.toggleLike('phrase', phrase.id)}
          className={`size-[44px] flex items-center justify-center rounded-full active:bg-primary-fixed/40 ${liked ? 'text-primary-container' : 'text-secondary'}`}
        >
          <Icon name="favorite" fill={liked} className="text-[24px]" />
        </button>
        <button
          type="button"
          aria-label={c.phrase.addToSet}
          onClick={() => nav.addToSet([phrase.id])}
          className="size-[44px] flex items-center justify-center rounded-full text-secondary active:bg-surface-container"
        >
          <Icon name="playlist_add" className="text-[24px]" />
        </button>
        {phrase.notes && (
          <button
            type="button"
            aria-label={c.phrase.notesTitle}
            onClick={onNotes}
            className="size-[44px] flex items-center justify-center rounded-full text-secondary active:bg-surface-container"
          >
            <Icon name="lightbulb" className="text-[24px]" />
          </button>
        )}
      </div>
    </div>
  );
}

/** Speed as one chip that cycles 1× → 1.25× → 0.8×: where there's no room for the segmented row. */
function SpeedChip({ className }: { className: string }) {
  const c = useCopy();
  const { state, actions } = useStore();
  const { toast } = useToast();
  const speed = state.prefs.speed;
  const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
  return (
    <button
      type="button"
      aria-label={c.player.speedIs(speed)}
      onClick={() => {
        actions.setPrefs({ speed: next });
        toast(c.player.speedIs(next));
      }}
      className={`${className} min-w-[44px] h-[44px] items-center justify-center rounded-full`}
    >
      <span className="min-w-12 px-2 py-1 rounded-full bg-surface-container-high text-body font-semibold tabular-nums text-center">{speed}×</span>
    </button>
  );
}

/**
 * The three steps. The current one is filled while it plays; the learner's turn fills
 * left to right over its real length, so a glance says how long is left to speak.
 */
function Steps({ phrase, promptLang }: { phrase: Phrase; promptLang: Phrase['targetLang'] }) {
  const c = useCopy();
  const { state } = useStore();
  const { phase, status } = state.player;
  const playing = status === 'playing';
  return (
    // At large text the three pills are too narrow for icon and label side by side: all
    // three stack the icon above the label together, so the row stays even.
    <ol className="@container grid grid-cols-3 gap-1.5" aria-label={c.player.steps}>
      {STEPS.map((p) => {
        const current = p === phase;
        const done = phase === 'rate' || STEPS.indexOf(p) < STEPS.indexOf(phase as Exclude<Phase, 'rate'>);
        return (
          <li
            key={p}
            aria-current={current ? 'step' : undefined}
            className={`relative isolate overflow-hidden min-h-11 px-1 rounded-xl flex items-center justify-center gap-x-1.5 @max-[21rem]:flex-col @max-[21rem]:gap-0 @max-[21rem]:py-1 text-center leading-tight text-label font-semibold border ${
              current && playing
                ? 'bg-primary-container text-on-primary border-primary-container'
                : current
                  ? 'bg-primary-fixed text-on-primary-fixed border-primary-container border-dashed'
                  : done
                    ? 'bg-primary-fixed/50 text-on-primary-fixed-variant border-transparent'
                    : 'bg-surface-container-low text-secondary border-hairline'
            }`}
          >
            {current && p === 'pause' && <PhaseFill className="-z-10 inset-0 bg-primary" />}
            <Icon name={current && !playing ? 'pause' : PHASE_ICONS[p]} className="text-icon-sm" />
            {phaseStepLabel(c, p, promptLang, phrase.targetLang)}
          </li>
        );
      })}
    </ol>
  );
}

/** For a learner's first phrases: the method in one line, while it's their turn. */
function Coach() {
  const c = useCopy();
  const { state } = useStore();
  const now = useNow(60_000);
  const { phase, status } = state.player;
  if (status !== 'playing' || phase !== 'pause' || learnerStats(state.learner, now).started >= 3) return null;
  return <p className="text-body text-secondary">{c.player.coach}</p>;
}

/**
 * Repetition, elapsed listening time, and the full play at 1× once measured (with the
 * rating hold while the phrase is unrated). The elapsed time runs at the current speed, so
 * the 1× total sits beside it only at 1×, and not once the play has run past it.
 * Re-renders on its own clock.
 */
function PlayTime({ phrase }: { phrase: Phrase }) {
  const c = useCopy();
  const { state } = useStore();
  const now = useNow(250);
  const elapsed = listenedMs(state.player, now);
  const full = state.prefs.speed === 1 ? phraseFullPlayMs(state, phrase, state.player.repeats) : null;
  const total = full !== null && elapsed <= full ? full : null;
  return (
    <p className="text-label text-secondary tabular-nums text-right">
      {c.player.repetition(state.player.repetition, state.player.repeats)} · {formatElapsed(elapsed)}
      {total !== null && ` / ${c.common.fullPlay(formatElapsed(total))}`}
    </p>
  );
}

/**
 * Three grades, never preselected, under one status line. A rating can be changed or undone
 * for five minutes, then it counts. In the hold (the moment to rate) the block is outlined
 * and a bar runs down over the time left.
 */
function Rating({ phrase }: { phrase: Phrase }) {
  const c = useCopy();
  const { state, actions } = useStore();
  const now = useNow(1000);
  const pending = pendingFor(state, phrase.id);
  // `now` can trail the rating by up to a second: never show more than the five minutes.
  const left = pending ? Math.min(RATING_WINDOW_MS, windowLeft(pending, Math.max(now, pending.at))) : 0;
  const active = pending && left > 0 ? pending : undefined;
  // Each grade's return: a change keeps the rating's own time, and all of them count from now.
  const from = active ? Math.max(now, active.at) : now;
  const dueOf = (grade: Grade) => previewDue(state.learner, phrase.id, grade, active?.at ?? now, active?.day);
  const hold = state.player.phase === 'rate' && state.player.status === 'playing';
  // Grades are always there, but asking whether you remembered it before your first turn at it
  // (in this play) makes no sense.
  const beforeTurn = state.player.repetition === 1 && (state.player.phase === 'native' || state.player.phase === 'pause');

  // Said once by useRate, not from a live region whose "back in N minutes" would
  // re-announce every minute of the undo window.
  const rate = useRate();

  return (
    <div className={`relative rounded-3xl px-1.5 pb-2.5 ring-2 transition-colors ${hold ? 'bg-primary-fixed/40 ring-primary-container' : 'ring-transparent'}`}>
      <div className="min-h-11 flex items-center justify-center gap-x-2 text-center text-body leading-snug">
        {active ? (
          // One row whatever the language: the words wrap beside Undo rather than push it below.
          <>
            <span className="flex-1 min-w-0 pl-1.5 text-left text-on-surface short:text-label @max-[22rem]/player:text-label">
              {c.player.rated(c.common.grade[active.grade], backIn(c, dueOf(active.grade), from))}
              {upNextIds(state.player).includes(phrase.id) && ` ${c.player.requeued}`}
            </span>
            <button
              type="button"
              aria-label={c.player.undoLabel(formatElapsed(left))}
              onClick={() => actions.unrate()}
              className="shrink-0 min-h-11 px-2 rounded-full font-bold text-primary-container underline underline-offset-2 tabular-nums whitespace-nowrap"
            >
              {c.player.undoFor(formatElapsed(left))}
            </button>
          </>
        ) : (
          <span className={`text-pretty ${hold ? 'font-bold text-on-surface' : 'text-secondary'}`}>{beforeTurn ? c.player.rateAfterTurn : c.player.howDidItGo}</span>
        )}
      </div>
      <div className="@container grid grid-cols-3 gap-2">
        {GRADES.map(({ grade, icon, tone }, i) => {
          const selected = active?.grade === grade;
          return (
            <button
              key={grade}
              type="button"
              aria-pressed={selected}
              aria-keyshortcuts={String(i + 1)}
              onClick={() => rate(grade)}
              className={`min-h-14 px-1 py-1 rounded-2xl flex flex-col items-center justify-center leading-tight active:opacity-80 ${tone} ${
                selected ? 'ring-2 ring-on-surface ring-offset-2 ring-offset-surface font-bold' : 'font-semibold'
              }`}
            >
              {/* A narrow row (large text) drops the icon and steps the label down, so "Missed" stays whole. */}
              <span className="flex items-center gap-1 text-body @max-[15rem]:text-label break-normal hyphens-auto">
                <Icon name={selected ? 'task_alt' : icon} className="text-icon-sm @max-[17.5rem]:hidden" />
                {c.common.grade[grade]}
              </span>
              <span className="text-caption opacity-80 tabular-nums">{backIn(c, dueOf(grade), from)}</span>
            </button>
          );
        })}
      </div>
      {hold && <PhaseFill deplete className="left-4 right-4 bottom-1 h-1 rounded-full bg-primary-container" />}
    </div>
  );
}

/**
 * Where a queue with a natural end stops (in either play mode): a review says it's done and
 * when the next one is; the demo hands over to a whole set; a Library list can play again.
 * Every figure is the session's own (sessionSummary), with this session's ratings counted.
 */
function EndPanel({ onClose }: { onClose: () => void }) {
  const c = useCopy();
  const nav = useNav();
  const { state, actions } = useStore();
  const { announce } = useToast();
  const now = useNow(30_000);
  const heading = useRef<HTMLHeadingElement>(null);
  const source = state.player.source;
  const summary = sessionSummary(state, now);
  const rated = summary ? summary.ratings.missed + summary.ratings.hard + summary.ratings.easy : 0;
  // As Home offers it: this review's ratings, still in their undo window, already count.
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
  const title = endTitle(c, source, rated);
  const body = demo ? c.player.end.demoBody : `${c.player.end.rated(rated)} · ${next}`;
  const startSuggested = () => {
    if (!suggested) return;
    // Its phrases still worth playing (all of them for a new learner), with the player left open.
    const ids = playableIds(learner, suggested.phraseIds, now);
    nav.playSet(suggested.id, { phraseIds: ids.length > 0 ? ids : suggested.phraseIds });
  };

  // The transport has just gone: keep keyboard focus in the player, on the panel, and say it.
  useEffect(() => {
    const active = document.activeElement;
    if (!active || active === document.body || !active.isConnected) heading.current?.focus({ preventScroll: true });
    announce(`${title}. ${body}`);
    // Once, when the queue ends.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section aria-labelledby="end-panel-title" className="rounded-3xl bg-surface-container-low px-4 py-4 flex flex-col items-center gap-3 text-center">
      <div>
        <h2 id="end-panel-title" ref={heading} tabIndex={-1} className="font-serif text-heading font-semibold text-on-surface">
          {title}
        </h2>
        <p className="text-body text-secondary mt-1 text-pretty">{body}</p>
      </div>
      <div className="w-full max-w-[20rem] flex flex-col gap-2">
        {source?.kind === 'library' ? (
          <button type="button" onClick={() => actions.jump(0, true)} className={PANEL_PRIMARY}>
            <Icon name="replay" className="text-icon" />
            {c.player.end.playAgain}
          </button>
        ) : (
          suggested && (
            <button type="button" onClick={startSuggested} className={PANEL_PRIMARY}>
              <Icon name="play_arrow" fill className="text-icon" />
              {demo || setProgress(learner, suggested.phraseIds, now).started === 0 ? c.player.end.startSet(suggested.title) : c.player.end.continueSet(suggested.title)}
            </button>
          )
        )}
        <button type="button" onClick={onClose} className={btnText}>
          {demo ? c.player.end.notNow : c.common.close}
        </button>
      </div>
    </section>
  );
}

/** Play mode, previous, play/pause, next, repetitions: fixed pixel sizes, so large text doesn't squash them. */
function Transport() {
  const c = useCopy();
  const { state, actions } = useStore();
  const playing = state.player.status === 'playing';
  return (
    <div className="@container/transport flex items-center justify-between">
      <PlayModeButton />
      <button type="button" aria-label={c.player.previous} aria-keyshortcuts="ArrowLeft" onClick={actions.prev} className="size-[48px] flex items-center justify-center rounded-full active:bg-surface-container">
        <Icon name="skip_previous" fill className="text-[34px]" />
      </button>
      <button
        type="button"
        aria-label={playing ? c.common.pause : c.common.play}
        aria-keyshortcuts="Space"
        onClick={playing ? actions.pause : actions.play}
        className="size-[64px] shrink-0 rounded-full bg-primary-container text-on-primary flex items-center justify-center shadow-float active:scale-95 transition-transform"
      >
        <Icon name={playing ? 'pause' : 'play_arrow'} fill className="text-[40px]" />
      </button>
      <button type="button" aria-label={c.player.next} aria-keyshortcuts="ArrowRight" onClick={actions.next} className="size-[48px] flex items-center justify-center rounded-full active:bg-surface-container">
        <Icon name="skip_next" fill className="text-[34px]" />
      </button>
      <RepeatsButton />
    </div>
  );
}

/**
 * A setting in the transport: its glyph, and a word under it saying what it is set to. The word
 * goes (it stays in the name) where the row is too narrow for it, i.e. at large text.
 */
function SettingButton({ label, caption, onClick, children }: { label: string; caption: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="size-[56px] shrink-0 flex flex-col items-center justify-center gap-0.5 rounded-2xl text-primary-container active:bg-surface-container"
    >
      {children}
      <span aria-hidden="true" className="text-caption font-semibold leading-none whitespace-nowrap @max-[15rem]/transport:sr-only">
        {caption}
      </span>
    </button>
  );
}

function PlayModeButton() {
  const c = useCopy();
  const { state, actions } = useStore();
  const { toast } = useToast();
  const mode = state.prefs.playMode;
  return (
    <SettingButton
      label={c.player.playMode[mode]}
      caption={mode === 'repeat' ? c.player.captions.again : c.player.captions.continue}
      onClick={() => {
        const next = mode === 'repeat' ? 'continue' : 'repeat';
        actions.setPrefs({ playMode: next });
        // Shown and said: the glyph alone doesn't say what changed.
        toast(c.player.playModeToast[next]);
      }}
    >
      <Icon name={mode === 'repeat' ? 'repeat' : 'playlist_play'} className="text-[26px]" />
    </SettingButton>
  );
}

function RepeatsButton() {
  const c = useCopy();
  const { state, actions } = useStore();
  const { toast } = useToast();
  const setting = state.prefs.repeats;
  const label = setting === 'auto' ? c.player.repeats.auto : setting === 1 ? c.player.repeats.one : c.player.repeats.three;
  const next = REPEAT_SETTINGS[(REPEAT_SETTINGS.indexOf(setting) + 1) % REPEAT_SETTINGS.length];
  return (
    <SettingButton
      label={label}
      caption={c.player.captions.reps}
      onClick={() => {
        actions.setPrefs({ repeats: next });
        toast(next === 'auto' ? c.player.repeatsToast.auto : next === 1 ? c.player.repeatsToast.one : c.player.repeatsToast.three);
      }}
    >
      {/* A count, not a speed: no "×" beside the speed control's "1×". */}
      <span aria-hidden="true" className="min-w-[40px] h-[26px] px-1.5 rounded-lg border-2 border-primary-container text-[12px] font-black flex items-center justify-center tabular-nums">
        {setting === 'auto' ? c.player.captions.auto : setting}
      </span>
    </SettingButton>
  );
}
