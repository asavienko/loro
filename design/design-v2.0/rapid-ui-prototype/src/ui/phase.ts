import type { Copy } from '../copy';
import { languageName } from '../copy';
import type { LanguageCode } from '../content';
import type { Phase, PlayerState } from '../state/types';
import type { IconName } from './icons';

export const PHASE_ICONS: Record<Exclude<Phase, 'rate'>, IconName> = {
  native: 'hearing',
  pause: 'mic',
  target: 'volume_up',
};

/**
 * The target text stays hidden while the learner is recalling it (the prompt
 * and their own turn), and appears once they hear it.
 */
export function isTargetRevealed(player: Pick<PlayerState, 'phase' | 'ended' | 'repetition'>): boolean {
  return player.phase === 'target' || player.phase === 'rate' || player.ended;
}

/** What the learner should do right now, e.g. "Your turn — say it in Spanish". */
export function phaseInstruction(c: Copy, phase: Phase, promptLang: LanguageCode, targetLang: LanguageCode): string {
  switch (phase) {
    case 'native':
      return c.player.instruction.native(languageName(promptLang, c.locale));
    case 'pause':
      return c.player.instruction.pause(languageName(targetLang, c.locale));
    case 'target':
      return c.player.instruction.target(languageName(targetLang, c.locale));
    case 'rate':
      return c.player.instruction.rate;
  }
}

export function phaseStepLabel(c: Copy, phase: Exclude<Phase, 'rate'>, promptLang: LanguageCode, targetLang: LanguageCode): string {
  switch (phase) {
    case 'native':
      return languageName(promptLang, c.locale);
    case 'pause':
      return c.player.yourTurn;
    case 'target':
      return languageName(targetLang, c.locale);
  }
}
