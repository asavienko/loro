import { FormEvent, useState } from 'react';
import { useNav } from '../nav/NavContext';
import { findSetView } from '../state/catalog';
import { useCopy, useStore } from '../state/store';
import { Sheet } from '../ui/Sheet';
import { useToast } from '../ui/Toast';

/** Names a new set (optionally holding phrases already), or renames one of the learner's sets. */
export function CreateSetSheet({ request, onClose }: { request: { phraseIds: string[]; rename?: string } | null; onClose: () => void }) {
  const c = useCopy();
  const nav = useNav();
  const { toast } = useToast();
  const { state, actions } = useStore();
  const renaming = request?.rename ? findSetView(state.learner, request.rename) : undefined;

  const submit = (title: string) => {
    const clean = title.trim();
    if (!request || !clean) return;
    if (renaming) {
      actions.renameSet(renaming.id, clean);
    } else {
      const id = actions.createSet(clean, request.phraseIds);
      toast(c.createSet.created(clean));
      nav.openSet(id);
    }
    onClose();
  };

  return (
    <Sheet open={request !== null} title={renaming ? c.createSet.renameTitle : c.createSet.title} onClose={onClose}>
      {request && <SetNameForm key={request.rename ?? request.phraseIds.join()} initial={renaming?.title ?? ''} submitLabel={renaming ? c.common.save : c.createSet.create} onSubmit={submit} />}
    </Sheet>
  );
}

function SetNameForm({ initial, submitLabel, onSubmit }: { initial: string; submitLabel: string; onSubmit: (title: string) => void }) {
  const c = useCopy();
  const [title, setTitle] = useState(initial);
  return (
      <form
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          onSubmit(title);
        }}
        className="flex flex-col gap-3"
      >
        <label className="flex flex-col gap-1">
          <span className="text-body font-semibold">{c.createSet.name}</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={60}
            required
            className="min-h-12 px-4 rounded-2xl bg-surface-container-low border border-outline-variant/60 text-base"
          />
        </label>
        <button type="submit" disabled={!title.trim()} className="min-h-12 rounded-full bg-primary-container text-on-primary font-bold disabled:opacity-40">
          {submitLabel}
        </button>
      </form>
  );
}
