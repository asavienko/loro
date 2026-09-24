import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DAY, MINUTE } from './clock';
import { SETS } from '../content';
import { AppEvent, AppState, currentPhraseId, initialState, transition } from './machine';
import { applyGrade, isDue, isLearned, newMemory, POINTS, previewInterval, retrievability } from './memory';
import { parseState, serializeState } from './persistence';
import { learnerStats, previouslyPlayed, upNextIds } from './selectors';

const T0 = 1_800_000_000_000;
// Ids come from the content, so editing phrases doesn't break the tests.
const SET = SETS[0];
const OTHER_SET = SETS[1];
const IDS = SET.phraseIds.slice(0, 3);
const [P1, P2, P3] = IDS;

function run(state: AppState, ...events: AppEvent[]): AppState {
  return events.reduce(transition, state);
}

const load = (now = T0): AppEvent => ({ type: 'LOAD', phraseIds: IDS, setId: SET.id, now, seed: 7 });
const done = (s: AppState, now = T0, measuredMsAt1x?: number): AppEvent => ({
  type: 'PHASE_DONE',
  cycle: s.player.cycle,
  now,
  measuredMsAt1x,
});

/** Finish the three phases of one repetition. */
function repetition(state: AppState, now = T0): AppState {
  let s = state;
  for (let i = 0; i < 3; i++) s = transition(s, done(s, now, 1200));
  return s;
}

describe('player loop', () => {
  it('walks native → pause → target for each repetition, then advances', () => {
    let s = run(initialState(), load());
    assert.equal(s.player.status, 'playing');
    assert.equal(s.player.phase, 'native');
    s = transition(s, done(s));
    assert.equal(s.player.phase, 'pause');
    s = transition(s, done(s));
    assert.equal(s.player.phase, 'target');
    s = transition(s, done(s, T0, 1200));
    assert.equal(s.player.repetition, 2);
    assert.equal(s.player.phase, 'native');
    assert.equal(s.learner.points, POINTS.repetition);
    assert.equal(s.learner.phrases[P1].targetMsAt1x, 1200);

    s = repetition(repetition(s));
    assert.equal(currentPhraseId(s.player), P2);
    assert.equal(s.player.repetition, 1);
    assert.equal(s.learner.phrases[P1].heardCount, 3);
  });

  it('ignores a completion from a stale cycle', () => {
    const s = run(initialState(), load());
    const stale = s.player.cycle;
    const paused = run(s, { type: 'PAUSE', now: T0 + 500 }, { type: 'PLAY', now: T0 + 900 });
    const after = transition(paused, { type: 'PHASE_DONE', cycle: stale, now: T0 + 1000 });
    assert.equal(after.player.phase, 'native');
  });

  it('stops on the last phrase at the end of the queue', () => {
    let s = run(initialState(), load(), { type: 'JUMP', index: 2, now: T0 }, { type: 'TOGGLE_REPEAT' });
    s = repetition(s);
    assert.equal(s.player.status, 'paused');
    assert.equal(currentPhraseId(s.player), P3);
  });

  it('measures real listening time and excludes paused time', () => {
    const s = run(initialState(), load(), { type: 'PAUSE', now: T0 + 4000 }, { type: 'PLAY', now: T0 + 60_000 });
    assert.equal(s.player.elapsedMs, 4000);
    assert.equal(s.player.playingSince, T0 + 60_000);
  });

  it('Previous restarts after 3 s and goes back before that', () => {
    const base = run(initialState(), load(), { type: 'NEXT', now: T0 });
    assert.equal(currentPhraseId(transition(base, { type: 'PREV', now: T0 + 1000 }).player), P1);
    assert.equal(currentPhraseId(transition(base, { type: 'PREV', now: T0 + 5000 }).player), P2);
  });
});

describe('rating', () => {
  it('rates the current phrase once and awards points', () => {
    let s = run(initialState(), load(), { type: 'RATE', grade: 'easy', now: T0 });
    assert.equal(s.player.ratedCurrent, 'easy');
    assert.equal(s.learner.points, POINTS.easy);
    s = transition(s, { type: 'RATE', grade: 'hard', now: T0 });
    assert.equal(s.learner.points, POINTS.easy, 'second rating is ignored');
    s = transition(s, { type: 'NEXT', now: T0 });
    assert.equal(s.player.ratedCurrent, null, 'rating is offered again for the next phrase');
  });

  it('starts unrated — nothing is preselected', () => {
    assert.equal(run(initialState(), load()).player.ratedCurrent, null);
  });
});

describe('forgetting curve', () => {
  it('recall is 90% when a phrase falls due', () => {
    const graded = applyGrade(newMemory(T0), 'easy', T0).memory;
    assert.equal(graded.stabilityDays, 4);
    assert.ok(Math.abs(retrievability(graded, T0 + 4 * DAY)! - 0.9) < 1e-9);
    assert.equal(isDue(graded, T0 + 4 * DAY - 1), false);
    assert.equal(isDue(graded, T0 + 4 * DAY), true);
  });

  it('hard brings a new phrase back in 10 minutes', () => {
    assert.equal(Math.round(previewInterval(undefined, 'hard', T0) / MINUTE), 10);
  });

  it('becomes learned after enough easy reviews and pays the bonus once', () => {
    let memory = newMemory(T0);
    let now = T0;
    let bonuses = 0;
    for (let i = 0; i < 6 && !isLearned(memory); i++) {
      const result = applyGrade(memory, 'easy', now);
      if (result.becameLearned) bonuses++;
      memory = result.memory;
      now += memory.stabilityDays! * DAY;
    }
    assert.ok(isLearned(memory));
    assert.equal(bonuses, 1);
    const lapse = applyGrade(memory, 'hard', now).memory;
    assert.equal(isLearned(lapse), false, 'a lapse un-learns the phrase');
    assert.equal(applyGrade(lapse, 'easy', now).becameLearned, false, 'bonus is not paid twice');
  });
});

describe('queue', () => {
  it('up next never contains the current phrase', () => {
    const s = run(initialState(), load());
    assert.deepEqual(upNextIds(s.player), [P2, P3]);
  });

  it('reorders and removes only upcoming phrases', () => {
    let s = run(initialState(), load());
    s = transition(s, { type: 'REORDER_UP_NEXT', phraseIds: [P3, P2] });
    assert.deepEqual(s.player.order, [P1, P3, P2]);
    s = transition(s, { type: 'REMOVE_FROM_QUEUE', position: 0 });
    assert.equal(s.player.order.length, 3, 'current phrase cannot be removed');
    s = transition(s, { type: 'REMOVE_FROM_QUEUE', position: 1 });
    assert.deepEqual(s.player.order, [P1, P2]);
  });

  it('shuffle reorders only up next and turning it off restores the order', () => {
    let s = run(initialState(), load(), { type: 'TOGGLE_SHUFFLE', seed: 3 });
    assert.equal(currentPhraseId(s.player), P1);
    assert.deepEqual([...upNextIds(s.player)].sort(), [P2, P3]);
    s = transition(s, { type: 'TOGGLE_SHUFFLE', seed: 3 });
    assert.deepEqual(s.player.order, IDS);
  });

  it('previously played lists distinct heard phrases, not the current one', () => {
    let s = run(initialState(), load(), { type: 'TOGGLE_REPEAT' });
    s = repetition(s);
    assert.deepEqual(
      previouslyPlayed(s).map((e) => e.phraseId),
      [P1],
    );
  });
});

describe('persistence', () => {
  it('round-trips as JSON and never resumes mid-playback', () => {
    let s = run(initialState(), load(), { type: 'RATE', grade: 'easy', now: T0 });
    s = transition(s, { type: 'TOGGLE_SAVE_PHRASE', phraseId: P1 });
    const back = parseState(serializeState(s))!;
    assert.deepEqual(back.learner, s.learner);
    assert.equal(back.player.status, 'paused');
    assert.equal(parseState('{"version":99}'), null);
  });

  it('stats come from the state', () => {
    const s = run(initialState(), load(), { type: 'RATE', grade: 'easy', now: T0 });
    const stats = learnerStats(s.learner, T0 + 4 * DAY);
    assert.equal(stats.points, POINTS.easy);
    assert.equal(stats.due, 1);
    assert.equal(stats.averageRetention, 90);
  });
});

describe('round 2: learning loop', () => {
  it('a rating right after the last one barely moves stability; the learned bonus is paid once', () => {
    let memory = applyGrade(newMemory(T0), 'easy', T0).memory;
    const first = memory.stabilityDays!;
    memory = applyGrade(memory, 'easy', T0 + 5000).memory;
    assert.ok(memory.stabilityDays! < first * 1.01, 'no growth for an immediate re-rating');

    // Rated on time (at 90% recall) it grows by ×2.3.
    const onTime = applyGrade(memory, 'easy', T0 + 5000 + memory.stabilityDays! * DAY).memory;
    assert.ok(Math.abs(onTime.stabilityDays! / memory.stabilityDays! - 2.3) < 0.01);
  });

  it('re-rating after restarting the phrase is allowed, but farming does not reach learned', () => {
    let s = run(initialState(), load());
    for (let i = 0; i < 10; i++) {
      s = run(s, { type: 'RATE', grade: 'easy', now: T0 + i * 1000 }, { type: 'PREV', now: T0 + i * 1000 + 500 });
    }
    assert.equal(s.player.ratedCurrent, null, 'Previous restarts the phrase and offers the rating again');
    assert.equal(isLearned(s.learner.phrases[P1]), false);
    assert.equal(s.learner.history.filter((e) => e.event === 'learned').length, 0);
  });

  it('pays +10 through transition exactly once when a phrase becomes learned', () => {
    let s = run(initialState(), load());
    let now = T0;
    for (let i = 0; i < 8 && !isLearned(s.learner.phrases[P1] ?? newMemory(now)); i++) {
      s = run(s, { type: 'RATE', grade: 'easy', now }, { type: 'PREV', now: now + 500 });
      now += s.learner.phrases[P1].stabilityDays! * DAY;
    }
    const learned = s.learner.history.filter((e) => e.event === 'learned');
    assert.equal(learned.length, 1);
    assert.equal(learned[0].points, POINTS.learned);
  });

  it('failed audio stops playback, names the language and pays no point', () => {
    let s = run(initialState(), load());
    s = transition(s, { type: 'PHASE_DONE', cycle: s.player.cycle, now: T0 + 100, failedLang: 'es-ES' });
    assert.equal(s.player.status, 'paused');
    assert.equal(s.player.audioError, 'es-ES');
    assert.equal(s.learner.points, 0);
    assert.equal(s.learner.phrases[P1], undefined, 'no measurement stored');
    s = transition(s, { type: 'PLAY', now: T0 + 200 });
    assert.equal(s.player.audioError, null, 'Play tries again');
  });

  it('replaying after the end of the queue starts a fresh play of the last phrase', () => {
    let s = run(initialState(), load(), { type: 'JUMP', index: 2, now: T0 }, { type: 'TOGGLE_REPEAT' });
    s = transition(s, { type: 'RATE', grade: 'easy', now: T0 });
    s = repetition(s, T0 + 4000);
    assert.equal(s.player.ended, true);
    s = transition(s, { type: 'PLAY', now: T0 + 10_000 });
    assert.equal(s.player.status, 'playing');
    assert.equal(s.player.ratedCurrent, null);
    assert.equal(s.player.elapsedMs, 0);
    assert.equal(s.player.ended, false);
  });

  it('ignores stale completions after Next, Previous and Jump, and while paused', () => {
    const s = run(initialState(), load());
    const stale = s.player.cycle;
    for (const event of [
      { type: 'NEXT', now: T0 },
      { type: 'PREV', now: T0 },
      { type: 'JUMP', index: 2, now: T0 },
    ] as AppEvent[]) {
      const moved = transition(s, event);
      const after = transition(moved, { type: 'PHASE_DONE', cycle: stale, now: T0 + 1 });
      assert.equal(after.player.phase, 'native');
    }
    const paused = transition(s, { type: 'PAUSE', now: T0 });
    const after = transition(paused, { type: 'PHASE_DONE', cycle: paused.player.cycle, now: T0 + 1 });
    assert.equal(after.player.phase, 'native');
  });

  it('Previous at the first phrase restarts it', () => {
    const s = run(initialState(), load(), { type: 'PREV', now: T0 + 100 });
    assert.equal(s.player.index, 0);
  });

  it('turning repeat off during repetition 2 finishes after the current repetition', () => {
    let s = repetition(run(initialState(), load()));
    assert.equal(s.player.repetition, 2);
    s = transition(s, { type: 'TOGGLE_REPEAT' });
    assert.equal(s.player.repetition, 1);
    s = repetition(s);
    assert.equal(currentPhraseId(s.player), P2);
  });
});

describe('round 2: queue', () => {
  it('reorder needs the exact same items', () => {
    const s = run(initialState(), load());
    const bad = transition(s, { type: 'REORDER_UP_NEXT', phraseIds: [P2, P2] });
    assert.deepEqual(bad.player.order, s.player.order);
  });

  it('removing a played copy before the current phrase keeps the current one', () => {
    let s = run(initialState(), load(), { type: 'NEXT', now: T0 });
    s = transition(s, { type: 'ENQUEUE', phraseIds: [P1], setId: SET.id });
    assert.deepEqual(s.player.order, [P1, P2, P3, P1], 'a played phrase can be queued again');
    s = transition(s, { type: 'REMOVE_FROM_QUEUE', position: 0 });
    assert.deepEqual(s.player.order, [P2, P3, P1]);
    assert.equal(currentPhraseId(s.player), P2);
    s = transition(s, { type: 'REMOVE_FROM_QUEUE', position: 2 });
    assert.deepEqual(s.player.order, [P2, P3], 'only the removed position goes');
  });

  it('adding another set makes the queue mixed; an empty queue adopts the set without playing', () => {
    let s = run(initialState(), load());
    s = transition(s, { type: 'ENQUEUE', phraseIds: OTHER_SET.phraseIds, setId: OTHER_SET.id });
    assert.equal(s.player.setId, null);
    const fresh = transition(initialState(), { type: 'ENQUEUE', phraseIds: IDS, setId: SET.id });
    assert.equal(fresh.player.setId, SET.id);
    assert.equal(fresh.player.status, 'idle');
    assert.equal(currentPhraseId(fresh.player), P1);
  });

  it('load with a start index and shuffle on plays that phrase first; LOAD of nothing is ignored', () => {
    let s = run(initialState(), { type: 'TOGGLE_SHUFFLE', seed: 1 });
    s = transition(s, { type: 'LOAD', phraseIds: IDS, setId: SET.id, startIndex: 2, now: T0, seed: 5 });
    assert.equal(currentPhraseId(s.player), P3);
    assert.equal(s.player.index, 0);
    assert.equal(transition(s, { type: 'LOAD', phraseIds: [], setId: null, now: T0, seed: 1 }), s);
  });
});
