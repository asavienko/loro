// Rates the current phrase, with its cue, and says it to a screen reader (the web prototype's
// src/screens/useRate.ts). What the screen shows of it is each surface's own, with no message over
// it: the player marks the grade with Undo, the bar turns it into Undo for a few seconds.
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
  const { announce } = useToast();
  const latest = useLatest({ state, actions, c, announce });
  return (grade) => {
    const { state: s, actions: a, c: copy, announce: say } = latest.current;
    const id = currentPhraseId(s.player);
    if (id === null) return;
    a.rate(grade);
    if (grade === 'easy') easyCue();
    else gentleCue();
    const again = upNextIds(s.player).includes(id) || requeuesOn(s.player, grade);
    say(`${copy.player.ratedAs(copy.common.grade[grade])}. ${again ? copy.player.backLater : copy.player.scheduled}`);
  };
}
