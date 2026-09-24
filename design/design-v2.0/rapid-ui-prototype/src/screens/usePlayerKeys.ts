import { useEffect } from 'react';
import { easyCue, gentleCue } from '../audio/cues';
import { useLatest } from '../lib/useLatest';
import { useStore } from '../state/store';
import type { Grade } from '../state/types';

const GRADE_KEYS: Record<string, Grade> = { '1': 'missed', '2': 'hard', '3': 'easy' };

/**
 * Keyboard shortcuts while the player is open: Space plays or pauses, ← and →
 * change phrase, 1 / 2 / 3 rate Missed / Hard / Easy. Ignored while typing or
 * when a control that uses the key itself has focus.
 */
export function usePlayerKeys(): void {
  const { state, actions } = useStore();
  const latest = useLatest({ playing: state.player.status === 'playing', actions });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [role="tab"], [role="radio"], [contenteditable="true"]')) return;
      const { playing, actions: a } = latest.current;
      const grade = GRADE_KEYS[event.key];
      if (event.key === ' ' && !target?.closest('button')) {
        event.preventDefault();
        if (playing) a.pause();
        else a.play();
      } else if (event.key === 'ArrowRight') {
        a.next();
      } else if (event.key === 'ArrowLeft') {
        a.prev();
      } else if (grade) {
        a.rate(grade);
        if (grade === 'easy') easyCue();
        else gentleCue();
      } else {
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [latest]);
}
