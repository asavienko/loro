// Rates the current phrase, with its cue, and says the result once (the web prototype's
// src/screens/useRate.ts). A rating given while the grades wait moves straight on, so it is also
// shown, with Undo, because the screen has already moved on.
import { easyCue, gentleCue } from '@shared/audio/cues';
import { useLatest } from '@shared/lib/useLatest';
import { clock } from '@shared/state/clock';
import { requeuesOn } from '@shared/state/machine';
import { currentPhraseId, pendingFor, previewDue, upNextIds, windowLeft } from '@shared/state/selectors';
import type { Grade } from '@shared/state/types';
import { backIn } from '@shared/ui/phase';
import { useCopy, useStore } from '../state/store';
import { useToast } from '../ui/Toast';

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
    const open = pendingFor(s, id);
    const kept = open && windowLeft(open, now) > 0 ? open : undefined;
    const at = kept ? kept.at : now;
    const movesOn = s.player.phase === 'rate';
    a.rate(grade);
    if (grade === 'easy') easyCue();
    else gentleCue();
    const rated = copy.player.rated(copy.common.grade[grade], backIn(copy, previewDue(s.learner, id, grade, at, kept?.day), now));
    const again = upNextIds(s.player).includes(id) || requeuesOn(s.player, grade);
    const text = again ? `${rated} ${copy.player.requeued}` : rated;
    if (movesOn) show(text, { action: { label: copy.common.undo, run: () => a.unrate(id) } });
    else say(text);
  };
}
