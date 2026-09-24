import { useNav } from '../nav/NavContext';
import { findPhrase, ownSets } from '../state/catalog';
import { useCopy, useStore } from '../state/store';
import { Sheet, SheetOption } from '../ui/Sheet';
import { useToast } from '../ui/Toast';

/** Adds phrases to one of the learner's own sets, or to a new one. */
export function AddToSetSheet({ phraseIds, onClose }: { phraseIds: string[] | null; onClose: () => void }) {
  const c = useCopy();
  const nav = useNav();
  const { toast } = useToast();
  const { state, actions } = useStore();
  const sets = ownSets(state.learner);
  return (
    <Sheet open={phraseIds !== null} title={c.addToSet.title} onClose={onClose}>
      {phraseIds && (
        <>
          <SheetOption
            icon="add"
            label={c.addToSet.newSet}
            onClick={() => {
              onClose();
              nav.createSet(phraseIds);
            }}
          />
          {sets.length === 0 ? (
            <p className="px-2 py-2 text-body text-secondary">{c.addToSet.none}</p>
          ) : (
            sets.map((set) => {
              const already = phraseIds.every((id) => set.phraseIds.includes(id));
              return (
                <SheetOption
                  key={set.id}
                  icon={already ? 'task_alt' : 'queue_music'}
                  label={set.title}
                  detail={already ? c.addToSet.alreadyHere : c.common.phrases(set.phraseIds.filter((id) => findPhrase(state.learner, id)).length)}
                  onClick={() => {
                    if (!already) actions.addToSet(set.id, phraseIds);
                    toast(already ? c.addToSet.already(set.title) : c.addToSet.added(set.title));
                    onClose();
                  }}
                />
              );
            })
          )}
        </>
      )}
    </Sheet>
  );
}
