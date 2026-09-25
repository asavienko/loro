import { useNav } from '../nav/NavContext';
import { useCopy } from '../state/store';
import { Sheet, SheetOption } from '../ui/Sheet';

/** Library's "+": the two things a learner can add, each handing over to its own sheet. */
export function AddSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const c = useCopy();
  const nav = useNav();
  return (
    <Sheet open={open} title={c.nav.addSheet} onClose={onClose}>
      <SheetOption
        icon="edit_note"
        label={c.library.addPhrase}
        onClick={() => {
          onClose();
          nav.addPhrase();
        }}
      />
      <SheetOption
        icon="playlist_add"
        label={c.library.newSet}
        onClick={() => {
          onClose();
          nav.createSet();
        }}
      />
    </Sheet>
  );
}
