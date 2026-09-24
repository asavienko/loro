import { getLanguage, Phrase } from '../content';
import { Phase, PlayerState } from '../state/machine';

export const PHASE_ICONS: Record<Phase, string> = {
  native: 'hearing',
  pause: 'mic',
  target: 'volume_up',
};

/**
 * The target text stays hidden while the learner is recalling it (the native
 * prompt and their own turn), and appears once they hear it.
 */
export function isTargetRevealed(player: Pick<PlayerState, 'phase' | 'ended'>): boolean {
  return player.phase === 'target' || player.ended;
}

/** What the learner should do right now, e.g. "Your turn — say it in Spanish". */
export function phaseInstruction(phase: Phase, phrase: Phrase): string {
  const target = getLanguage(phrase.target.lang).name;
  switch (phase) {
    case 'native':
      return `Listen in ${getLanguage(phrase.native.lang).name}`;
    case 'pause':
      return `Your turn — say it in ${target}`;
    case 'target':
      return `Hear it in ${target}`;
  }
}

export function phaseStepLabel(phase: Phase, phrase: Phrase): string {
  switch (phase) {
    case 'native':
      return getLanguage(phrase.native.lang).name;
    case 'pause':
      return 'Your turn';
    case 'target':
      return getLanguage(phrase.target.lang).name;
  }
}
