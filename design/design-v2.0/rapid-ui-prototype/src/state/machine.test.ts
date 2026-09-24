import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { keyOf } from './catalog';
import { canHandle } from './chart';
import { transition } from './machine';
import { derive, isLearned, RATING_WINDOW_MS } from './memory';
import { currentPhraseId, memoryOf, phraseProgress, points, upNextIds } from './selectors';
import { cafe, DAY, done, fresh, load, MINUTE, playPhrase, run, T0 } from './testing';

describe('player loop', () => {
  it('walks native → pause → target three times for a new phrase, then holds for a rating', () => {
    let s = load(fresh());
    assert.equal(s.player.repeats, 3);
    const phases: string[] = [];
    for (let i = 0; i < 10; i++) {
      phases.push(`${s.player.repetition}:${s.player.phase}`);
      s = done(s, T0 + i * 1000);
    }
    assert.deepEqual(phases, [
      '1:native', '1:pause', '1:target',
      '2:native', '2:pause', '2:target',
      '3:native', '3:pause', '3:target',
      '3:rate',
    ]);
    assert.equal(s.player.index, 1, 'the hold ends and the next phrase starts');
  });

  it('logs each heard repetition with its measured lengths', () => {
    let s = load(fresh());
    s = done(s, T0 + 1000, 900); // native, 900 ms
    s = done(s, T0 + 2000); // pause
    s = done(s, T0 + 3000, 1500); // target, 1500 ms
    const heard = s.learner.log.filter((e) => e.kind === 'heard');
    assert.equal(heard.length, 1);
    assert.deepEqual([heard[0].kind === 'heard' && heard[0].nativeMs, heard[0].kind === 'heard' && heard[0].targetMs], [900, 1500]);
  });

  it('an unconfirmed target moves on but records and pays nothing', () => {
    let s = load(fresh());
    s = done(done(s, T0 + 1), T0 + 2);
    s = transition(s, { type: 'PHASE_DONE', cycle: s.player.cycle, now: T0 + 3, unconfirmed: true });
    assert.equal(s.player.repetition, 2);
    assert.equal(s.learner.log.length, 0);
    assert.equal(points(s.learner), 0);
  });

  it('failed audio pauses with the language and records nothing', () => {
    let s = load(fresh());
    s = transition(s, { type: 'PHASE_DONE', cycle: s.player.cycle, now: T0 + 5, failure: { lang: 'en-GB', reason: 'no-voice' } });
    assert.equal(s.player.status, 'paused');
    assert.deepEqual(s.player.audioError, { lang: 'en-GB', reason: 'no-voice' });
    assert.equal(s.learner.log.length, 0);
  });

  it('ignores stale completions and events the statechart does not allow', () => {
    let s = load(fresh());
    const stale = s.player.cycle;
    s = transition(s, { type: 'PAUSE', now: T0 + 10 });
    assert.equal(transition(s, { type: 'PHASE_DONE', cycle: stale, now: T0 + 20 }), s);
    assert.equal(canHandle('paused', 'PHASE_DONE'), false);
    assert.equal(transition(s, { type: 'PAUSE', now: T0 + 30 }), s);
    s = transition(s, { type: 'PLAY', now: T0 + 40 });
    assert.equal(transition(s, { type: 'PLAY', now: T0 + 50 }), s);
  });

  it('Next, Previous and Jump keep pause; Play now plays', () => {
    let s = transition(load(fresh()), { type: 'PAUSE', now: T0 + 1 });
    s = transition(s, { type: 'NEXT', now: T0 + 2 });
    assert.equal(s.player.status, 'paused');
    s = transition(s, { type: 'JUMP', index: 3, now: T0 + 3 });
    assert.deepEqual([s.player.index, s.player.status], [3, 'paused']);
    s = transition(s, { type: 'JUMP', index: 4, now: T0 + 4, play: true });
    assert.deepEqual([s.player.index, s.player.status], [4, 'playing']);
  });

  it('Previous restarts after 3 s and goes back before that', () => {
    let s = transition(load(fresh()), { type: 'NEXT', now: T0 });
    assert.equal(transition(s, { type: 'PREV', now: T0 + 1000 }).player.index, 0);
    s = transition(s, { type: 'PREV', now: T0 + 4000 });
    assert.equal(s.player.index, 1);
  });

  it('a new LOAD never inherits shuffle', () => {
    let s = transition(load(fresh()), { type: 'TOGGLE_SHUFFLE', seed: 7 });
    assert.equal(s.player.shuffle, true);
    s = load(s, T0 + 10);
    assert.equal(s.player.shuffle, false);
    assert.deepEqual(s.player.order, cafe());
  });
});

describe('end of the queue', () => {
  const last = (s: ReturnType<typeof fresh>) => transition(s, { type: 'JUMP', index: cafe().length - 1, now: T0 });

  it('repeat mode starts the queue again and counts the pass', () => {
    let s = last(load(fresh({ playMode: 'repeat' })));
    [s] = playPhrase(s, T0);
    assert.equal(s.player.index, 0);
    assert.equal(s.player.status, 'playing');
    assert.equal(s.player.session?.passes, 1);
  });

  it('continue mode appends the next set of the course', () => {
    let s = last(load(fresh({ playMode: 'continue' })));
    [s] = playPhrase(s, T0);
    assert.equal(s.player.setId, 'set-tapas');
    assert.equal(currentPhraseId(s.player), 'tapas-01');
  });

  it('Next on the last phrase follows the play mode', () => {
    const repeat = transition(last(load(fresh({ playMode: 'repeat' }))), { type: 'NEXT', now: T0 + 1 });
    assert.equal(repeat.player.index, 0);
    const cont = transition(last(load(fresh({ playMode: 'continue' }))), { type: 'NEXT', now: T0 + 1 });
    assert.equal(currentPhraseId(cont.player), 'tapas-01');
  });
});

describe('rating window', () => {
  it('a rating is pending for five minutes, can change, then counts at its original time', () => {
    let s = load(fresh());
    s = transition(s, { type: 'RATE', grade: 'hard', now: T0 + 1000 });
    s = transition(s, { type: 'RATE', grade: 'easy', now: T0 + 2 * MINUTE });
    assert.equal(s.pending.length, 1);
    assert.equal(s.pending[0].grade, 'easy');
    assert.equal(s.pending[0].at, T0 + 1000);
    assert.equal(points(s.learner), 0, 'nothing is paid while it can still change');
    s = transition(s, { type: 'COMMIT', now: T0 + 1000 + RATING_WINDOW_MS - 1 });
    assert.equal(s.pending.length, 1);
    s = transition(s, { type: 'COMMIT', now: T0 + 1000 + RATING_WINDOW_MS });
    assert.equal(s.pending.length, 0);
    const rated = s.learner.log.filter((e) => e.kind === 'rated');
    assert.equal(rated.length, 1);
    assert.equal(rated[0].at, T0 + 1000);
    assert.equal(points(s.learner), 3);
  });

  it('undo removes the rating inside the window only', () => {
    let s = transition(load(fresh()), { type: 'RATE', grade: 'easy', now: T0 });
    assert.equal(transition(s, { type: 'UNRATE', now: T0 + MINUTE }).pending.length, 0);
    s = transition(s, { type: 'UNRATE', now: T0 + RATING_WINDOW_MS });
    assert.equal(s.pending.length, 0);
    assert.equal(s.learner.log.filter((e) => e.kind === 'rated').length, 1, 'the window had closed: it counted');
  });

  it('after the window a new rating is a new review', () => {
    let s = transition(load(fresh()), { type: 'RATE', grade: 'easy', now: T0 });
    s = transition(s, { type: 'RATE', grade: 'easy', now: T0 + RATING_WINDOW_MS + 1 });
    assert.equal(s.learner.log.filter((e) => e.kind === 'rated').length, 1, 'the first one counted');
    assert.equal(s.pending.length, 1, 'the second one is pending');
  });

  it('missed brings the phrase back four phrases later', () => {
    let s = load(fresh());
    s = transition(s, { type: 'RATE', grade: 'missed', now: T0 });
    assert.deepEqual(upNextIds(s.player), ['cafe-02', 'cafe-03', 'cafe-04', 'cafe-05', 'cafe-01']);
    s = transition(s, { type: 'RATE', grade: 'missed', now: T0 + 1 });
    assert.equal(s.player.order.filter((id) => id === 'cafe-01').length, 2, 'not added twice');
  });

  it('near the end, missed still leaves another phrase first; on the last phrase it is not re-queued', () => {
    let s = load(fresh(), T0, ['cafe-01', 'cafe-02']);
    s = transition(s, { type: 'RATE', grade: 'missed', now: T0 });
    assert.deepEqual(s.player.order, ['cafe-01', 'cafe-02', 'cafe-01'], 'after the one phrase left');
    s = transition(s, { type: 'JUMP', index: 2, now: T0 + 1, play: true });
    s = transition(s, { type: 'RATE', grade: 'hard', now: T0 + 2 });
    assert.deepEqual(s.player.order, ['cafe-01', 'cafe-02', 'cafe-01'], 'the last phrase is not appended to replay at once');
  });

  it('rating during the hold moves on at once; a rated phrase skips the hold', () => {
    let s = transition(load(fresh()), { type: 'RATE', grade: 'easy', now: T0 });
    for (let i = 0; i < 9; i++) s = done(s, T0 + i);
    assert.equal(s.player.index, 1, 'already rated: no hold');
    for (let i = 0; i < 9; i++) s = done(s, T0 + 100 + i);
    assert.equal(s.player.phase, 'rate');
    s = transition(s, { type: 'RATE', grade: 'hard', now: T0 + 200 });
    assert.equal(s.player.index, 2);
  });
});

describe('points', () => {
  it('listening pays one point per phrase per five minutes', () => {
    let s = load(fresh());
    [s] = playPhrase(s, T0); // three repetitions within a minute
    assert.equal(points(s.learner), 1);
    s = transition(s, { type: 'JUMP', index: 0, now: T0 + 6 * MINUTE });
    [s] = playPhrase(s, T0 + 6 * MINUTE);
    assert.equal(points(s.learner), 2, 'cafe-01 pays again after five minutes');
  });
});

describe('memory through the Rust core', () => {
  function rateAt(s: ReturnType<typeof fresh>, grade: 'missed' | 'hard' | 'easy', at: number) {
    s = transition(s, { type: 'RATE', grade, now: at });
    return transition(s, { type: 'COMMIT', now: at + RATING_WINDOW_MS });
  }

  it('the first Easy on a phrase heard once comes back within a day; heard twice, within four', () => {
    let once = load(fresh());
    once = done(done(done(once, T0 + 1), T0 + 2), T0 + 3);
    once = rateAt(once, 'easy', T0 + 10);
    const onceDue = phraseProgress(once.learner, 'cafe-01', T0).dueAt!;
    assert.ok(onceDue - (T0 + 10) <= DAY);

    let twice = load(fresh());
    for (let i = 0; i < 6; i++) twice = done(twice, T0 + i);
    twice = rateAt(twice, 'easy', T0 + 10);
    const twiceDue = phraseProgress(twice.learner, 'cafe-01', T0).dueAt!;
    assert.ok(twiceDue - (T0 + 10) <= 4 * DAY && twiceDue - (T0 + 10) > DAY);
  });

  it('a reviewed phrase is due when recall falls to 90%, never years out', () => {
    let s = load(fresh());
    let at = T0;
    for (let i = 0; i < 4; i++) {
      s = rateAt(s, 'easy', at);
      const fsrs = memoryOf(s.learner, 'cafe-01').fsrs!;
      assert.ok(fsrs.due - at <= Math.max(1, Math.round(fsrs.stability)) * DAY);
      at = fsrs.due;
    }
    assert.ok(at - T0 < 365 * DAY, 'four on-time reviews stay within a year');
  });

  it('missed goes to relearning ten minutes out and raises difficulty', () => {
    let s = rateAt(load(fresh()), 'easy', T0);
    const before = memoryOf(s.learner, 'cafe-01').fsrs!;
    s = rateAt(s, 'missed', before.due);
    const after = memoryOf(s.learner, 'cafe-01').fsrs!;
    assert.equal(after.state, 'relearning');
    assert.equal(after.due - before.due, 10 * MINUTE);
    assert.ok(after.difficulty > before.difficulty);
  });

  it('learned needs three successful reviews and 21 days of stability; the bonus is paid once', () => {
    let s = load(fresh());
    let at = T0;
    for (let i = 0; i < 6; i++) {
      s = rateAt(s, 'easy', at);
      at = memoryOf(s.learner, 'cafe-01').fsrs!.due;
    }
    const memory = memoryOf(s.learner, 'cafe-01');
    assert.ok(isLearned(memory));
    assert.ok(memory.successes >= 3);
    const bonuses = [...derive(s.learner.log).learnedBonuses.keys()];
    assert.deepEqual(bonuses, [keyOf(s.learner, 'cafe-01')]);
  });
});

describe('queue edits', () => {
  it('play next and add to end', () => {
    let s = load(fresh());
    s = transition(s, { type: 'ENQUEUE', phraseIds: ['tapas-01'], setId: 'set-tapas', at: 'next', now: T0 });
    assert.equal(upNextIds(s.player)[0], 'tapas-01');
    s = transition(s, { type: 'ENQUEUE', phraseIds: ['cafe-03'], setId: 'set-cafe', at: 'next', now: T0 });
    assert.deepEqual(upNextIds(s.player).slice(0, 2), ['cafe-03', 'tapas-01'], 'moved, not duplicated');
    s = transition(s, { type: 'ENQUEUE', phraseIds: ['taxi-01'], setId: 'set-taxi', at: 'end', now: T0 });
    assert.equal(upNextIds(s.player).at(-1), 'taxi-01');
    assert.equal(s.player.setId, null, 'mixed queue');
  });

  it('an empty queue adopts phrases without playing', () => {
    const s = transition(fresh(), { type: 'ENQUEUE', phraseIds: cafe(), setId: 'set-cafe', at: 'end', now: T0 });
    assert.equal(s.player.status, 'paused');
    assert.equal(currentPhraseId(s.player), 'cafe-01');
  });

  it('remove then undo restores the queue; clear keeps only the current phrase', () => {
    const s = load(fresh());
    const removed = transition(s, { type: 'REMOVE_FROM_QUEUE', position: 2 });
    const restored = transition(removed, { type: 'INSERT_IN_QUEUE', position: 2, phraseId: 'cafe-03' });
    assert.deepEqual(restored.player.order, s.player.order);
    assert.deepEqual(transition(s, { type: 'CLEAR_QUEUE' }).player.order, ['cafe-01']);
  });
});

describe('repetitions', () => {
  it('auto plays three for new phrases and one for phrases under review', () => {
    let s = load(fresh());
    s = transition(s, { type: 'RATE', grade: 'easy', now: T0 });
    s = transition(s, { type: 'COMMIT', now: T0 + RATING_WINDOW_MS });
    s = load(s, T0 + RATING_WINDOW_MS + 1);
    assert.equal(s.player.repeats, 1);
    const fixed = run(s, { type: 'SET_PREFS', prefs: { repeats: 3 } });
    assert.equal(fixed.player.repeats, 3);
  });
});

describe('the learner’s own phrases and sets', () => {
  it('adds, groups, likes and deletes', () => {
    let s = run(fresh(), { type: 'ADD_OWN_PHRASE', target: '  ¿Hay   wifi? ', native: 'Is there wifi?', now: T0 });
    const [own] = Object.values(s.learner.ownPhrases);
    assert.equal(own.target, '¿Hay wifi?');
    s = run(
      s,
      { type: 'CREATE_SET', title: 'Travel bits', phraseIds: [own.id, 'taxi-01'], now: T0 + 1 },
      { type: 'TOGGLE_LIKE', kind: 'phrase', id: own.id, now: T0 + 2 },
    );
    const [set] = Object.values(s.learner.ownSets);
    assert.deepEqual(set.phraseIds, [own.id, 'taxi-01']);
    assert.equal(s.learner.likes[`phrase:${own.id}`].liked, true);
    s = run(s, { type: 'DELETE_OWN_PHRASE', id: own.id, now: T0 + 3 });
    assert.equal(s.learner.ownPhrases[own.id].deleted, true);
    // Undo brings it back, set membership and like intact.
    s = run(s, { type: 'RESTORE_OWN_PHRASE', id: own.id, now: T0 + 4 }, { type: 'DELETE_SET', setId: set.id, now: T0 + 5 }, { type: 'RESTORE_SET', setId: set.id, now: T0 + 6 });
    assert.equal(s.learner.ownPhrases[own.id].deleted, false);
    assert.equal(s.learner.ownPhrases[own.id].updatedAt, T0 + 4);
    assert.equal(s.learner.ownSets[set.id].deleted, false);
    assert.deepEqual(s.learner.ownSets[set.id].phraseIds, [own.id, 'taxi-01']);
    assert.equal(run(s, { type: 'RESTORE_SET', setId: set.id, now: T0 + 7 }), s, 'restoring a live set does nothing');
    // Undoing a removal puts the phrase back where it was.
    s = run(s, { type: 'REMOVE_FROM_SET', setId: set.id, phraseId: own.id, now: T0 + 8 }, { type: 'ADD_TO_SET', setId: set.id, phraseIds: [own.id], at: 0, now: T0 + 9 });
    assert.deepEqual(s.learner.ownSets[set.id].phraseIds, [own.id, 'taxi-01']);
  });

  it('editing your phrase keeps its id and history', () => {
    let s = run(fresh(), { type: 'ADD_OWN_PHRASE', target: 'Hola', native: 'Hi', now: T0 });
    const id = Object.keys(s.learner.ownPhrases)[0];
    s = run(s, { type: 'EDIT_OWN_PHRASE', id, target: ' ¡Hola! ', native: 'Hello', now: T0 + 1 });
    assert.deepEqual([s.learner.ownPhrases[id].target, s.learner.ownPhrases[id].native], ['¡Hola!', 'Hello']);
    assert.equal(run(s, { type: 'EDIT_OWN_PHRASE', id, target: '', native: 'x', now: T0 + 2 }), s, 'an empty text is refused');
  });

  it('moves a phrase within your set', () => {
    let s = run(fresh(), { type: 'CREATE_SET', title: 'Mine', phraseIds: ['cafe-01', 'cafe-02', 'cafe-03'], now: T0 });
    const setId = Object.keys(s.learner.ownSets)[0];
    s = run(s, { type: 'MOVE_IN_SET', setId, phraseId: 'cafe-03', delta: -1, now: T0 + 1 });
    assert.deepEqual(s.learner.ownSets[setId].phraseIds, ['cafe-01', 'cafe-03', 'cafe-02']);
    assert.equal(run(s, { type: 'MOVE_IN_SET', setId, phraseId: 'cafe-01', delta: -1, now: T0 + 2 }), s, 'the first cannot move up');
  });

  it('changing course empties the queue', () => {
    const s = run(load(fresh()), { type: 'SET_PROFILE', profile: { targetLang: 'bg-BG' }, now: T0 });
    assert.equal(s.player.status, 'idle');
    assert.equal(s.player.order.length, 0);
  });
});

describe('merging another device', () => {
  it("that deleted the phrase playing here pauses on the next one instead of freezing", () => {
    let s = run(fresh(), { type: 'ADD_OWN_PHRASE', target: 'Hola', native: 'Hi', now: T0 });
    const id = Object.keys(s.learner.ownPhrases)[0];
    s = run(s, { type: 'LOAD', phraseIds: [id, 'cafe-01'], setId: null, startIndex: 0, shuffle: false, now: T0 + 1, seed: 1 });
    assert.equal(s.player.status, 'playing');
    const remote = { ...s.learner, ownPhrases: { [id]: { ...s.learner.ownPhrases[id], deleted: true, updatedAt: T0 + 5 } } };
    s = run(s, { type: 'MERGE_REMOTE', learner: remote, now: T0 + 6 });
    assert.equal(s.learner.ownPhrases[id].deleted, true);
    assert.deepEqual(s.player.order, ['cafe-01']);
    assert.equal(s.player.index, 0);
    assert.equal(s.player.status, 'paused');
  });

  it('that changed nothing in the queue leaves playback alone', () => {
    const s = load(fresh());
    const remote = { ...s.learner, profile: { ...s.learner.profile, name: 'Bea', updatedAt: T0 + 5 } };
    const after = run(s, { type: 'MERGE_REMOTE', learner: remote, now: T0 + 6 });
    assert.equal(after.learner.profile.name, 'Bea');
    assert.equal(after.player, s.player);
  });
});
