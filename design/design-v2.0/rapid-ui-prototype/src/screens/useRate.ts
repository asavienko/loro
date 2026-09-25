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
 * That rating is also shown, with Undo, because the screen has already moved on; any other
 * rating stays on screen in the player's status line, so it is only read out.
 */
export function useRate(): (grade: Grade) => void {
  const c = useCopy();
  const { state, actions } = useStore();
  const { announce, toast } = useToast();
  const latest = useLatest({ state, actions, c, announce, toast });
  return (grade) => {
    const { state: s, actions: a, c: copy, announce: say, toast: show } = latest.current;
    const id = currentPhraseId(s.player);
    if (id === null) return;
    const now = clock.now();
    // A change inside the window keeps the rating's original time.
    const open = pendingFor(s, id);
    const at = open && windowLeft(open, now) > 0 ? open.at : now;
    const movesOn = s.player.phase === 'rate';
    a.rate(grade);
    if (grade === 'easy') easyCue();
    else gentleCue();
    const text = copy.player.rated(copy.common.grade[grade], formatWhen(previewDue(s.learner, id, grade, at), now, copy.locale));
    // The toast goes through the same live region, so it is still said exactly once.
    if (movesOn) show(text, { action: { label: copy.common.undo, run: () => a.unrate(id) } });
    else say(text);
  };
}
