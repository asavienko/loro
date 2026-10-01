// Rates the current phrase, with its cue, and says the result once (the web prototype's
// src/screens/useRate.ts). A rating given while the grades wait moves straight on, so it is also
// shown, with Undo, because the screen has already moved on.
import { easyCue, gentleCue } from '@shared/audio/cues';
import { useLatest } from '@shared/lib/useLatest';
import { requeuesOn } from '@shared/state/machine';
import { currentPhraseId, upNextIds } from '@shared/state/selectors';
import type { Grade } from '@shared/state/types';
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
    const movesOn = s.player.phase === 'rate';
    a.rate(grade);
    if (grade === 'easy') easyCue();
    else gentleCue();
    // What it did, without when the phrase comes back: FSRS decides that, and no grade shows it.
    const again = upNextIds(s.player).includes(id) || requeuesOn(s.player, grade);
    const text = `${copy.player.ratedAs(copy.common.grade[grade])}. ${again ? copy.player.backLater : copy.player.scheduled}`;
    if (movesOn) show(text, { action: { label: copy.common.undo, run: () => a.unrate(id) } });
    else say(text);
  };
}
