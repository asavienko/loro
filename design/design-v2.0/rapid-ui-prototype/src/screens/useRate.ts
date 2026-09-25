import { easyCue, gentleCue } from '../audio/cues';
import { useLatest } from '../lib/useLatest';
import { clock, formatWhen } from '../state/clock';
import { currentPhraseId, pendingFor, previewDue, windowLeft } from '../state/selectors';
import { useCopy, useStore } from '../state/store';
import type { Grade } from '../state/types';
import { useToast } from '../ui/Toast';

/**
 * Rates the current phrase (tap or key 1 / 2 / 3), with its cue, and says the result once.
 * Said here rather than by watching the rating: a rating given while the grades wait moves
 * straight to the next phrase, so a watcher would miss it, then speak when the phrase returns.
 */
export function useRate(): (grade: Grade) => void {
  const c = useCopy();
  const { state, actions } = useStore();
  const { announce } = useToast();
  const latest = useLatest({ state, actions, c, announce });
  return (grade) => {
    const { state: s, actions: a, c: copy, announce: say } = latest.current;
    const id = currentPhraseId(s.player);
    if (id === null) return;
    const now = clock.now();
    // A change inside the window keeps the rating's original time.
    const open = pendingFor(s, id);
    const at = open && windowLeft(open, now) > 0 ? open.at : now;
    a.rate(grade);
    if (grade === 'easy') easyCue();
    else gentleCue();
    say(copy.player.rated(copy.common.grade[grade], formatWhen(previewDue(s.learner, id, grade, at), at, copy.locale)));
  };
}
