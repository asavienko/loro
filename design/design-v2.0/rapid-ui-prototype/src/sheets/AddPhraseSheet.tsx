import { FormEvent, useState } from 'react';
import { languageName } from '../copy';
import { useCopy, useStore } from '../state/store';
import { Sheet } from '../ui/Sheet';
import { useToast } from '../ui/Toast';

/** The learner's own phrase: both languages, played with the device voice like any other. */
export function AddPhraseSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const c = useCopy();
  const { toast } = useToast();
  const { state, actions } = useStore();
  const { nativeLang, targetLang } = state.learner.profile;
  const [target, setTarget] = useState('');
  const [native, setNative] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!target.trim() || !native.trim()) return;
    actions.addOwnPhrase(target, native);
    toast(c.addPhrase.added);
    setTarget('');
    setNative('');
    onClose();
  };

  return (
    <Sheet open={open} title={c.addPhrase.title} onClose={onClose}>
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
          {c.addPhrase.add}
        </button>
      </form>
    </Sheet>
  );
}
