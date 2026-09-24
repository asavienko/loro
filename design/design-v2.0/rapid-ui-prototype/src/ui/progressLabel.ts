import type { Copy } from '../copy';
import { formatWhen } from '../state/clock';
import type { PhraseProgress } from '../state/selectors';

/** Short real status for a phrase row: "New", "Due now", "Learned · 97%", "82% · next in 3 days". */
export function progressLabel(c: Copy, progress: PhraseProgress, now: number): string {
  switch (progress.status) {
    case 'new':
      return progress.memory.heardCount > 0 ? c.status.listenedNotRated : c.status.new;
    case 'due':
      return c.status.due;
    case 'learned':
      return c.status.learned(progress.recall ?? 0);
    case 'learning':
      return c.status.learning(progress.recall ?? 0, formatWhen(progress.dueAt ?? now, now, c.locale));
  }
}
