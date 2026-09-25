import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { chartAsMermaid, PLAYER_CHART } from './chart';
import { addLocalDays, formatInterval, formatWhen, HOUR, startOfLocalDay, startOfLocalWeek } from './clock';
import { transition } from './machine';
import { RATING_WINDOW_MS, typicalMs } from './memory';
import {
  continuation,
  learnedPerWeek,
  learnerStats,
  learnedIds,
  learningIds,
  nextDue,
  playableIds,
  playedSets,
  previewDue,
  recallBuckets,
  recentSetIds,
  reviewQueue,
  sessionSummary,
  setDurationMs,
  suggestedSetId,
  todayCounts,
} from './selectors';
import { findSamePhrase, findSetView, phraseKey } from './catalog';
import { fullPlayMs, pauseMs } from './timing';
import { cafe, DAY, done, fresh, load, MINUTE, playPhrase, run, T0 } from './testing';
import { memoryOf, points } from './selectors';

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

describe('the same phrase', () => {
  it('ignores case, accents, punctuation and spacing', () => {
    assert.equal(phraseKey('¿Dónde  está el METRO?'), phraseKey('donde esta el metro'));
    assert.notEqual(phraseKey('La cuenta'), phraseKey('La cuenta, por favor'));
    assert.equal(phraseKey('?!'), '');
  });

  it('finds a course or own phrase, but not the one being edited', () => {
    const s = run(fresh(), { type: 'ADD_OWN_PHRASE', target: 'Hasta luego', native: 'See you', now: T0 });
    assert.equal(findSamePhrase(s.learner, 'la cuenta por favor')?.id, 'cafe-03');
    const own = findSamePhrase(s.learner, 'hasta LUEGO!')!;
    assert.ok(own.own);
    assert.equal(findSamePhrase(s.learner, 'Hasta luego', own.id), undefined);
    assert.equal(findSamePhrase(s.learner, '   '), undefined);
  });
});

describe('the rating preview', () => {
  it('promises the return the rating actually schedules, whatever plays after it', () => {
    // Rate a new phrase Easy during its first repetition, then let the rest play.
    let s = load(fresh());
    s = done(s, T0 + 2000); // native
    s = done(s, T0 + 4000); // pause
    s = done(s, T0 + 6000); // target: heard once
    s = run(s, { type: 'RATE', grade: 'easy', now: T0 + 6500 });
    const shown = () => previewDue(s.learner, 'cafe-01', 'easy', T0 + 6500);
    const before = shown();
    for (let t = 8000; t < 40_000; t += 2000) s = done(s, T0 + t); // two more repetitions heard
    assert.equal(shown(), before, 'later repetitions do not move the promise');
    s = run(s, { type: 'COMMIT', now: T0 + 6500 + RATING_WINDOW_MS + 1 });
    assert.equal(memoryOf(s.learner, 'cafe-01').fsrs?.due, before, 'and it is what commits');
  });

  it('stays the same for a whole play: the first-review cap counts earlier days, not repetitions', () => {
    const morning = startOfLocalDay(T0) + 10 * HOUR;
    let s = load(fresh(), morning);
    const shown = new Set<number>();
    for (let i = 1; i <= 9; i++) {
      s = done(s, morning + i * 2000);
      const at = morning + i * 2000 + 500;
      shown.add(previewDue(s.learner, 'cafe-01', 'easy', at) - at);
    }
    assert.deepEqual([...shown], [DAY], 'Easy reads "1 day" through all three repetitions');
  });
});

describe('history runs', () => {
  it('add up to the points badge, with early ratings and learned bonuses in their run', () => {
    let s = load(fresh());
    // Rate during the first repetition, before the phrase is first logged as heard.
    s = run(s, { type: 'RATE', grade: 'easy', now: T0 + 100 });
    for (let t = 2000; t < 60_000; t += 2000) s = done(s, T0 + t);
    s = run(s, { type: 'COMMIT', now: T0 + 100 + RATING_WINDOW_MS + 1 });
    const runs = playedSets(s.learner);
    assert.ok(runs.length > 0);
    assert.equal(runs.reduce((sum, r) => sum + r.points, 0), points(s.learner));
  });
});

describe('the current course only', () => {
  it("a set takes only its course's phrases, and Today counts only this course", () => {
    let s = run(fresh(), { type: 'CREATE_SET', title: 'Mixed', phraseIds: ['cafe-01', 'bg-kafene-01'], now: T0 });
    const [set] = Object.values(s.learner.ownSets);
    assert.deepEqual(set.phraseIds, ['cafe-01']);
    s = run(s, { type: 'ADD_TO_SET', setId: set.id, phraseIds: ['bg-kafene-02'], now: T0 + 1 });
    assert.deepEqual(s.learner.ownSets[set.id].phraseIds, ['cafe-01']);
    // A Bulgarian listen in the log while learning Spanish.
    const bg = { id: 'x.y-1', at: T0 + 5, device: 'x', kind: 'heard' as const, key: 'en-GB>bg-BG:bg-kafene-01', phraseId: 'bg-kafene-01', setId: 'set-bg-kafene', targetMs: 1000, nativeMs: 1000 };
    s = { ...s, learner: { ...s.learner, log: [...s.learner.log, bg] } };
    assert.equal(todayCounts(s, T0 + 10).heard, 0);
    assert.deepEqual(playedSets(s.learner), []);
  });
});

describe('the Learning view', () => {
  it('holds every started phrase not yet learned, heard-but-unrated included', () => {
    let s = load(fresh());
    [s] = playPhrase(s, T0); // cafe-01 heard, never rated
    const learning = learningIds(s.learner, T0 + DAY);
    assert.ok(learning.includes('cafe-01'));
    assert.equal(learnerStats(s.learner, T0 + DAY).started, learning.length + learnedIds(s.learner, cafe()).length);
  });
});

describe('home and stats (fourth review)', () => {
  it('the weekly chart keeps every week across the spring clock change', () => {
    const tz = process.env.TZ;
    process.env.TZ = 'Europe/Sofia';
    try {
      const now = Date.UTC(2026, 3, 1, 9); // Wed 1 Apr 2026, 12:00 in Sofia, after the change on 29 Mar
      const weeks = learnedPerWeek(fresh().learner, now).map((w) => w.weekStart);
      weeks.forEach((w) => assert.equal(startOfLocalWeek(w), w, 'each column starts on a Monday'));
      for (let i = 1; i < weeks.length; i++) assert.equal(weeks[i], addLocalDays(weeks[i - 1], 7), `week ${i} follows the one before`);
      assert.ok(weeks.includes(Date.UTC(2026, 2, 22, 22)), 'the week of Monday 23 March is there');
    } finally {
      process.env.TZ = tz;
    }
  });

  it('a set heard in another course with the same target is not recent here', () => {
    const s = fresh();
    const other = { id: 'x.y-1', at: T0, device: 'x', kind: 'heard' as const, key: 'bg-BG>es-ES:tapas-01', phraseId: 'tapas-01', setId: 'set-tapas', targetMs: 1000, nativeMs: 1000 };
    const learner = { ...s.learner, log: [other] };
    assert.deepEqual(recentSetIds(learner), []);
    assert.deepEqual(recentSetIds({ ...learner, log: [{ ...other, key: 'en-GB>es-ES:tapas-01' }] }), ['set-tapas']);
  });

  it("the summary's points leave out a learned bonus another device earned", () => {
    const base = load(fresh());
    const key = 'en-GB>es-ES:cafe-01';
    const logFrom = (device: string) =>
      [0, 3, 10, 30, 80].flatMap((d, i) => [
        { id: `${device}.h-${i}`, at: T0 + d * DAY + 1, device, kind: 'heard' as const, key, phraseId: 'cafe-01', setId: 'set-cafe', targetMs: 1000, nativeMs: 1000 },
        { id: `${device}.r-${i}`, at: T0 + d * DAY + 2, device, kind: 'rated' as const, key, phraseId: 'cafe-01', setId: 'set-cafe', grade: 'easy' as const },
      ]);
    const withLog = (device: string) => ({ ...base, learner: { ...base.learner, log: logFrom(device) } });
    const here = sessionSummary(withLog(base.device.id), T0 + 100 * DAY)!;
    const there = sessionSummary(withLog('other'), T0 + 100 * DAY)!;
    assert.ok(here.points >= 25, `this device's learned bonus counts (${here.points})`);
    assert.equal(there.points, 0);
  });

  it('Today counts rated phrases, not ratings', () => {
    let s = load(fresh());
    [s] = playPhrase(s, T0);
    s = run(s, ...rated('missed', T0 + MINUTE), ...rated('hard', T0 + 7 * MINUTE));
    assert.equal(todayCounts(s, T0 + 20 * MINUTE).rated, 1);
  });
});

describe('library and summary (onboarding/library review)', () => {
  const key = 'en-GB>es-ES:cafe-01';
  const easyOver = (device: string) =>
    [0, 3, 10, 30, 80].flatMap((d, i) => [
      { id: `${device}.h-${i}`, at: T0 + d * DAY + 1, device, kind: 'heard' as const, key, phraseId: 'cafe-01', setId: 'set-cafe', targetMs: 1000, nativeMs: 1000 },
      { id: `${device}.r-${i}`, at: T0 + d * DAY + 2, device, kind: 'rated' as const, key, phraseId: 'cafe-01', setId: 'set-cafe', grade: 'easy' as const },
    ]);

  it('a learned phrase that fell due is under Learned, not Learning', () => {
    const s = fresh();
    const learner = { ...s.learner, log: easyOver('x') };
    const later = T0 + 3000 * DAY;
    assert.deepEqual(learnedIds(learner, ['cafe-01']), ['cafe-01']);
    assert.deepEqual(learningIds(learner, later), []);
  });

  it("the summary leaves out another tab's listening", () => {
    const s = load(fresh(), T0, ['cafe-01'], 'set-cafe');
    const other = { id: `${s.device.id}.other-1`, at: T0 + 5, device: s.device.id, kind: 'heard' as const, key: 'en-GB>es-ES:tapas-01', phraseId: 'tapas-01', setId: 'set-tapas', targetMs: 1000, nativeMs: 1000 };
    const withOther = { ...s, learner: { ...s.learner, log: [...s.learner.log, other] } };
    const summary = sessionSummary(withOther, T0 + 10)!;
    assert.equal(summary.repetitions, 0);
    assert.equal(summary.points, 0);
  });
});
