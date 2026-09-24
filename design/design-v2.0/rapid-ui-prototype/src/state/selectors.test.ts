import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { chartAsMermaid, PLAYER_CHART } from './chart';
import { formatInterval, formatWhen, HOUR } from './clock';
import { transition } from './machine';
import { RATING_WINDOW_MS, typicalMs } from './memory';
import {
  continuation,
  learnedPerWeek,
  nextDue,
  playableIds,
  playedSets,
  recallBuckets,
  reviewQueue,
  sessionSummary,
  setDurationMs,
  suggestedSetId,
  todayCounts,
} from './selectors';
import { findSetView } from './catalog';
import { fullPlayMs, pauseMs } from './timing';
import { cafe, DAY, done, fresh, load, MINUTE, playPhrase, run, T0 } from './testing';

const rated = (grade: 'missed' | 'hard' | 'easy', now: number) => [
  { type: 'RATE' as const, grade, now },
  { type: 'COMMIT' as const, now: now + RATING_WINDOW_MS },
];

describe('selectors', () => {
  it('suggests the first set of the course, then the set in progress', () => {
    const s = fresh();
    assert.equal(suggestedSetId(s.learner, T0), 'set-cafe');
    const played = done(done(done(load(s, T0, ['taxi-01'], 'set-taxi'), T0 + 1), T0 + 2), T0 + 3);
    assert.equal(suggestedSetId(played.learner, T0 + 10), 'set-taxi');
  });

  it('caps the review queue at ten, most overdue first', () => {
    let s = fresh();
    const ids = [...cafe(), 'tapas-01', 'tapas-02', 'tapas-03', 'tapas-04', 'tapas-05', 'taxi-01'];
    ids.forEach((id, i) => {
      s = run(load(s, T0 + i, [id], null), ...rated('missed', T0 + i));
    });
    const queue = reviewQueue(s.learner, T0 + DAY);
    assert.equal(queue.length, 10);
    assert.equal(queue[0], ids[0]);
    assert.equal(nextDue(s.learner, T0)?.count, ids.length, 'all due the same minute');
  });

  it('playable phrases leave out learned ones that are not due', () => {
    const s = fresh();
    assert.deepEqual(playableIds(s.learner, cafe(), T0), cafe());
  });

  it('continue picks the next set with something to play', () => {
    const s = load(fresh());
    assert.equal(continuation(s.learner, s.player, T0)?.setId, 'set-tapas');
  });

  it('the session summary and today count from the log', () => {
    let s = load(fresh());
    [s] = playPhrase(s, T0);
    s = run(s, { type: 'RATE', grade: 'easy', now: T0 + MINUTE });
    const summary = sessionSummary(s, T0 + MINUTE)!;
    assert.equal(summary.phrasesPlayed, 1);
    assert.equal(summary.repetitions, 3);
    assert.equal(summary.pendingRatings, 1);
    assert.equal(summary.points, 1);
    assert.deepEqual(todayCounts(s, T0 + MINUTE), { heard: 1, rated: 1 });
  });

  it('history groups listening by set', () => {
    let s = load(fresh());
    [s] = playPhrase(s, T0);
    [s] = playPhrase(s, T0 + MINUTE);
    const runs = playedSets(s.learner);
    assert.equal(runs.length, 1);
    assert.deepEqual([runs[0].setId, runs[0].phrases, runs[0].points], ['set-cafe', 2, 2]);
  });

  it('recall buckets and weekly learned counts come from state', () => {
    let s = load(fresh());
    s = run(s, ...rated('easy', T0));
    const buckets = recallBuckets(s.learner, T0 + HOUR);
    assert.equal(buckets.reduce((n, b) => n + b.count, 0), 1);
    assert.equal(buckets[0].count, 1, 'rated an hour ago: 90–100%');
    assert.equal(learnedPerWeek(s.learner, T0).length, 8);
  });

  it('a set duration exists only once every phrase is measured', () => {
    let s = load(fresh());
    const view = findSetView(s.learner, 'set-cafe')!;
    assert.equal(setDurationMs(s, view), null);
    for (const [i] of cafe().entries()) {
      s = transition(s, { type: 'JUMP', index: i, now: T0 });
      s = done(s, T0 + 1, 800);
      s = done(s, T0 + 2);
      s = done(s, T0 + 3, 1000);
    }
    assert.equal(setDurationMs(s, view), cafe().length * fullPlayMs(800, 1000, 'x', 3)!);
  });
});

describe('timing and formatting', () => {
  it('pause scales with the measured target and speed, within bounds', () => {
    assert.equal(pauseMs(1000, 'x', 1), 1000 * 1.3 + 600);
    assert.equal(pauseMs(100, 'x', 1), 1500);
    assert.equal(pauseMs(20_000, 'x', 1), 8000);
    assert.equal(fullPlayMs(null, 1000, 'x', 3), null);
  });

  it('typical length ignores outliers', () => {
    assert.equal(typicalMs([]), null);
    assert.equal(typicalMs([1000, 1100, 5000]), 1050);
  });

  it('formats intervals and relative times in the UI language', () => {
    assert.match(formatInterval(10 * MINUTE, 'en'), /10 min/);
    assert.match(formatWhen(T0 + 4 * DAY, T0, 'en'), /in 4 days/);
    assert.match(formatWhen(T0 + 4 * DAY, T0, 'ru'), /через 4 дня/);
  });
});

describe('statechart', () => {
  it('lists allowed events per status and renders as Mermaid', () => {
    assert.ok(PLAYER_CHART.paused.includes('PLAY'));
    assert.ok(!PLAYER_CHART.playing.includes('PLAY'));
    assert.match(chartAsMermaid(), /stateDiagram-v2/);
  });
});
