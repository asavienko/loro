import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { keyOf } from './catalog';
import { canHandle } from './chart';
import { transition } from './machine';
import { derive, isLearned, RATING_WINDOW_MS } from './memory';
import { currentPhraseId, memoryOf, phraseProgress, points, previouslyPlayed, sessionSummary, upNextIds } from './selectors';
import { addLocalDays, HOUR, startOfLocalDay } from './clock';
// Phase timing, one-pass queues and undo after moving on (the player's round-3 changes).
import { findPhrase, OWN_PHRASE_PREFIX, OWN_SET_PREFIX } from './catalog';
import { requeuesOn } from './machine';
import { measuredTargetMs, pendingFor, phaseDurationMs } from './selectors';
import { pauseMs, RATE_HOLD_MS } from './timing';
import { cafe, DAY, done, fresh, load, MINUTE, playPhrase, run, T0 } from './testing';
import { isTargetRevealed } from '../ui/phase';

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
    const undone = transition(s, { type: 'UNRATE', now: T0 + MINUTE });
    // Kept as a tombstone until the window closes (so the undo reaches other tabs), never counted.
    assert.equal(undone.pending.filter((p) => !p.undone).length, 0);
    const later = transition(undone, { type: 'COMMIT', now: T0 + RATING_WINDOW_MS });
    assert.equal(later.pending.length, 0);
    assert.equal(later.learner.log.filter((e) => e.kind === 'rated').length, 0);
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

  it('the first Easy comes back within a day on the day a phrase is first heard; within four once heard on an earlier day', () => {
    // Local times, so the calendar days are the same in any time zone.
    const morning = startOfLocalDay(T0) + 10 * HOUR;
    let today = load(fresh(), morning);
    for (let i = 0; i < 9; i++) today = done(today, morning + i * 1000); // all three repetitions
    today = rateAt(today, 'easy', morning + 10_000);
    assert.equal(phraseProgress(today.learner, 'cafe-01', morning).dueAt! - (morning + 10_000), DAY, 'three repetitions today are still one day');

    const lastNight = addLocalDays(morning, -1) + 10 * HOUR;
    let earlier = load(fresh(), lastNight);
    earlier = done(done(done(earlier, lastNight + 1), lastNight + 2), lastNight + 3); // heard once, last night
    earlier = rateAt(earlier, 'easy', morning);
    const earlierDue = phraseProgress(earlier.learner, 'cafe-01', morning).dueAt!;
    assert.ok(earlierDue - morning <= 4 * DAY && earlierDue - morning > DAY);
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
    const fixed = run(s, { type: 'SET_PREFS', prefs: { repeats: 3 }, now: T0 + 50 });
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
    // A phrase is in a set once, however it's added.
    s = run(s, { type: 'ADD_TO_SET', setId: set.id, phraseIds: ['cafe-01', 'cafe-01'], now: T0 + 10 });
    assert.deepEqual(s.learner.ownSets[set.id].phraseIds, [own.id, 'taxi-01', 'cafe-01']);
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

  it('a new phrase or set gets the id promised to the caller, though the speech took the counter first', () => {
    // The store promises the counter's next id as last rendered; a heard entry, not yet rendered,
    // takes that number first. The new phrase and set keep the promised ids all the same.
    let s = load(fresh());
    const promised = (prefix: string, state: typeof s) => `${prefix}dev.tab-${(state.device.seq + 1).toString(36)}`;
    const phraseId = promised(OWN_PHRASE_PREFIX, s);
    s = done(done(done(s, T0 + 1), T0 + 2), T0 + 3); // the target is heard: an id from the counter
    s = run(s, { type: 'ADD_OWN_PHRASE', target: '¿Hay wifi?', native: 'Is there wifi?', now: T0 + 4, id: phraseId });
    assert.equal(s.learner.ownPhrases[phraseId]?.target, '¿Hay wifi?');
    const setId = promised(OWN_SET_PREFIX, s);
    s = done(done(done(s, T0 + 5), T0 + 6), T0 + 7);
    s = run(s, { type: 'CREATE_SET', title: 'Travel bits', phraseIds: [phraseId], now: T0 + 8, id: setId });
    assert.equal(s.learner.ownSets[setId]?.title, 'Travel bits');
    // An id already in use is never reused: the counter's next one instead.
    s = run(s, { type: 'ADD_OWN_PHRASE', target: 'Hola', native: 'Hi', now: T0 + 9, id: phraseId });
    assert.equal(s.learner.ownPhrases[phraseId].target, '¿Hay wifi?');
    assert.equal(Object.keys(s.learner.ownPhrases).length, 2);
  });

  it('saves what was kept in Make a set at once: new phrases, existing ones, one new set', () => {
    let s = run(fresh(), { type: 'ADD_OWN_PHRASE', target: 'Hola', native: 'Hi', now: T0 });
    const mine = Object.keys(s.learner.ownPhrases)[0];
    const promised = (n: number) => `dev.tab-${(s.device.seq + n).toString(36)}`;
    const [aiId, bankId, setId] = [`${OWN_PHRASE_PREFIX}${promised(1)}`, `${OWN_PHRASE_PREFIX}${promised(2)}`, `${OWN_SET_PREFIX}${promised(3)}`];
    s = run(s, {
      type: 'ADD_PICKS',
      picks: [
        { target: '¿Hay  farmacia? ', native: 'Is there a pharmacy?', origin: 'ai', id: aiId },
        { phraseId: 'cafe-01' },
        { target: 'Me duele la garganta', native: 'I have a sore throat', origin: 'bank', id: bankId },
        { phraseId: mine },
        { phraseId: 'nowhere-01' },
      ],
      title: 'Pharmacy',
      id: setId,
      now: T0 + 1,
    });
    assert.deepEqual(s.learner.ownSets[setId].phraseIds, [aiId, 'cafe-01', bankId, mine], 'in the order kept; an unknown phrase is left out');
    assert.equal(s.learner.ownSets[setId].title, 'Pharmacy');
    assert.equal(s.learner.ownPhrases[aiId].target, '¿Hay farmacia?');
    assert.equal(s.learner.ownPhrases[aiId].origin, 'ai');
    assert.equal(s.learner.ownPhrases[bankId].origin, 'bank');
    assert.equal(s.learner.ownPhrases[mine].origin, undefined);
    // Corrected by the learner, an AI phrase is still one no native speaker has checked.
    s = run(s, { type: 'EDIT_OWN_PHRASE', id: aiId, target: '¿Hay una farmacia?', native: 'Is there a pharmacy?', now: T0 + 2 });
    assert.equal(s.learner.ownPhrases[aiId].origin, 'ai');
  });

  it('Make a set can fill one of your sets instead, and saves nothing when nothing was kept', () => {
    let s = run(fresh(), { type: 'CREATE_SET', title: 'Trip', phraseIds: ['cafe-01'], now: T0 });
    const setId = Object.keys(s.learner.ownSets)[0];
    s = run(s, { type: 'ADD_PICKS', picks: [{ phraseId: 'cafe-01' }, { target: 'Hola', native: 'Hi' }], setId, now: T0 + 1 });
    const [hola] = Object.values(s.learner.ownPhrases);
    assert.deepEqual(s.learner.ownSets[setId].phraseIds, ['cafe-01', hola.id]);
    assert.equal(Object.keys(s.learner.ownSets).length, 1);
    assert.equal(run(s, { type: 'ADD_PICKS', picks: [{ target: '  ', native: 'x' }], title: 'Empty', now: T0 + 2 }), s);
    assert.equal(canHandle('playing', 'ADD_PICKS'), true, 'saving never waits for the player');
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

describe('clearing the queue', () => {
  it('undo puts the cleared phrases after the phrase playing by then', () => {
    let s = load(fresh());
    const cleared = upNextIds(s.player);
    s = run(s, { type: 'CLEAR_QUEUE' }, { type: 'ENQUEUE', phraseIds: ['taxi-01'], setId: null, at: 'end', now: T0 + 1 }, { type: 'NEXT', now: T0 + 2 });
    assert.equal(currentPhraseId(s.player), 'taxi-01');
    s = run(s, { type: 'RESTORE_UP_NEXT', phraseIds: cleared });
    assert.equal(currentPhraseId(s.player), 'taxi-01');
    assert.deepEqual(upNextIds(s.player), cleared);
  });

  it("a removed phrase's undo keeps its distance ahead even after playback moved on", () => {
    let s = load(fresh());
    // cafe-04 was two places ahead of cafe-01 (up next: 02, 03, 04, 05).
    s = run(s, { type: 'REMOVE_FROM_QUEUE', position: 3 }, { type: 'NEXT', now: T0 + 1 });
    assert.equal(currentPhraseId(s.player), 'cafe-02');
    s = run(s, { type: 'RESTORE_UP_NEXT', phraseIds: ['cafe-04'], offset: 2 });
    assert.deepEqual(upNextIds(s.player), ['cafe-03', 'cafe-05', 'cafe-04']);
  });

  it('shuffle off after an undo keeps the restored phrases where they came back', () => {
    let s = load(fresh());
    const upNext = upNextIds(s.player);
    s = run(s, { type: 'CLEAR_QUEUE' }, { type: 'RESTORE_UP_NEXT', phraseIds: upNext });
    s = run(s, { type: 'TOGGLE_SHUFFLE', seed: 7 }, { type: 'TOGGLE_SHUFFLE', seed: 7 });
    assert.deepEqual(upNextIds(s.player), upNext);
  });
});

describe('player review fixes', () => {
  it("a course switched on another tab stops this tab's queue", () => {
    const s = run(load(fresh()), { type: 'PLAY', now: T0 });
    const remote = { ...s.learner, profile: { ...s.learner.profile, targetLang: 'bg-BG' as const, updatedAt: T0 + 5 } };
    const after = run(s, { type: 'MERGE_REMOTE', learner: remote, now: T0 + 6 });
    assert.equal(after.learner.profile.targetLang, 'bg-BG');
    assert.equal(after.player.status, 'idle');
    assert.deepEqual(after.player.order, []);
  });

  it("another course's phrase isn't queued", () => {
    const s = run(load(fresh()), { type: 'ENQUEUE', phraseIds: ['bg-kafene-01', 'tapas-01'], setId: null, at: 'next', now: T0 });
    assert.ok(!s.player.order.includes('bg-kafene-01'));
    assert.ok(s.player.order.includes('tapas-01'));
  });

  it('continue mode after a queue with no set moves past what it played', () => {
    let s = load(fresh({ playMode: 'continue' }), T0, ['cafe-01'], null);
    s = run(s, { type: 'NEXT', now: T0 + 1 });
    const order = s.player.order;
    assert.notEqual(order[s.player.index], 'cafe-01', 'not the phrase just heard again');
  });

  it("shuffle on and off leaves a missed phrase's copy a few phrases on", () => {
    let s = run(load(fresh()), { type: 'NEXT', now: T0 }, { type: 'RATE', grade: 'missed', now: T0 + 1 });
    const copyAt = s.player.order.lastIndexOf('cafe-02');
    assert.ok(copyAt > s.player.index + 1);
    s = run(s, { type: 'TOGGLE_SHUFFLE', seed: 3 }, { type: 'TOGGLE_SHUFFLE', seed: 3 });
    assert.equal(s.player.order.lastIndexOf('cafe-02'), copyAt);
  });

  it('an audio error is left behind on Next', () => {
    let s = run(load(fresh()), { type: 'PLAY', now: T0 });
    s = run(s, { type: 'PHASE_DONE', cycle: s.player.cycle, now: T0 + 1, failure: { lang: 'en-GB', reason: 'silent' } });
    assert.ok(s.player.audioError);
    s = run(s, { type: 'NEXT', now: T0 + 2 });
    assert.equal(s.player.audioError, null);
  });
});

describe('previously played', () => {
  it("lists this course's phrases only", () => {
    const s = load(fresh());
    const heard = (key: string, phraseId: string, setId: string, at: number) =>
      ({ id: `${s.device.id}.h-${at}`, at, device: s.device.id, kind: 'heard' as const, key, phraseId, setId, targetMs: 1000, nativeMs: 1000 });
    const withLog = { ...s, learner: { ...s.learner, log: [heard('en-GB>bg-BG:bg-kafene-01', 'bg-kafene-01', 'set-bg-kafene', T0 - 2), heard('en-GB>es-ES:tapas-01', 'tapas-01', 'set-tapas', T0 - 1)] } };
    assert.deepEqual(previouslyPlayed(withLog).map((e) => e.phraseId), ['tapas-01']);
  });
});

describe('continue mode (regression)', () => {
  it('keeps going round the course while phrases are left to learn', () => {
    let s = load(fresh({ playMode: 'continue' }));
    for (let i = 0; i < 60; i++) s = run(s, { type: 'NEXT', now: T0 + i });
    assert.equal(s.player.ended, false);
    assert.ok(s.player.order.length > 30, `went past one pass (${s.player.order.length})`);
  });
});

describe('undo inside the window (regression)', () => {
  it('a phrase whose rating was undone waits to be rated again', () => {
    let s = run(load(fresh()), { type: 'RATE', grade: 'easy', now: T0 }, { type: 'UNRATE', now: T0 + 1 });
    for (let i = 0; i < 9 && s.player.phase !== 'rate'; i++) s = done(s, T0 + 10 + i);
    assert.equal(s.player.phase, 'rate');
    assert.equal(s.player.index, 0);
  });
});

describe('session and settings (regression)', () => {
  it('Clear queue keeps what the session heard in its summary', () => {
    let s = load(fresh());
    [s] = playPhrase(s, T0);
    s = run(s, { type: 'NEXT', now: T0 + MINUTE });
    [s] = playPhrase(s, T0 + MINUTE);
    const before = sessionSummary(s, T0 + 2 * MINUTE)!;
    s = run(s, { type: 'CLEAR_QUEUE' });
    const after = sessionSummary(s, T0 + 2 * MINUTE)!;
    assert.equal(after.repetitions, before.repetitions);
    assert.equal(after.phrasesPlayed, before.phrasesPlayed);
    assert.ok(after.repetitions > 0);
  });

  it('a repetitions change from another tab reaches the player', () => {
    const s = run(load(fresh()), { type: 'PLAY', now: T0 });
    const remotePrefs = { ...s.prefs, repeats: 1 as const, changedAt: { repeats: T0 + 5 } };
    const after = run(s, { type: 'MERGE_REMOTE', learner: s.learner, prefs: remotePrefs, now: T0 + 6 });
    assert.equal(after.prefs.repeats, 1);
    assert.equal(after.player.repeats, 1);
  });
});

describe('phase timing (what the screen counts down)', () => {
  it('fixes the learner’s turn at the driver’s pause when it starts, and the hold at RATE_HOLD_MS', () => {
    let s = load(fresh({ speed: 1.25 }));
    assert.equal(s.player.phaseStartedAt, T0);
    assert.equal(s.player.phaseMs, null, 'a spoken step has no length ahead of time');
    s = done(s, T0 + 900, 900);
    const id = currentPhraseId(s.player)!;
    const phrase = findPhrase(s.learner, id)!;
    assert.equal(s.player.phase, 'pause');
    assert.equal(s.player.phaseStartedAt, T0 + 900);
    // Exactly the call the audio driver made before it read `phaseMs`.
    assert.equal(s.player.phaseMs, pauseMs(measuredTargetMs(s.learner, id), phrase.target, 1.25));
    assert.equal(s.player.phaseMs, phaseDurationMs(s));
    for (let i = 0; i < 8 && s.player.phase !== 'rate'; i++) s = done(s, T0 + 1000 * (i + 2), 1500);
    assert.equal(s.player.phase, 'rate');
    assert.equal(s.player.phaseMs, RATE_HOLD_MS);
  });

  it('a measured target sizes the next turn, and the longer setting lengthens it', () => {
    let s = load(fresh({ pauseLength: 'longer' }));
    s = done(done(done(s, T0 + 1, 900), T0 + 2), T0 + 3, 1600); // one repetition, target measured
    s = done(s, T0 + 4, 900); // the next prompt
    assert.equal(s.player.phase, 'pause');
    assert.equal(s.player.phaseMs, pauseMs(1600, 'x', 1, 'longer'));
    assert.equal(s.player.phaseMs, 1600 * 2 + 1000);
  });

  it('nothing runs while paused; Play restarts the phase at the new speed; a change mid-turn does not stretch it', () => {
    let s = done(load(fresh()), T0 + 900, 900);
    const planned = s.player.phaseMs;
    s = run(s, { type: 'SET_PREFS', prefs: { speed: 0.8 }, now: T0 + 1000 });
    assert.equal(s.player.phaseMs, planned, 'the turn already running keeps its length, as the audio does');
    s = run(s, { type: 'PAUSE', now: T0 + 1100 });
    assert.deepEqual([s.player.phaseStartedAt, s.player.phaseMs], [null, null]);
    s = run(s, { type: 'PLAY', now: T0 + 5000 });
    assert.equal(s.player.phaseStartedAt, T0 + 5000);
    assert.equal(s.player.phaseMs, phaseDurationMs(s));
    assert.ok(s.player.phaseMs! > planned!, 'slower speed, longer turn');
  });
});

describe('queues with a natural end', () => {
  const review = (mode: 'repeat' | 'continue') =>
    transition(fresh({ playMode: mode }), { type: 'LOAD', phraseIds: ['cafe-01', 'cafe-02'], setId: null, source: { kind: 'review' }, now: T0, seed: 1 });

  for (const mode of ['repeat', 'continue'] as const) {
    it(`a review plays once and stops on its last phrase (${mode} mode)`, () => {
      let s = review(mode);
      let t = T0;
      [s, t] = playPhrase(s, t);
      assert.equal(s.player.index, 1);
      [s, t] = playPhrase(s, t);
      assert.equal(s.player.status, 'paused');
      assert.equal(s.player.ended, true);
      assert.deepEqual(s.player.order, ['cafe-01', 'cafe-02'], 'nothing continues after it');
      assert.equal(s.player.index, 1);
      assert.equal(s.player.session?.passes, 0, 'not a pass of a repeating queue');
    });
  }

  it('Next on the last phrase ends it; a set keeps its play mode', () => {
    let s = run(review('repeat'), { type: 'NEXT', now: T0 + 1 }, { type: 'NEXT', now: T0 + 2 });
    assert.deepEqual([s.player.ended, s.player.status], [true, 'paused']);
    s = load(fresh({ playMode: 'repeat' }), T0, ['cafe-01'], 'set-cafe');
    [s] = playPhrase(s, T0);
    assert.deepEqual([s.player.ended, s.player.index, s.player.status], [false, 0, 'playing'], 'a set starts again');
  });

  it('Next on the last phrase before its target ends the queue with the target still hidden (R-01)', () => {
    const lastOfReview = (mode: 'repeat' | 'continue') =>
      transition(fresh({ playMode: mode }), { type: 'LOAD', phraseIds: ['cafe-01', 'cafe-02'], setId: null, source: { kind: 'review' }, startIndex: 1, now: T0, seed: 1 });
    for (const mode of ['repeat', 'continue'] as const) {
      // In the prompt, and in the learner's turn: never heard.
      for (const phasesDone of [0, 1]) {
        let s = lastOfReview(mode);
        for (let i = 0; i < phasesDone; i++) s = done(s, T0 + 1 + i);
        s = run(s, { type: 'NEXT', now: T0 + 10 });
        assert.deepEqual([s.player.ended, s.player.targetHeard], [true, false], `${mode}, ${phasesDone} phases`);
        assert.equal(isTargetRevealed(s.player), false, 'recall rule: not shown before it is heard');
      }
    }
    // Once the target has played, Next ends it with the target shown, as a finished queue does.
    let s = done(done(lastOfReview('continue'), T0 + 1), T0 + 2);
    assert.equal(s.player.phase, 'target');
    s = run(s, { type: 'NEXT', now: T0 + 3 });
    assert.deepEqual([s.player.ended, isTargetRevealed(s.player)], [true, true]);
    // Play replays it from the prompt, hidden again.
    s = run(s, { type: 'PLAY', now: T0 + 4 });
    assert.deepEqual([s.player.ended, s.player.targetHeard, isTargetRevealed(s.player)], [false, false, false]);
    // Played through to the end, it is shown.
    [s] = playPhrase(s, T0 + 5);
    assert.deepEqual([s.player.ended, isTargetRevealed(s.player)], [true, true]);
  });

  it('keeps where it came from, for its title', () => {
    const s = transition(fresh(), { type: 'LOAD', phraseIds: ['cafe-01'], setId: null, source: { kind: 'library', view: 'liked' }, now: T0, seed: 1 });
    assert.deepEqual(s.player.source, { kind: 'library', view: 'liked' });
    assert.equal(load(s).player.source, null, 'a set is named by its set');
  });
});

describe('undo after moving on', () => {
  it('a rating given in the hold can be undone by phrase once the next phrase plays', () => {
    let s = load(fresh());
    for (let i = 0; i < 9; i++) s = done(s, T0 + i * 1000);
    assert.equal(s.player.phase, 'rate');
    s = run(s, { type: 'RATE', grade: 'easy', now: T0 + 10_000 });
    assert.equal(s.player.index, 1, 'the rating ends the hold');
    s = run(s, { type: 'UNRATE', phraseId: 'cafe-01', now: T0 + 12_000 });
    assert.equal(pendingFor(s, 'cafe-01'), undefined);
    assert.equal(s.player.index, 1, 'the player stays where it is');
  });

  it('Missed or Hard bring the phrase back later, as requeuesOn says', () => {
    const s = load(fresh());
    assert.equal(requeuesOn(s.player, 'hard'), true);
    assert.equal(requeuesOn(s.player, 'easy'), false);
    const after = run(s, { type: 'RATE', grade: 'hard', now: T0 + 1 });
    assert.equal(after.player.order.filter((id) => id === 'cafe-01').length, 2);
    assert.equal(requeuesOn(after.player, 'hard'), false, 'already coming back');
  });
});
