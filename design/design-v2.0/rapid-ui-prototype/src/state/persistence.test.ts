import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SETS } from '../content';
import { initialState, transition } from './machine';
import { parseState, serializeState } from './persistence';

const T0 = 1_800_000_000_000;
const SET = SETS[0];
const [P1, P2] = SET.phraseIds;

describe('persistence', () => {
  it('rejects malformed input', () => {
    assert.equal(parseState('not json'), null);
    assert.equal(parseState('[]'), null);
    assert.equal(parseState('{"version":2}'), null);
  });

  it('keeps the queue order through a round-trip', () => {
    const s = transition(initialState(), { type: 'LOAD', phraseIds: SET.phraseIds, setId: SET.id, now: T0, seed: 1 });
    const back = parseState(serializeState(s))!;
    assert.deepEqual(back.player.order, SET.phraseIds);
    assert.equal(back.player.setId, SET.id);
  });

  it('drops ids the content no longer has and keeps the current phrase', () => {
    const s = transition(initialState(), { type: 'LOAD', phraseIds: ['gone', P1, P2], setId: 'gone-set', startIndex: 1, now: T0, seed: 1 });
    const saved = JSON.parse(serializeState(s));
    saved.learner.phrases = { gone: { firstHeardAt: T0 }, [P1]: { firstHeardAt: T0, heardCount: 2 } };
    saved.learner.savedPhraseIds = ['gone', P2];
    saved.learner.likedSetIds = ['gone-set', SET.id];
    saved.learner.history = [{ at: T0, phraseId: 'gone', setId: null, event: 'heard', points: 1 }];
    const back = parseState(JSON.stringify(saved))!;
    assert.deepEqual(back.player.order, [P1, P2]);
    assert.equal(back.player.order[back.player.index], P1);
    assert.equal(back.player.setId, null);
    assert.deepEqual(Object.keys(back.learner.phrases), [P1]);
    assert.equal(back.learner.phrases[P1].heardCount, 2);
    assert.equal(back.learner.phrases[P1].stabilityDays, null, 'missing memory fields are back-filled');
    assert.deepEqual(back.learner.savedPhraseIds, [P2]);
    assert.deepEqual(back.learner.likedSetIds, [SET.id]);
    assert.deepEqual(back.learner.history, []);
  });

  it('clamps an out-of-range index', () => {
    const saved = JSON.parse(serializeState(initialState()));
    saved.player.order = [P1, P2];
    saved.player.index = 9;
    assert.equal(parseState(JSON.stringify(saved))!.player.index, 1);
  });

  it('migrates a version 1 save', () => {
    const v1 = {
      version: 1,
      learner: { points: 7, phrases: {}, savedPhraseIds: [P1], likedSetIds: [], downloadedSetIds: [SET.id], history: [] },
      player: { ...initialState().player, order: [P1], ended: undefined, audioError: undefined },
    };
    const back = parseState(JSON.stringify(v1))!;
    assert.equal(back.version, 2);
    assert.equal(back.learner.points, 7);
    assert.equal('downloadedSetIds' in back.learner, false);
    assert.equal(back.player.ended, false);
    assert.equal(back.player.audioError, null);
  });
});
