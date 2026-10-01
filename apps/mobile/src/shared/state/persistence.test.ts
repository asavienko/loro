import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { transition } from './machine';
import { derive, RATING_WINDOW_MS } from './memory';
import { mergeLearner } from './merge';
import { installLanguages } from '../content';
import { installFixture } from '../content/fixture';
import { loadState, parseState, sanitizeLearner, sanitizeState, serializeState, syncWithServer } from './persistence';
import { memoryOf, points } from './selectors';
import { done, fresh, load, MINUTE, run, T0 } from './testing';
import type { Device } from './types';

const device: Device = { id: 'dev', instance: 'next', seq: 0 };

describe('persistence', () => {
  it('keeps a saved course on a start before the server’s languages are on the device (an update)', () => {
    const profile = { name: 'Ana', nativeLang: 'bg-BG', targetLang: 'es-ES', onboarded: true, updatedAt: T0 };
    installLanguages({ version: 'none', languages: [] });
    try {
      const learner = sanitizeLearner({ ...fresh().learner, profile });
      assert.equal(learner.profile.nativeLang, 'bg-BG');
      assert.equal(learner.profile.targetLang, 'es-ES');
      // A code the app doesn't handle still falls back, and a course is never the learner's own language.
      const odd = sanitizeLearner({ ...fresh().learner, profile: { ...profile, nativeLang: 'xx-XX', targetLang: 'en-GB' } });
      assert.equal(odd.profile.nativeLang, 'en-GB');
      assert.notEqual(odd.profile.targetLang, 'en-GB');
    } finally {
      installFixture();
    }
  });

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

  it('reopens on the same copy of a phrase queued twice, and floors a fractional index', () => {
    const s = load(fresh());
    const order = ['cafe-01', 'cafe-02', 'cafe-01'];
    const at = (index: number) => parseState(serializeState({ ...s, player: { ...s.player, order, baseOrder: order, index } }), device)!.player.index;
    assert.equal(at(2), 2, 'the second copy, not the first');
    assert.equal(at(1.5), 1);
  });

  it('queues only installed phrases, keeping the current one', () => {
    const s = load(fresh());
    const raw = JSON.parse(serializeState(s));
    raw.player.order = ['gone', ...raw.player.order];
    raw.player.index = 1;
    const back = sanitizeState(raw, device)!;
    assert.equal(back.player.order[back.player.index], 'cafe-01');
    assert.ok(!back.player.order.includes('gone'));
  });

  it('keeps progress on served phrases that are not installed, and drops own ones that are gone (plan 106)', () => {
    const raw = JSON.parse(serializeState(load(fresh())));
    // Another course's phrase, or a shared set not downloaded yet: still the learner's.
    raw.learner.likes['phrase:u3k9x2m1q-01'] = { liked: true, at: 1 };
    raw.learner.likes['set:set-u-3k9x2m1q'] = { liked: true, at: 1 };
    raw.learner.likes['phrase:mine-p-gone'] = { liked: true, at: 1 };
    raw.learner.likes['phrase:Not An Id'] = { liked: true, at: 1 };
    const back = sanitizeState(raw, device)!;
    assert.equal(back.learner.likes['phrase:u3k9x2m1q-01']?.liked, true);
    assert.equal(back.learner.likes['set:set-u-3k9x2m1q']?.liked, true);
    assert.equal(back.learner.likes['phrase:mine-p-gone'], undefined);
    assert.equal(back.learner.likes['phrase:Not An Id'], undefined);
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

  it('keeps an own phrase’s notes only when they are whole, its bank link only when the bank has it', () => {
    const raw = JSON.parse(serializeState(fresh()));
    const phrase = { native: 'b', targetLang: 'es-ES', nativeLang: 'en-GB', createdAt: 1, updatedAt: 1, deleted: false };
    const notes = {
      mnemonic: { title: 'm', text: 'x' },
      grammar: { title: 'g', text: 'y' },
      pronunciation: { title: 'p', text: 'z', ipa: '[a]', respelling: 'AH' },
    };
    raw.learner.ownPhrases = {
      'mine-p-bank': { ...phrase, target: 'a', bankId: 'bank-hotel-es-02' },
      'mine-p-wrongbank': { ...phrase, target: 'b', bankId: 'bank-hotel-bg-02' },
      'mine-p-ai': { ...phrase, target: 'c', notes, image: ['coffee', 'not_an_icon', 'coffee_maker'] },
      'mine-p-half': { ...phrase, target: 'd', notes: { mnemonic: notes.mnemonic } },
    };
    const own = sanitizeState(raw, device)!.learner.ownPhrases;
    assert.equal(own['mine-p-bank'].bankId, 'bank-hotel-es-02');
    assert.equal(own['mine-p-wrongbank'].bankId, undefined, 'a bank phrase of another language');
    assert.deepEqual(own['mine-p-ai'].notes, notes);
    assert.deepEqual(own['mine-p-ai'].image, ['coffee'], 'only icons the app can draw');
    assert.equal(own['mine-p-half'].notes, undefined, 'all three or none');
  });

  it('keeps where a phrase came from, and only the origins it knows', () => {
    const raw = JSON.parse(serializeState(fresh()));
    const phrase = { native: 'b', targetLang: 'es-ES', nativeLang: 'en-GB', createdAt: 1, updatedAt: 1, deleted: false };
    raw.learner.ownPhrases = {
      'mine-p-ai': { ...phrase, target: 'a', origin: 'ai' },
      'mine-p-bank': { ...phrase, target: 'b', origin: 'bank' },
      'mine-p-odd': { ...phrase, target: 'c', origin: 'rumour' },
      'mine-p-own': { ...phrase, target: 'd' },
    };
    const own = sanitizeState(raw, device)!.learner.ownPhrases;
    assert.deepEqual(Object.values(own).map((p) => p.origin), ['ai', 'bank', undefined, undefined]);
    assert.equal('origin' in own['mine-p-own'], false, 'a phrase the learner wrote saves no origin');
  });

  it('RESTORE goes through the same sanitising', () => {
    const s = fresh();
    assert.equal(transition(s, { type: 'RESTORE', state: { junk: true } }), s);
  });
});

describe('merge', () => {
  it('a rating pending in two tabs of the same browser is counted once', () => {
    const rated = transition(load(fresh()), { type: 'RATE', grade: 'easy', now: T0 });
    // A second tab of this browser: same device id, its own instance, the same pending rating.
    const tabB = { ...rated, device: { ...rated.device, instance: 'tab-b' } };
    const later = T0 + RATING_WINDOW_MS + 1;
    const a = transition(rated, { type: 'COMMIT', now: later });
    const b = transition(tabB, { type: 'COMMIT', now: later });
    const merged = mergeLearner(a.learner, b.learner);
    assert.equal(merged.log.filter((e) => e.kind === 'rated').length, 1);
    // And a tab that merges first, then commits, doesn't add it again.
    const bAfterMerge = transition({ ...tabB, learner: mergeLearner(tabB.learner, a.learner) }, { type: 'COMMIT', now: later });
    assert.equal(bAfterMerge.learner.log.filter((e) => e.kind === 'rated').length, 1);
  });

  it('settles a tie the same way on both devices', () => {
    const base = fresh().learner;
    const set = (title: string) => ({ id: 'mine-s-1', title, phraseIds: [], targetLang: 'es-ES' as const, createdAt: T0, updatedAt: T0 + 5, deleted: false });
    const a = { ...base, ownSets: { 'mine-s-1': set('A') }, profile: { ...base.profile, name: 'Ana', updatedAt: T0 + 5 } };
    const b = { ...base, ownSets: { 'mine-s-1': set('B') }, profile: { ...base.profile, name: 'Bea', updatedAt: T0 + 5 } };
    const ab = mergeLearner(a, b);
    const ba = mergeLearner(b, a);
    assert.equal(ab.ownSets['mine-s-1'].title, ba.ownSets['mine-s-1'].title);
    assert.equal(ab.profile.name, ba.profile.name);
  });

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
    // A phrase made on a device before plan 108, and its upload marking it deleted.
    const id = 'mine-p-a.b-1';
    const s0 = fresh();
    const own = { id, targetLang: 'es-ES' as const, nativeLang: 'en-GB' as const, target: 'Hola', native: 'Hi', createdAt: T0, updatedAt: T0, deleted: false };
    const a = { ...s0, learner: { ...s0.learner, ownPhrases: { [id]: own } } };
    const deleted = run(a, { type: 'OWN_UPLOADED', phraseIds: [id], setIds: [], now: T0 + MINUTE });
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
    const pending = run(fresh(), { type: 'TOGGLE_LIKE', kind: 'set', id: 'set-cafe', now: T0 }, { type: 'SET_PREFS', prefs: { speed: 0.8 }, now: T0 + 1 });
    const state = loadState({ saved: serializeState(saved), pending: serializeState(pending) }, () => fresh());
    assert.equal(state.learner.likes['set:set-taxi'].liked, true, 'another tab’s later progress is kept');
    assert.equal(state.learner.likes['set:set-cafe'].liked, true, 'the closing page’s progress is kept');
    assert.equal(state.prefs.speed, 0.8, 'device settings come from the closing page');
    assert.deepEqual(loadState({ saved: null, pending: null }, () => fresh()).learner, fresh().learner);
  });

  it("takes another tab's progress and pending ratings, but not its queue or settings", () => {
    const saved = load(fresh());
    const otherTab = run(load(fresh(), T0, ['taxi-01']), { type: 'RATE', grade: 'hard', now: T0 + 1 }, { type: 'SET_PREFS', prefs: { speed: 1.25 }, now: T0 + 2 }, {
      type: 'TOGGLE_LIKE', kind: 'set', id: 'set-taxi', now: T0 + 2,
    });
    const state = loadState({ saved: serializeState(saved), pending: null, others: [serializeState(otherTab)] }, () => fresh());
    assert.equal(state.learner.likes['set:set-taxi'].liked, true);
    assert.deepEqual(state.pending.map((p) => p.phraseId), ['taxi-01'], 'its rating still commits');
    assert.deepEqual(state.player.order, saved.player.order, 'not its queue');
    assert.equal(state.prefs.speed, saved.prefs.speed, 'not its speed');
  });

  it('merges progress left in localStorage beside an IndexedDB copy', () => {
    const indexedDb = run(fresh(), { type: 'TOGGLE_LIKE', kind: 'set', id: 'set-taxi', now: T0 + 5 });
    // Saved in a session where IndexedDB didn't open.
    const localOnly = run(fresh(), { type: 'TOGGLE_LIKE', kind: 'set', id: 'set-cafe', now: T0 + 9 });
    const state = loadState({ saved: serializeState(indexedDb), pending: null, stray: serializeState(localOnly) }, () => fresh());
    assert.equal(state.learner.likes['set:set-taxi'].liked, true);
    assert.equal(state.learner.likes['set:set-cafe'].liked, true, 'the fallback session’s progress is not lost');
  });
});

describe('persistence of the player’s round-3 settings', () => {
  it('keeps a longer pause and a folded queue hint; anything else is the default', () => {
    const s = run(fresh(), { type: 'SET_PREFS', prefs: { pauseLength: 'longer', queueHintDone: true }, now: T0 });
    const back = parseState(serializeState(s), device)!;
    assert.equal(back.prefs.pauseLength, 'longer');
    assert.equal(back.prefs.queueHintDone, true);
    const raw = JSON.parse(serializeState(s));
    raw.prefs.pauseLength = 'forever';
    raw.prefs.queueHintDone = 'yes';
    const odd = sanitizeState(raw, device)!;
    assert.equal(odd.prefs.pauseLength, 'standard');
    assert.equal(odd.prefs.queueHintDone, false);
    // A save from before these settings existed.
    delete raw.prefs.pauseLength;
    assert.equal(sanitizeState(raw, device)!.prefs.pauseLength, 'standard');
  });

  it('keeps where a queue came from, only in a known shape, and never a running phase', () => {
    const s = transition(fresh(), { type: 'LOAD', phraseIds: ['cafe-01'], setId: null, source: { kind: 'library', view: 'due' }, now: T0, seed: 1 });
    const back = parseState(serializeState(s), device)!;
    assert.deepEqual(back.player.source, { kind: 'library', view: 'due' });
    assert.deepEqual([back.player.phaseStartedAt, back.player.phaseMs], [null, null]);
    const raw = JSON.parse(serializeState(s));
    for (const bad of [{ kind: 'library', view: 'ownSets' }, { kind: 'mystery' }, 'review', null]) {
      raw.player.source = bad;
      assert.equal(sanitizeState(raw, device)!.player.source, null, JSON.stringify(bad));
    }
    raw.player.source = { kind: 'review', extra: 1 };
    assert.deepEqual(sanitizeState(raw, device)!.player.source, { kind: 'review' });
  });

  it('keeps whether an ended queue heard its last target; a save without it keeps it hidden (R-01)', () => {
    const review = transition(fresh(), { type: 'LOAD', phraseIds: ['cafe-01'], setId: null, source: { kind: 'review' }, now: T0, seed: 1 });
    const skipped = run(review, { type: 'NEXT', now: T0 + 1 });
    assert.equal(parseState(serializeState(skipped), device)!.player.targetHeard, false);
    const heard = run(done(done(review, T0 + 1), T0 + 2), { type: 'NEXT', now: T0 + 3 });
    assert.equal(parseState(serializeState(heard), device)!.player.targetHeard, true);
    const raw = JSON.parse(serializeState(heard));
    delete raw.player.targetHeard;
    assert.equal(sanitizeState(raw, device)!.player.targetHeard, false, 'an older save');
    // Mid-phrase, a restored player starts the phrase from its prompt: not heard in that play.
    const midPhrase = JSON.parse(serializeState(done(done(review, T0 + 1), T0 + 2)));
    assert.equal(sanitizeState(midPhrase, device)!.player.targetHeard, false);
  });
});
