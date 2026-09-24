import { clock, formatInterval } from '../state/clock';
import { PhraseProgress } from '../state/selectors';

/** Short real status for a phrase row: "New", "Due now", "Learned · 97%", "82% · next in 3d". */
export function progressLabel(progress: PhraseProgress, now: number): string {
  switch (progress.status) {
    case 'new':
      return progress.memory ? 'Listened, not rated' : 'New';
    case 'due':
      return 'Due now';
    case 'learned':
      return `Learned · ${progress.retention}%`;
    case 'learning':
      return `${progress.retention}% · next in ${formatInterval((progress.dueAt ?? now) - now)}`;
  }
}

/** "today 14:20" or "Mon 14:20". */
export function dueLabel(at: number, now: number): string {
  return clock.isSameDay(at, now) ? `today ${clock.formatTime(at)}` : clock.formatDayTime(at);
}
