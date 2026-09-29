import { StyleSheet } from 'react-native';
import { useNav } from '@shared/nav/NavContext';
import { findPhrase, ownSets } from '@shared/state/catalog';
import { useCopy, useStore } from '../state/store';
import { Sheet, SheetOption } from '../ui/Sheet';
import { useToast } from '../ui/Toast';
import { Txt } from '../ui/Txt';

/** Adds phrases to one of the learner's own sets, or to a new one (the web's src/sheets/AddToSetSheet.tsx). */
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
            onPress={() => {
              onClose();
              nav.createSet(phraseIds);
            }}
          />
          {sets.length === 0 ? (
            <Txt color="secondary" style={styles.none}>
              {c.addToSet.none}
            </Txt>
          ) : (
            sets.map((set) => {
              const already = phraseIds.every((id) => set.phraseIds.includes(id));
              return (
                <SheetOption
                  key={set.id}
                  icon={already ? 'task_alt' : 'queue_music'}
                  label={set.title}
                  detail={already ? c.addToSet.alreadyHere : c.common.phrases(set.phraseIds.filter((id) => findPhrase(state.learner, id)).length)}
                  onPress={() => {
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

const styles = StyleSheet.create({ none: { paddingHorizontal: 8, paddingVertical: 8 } });
