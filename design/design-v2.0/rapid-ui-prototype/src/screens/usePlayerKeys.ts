import { useEffect } from 'react';
import { useLatest } from '../lib/useLatest';
import { playsOnce } from '../state/machine';
import { useStore } from '../state/store';
import type { Grade } from '../state/types';
import { useRate } from './useRate';

const GRADE_KEYS: Record<string, Grade> = { '1': 'missed', '2': 'hard', '3': 'easy' };

/**
 * Keyboard shortcuts while the player is open: Space plays or pauses, ← and →
 * change phrase, 1 / 2 / 3 rate Missed / Hard / Easy (not on the end panel, which shows
 * no grades). Ignored while typing or when a control that uses the key itself has focus.
 */
export function usePlayerKeys(): void {
  const { state, actions } = useStore();
  // A queue that played once and ended shows its end panel in place of the grades.
  const graded = !(state.player.ended && playsOnce(state.player));
  const latest = useLatest({ playing: state.player.status === 'playing', graded, actions, rate: useRate() });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      // Keys sent to the window or document have no element to look up from.
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input, textarea, select, [role="tab"], [role="radio"], [contenteditable="true"]')) return;
      // A sheet or the queue over the player owns its keys: Space scrolls it, arrows move in it.
      const dialog = target?.closest('[role="dialog"]');
      if (dialog && !dialog.hasAttribute('data-player')) return;
      // One step per press: a held key's auto-repeat would fly through the queue.
      if (event.repeat) {
        if (event.key === ' ' || event.key in GRADE_KEYS || event.key.startsWith('Arrow')) event.preventDefault();
        return;
      }
      const { playing, graded, actions: a, rate } = latest.current;
      const grade = GRADE_KEYS[event.key];
      if (event.key === ' ' && !target?.closest('button')) {
        event.preventDefault();
        if (playing) a.pause();
        else a.play();
      } else if (event.key === 'ArrowRight') {
        a.next();
      } else if (event.key === 'ArrowLeft') {
        a.prev();
      } else if (grade && graded) {
        rate(grade);
      } else {
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [latest]);
}
