import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PHRASES, SETS } from '../content';
import { DAY } from './clock';
import { initialState, LearnerState } from './machine';
import { LEARNED_STABILITY_DAYS, newMemory } from './memory';
import { duePhraseIds, learnedPhraseIds, learnerStats, nextDue, phraseProgress, setProgress, suggestedSetId } from './selectors';

const T0 = 1_800_000_000_000;
const [P1, P2, P3] = SETS[0].phraseIds;

function learnerWith(phrases: LearnerState['phrases']): LearnerState {
  return { ...initialState().learner, phrases };
}

const reviewed = (stabilityDays: number, lastReviewedAt: number) => ({
  ...newMemory(T0),
  stabilityDays,
  lastReviewedAt,
});

describe('selectors', () => {
  it('a learned phrase that is due is both due and learned, and every learned count agrees', () => {
    const learner = learnerWith({ [P1]: reviewed(LEARNED_STABILITY_DAYS, T0) });
    const now = T0 + (LEARNED_STABILITY_DAYS + 1) * DAY;
    assert.equal(phraseProgress(learner, P1, now).status, 'due');
    const listed = learnedPhraseIds(learner, PHRASES.map((p) => p.id));
    assert.deepEqual(listed, [P1]);
    assert.equal(learnerStats(learner, now).learned, listed.length);
    assert.equal(setProgress(learner, SETS[0].id, now).learned, 1);
  });

  it('orders due phrases by due time and groups the next due minute', () => {
    const learner = learnerWith({
      [P1]: reviewed(2, T0),
      [P2]: reviewed(1, T0),
      [P3]: reviewed(5, T0),
      gone: reviewed(0.5, T0),
    });
    assert.deepEqual(duePhraseIds(learner, T0 + 3 * DAY), [P2, P1]);
    assert.deepEqual(nextDue(learner, T0), { at: T0 + DAY, count: 1 }, 'phrases missing from content are ignored');
  });

  it('suggests the first set to start, then the most recent unfinished one', () => {
    assert.equal(suggestedSetId(initialState().learner, T0), SETS[0].id);
    const other = SETS[2];
    const learner: LearnerState = {
      ...initialState().learner,
      history: [{ at: T0, phraseId: other.phraseIds[0], setId: other.id, event: 'heard', points: 1 }],
    };
    assert.equal(suggestedSetId(learner, T0), other.id);
  });
});
