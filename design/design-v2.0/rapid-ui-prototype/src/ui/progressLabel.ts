import type { Copy } from '../copy';
import { formatWhen, HOUR } from '../state/clock';
import type { PhraseProgress } from '../state/selectors';
import { backIn } from './phase';

/**
 * How long a rating is what a row says about its phrase. Straight after a rating recall is 100%
 * (true, and no use beside the learner's own "Missed"), so for this long the row says the rating
 * and when the phrase comes back, as the player did. A rating in its undo window is well inside it.
 */
const JUST_RATED_MS = HOUR;

/**
 * Short real status for a phrase row: "New", "Due now", "Rated Missed — back in 9 min",
 * "Learned · recall 97%", "Recall 82% · back in 3 days". Pass the progress of `displayLearner`,
 * so a rating in its undo window counts.
 */
export function progressLabel(c: Copy, progress: PhraseProgress, now: number): string {
  const { lastGrade, lastGradeAt } = progress.memory;
  // Not a phrase due again already: that it is due is what matters then.
  const scheduled = progress.status === 'learning' || progress.status === 'learned';
  if (scheduled && lastGrade !== null && lastGradeAt !== null && now - lastGradeAt < JUST_RATED_MS && progress.dueAt !== null) {
    // Worded as the player words it (one "when", short units), so the row and the player agree.
    return c.player.rated(c.common.grade[lastGrade], backIn(c, progress.dueAt, now));
  }
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
