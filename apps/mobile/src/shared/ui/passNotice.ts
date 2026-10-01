// What the player says as a pass through its queue ends (P3-01), as it happens: in repeat mode the
// queue was played through and starts again from its first phrase, with the course's next set one tap
// away; in continue mode it went on with the course's next set. A queue with a natural end (a review,
// the demo, a Library list) stops on its own panel instead.
import { continuation } from '../state/selectors';
import type { LearnerState, PlayerState } from '../state/types';

/** Where the player was, to tell the end of a pass from any other move. */
export interface PassMark {
  session: string | null;
  passes: number;
  setId: string | null;
  index: number;
  length: number;
}

export function passMark(player: PlayerState): PassMark {
  return { session: player.session?.id ?? null, passes: player.session?.passes ?? 0, setId: player.setId, index: player.index, length: player.order.length };
}

export type PassNotice =
  /** Repeat: played through, starting again; `next` is the course's next set to go on with, if any. */
  | { kind: 'again'; session: string; index: number; next: { setId: string; phraseIds: string[] } | null }
  /** Continue: the queue ran out and took on the course's next set (null: the phrases due for review). */
  | { kind: 'next'; session: string; index: number; setId: string | null };

/** The notice for the move from `before` to `player`, or null when it wasn't the end of a pass. */
export function passNotice(before: PassMark, player: PlayerState, learner: LearnerState, now: number): PassNotice | null {
  const session = player.session;
  if (!session || session.id !== before.session) return null;
  if (session.passes > before.passes) {
    // One phrase "starts again" after every play: that is no news.
    if (player.order.length < 2) return null;
    const next = continuation(learner, player, now);
    return { kind: 'again', session: session.id, index: player.index, next: next?.setId ? { setId: next.setId, phraseIds: next.phraseIds } : null };
  }
  // Off the end of the queue onto phrases added as it ended, of another set: the course's next ones.
  const ranOn = before.index === before.length - 1 && player.index === before.length && player.order.length > before.length;
  if (ranOn && player.setId !== before.setId) return { kind: 'next', session: session.id, index: player.index, setId: player.setId };
  return null;
}

/** Whether a notice still speaks of what's playing: the phrase it came with, in its session. */
export function passNoticeHolds(notice: PassNotice, player: PlayerState): boolean {
  return player.session?.id === notice.session && player.index === notice.index;
}
