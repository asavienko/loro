import type { Copy } from '../copy';
import { languageLabel, languageName } from '../copy';
import type { LanguageCode } from '../content';
import type { SetView } from '../state/catalog';
import type { Phase, PlayerState } from '../state/types';
import type { IconName } from './icons';

export const PHASE_ICONS: Record<Exclude<Phase, 'rate'>, IconName> = {
  native: 'hearing',
  // A person speaking: the learner says it. Not a microphone: nothing is recorded.
  pause: 'record_voice_over',
  target: 'volume_up',
};

/**
 * The target text stays hidden while the learner is recalling it (the prompt
 * and their own turn), and appears once they hear it. Not while speech has
 * failed: then it may never have played (no voice for the language). A queue
 * that has ended shows it only if it was heard: Next can end one before that.
 */
export function isTargetRevealed(player: Pick<PlayerState, 'phase' | 'ended' | 'targetHeard' | 'repetition' | 'audioError'>): boolean {
  return !player.audioError && (player.phase === 'target' || player.phase === 'rate' || (player.ended && player.targetHeard));
}

/**
 * The queue's name: its set's title, else where it came from ("Review", "Try the loop", a
 * Library view such as "Due"), else "Queue" for one put together by hand.
 */
export function queueTitle(c: Copy, player: Pick<PlayerState, 'source'>, set: SetView | undefined): string {
  if (set) return set.title;
  switch (player.source?.kind) {
    case 'review':
      return c.home.reviewTitle;
    case 'demo':
      return c.home.demoTitle;
    case 'library':
      return c.library.filters[player.source.view];
    default:
      return c.queue.title;
  }
}

/** What the learner should do right now, e.g. "Your turn — say it out loud in Spanish". */
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
      return languageLabel(promptLang, c.locale);
    case 'pause':
      return c.player.yourTurn;
    case 'target':
      return languageLabel(targetLang, c.locale);
  }
}
