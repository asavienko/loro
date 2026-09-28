import { FormEvent, useId, useRef, useState } from 'react';
import { languageName } from '../copy';
import { useRoute } from '../nav/history';
import { useNav } from '../nav/NavContext';
import type { LanguageCode } from '../content';
import { bankMatch, findSamePhrase, promptOf } from '../state/catalog';
import { liveAvailable, writeNotes } from '../generate/remote';
import { LIMITS, sayable, tidy } from '../state/limits';
import { useCopy, useStore } from '../state/store';
import { CharCount } from '../ui/CharCount';
import { Sheet } from '../ui/Sheet';
import { useToast } from '../ui/Toast';
import { btnPrimary } from '../ui/button';
import { fieldClass } from '../ui/field';

/**
 * The learner's own phrase: both languages, played with the device voice like
 * any other. With `editId` it corrects an existing phrase and keeps its history.
 */
export function AddPhraseSheet({ request, onClose }: { request: { editId?: string; target?: string } | null; onClose: () => void }) {
  const c = useCopy();
  const { state } = useStore();
  const editing = request?.editId ? state.learner.ownPhrases[request.editId] : undefined;
  return (
    <Sheet open={request !== null} title={editing ? c.addPhrase.editTitle : c.addPhrase.title} onClose={onClose}>
      {request && (
        <PhraseForm
          key={request.editId ?? 'new'}
          editId={editing?.id}
          initialTarget={editing?.target ?? request.target ?? ''}
          initialNative={editing?.native ?? ''}
          targetLang={editing?.targetLang ?? state.learner.profile.targetLang}
          nativeLang={editing?.nativeLang ?? state.learner.profile.nativeLang}
          onDone={onClose}
        />
      )}
    </Sheet>
  );
}

interface FormProps {
  editId?: string;
  initialTarget: string;
  initialNative: string;
  targetLang: LanguageCode;
  nativeLang: LanguageCode;
  onDone: () => void;
}

function PhraseForm({ editId, initialTarget, initialNative, targetLang, nativeLang, onDone }: FormProps) {
  const c = useCopy();
  const nav = useNav();
  const route = useRoute();
  const { toast } = useToast();
  const { state, actions } = useStore();
  const [target, setTarget] = useState(initialTarget);
  const [native, setNative] = useState(initialNative);
  // Saying the same thing twice is allowed, but the learner should know.
  const same = findSamePhrase(state.learner, target, editId);
  const targetCount = useId();
  const nativeRef = useRef<HTMLInputElement>(null);
  const nativeCount = useId();

  // An edit that changes nothing (spacing aside) has nothing to save.
  const unchanged = Boolean(editId) && tidy(target) === tidy(initialTarget) && tidy(native) === tidy(initialNative);
  // A phrase needs something to say aloud: a letter or a digit.
  const ready = sayable(target) && Boolean(native.trim()) && !unchanged;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!ready) return;
    if (editId) {
      actions.editOwnPhrase(editId, target, native);
      toast(c.addPhrase.edited);
    } else {
      const id = actions.addOwnPhrase(target, native);
      // Its notes: the bank's when the bank has it, otherwise the writer's, asked for quietly now.
      if (!bankMatch(targetLang, target)) {
        const asked = { target: tidy(target), native: tidy(native), targetLang, nativeLang };
        void liveAvailable().then((live) => {
          if (!live) return;
          writeNotes(asked).then(
            (written) => actions.setOwnNotes(id, asked.target, written.notes, written.image),
            () => {},
          );
        });
      }
      // The next step is hearing it.
      toast(c.addPhrase.added, { action: { label: c.common.play, run: () => nav.playPhraseInSet(id) } });
      // Added from the Library: show it there, under Mine (once this sheet's history entry is gone).
      if (route.name === 'library') {
        onDone();
        nav.go({ name: 'library', view: 'mine' });
        revealRow(id);
        return;
      }
    }
    onDone();
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-body font-semibold">{c.addPhrase.target(languageName(targetLang, c.locale))}</span>
        <input
          lang={targetLang}
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          maxLength={LIMITS.phrase}
          aria-describedby={targetCount}
          enterKeyHint="next"
          // The keyboard's autocorrect speaks the device language and would "fix" the phrase.
          autoCorrect="off"
          autoCapitalize="sentences"
          autoComplete="off"
          // Enter in the first field goes on to the translation while it is still empty.
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing && !native.trim()) {
              e.preventDefault();
              nativeRef.current?.focus();
            }
          }}
          required
          className={`${fieldClass} font-serif italic`}
        />
        <CharCount id={targetCount} value={target} max={LIMITS.phrase} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-body font-semibold">{c.addPhrase.native(languageName(nativeLang, c.locale))}</span>
        <input
          ref={nativeRef}
          lang={nativeLang}
          value={native}
          onChange={(e) => setNative(e.target.value)}
          maxLength={LIMITS.phrase}
          aria-describedby={nativeCount}
          enterKeyHint="done"
          autoComplete="off"
          required
          className={fieldClass}
        />
        <CharCount id={nativeCount} value={native} max={LIMITS.phrase} />
      </label>
      {same && (
        <p role="status" className="text-body rounded-xl bg-surface-container-low p-3">
          {c.addPhrase.duplicate}{' '}
          <span lang={same.targetLang} className="font-serif italic font-semibold">
            {same.target}
          </span>
          <span lang={promptOf(same, nativeLang).lang} className="block text-label text-secondary">
            {promptOf(same, nativeLang).text}
          </span>
        </p>
      )}
      <p className="text-label text-secondary">{c.addPhrase.hint}</p>
      <button type="submit" disabled={!ready} className={btnPrimary}>
        {editId ? c.common.save : c.addPhrase.add}
      </button>
    </form>
  );
}

/**
 * Brings the new phrase's Library row into view once Mine shows it (at large text the list can
 * start below the fold), after the page's own scroll restoration as the view changes. A row not
 * wholly on screen goes to the top, under the header: the "Phrase added" toast is at the bottom.
 */
function revealRow(id: string) {
  const until = performance.now() + 2000;
  const step = () => {
    const row = document.querySelector(`[data-phrase-row="${CSS.escape(id)}"]`);
    if (!row || !window.location.hash.includes('view=mine')) {
      if (performance.now() < until) requestAnimationFrame(step);
      return;
    }
    const box = row.getBoundingClientRect();
    const header = document.querySelector('header')?.getBoundingClientRect().bottom ?? 0;
    const below = parseFloat(getComputedStyle(document.documentElement).scrollPaddingBottom) || 0;
    if (box.top < header || box.bottom > window.innerHeight - below) row.scrollIntoView({ block: 'start' });
  };
  requestAnimationFrame(step);
}
