// "Make a set" (plan 103): the learner says what they want to talk about (a topic, a few keywords or
// a text), gets a deck of suggested phrases, and decides one card at a time: swipe right (or Add, or
// →) to add it, left (or Skip, or ←) to skip it. What they added becomes a set of their own, or
// joins the set they came from. Nothing is added without a decision, and a card says where its
// phrase came from, AI included.
import { motion } from 'motion/react';
import { FormEvent, KeyboardEvent as ReactKeyboardEvent, RefObject, useEffect, useId, useRef, useState } from 'react';
import { canSpeak, speak } from '../audio/speech';
import { languageName } from '../copy';
import { BANK_THEMES } from '../content';
import { added, currentCard, deal, dealt, decide, edit, lastDecision, newDeck, nextCard, picksOf, unadd, undo } from '../generate/deck';
import { defaultTitle, MakeRequest, MakeSession } from '../generate/session';

export type { MakeRequest, MakeSession } from '../generate/session';
import { liveAvailable } from '../generate/remote';
import { suggest } from '../generate/suggest';
import { INPUT_LIMITS, SUGGEST_MODES, SuggestMode, SuggestRequest, Suggestion } from '../generate/types';
import { useDialog } from '../lib/useDialog';
import { useLatest } from '../lib/useLatest';
import { useNav } from '../nav/NavContext';
import { findPhrase, findSetView, ownSets, sameKey } from '../state/catalog';
import { clip, LIMITS, tidy } from '../state/limits';
import { useCopy, useStore } from '../state/store';
import { CharCount } from '../ui/CharCount';
import { Chip } from '../ui/Chip';
import { Icon, IconName } from '../ui/Icon';
import { PhraseImage } from '../ui/PhraseImage';
import { SwipeDeck, SwipeTravel } from '../ui/SwipeDeck';
import { useToast } from '../ui/Toast';
import { btnIcon, btnPrimary, btnText, btnTonal } from '../ui/button';
import { fieldClass } from '../ui/field';

/** A card takes most of a tall phone, as a card to decide should; large text grows it further. */
const CARD_HEIGHT = 'min-h-[min(24rem,52dvh)]';

const SOURCE_ICONS: Record<Suggestion['source'], IconName> = { course: 'menu_book', mine: 'person', bank: 'library_music', ai: 'auto_awesome' };

export function MakeSetScreen({
  request,
  session: sessionRef,
  onClose,
  onSaved,
}: {
  request: MakeRequest;
  /** Where the shell reads the flow as it stands when it closes (to offer it back). */
  session: RefObject<MakeSession | null>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const c = useCopy();
  const nav = useNav();
  const { toast, announce } = useToast();
  const { state, actions } = useStore();
  const { learner } = state;
  const { nativeLang, targetLang } = learner.profile;
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialog(dialogRef, onClose);

  const [session, setSession] = useState<MakeSession>(
    () =>
      request.resume ?? {
        setId: request.setId ?? null,
        mode: 'topic',
        texts: { topic: clip(tidy(request.input ?? ''), INPUT_LIMITS.topic), keywords: '', text: '' },
        asked: null,
        deck: null,
        writer: 'device',
        fellBack: false,
        exhausted: false,
        step: 'ask',
        title: '',
        nothingFor: null,
      },
  );
  useEffect(() => {
    sessionRef.current = session;
  }, [session, sessionRef]);
  const update = (patch: Partial<MakeSession>) => setSession((s) => ({ ...s, ...patch }));

  const into = session.setId ? findSetView(learner, session.setId) : undefined;
  const [live, setLive] = useState<boolean | null>(null);
  useEffect(() => {
    let on = true;
    void liveAvailable().then((value) => on && setLive(value));
    return () => {
      on = false;
    };
  }, []);

  // Which way the last card left, or where a card taken back comes from.
  const [travel, setTravel] = useState<SwipeTravel>({ direction: 1, returning: false });

  // One request at a time: a newer one (or closing) cancels the one in flight, so a late answer
  // never replaces a newer deck.
  const [pending, setPending] = useState<AbortController | null>(null);
  const inFlight = useRef<AbortController | null>(null);
  useEffect(() => () => inFlight.current?.abort(), []);

  const ask = async (asked: SuggestRequest, more: boolean) => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    const inSet = (into?.phraseIds ?? []).map((id) => findPhrase(learner, id)?.target ?? '').filter(Boolean);
    const seen = session.deck ? dealt(session.deck) : { keys: new Set<string>(), texts: [] };
    try {
      // Asked once per page, so this answers at once after the first time.
      const isLive = await liveAvailable();
      if (controller.signal.aborted) return;
      setPending(controller);
      const result = await suggest(learner, asked, {
        live: isLive,
        exclude: new Set([...seen.keys, ...inSet.map(sameKey)]),
        avoid: [...inSet, ...seen.texts],
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setTravel({ direction: 1, returning: false });
      setSession((s) => {
        const deck = s.deck ? deal(s.deck, result.suggestions) : result.suggestions.length > 0 ? newDeck(result.suggestions) : null;
        if (!deck || deck === s.deck) return more ? { ...s, exhausted: true } : { ...s, nothingFor: asked.input };
        return {
          ...s,
          deck,
          asked,
          writer: result.writer,
          fellBack: result.fellBack,
          exhausted: false,
          nothingFor: null,
          step: 'deck',
          title: s.title || defaultTitle(c, asked),
        };
      });
    } catch {
      // Cancelled: replaced by a newer request, or the flow closed.
    } finally {
      if (inFlight.current === controller) inFlight.current = null;
      setPending((p) => (p === controller ? null : p));
    }
  };

  const askFor = (mode: SuggestMode, input: string) => {
    if (tidy(input).length < 2) return;
    void ask({ mode, input: tidy(input), targetLang, nativeLang }, false);
  };

  // Opened from a search ("Suggest phrases about …"): the learner has said what they want. A
  // remount (React's development rehearsal) cancels the first request and asks again.
  const askLatest = useLatest(askFor);
  const startWith = request.resume ? undefined : request.input;
  useEffect(() => {
    if (!startWith) return;
    askLatest.current('topic', startWith);
    return () => inFlight.current?.abort();
  }, [startWith, askLatest]);

  const keptCount = session.deck ? added(session.deck).length : 0;

  const save = (title: string) => {
    const deck = session.deck;
    if (!deck) return;
    const kept = added(deck);
    if (kept.length === 0) return;
    const picks = picksOf(kept);
    if (into) {
      actions.savePicks(picks, { setId: into.id });
      toast(c.make.addedInto(kept.length, into.title));
      onSaved();
      return;
    }
    const clean = tidy(title);
    if (!clean) return;
    const id = actions.savePicks(picks, { title: clean });
    toast(c.createSet.created(clean));
    nav.openSet(id);
    onSaved();
  };

  return (
    <motion.div
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="make-title"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed inset-0 z-50 bg-surface flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
    >
      <header className="shrink-0 flex items-center gap-2 px-2 h-14 border-b border-surface-container-high max-w-lg w-full mx-auto">
        <button type="button" aria-label={c.common.close} onClick={onClose} className={`${btnIcon} text-on-surface`}>
          <Icon name="close" className="text-icon-lg" />
        </button>
        <h1 id="make-title" className="flex-1 min-w-0 text-center font-serif text-title font-semibold truncate">
          {into ? c.make.into(into.title) : c.make.title}
        </h1>
        {session.step === 'deck' && keptCount > 0 ? (
          <button type="button" onClick={() => update({ step: 'save' })} className={`${btnText} shrink-0`}>
            {c.make.done}
          </button>
        ) : (
          <span aria-hidden="true" className="w-11 shrink-0" />
        )}
      </header>

      {/* A card dragged off the side doesn't widen the page. */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="max-w-lg mx-auto px-4 py-4 flex flex-col gap-4">
          {session.step === 'ask' && (
            <AskStep
              session={session}
              live={live}
              pending={pending}
              onChange={update}
              onAsk={askFor}
              onBackToDeck={keptCount > 0 ? () => update({ step: 'deck' }) : undefined}
            />
          )}
          {session.step === 'deck' && session.deck && (
            <DeckStep
              session={session}
              travel={travel}
              pending={pending !== null}
              onDecide={(add) => {
                const card = session.deck && currentCard(session.deck);
                if (!card) return;
                setTravel({ direction: add ? 1 : -1, returning: false });
                setSession((s) => ({ ...s, deck: s.deck && decide(s.deck, add) }));
                announce(add ? c.make.announceAdded(card.target) : c.make.announceSkipped(card.target));
              }}
              onUndo={() => {
                const last = session.deck && lastDecision(session.deck);
                if (!last) return;
                setTravel({ direction: last.added ? 1 : -1, returning: true });
                setSession((s) => ({ ...s, deck: s.deck && undo(s.deck) }));
                announce(c.make.undoLabel(last.card.target));
              }}
              onEdit={(key, target, native) => setSession((s) => ({ ...s, deck: s.deck && edit(s.deck, key, target, native) }))}
              onMore={() => session.asked && void ask(session.asked, true)}
              onAnother={() => update({ step: 'ask', nothingFor: null })}
              onSave={() => update({ step: 'save' })}
              dialog={dialogRef}
            />
          )}
          {session.step === 'save' && session.deck && (
            <SaveStep
              session={session}
              into={into?.title}
              onTitle={(title) => update({ title })}
              onRemove={(key) => setSession((s) => ({ ...s, deck: s.deck && unadd(s.deck, key) }))}
              onBack={() => update({ step: 'deck' })}
              onSave={save}
            />
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ---------- asking ----------

function AskStep({
  session,
  live,
  pending,
  onChange,
  onAsk,
  onBackToDeck,
}: {
  session: MakeSession;
  live: boolean | null;
  pending: AbortController | null;
  onChange: (patch: Partial<MakeSession>) => void;
  onAsk: (mode: SuggestMode, input: string) => void;
  onBackToDeck?: () => void;
}) {
  const c = useCopy();
  const nav = useNav();
  const { state } = useStore();
  const locale = c.locale.slice(0, 2) as 'en' | 'bg' | 'ru';
  const { mode, texts } = session;
  const text = texts[mode];
  const setText = (value: string) => onChange({ texts: { ...texts, [mode]: value }, nothingFor: null });
  const hintId = useId();
  const countId = useId();
  const field = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const hint =
    mode === 'text' ? c.make.hintText(languageName(state.learner.profile.targetLang, c.locale)) : mode === 'keywords' ? c.make.hintKeywords : c.make.hintTopic;
  const ready = tidy(text).length >= 2 && !pending;
  const fieldProps = {
    ref: field,
    value: text,
    onChange: (e: { target: { value: string } }) => setText(e.target.value),
    maxLength: INPUT_LIMITS[mode],
    placeholder: c.make.placeholder[mode],
    'aria-describedby': `${hintId} ${countId}`,
    autoComplete: 'off',
    disabled: pending !== null,
  };

  return (
    <form
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        if (ready) onAsk(mode, text);
      }}
      className="flex flex-col gap-4"
    >
      <p className="text-body text-secondary">{c.make.intro}</p>
      <div role="group" aria-label={c.make.modesLabel} className="grid grid-cols-3 gap-1 p-1 bg-surface-container-low rounded-full">
        {SUGGEST_MODES.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => {
              onChange({ mode: m, nothingFor: null });
              requestAnimationFrame(() => field.current?.focus());
            }}
            className={`min-h-11 px-1 rounded-full text-body [overflow-wrap:anywhere] ${mode === m ? 'bg-surface-container-lowest font-bold shadow-card' : 'text-secondary font-medium'}`}
          >
            {c.make.modes[m]}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        <label className="flex flex-col gap-1">
          <span className="text-body font-semibold">{c.make.field[mode]}</span>
          {mode === 'text' ? (
            <textarea {...fieldProps} rows={6} className={`${fieldClass} py-3 resize-y`} />
          ) : (
            <input {...fieldProps} type="text" enterKeyHint="go" className={fieldClass} />
          )}
        </label>
        <div className="flex items-start justify-between gap-3">
          <p id={hintId} className="text-label text-secondary">
            {hint}
          </p>
          <CharCount id={countId} value={text} max={INPUT_LIMITS[mode]} />
        </div>
      </div>

      {session.nothingFor !== null && (
        <div role="status" className="rounded-2xl bg-surface-container-low p-4 flex flex-col items-start gap-2">
          <p className="text-body font-semibold">{c.make.none(session.nothingFor)}</p>
          <p className="text-body text-secondary">{c.make.noneHint}</p>
          <button type="button" onClick={() => nav.addPhrase()} className={btnTonal}>
            <Icon name="add" className="text-icon-md" />
            {c.make.writeOwn}
          </button>
        </div>
      )}

      <button type="submit" disabled={!ready} className={btnPrimary}>
        <Icon name={pending ? 'hourglass_empty' : 'auto_awesome'} className={`text-icon-md ${pending ? 'motion-safe:animate-pulse' : ''}`} />
        {pending ? c.make.writing : c.make.suggest}
      </button>
      {pending && (
        <button type="button" onClick={() => pending.abort()} className={`${btnText} self-center -mt-2`}>
          {c.common.cancel}
        </button>
      )}

      {mode === 'topic' && (
        <section aria-labelledby="make-topics" className="flex flex-col gap-1">
          <h2 id="make-topics" className="text-label font-semibold text-secondary">
            {c.make.tryTopics}
          </h2>
          <div className="scroll-row flex gap-x-2 overflow-x-auto -mx-4 px-4">
            {BANK_THEMES.map((theme) => (
              <Chip
                key={theme.id}
                action
                disabled={pending !== null}
                onClick={() => {
                  onChange({ texts: { ...texts, topic: theme.title[locale] }, nothingFor: null });
                  onAsk('topic', theme.title[locale]);
                }}
              >
                {theme.title[locale]}
              </Chip>
            ))}
          </div>
        </section>
      )}

      {live !== null && (
        <p className="text-label text-secondary flex items-start gap-1.5">
          <Icon name={live ? 'auto_awesome' : 'library_music'} className="text-icon-sm shrink-0" />
          {live ? c.make.byAi : c.make.byDevice}
        </p>
      )}

      {onBackToDeck && (
        <button type="button" onClick={onBackToDeck} className={`${btnText} self-start`}>
          <Icon name="arrow_back" className="text-icon-md" />
          {c.make.backToDeck}
        </button>
      )}
    </form>
  );
}

// ---------- deciding ----------

function DeckStep({
  session,
  travel,
  pending,
  onDecide,
  onUndo,
  onEdit,
  onMore,
  onAnother,
  onSave,
  dialog,
}: {
  session: MakeSession;
  travel: SwipeTravel;
  pending: boolean;
  onDecide: (add: boolean) => void;
  onUndo: () => void;
  onEdit: (key: string, target: string, native: string) => void;
  onMore: () => void;
  onAnother: () => void;
  onSave: () => void;
  dialog: RefObject<HTMLDivElement | null>;
}) {
  const c = useCopy();
  const deck = session.deck!;
  const card = currentCard(deck);
  const next = nextCard(deck);
  const last = lastDecision(deck);
  const count = added(deck).length;
  const total = deck.cards.length;
  const position = Math.min(deck.decisions.length + 1, total);
  const [editing, setEditing] = useState<string | null>(null);
  const isEditing = editing !== null && editing === card?.key;
  const addButton = useRef<HTMLButtonElement>(null);
  const endTitle = useRef<HTMLHeadingElement>(null);

  // The deck opens on its Add button, so a keyboard or screen reader starts on the first phrase.
  useEffect(() => {
    addButton.current?.focus({ preventScroll: true });
  }, []);
  // The last decision takes the buttons away: focus goes to what follows.
  const ended = card === null;
  useEffect(() => {
    if (ended) endTitle.current?.focus({ preventScroll: true });
  }, [ended]);

  // → adds, ← skips, Ctrl/⌘-Z takes the last decision back; not while typing a correction.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && target !== document.body && !dialog.current?.contains(target)) return;
      if (target?.closest('input, textarea, select') || isEditing) return;
      if (event.key === 'ArrowRight' && card) {
        event.preventDefault();
        onDecide(true);
      } else if (event.key === 'ArrowLeft' && card) {
        event.preventDefault();
        onDecide(false);
      } else if ((event.key === 'z' || event.key === 'Z') && (event.metaKey || event.ctrlKey) && last) {
        event.preventDefault();
        onUndo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-center justify-between gap-3 text-label font-semibold text-secondary tabular-nums">
        <span>{c.make.progress(position, total)}</span>
        <span>{c.make.addedCount(count)}</span>
      </p>
      {session.fellBack && (
        <p role="status" className="text-label text-secondary rounded-xl bg-surface-container-low px-3 py-2">
          {c.make.fellBack}
        </p>
      )}

      {card ? (
        <>
          <SwipeDeck
            top={{
              key: card.key,
              node: isEditing ? (
                <EditFace card={card} onDone={(text) => {
                  if (text) onEdit(card.key, text.target, text.native);
                  setEditing(null);
                }} />
              ) : (
                <CardFace card={card} position={position} total={total} onEdit={() => setEditing(card.key)} />
              ),
            }}
            under={next ? { key: next.key, node: <CardFace card={next} position={position + 1} total={total} /> } : null}
            travel={travel}
            stamps={{ yes: c.make.add, no: c.make.skip }}
            onSwipe={(direction) => onDecide(direction === 1)}
            disabled={isEditing}
          />
          <div className="flex items-start justify-center gap-5 pt-2">
            <DecisionButton icon="close" label={c.make.skip} name={c.make.skipLabel(card.target)} tone="skip" onClick={() => onDecide(false)} disabled={isEditing} />
            <DecisionButton
              icon="undo"
              label={c.common.undo}
              name={last ? c.make.undoLabel(last.card.target) : c.common.undo}
              tone="undo"
              onClick={onUndo}
              disabled={!last || isEditing}
            />
            <DecisionButton ref={addButton} icon="check" label={c.make.add} name={c.make.addLabel(card.target)} tone="add" onClick={() => onDecide(true)} disabled={isEditing} />
          </div>
          <p className="text-label text-secondary text-center">
            {c.make.swipeHint} <span className="hidden fine-pointer:inline">{c.make.keysHint}</span>
          </p>
        </>
      ) : (
        <section aria-labelledby="make-end" className="rounded-3xl bg-surface-container-low p-6 flex flex-col items-center text-center gap-3">
          <Icon name="task_alt" className="text-icon-3xl text-tertiary-container" />
          <h2 id="make-end" ref={endTitle} tabIndex={-1} className="font-serif text-heading font-semibold text-balance">
            {c.make.endTitle(total)}
          </h2>
          <p className="text-body text-secondary">{c.make.endAdded(count)}</p>
          {count > 0 && (
            <button type="button" onClick={onSave} className={`${btnPrimary} w-full`}>
              {c.make.review(count)}
            </button>
          )}
          {session.exhausted ? (
            <p role="status" className="text-body text-secondary">
              {c.make.noMore}
            </p>
          ) : (
            <button type="button" onClick={onMore} disabled={pending} className={`${btnTonal} w-full`}>
              <Icon name={pending ? 'hourglass_empty' : 'auto_awesome'} className={`text-icon-md ${pending ? 'motion-safe:animate-pulse' : ''}`} />
              {pending ? c.make.writing : c.make.more}
            </button>
          )}
          <div className="flex flex-wrap justify-center gap-x-2">
            {last && (
              <button type="button" onClick={onUndo} className={btnText}>
                <Icon name="undo" className="text-icon-md" />
                {c.common.undo}
              </button>
            )}
            <button type="button" onClick={onAnother} className={btnText}>
              {c.make.another}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

const DECISION_TONE = {
  add: 'size-16 bg-primary-container text-on-primary shadow-float',
  skip: 'size-16 bg-surface-container-lowest text-on-surface shadow-cover',
  undo: 'size-12 mt-2 bg-surface-container-low text-secondary',
} as const;

/** A round decision button with its word under it; its name carries the phrase it decides. */
function DecisionButton({
  ref,
  icon,
  label,
  name,
  tone,
  onClick,
  disabled,
}: {
  ref?: RefObject<HTMLButtonElement | null>;
  icon: IconName;
  label: string;
  name: string;
  tone: keyof typeof DECISION_TONE;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button ref={ref} type="button" aria-label={name} onClick={onClick} disabled={disabled} className="group min-w-16 flex flex-col items-center gap-1 rounded-2xl disabled:opacity-40">
      <span className={`${DECISION_TONE[tone]} rounded-full flex items-center justify-center group-active:scale-95 transition-transform forced-colors:border-2`}>
        <Icon name={icon} className={tone === 'undo' ? 'text-icon-md' : 'text-icon-2xl'} />
      </span>
      <span className="text-label font-semibold text-on-surface">{label}</span>
    </button>
  );
}

/** A suggestion's face: where it came from, the phrase, its meaning, and Listen and Correct. */
function CardFace({ card, position, total, onEdit }: { card: Suggestion; position: number; total: number; onEdit?: () => void }) {
  const c = useCopy();
  const { state, actions } = useStore();
  const { nativeLang, targetLang } = state.learner.profile;
  const playback = useRef<{ cancel: () => void } | null>(null);
  useEffect(() => () => playback.current?.cancel(), []);
  const source = card.source === 'course' ? c.make.source.course(card.setTitle ?? '') : c.make.source[card.source];

  const listen = () => {
    // One voice at a time: the loop pauses while a suggestion is heard.
    if (state.player.status === 'playing') actions.pause();
    playback.current?.cancel();
    playback.current = speak(card.target, targetLang, 1);
  };

  return (
    <div role="group" aria-label={c.make.cardLabel(position, total)} className={`${CARD_HEIGHT} flex flex-col`}>
      {/* The picture across the top, as a card to swipe has; the stamps show over it. */}
      {card.image ? (
        <PhraseImage icons={card.image} tone={card.tone} size="lg" className="w-full h-[min(9rem,18dvh)] rounded-t-3xl" />
      ) : (
        <span aria-hidden="true" className="block h-14" />
      )}
      <div className="flex-1 p-5 pt-4 flex flex-col gap-4">
      <p
        className={`self-start inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-label font-semibold ${
          card.source === 'ai' ? 'bg-primary-fixed text-on-primary-fixed' : 'bg-surface-container text-on-surface-variant'
        }`}
      >
        <Icon name={SOURCE_ICONS[card.source]} className="text-icon-xs" />
        <span lang={card.source === 'course' ? targetLang : undefined}>{source}</span>
      </p>
      <div className="flex-1 flex flex-col justify-center gap-2">
        <p lang={targetLang} className="font-serif italic text-display-sm font-medium text-on-surface text-balance [overflow-wrap:anywhere]">
          {card.target}
        </p>
        <p lang={nativeLang} className="text-row text-secondary [overflow-wrap:anywhere]">
          {card.native}
        </p>
      </div>
      {onEdit && (
        <div className="flex flex-wrap items-center gap-2 -mx-1">
          {canSpeak(targetLang) && (
            <button type="button" onClick={listen} aria-label={c.make.listen(card.target)} className={`${btnIcon} bg-surface-container-low text-on-surface`}>
              <Icon name="volume_up" className="text-icon" />
            </button>
          )}
          <button type="button" onClick={onEdit} aria-label={c.make.editLabel(card.target)} className={btnText}>
            <Icon name="edit" className="text-icon-md" />
            {c.make.edit}
          </button>
        </div>
      )}
      </div>
    </div>
  );
}

/** Correcting a card before adding it: both languages, stored as the phrase form stores them. */
function EditFace({ card, onDone }: { card: Suggestion; onDone: (text: { target: string; native: string } | null) => void }) {
  const c = useCopy();
  const { state } = useStore();
  const { nativeLang, targetLang } = state.learner.profile;
  const [target, setTarget] = useState(card.target);
  const [native, setNative] = useState(card.native);
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => {
    first.current?.focus();
  }, []);
  // Escape closes the correction, not the whole flow.
  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
    onDone(null);
  };
  return (
    <form
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        if (target.trim() && native.trim()) onDone({ target, native });
      }}
      className={`${CARD_HEIGHT} p-5 flex flex-col gap-3`}
    >
      <label className="flex flex-col gap-1">
        <span className="text-body font-semibold">{c.addPhrase.target(languageName(targetLang, c.locale))}</span>
        <input
          ref={first}
          lang={targetLang}
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          onKeyDown={onKeyDown}
          maxLength={LIMITS.phrase}
          autoCorrect="off"
          autoComplete="off"
          className={`${fieldClass} font-serif italic`}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-body font-semibold">{c.addPhrase.native(languageName(nativeLang, c.locale))}</span>
        <input lang={nativeLang} value={native} onChange={(e) => setNative(e.target.value)} onKeyDown={onKeyDown} maxLength={LIMITS.phrase} autoComplete="off" className={fieldClass} />
      </label>
      <div className="mt-auto flex flex-wrap justify-end gap-2">
        <button type="button" onClick={() => onDone(null)} className={btnText}>
          {c.common.cancel}
        </button>
        <button type="submit" disabled={!target.trim() || !native.trim()} className={btnTonal}>
          {c.common.save}
        </button>
      </div>
    </form>
  );
}

// ---------- saving ----------

function SaveStep({
  session,
  into,
  onTitle,
  onRemove,
  onBack,
  onSave,
}: {
  session: MakeSession;
  /** The learner's set being filled, by name; otherwise a new set is named here. */
  into?: string;
  onTitle: (title: string) => void;
  onRemove: (key: string) => void;
  onBack: () => void;
  onSave: (title: string) => void;
}) {
  const c = useCopy();
  const { state } = useStore();
  const { nativeLang, targetLang } = state.learner.profile;
  const kept = added(session.deck!);
  const countId = useId();
  const key = sameKey(session.title);
  // A same name is allowed, but said (as when naming a set by hand).
  const taken = !into && key !== '' && ownSets(state.learner).some((s) => sameKey(s.title) === key);
  const ready = kept.length > 0 && (Boolean(into) || tidy(session.title) !== '');

  return (
    <form
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        if (ready) onSave(session.title);
      }}
      className="flex flex-col gap-4"
    >
      <h2 className="font-serif text-heading font-semibold">{into ? c.make.into(into) : c.make.saveTitle}</h2>
      {!into && (
        <label className="flex flex-col gap-1">
          <span className="text-body font-semibold">{c.createSet.name}</span>
          <input
            value={session.title}
            onChange={(e) => onTitle(e.target.value)}
            maxLength={LIMITS.title}
            aria-describedby={countId}
            autoComplete="off"
            enterKeyHint="done"
            required
            className={fieldClass}
          />
          <CharCount id={countId} value={session.title} max={LIMITS.title} />
        </label>
      )}
      {taken && (
        <p role="status" className="text-body rounded-xl bg-surface-container-low p-3">
          {c.createSet.taken}
        </p>
      )}

      <section aria-labelledby="make-kept">
        <h3 id="make-kept" className="text-label font-semibold text-secondary min-h-11 flex items-center">
          {c.make.keptHeading(kept.length)}
        </h3>
        <ul className="-mx-2">
          {kept.map((card) => (
            <li key={card.key} className="min-h-14 flex items-center gap-2 px-2 py-1.5">
              <span className="flex-1 min-w-0">
                <span lang={targetLang} className="block font-serif italic text-row leading-snug [overflow-wrap:anywhere]">
                  {card.target}
                </span>
                <span lang={nativeLang} className="block text-label text-secondary [overflow-wrap:anywhere]">
                  {card.native}
                </span>
              </span>
              {card.source === 'ai' && (
                <span className="shrink-0 text-primary-container" title={c.make.source.ai}>
                  <Icon name="auto_awesome" className="text-icon-sm" />
                  <span className="sr-only">{c.make.source.ai}</span>
                </span>
              )}
              <button type="button" aria-label={c.make.remove(card.target)} onClick={() => onRemove(card.key)} className={`${btnIcon} text-secondary`}>
                <Icon name="close" className="text-icon-md" />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <button type="submit" disabled={!ready} className={btnPrimary}>
        {into ? c.make.addInto(kept.length, into) : c.createSet.create}
      </button>
      <button type="button" onClick={onBack} className={`${btnText} self-center`}>
        <Icon name="arrow_back" className="text-icon-md" />
        {c.make.backToDeck}
      </button>
    </form>
  );
}
