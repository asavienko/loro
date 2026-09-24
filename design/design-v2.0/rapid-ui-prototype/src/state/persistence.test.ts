import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { transition } from './machine';
import { derive, RATING_WINDOW_MS } from './memory';
import { mergeLearner } from './merge';
import { loadState, parseState, sanitizeState, serializeState, syncWithServer } from './persistence';
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

  it('stores the log compactly, about a third of the plain size, and reads it back exactly', () => {
    let s = load(fresh());
    for (let i = 0; i < 40; i++) s = done(s, T0 + i * 1000, 900 + i);
    s = run(s, { type: 'RATE', grade: 'hard', now: T0 + 60_000 }, { type: 'COMMIT', now: T0 + 60_000 + RATING_WINDOW_MS });
    const compact = serializeState(s);
    const plain = JSON.stringify(s);
    assert.ok(compact.length < plain.length * 0.6, `${compact.length} vs ${plain.length}`);
    assert.deepEqual(parseState(compact, device)!.learner, s.learner);
    assert.deepEqual(parseState(plain, device)!.learner, s.learner, 'plain saves still load');
  });

  it('drops entries with impossible times, and memory survives a review the core rejects', () => {
    const raw = JSON.parse(serializeState(fresh()));
    raw.learner.log = [
      { id: 'x-1', at: -5, device: 'x', kind: 'rated', key: 'en-GB>es-ES:cafe-01', phraseId: 'cafe-01', setId: null, grade: 'easy' },
      { id: 'x-2', at: T0, device: 'x', kind: 'rated', key: 'en-GB>es-ES:cafe-01', phraseId: 'cafe-01', setId: null, grade: 'easy' },
    ];
    const s = sanitizeState(raw, device)!;
    assert.deepEqual(s.learner.log.map((e) => e.id), ['x-2']);
    // Past sanitising (e.g. a merge), a rejected review is skipped, not thrown.
    const bad = [{ ...s.learner.log[0], id: 'x-0', at: -5 }, ...s.learner.log];
    assert.equal(derive(bad as typeof s.learner.log).memories.size, 1);
  });

  it('caps what the forms would have capped, and keeps carried-over points sane', () => {
    const raw = JSON.parse(serializeState(fresh()));
    raw.learner.ownPhrases = { 'mine-p-x': { target: 'a'.repeat(500), native: 'b', targetLang: 'es-ES', nativeLang: 'en-GB', createdAt: 1, updatedAt: 1, deleted: false } };
    raw.learner.ownSets = { 'mine-s-x': { title: 't'.repeat(500), targetLang: 'es-ES', phraseIds: [], createdAt: 1, updatedAt: 1, deleted: false } };
    raw.learner.log = [
      { id: 'c-1', at: 1, device: 'x', kind: 'carryover', points: -50 },
      { id: 'c-2', at: 2, device: 'x', kind: 'carryover', points: 12.6 },
    ];
    const s = sanitizeState(raw, device)!;
    assert.equal(s.learner.ownPhrases['mine-p-x'].target.length, 120);
    assert.equal(s.learner.ownSets['mine-s-x'].title.length, 60);
    assert.deepEqual(s.learner.log.map((e) => (e.kind === 'carryover' ? e.points : null)), [13]);
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

describe('server sync', () => {
  it('fetches, merges and sends back the merge; a 404 means a first sync', async () => {
    const local = run(fresh(), { type: 'TOGGLE_LIKE', kind: 'set', id: 'set-cafe', now: T0 });
    const remote = run(fresh(), { type: 'TOGGLE_LIKE', kind: 'set', id: 'set-taxi', now: T0 + 1 });
    const sent: unknown[] = [];
    const original = globalThis.fetch;
    let serverHas: unknown = remote.learner;
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        sent.push(JSON.parse(String(init.body)));
        return new Response(null, { status: 204 });
      }
      return serverHas === null ? new Response(null, { status: 404 }) : Response.json(serverHas);
    }) as typeof fetch;
    try {
      const merged = await syncWithServer(local.learner, 'https://example.test/sync');
      assert.equal(merged.likes['set:set-cafe'].liked, true);
      assert.equal(merged.likes['set:set-taxi'].liked, true);
      assert.deepEqual(sent[0], merged);
      serverHas = null;
      const first = await syncWithServer(local.learner, 'https://example.test/sync');
      assert.equal(first, local.learner);
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe('loading', () => {
  it('merges the copy a closing page left with the saved progress', () => {
    const saved = run(fresh(), { type: 'TOGGLE_LIKE', kind: 'set', id: 'set-taxi', now: T0 + 5 });
    const pending = run(fresh(), { type: 'TOGGLE_LIKE', kind: 'set', id: 'set-cafe', now: T0 }, { type: 'SET_PREFS', prefs: { speed: 0.8 } });
    const state = loadState({ saved: serializeState(saved), pending: serializeState(pending) }, () => fresh());
    assert.equal(state.learner.likes['set:set-taxi'].liked, true, 'another tab’s later progress is kept');
    assert.equal(state.learner.likes['set:set-cafe'].liked, true, 'the closing page’s progress is kept');
    assert.equal(state.prefs.speed, 0.8, 'device settings come from the closing page');
    assert.deepEqual(loadState({ saved: null, pending: null }, () => fresh()).learner, fresh().learner);
  });
});
