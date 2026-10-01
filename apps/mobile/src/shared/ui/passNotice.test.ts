import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { transition } from '../state/machine';
import { currentPhraseId, displayLearner } from '../state/selectors';
import { cafe, fresh, load, playPhrase, run, T0 } from '../state/testing';
import type { AppState } from '../state/types';
import { passMark, passNotice, passNoticeHolds } from './passNotice';

/** The notice the step from `before` to `after` gives, as the app reads it. */
const notice = (before: AppState, after: AppState) => passNotice(passMark(before.player), after.player, displayLearner(after), T0);
const onLast = (s: AppState) => transition(s, { type: 'JUMP', index: s.player.order.length - 1, now: T0 });

describe('the end of a pass', () => {
  it('repeat mode: played through and starting again, with the course’s next set to go on with', () => {
    const before = onLast(load(fresh({ playMode: 'repeat' })));
    const [after] = playPhrase(before, T0);
    assert.equal(after.player.index, 0, 'the queue starts again');
    const said = notice(before, after);
    assert.equal(said?.kind, 'again');
    assert.equal(said?.kind === 'again' && said.next?.setId, 'set-tapas');
    assert.equal(said && passNoticeHolds(said, after.player), true);
    // It speaks of the first phrase of the new pass only.
    const moved = transition(after, { type: 'NEXT', now: T0 + 1 });
    assert.equal(said && passNoticeHolds(said, moved.player), false);
  });

  it('Next on the last phrase ends a pass as playing it out does', () => {
    const before = onLast(load(fresh({ playMode: 'repeat' })));
    assert.equal(notice(before, transition(before, { type: 'NEXT', now: T0 + 1 }))?.kind, 'again');
  });

  it('continue mode: on to the course’s next set, said on its first phrase', () => {
    const before = onLast(load(fresh({ playMode: 'continue' })));
    const [after] = playPhrase(before, T0);
    assert.equal(currentPhraseId(after.player), 'tapas-01');
    assert.deepEqual(notice(before, after), { kind: 'next', session: after.player.session?.id, index: cafe().length, setId: 'set-tapas' });
  });

  it('says nothing for a move inside the queue, a new queue, or a queue of one phrase', () => {
    const s = load(fresh({ playMode: 'repeat' }));
    assert.equal(notice(s, transition(s, { type: 'NEXT', now: T0 + 1 })), null);
    assert.equal(notice(onLast(s), load(onLast(s), T0 + 2)), null, 'a new session');
    const one = load(fresh({ playMode: 'repeat' }), T0, ['cafe-01'], 'set-cafe');
    const again = transition(one, { type: 'NEXT', now: T0 + 1 });
    assert.equal(again.player.session?.passes, 1);
    assert.equal(notice(one, again), null);
  });

  it('a phrase played now from the last one of the queue is not the next set', () => {
    // Play a phrase now (the shell's playPhraseInSet): queued after the current one, then jumped to, in one render.
    const before = onLast(load(fresh({ playMode: 'continue' })));
    const after = run(before, { type: 'RESTORE_UP_NEXT', phraseIds: ['tapas-02'], offset: 0 }, { type: 'JUMP', index: before.player.index + 1, now: T0 + 1, play: true });
    assert.equal(currentPhraseId(after.player), 'tapas-02');
    assert.equal(notice(before, after), null);
  });

  it('a queue with a natural end stops on its own panel, without a notice', () => {
    const review = transition(fresh({ playMode: 'repeat' }), { type: 'LOAD', phraseIds: ['cafe-01', 'cafe-02'], setId: null, source: { kind: 'review' }, now: T0, seed: 1 });
    const before = onLast(review);
    const [after] = playPhrase(before, T0);
    assert.equal(after.player.ended, true);
    assert.equal(notice(before, after), null);
  });
});
