import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mergePending, ratingCommitId } from './merge';
import { RATING_WINDOW_MS } from './memory';
import type { PendingRating } from './types';
import { MINUTE, T0 } from './testing';

const rating = (grade: PendingRating['grade'], at: number, changedAt = at, extra: Partial<PendingRating> = {}): PendingRating => ({
  key: 'en-GB>es-ES:cafe-01',
  phraseId: 'cafe-01',
  setId: 'set-cafe',
  grade,
  at,
  changedAt,
  ...extra,
});
const none = () => false;

describe('pending ratings across tabs', () => {
  it("keeps a rating only the other tab has", () => {
    assert.deepEqual(mergePending([], [rating('hard', T0)], none, T0 + MINUTE), [rating('hard', T0)]);
  });

  it('the later change wins: a changed grade, or an undo', () => {
    const hard = rating('hard', T0);
    const easy = rating('easy', T0, T0 + MINUTE);
    assert.deepEqual(mergePending([hard], [easy], none, T0 + 2 * MINUTE), [easy]);
    assert.deepEqual(mergePending([easy], [hard], none, T0 + 2 * MINUTE), [easy]);
    const undone = rating('hard', T0, T0 + MINUTE, { undone: true });
    assert.deepEqual(mergePending([hard], [undone], none, T0 + 2 * MINUTE), [undone]);
  });

  it('two tabs rating the same phrase make one rating, the later', () => {
    const a = rating('hard', T0);
    const b = rating('easy', T0 + MINUTE);
    assert.deepEqual(mergePending([a], [b], none, T0 + 2 * MINUTE), [b]);
  });

  it("drops what's committed and undo tombstones whose window closed", () => {
    const hard = rating('hard', T0);
    assert.deepEqual(mergePending([], [hard], (p) => ratingCommitId('d', p) === ratingCommitId('d', hard), T0 + MINUTE), []);
    const undone = rating('hard', T0, T0 + MINUTE, { undone: true });
    assert.deepEqual(mergePending([], [undone], none, T0 + RATING_WINDOW_MS), []);
  });

  it('returns the same list when nothing changes', () => {
    const ours = [rating('hard', T0)];
    assert.equal(mergePending(ours, [rating('hard', T0)], none, T0 + MINUTE), ours);
  });
});

describe('settings across tabs', () => {
  it('the later change wins; a tie keeps ours', async () => {
    const { mergePrefs } = await import('./merge');
    const { initialPrefs } = await import('./initial');
    const older = { ...initialPrefs(), speed: 1 as const, updatedAt: T0 };
    const newer = { ...initialPrefs(), speed: 0.8 as const, updatedAt: T0 + MINUTE };
    assert.equal(mergePrefs(older, newer), newer);
    assert.equal(mergePrefs(newer, older), newer);
    const tie = { ...older, speed: 1.25 as const };
    assert.equal(mergePrefs(older, tie), older);
  });
});
