import { PROFILE } from '../content';
import { floatingChip } from '../lib/feedback';
import { serializeState } from '../state/persistence';
import { useStore } from '../state/store';
import { Sheet, SheetOption } from './Sheet';

/** Opened from the avatar: the progress snapshot tools, kept off the learning screens. */
export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, actions } = useStore();

  const copyProgress = async (anchor: HTMLElement) => {
    try {
      await navigator.clipboard.writeText(serializeState(state));
      floatingChip(anchor, 'Progress copied as JSON', 'success');
    } catch {
      floatingChip(anchor, 'Copy is not available here', 'info');
    }
  };

  const reset = () => {
    if (!window.confirm('Reset all progress on this device? Points, ratings and saved phrases are removed.')) return;
    actions.reset();
    onClose();
  };

  return (
    <Sheet open={open} title={PROFILE.name} onClose={onClose}>
      <h3 className="px-2 text-sm font-bold text-on-surface">Your progress data</h3>
      <p className="px-2 text-xs text-secondary mt-0.5 mb-2">
        Every number in the app comes from one state snapshot you can copy or sync.
      </p>
      <SheetOption icon="content_copy" label="Copy progress as JSON" onClick={(e) => copyProgress(e.currentTarget)} />
      <SheetOption icon="restart_alt" label="Reset progress…" tone="danger" onClick={reset} />
    </Sheet>
  );
}
