import { FormEvent, useState } from 'react';
import { languageName } from '../copy';
import type { LanguageCode } from '../content';
import { useCopy, useStore } from '../state/store';
import { Sheet } from '../ui/Sheet';
import { useToast } from '../ui/Toast';

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
  const { actions } = useStore();
  const [target, setTarget] = useState(initialTarget);
  const [native, setNative] = useState(initialNative);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!target.trim() || !native.trim()) return;
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
          maxLength={120}
          required
          className="min-h-12 px-4 rounded-2xl bg-surface-container-low border border-outline-variant/60 text-base font-serif italic"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-body font-semibold">{c.addPhrase.native(languageName(nativeLang, c.locale))}</span>
        <input
          lang={nativeLang}
          value={native}
          onChange={(e) => setNative(e.target.value)}
          maxLength={120}
          required
          className="min-h-12 px-4 rounded-2xl bg-surface-container-low border border-outline-variant/60 text-base"
        />
      </label>
      <p className="text-label text-secondary">{c.addPhrase.hint}</p>
      <button type="submit" disabled={!target.trim() || !native.trim()} className="min-h-12 rounded-full bg-primary-container text-on-primary font-bold disabled:opacity-40">
        {editId ? c.common.save : c.addPhrase.add}
      </button>
    </form>
  );
}
