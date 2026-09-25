import { FormEvent, useId, useRef, useState } from 'react';
import { languageName } from '../copy';
import type { LanguageCode } from '../content';
import { findSamePhrase, promptOf } from '../state/catalog';
import { LIMITS, tidy } from '../state/limits';
import { useCopy, useStore } from '../state/store';
import { CharCount } from '../ui/CharCount';
import { Sheet } from '../ui/Sheet';
import { useToast } from '../ui/Toast';
import { btnPrimary } from '../ui/button';

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
  const ready = Boolean(target.trim() && native.trim()) && !unchanged;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!ready) return;
    if (editId) {
      actions.editOwnPhrase(editId, target, native);
      toast(c.addPhrase.edited);
    } else {
      actions.addOwnPhrase(target, native);
      toast(c.addPhrase.added);
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
          className="min-h-12 px-4 rounded-2xl bg-surface-container-low border border-outline-variant/60 text-field font-serif italic"
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
          className="min-h-12 px-4 rounded-2xl bg-surface-container-low border border-outline-variant/60 text-field"
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
