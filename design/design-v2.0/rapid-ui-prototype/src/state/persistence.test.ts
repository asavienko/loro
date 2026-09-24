import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { transition } from './machine';
import { RATING_WINDOW_MS } from './memory';
import { mergeLearner } from './merge';
import { parseState, sanitizeState, serializeState } from './persistence';
import { memoryOf, points } from './selectors';
import { done, fresh, load, MINUTE, run, T0 } from './testing';
import type { Device } from './types';

const device: Device = { id: 'dev', instance: 'next', seq: 0 };

describe('persistence', () => {
  it('rejects malformed input', () => {
    for (const bad of ['', 'nope', '[]', '{}', JSON.stringify({ version: 99 })]) {
      assert.equal(parseState(bad, device), null);
    }
  });

  it('round-trips, keeps this device, and never resumes mid-playback', () => {
    const s = done(load(fresh()), T0 + 1);
    const back = parseState(serializeState(s), device)!;
    assert.deepEqual(back.learner, s.learner);
    assert.deepEqual(back.device, device);
    assert.equal(back.player.status, 'paused');
    assert.deepEqual(back.player.order, s.player.order);
  });

  it('drops ids the content no longer has, keeping the current phrase', () => {
    const s = load(fresh());
    const raw = JSON.parse(serializeState(s));
    raw.player.order = ['gone', ...raw.player.order];
    raw.player.index = 1;
    raw.learner.likes['phrase:gone'] = { liked: true, at: 1 };
    const back = sanitizeState(raw, device)!;
    assert.equal(back.player.order[back.player.index], 'cafe-01');
    assert.equal(back.learner.likes['phrase:gone'], undefined);
  });

  it('migrates a v2 save: renamed ids, ratings replayed through FSRS, points kept', () => {
    const v2 = {
      version: 2,
      learner: {
        points: 50,
        phrases: {},
        savedPhraseIds: ['phrase-6'],
        likedSetIds: ['set-cafe'],
        history: [
          { at: T0, phraseId: 'phrase-1', setId: 'set-cafe', event: 'heard', points: 1 },
          { at: T0 + 1000, phraseId: 'phrase-1', setId: 'set-cafe', event: 'easy', points: 3 },
        ],
      },
      player: { order: ['phrase-1', 'phrase-2'], index: 1, speed: 1.25 },
    };
    const s = sanitizeState(v2, device)!;
    assert.equal(s.learner.likes['phrase:tapas-05'].liked, true, 'phrase-6 moved to tapas-05');
    assert.equal(s.learner.likes['set:set-cafe'].liked, true);
    assert.equal(memoryOf(s.learner, 'cafe-01').fsrs?.state, 'review');
    assert.equal(points(s.learner), 50, 'earned points carried over');
    assert.deepEqual(s.player.order, ['cafe-01', 'cafe-02']);
    assert.equal(s.prefs.speed, 1.25);
  });

  it('RESTORE goes through the same sanitising', () => {
    const s = fresh();
    assert.equal(transition(s, { type: 'RESTORE', state: { junk: true } }), s);
  });
});

describe('merge', () => {
  it('takes the union of both logs and counts a review once', () => {
    const base = load(fresh());
    const a = run(base, { type: 'RATE', grade: 'easy', now: T0 }, { type: 'COMMIT', now: T0 + RATING_WINDOW_MS });
    const b = done(done(done({ ...base, device: { id: 'other', instance: 'x', seq: 0 } }, T0 + 1), T0 + 2), T0 + 3);
    const merged = mergeLearner(a.learner, b.learner);
    assert.equal(merged.log.length, a.learner.log.length + b.learner.log.length);
    assert.equal(mergeLearner(merged, a.learner), merged, 'merging again changes nothing');
    assert.equal(memoryOf(merged, 'cafe-01').heardCount, 1);
    assert.equal(points(merged), 3 + 1);
  });

  it('likes, own phrases and the profile merge by last write; deletes win when newer', () => {
    const a = run(fresh(), { type: 'ADD_OWN_PHRASE', target: 'Hola', native: 'Hi', now: T0 });
    const id = Object.keys(a.learner.ownPhrases)[0];
    const deleted = run(a, { type: 'DELETE_OWN_PHRASE', id, now: T0 + MINUTE });
    const liked = run(a, { type: 'TOGGLE_LIKE', kind: 'set', id: 'set-cafe', now: T0 + 2 * MINUTE });
    const merged = mergeLearner(deleted.learner, liked.learner);
    assert.equal(merged.ownPhrases[id].deleted, true);
    assert.equal(merged.likes['set:set-cafe'].liked, true);
    const renamed = run(a, { type: 'SET_PROFILE', profile: { name: 'Bea' }, now: T0 + 3 * MINUTE });
    assert.equal(mergeLearner(a.learner, renamed.learner).profile.name, 'Bea');
    assert.equal(mergeLearner(renamed.learner, a.learner).profile.name, 'Bea');
  });
});
