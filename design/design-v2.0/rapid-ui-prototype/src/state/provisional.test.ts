// The provisional view: a rating in its five-minute window already counts in every status, due,
// next-review and learned figure (not in points), and commits without moving any of them.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fc from 'fast-check';
import { coursePhrases, courseSets, keyOf } from './catalog';
import { initialState } from './initial';
import { AppEvent, transition } from './machine';
import { RATING_WINDOW_MS } from './memory';
import {
  displayLearner,
  displayMemory,
  duePhraseIds,
  learnedIds,
  learnedPerWeek,
  learnerStats,
  learningIds,
  nextDue,
  phraseProgress,
  points,
  previewDue,
  recallBuckets,
  recentlyMissedIds,
  repeatsFor,
  reviewQueue,
  sessionSummary,
  setProgress,
  suggestedSetId,
} from './selectors';
import { cafe, DAY, done, fresh, load, MINUTE, run, T0 } from './testing';
import type { AppState, LearnerState, LogEntry } from './types';

/** Every figure a screen shows from the schedule, for one learner at one moment. */
function figures(learner: LearnerState, now: number) {
  const ids = coursePhrases(learner).map((p) => p.id);
  return {
    due: duePhraseIds(learner, now),
    review: reviewQueue(learner, now),
    next: nextDue(learner, now),
    stats: learnerStats(learner, now),
    learned: learnedIds(learner, ids),
    learning: learningIds(learner, now),
    missed: recentlyMissedIds(learner, now),
    rows: ids.map((id) => {
      const p = phraseProgress(learner, id, now);
      return [id, p.status, p.recall, p.dueAt];
    }),
    sets: courseSets(learner).map((s) => setProgress(learner, s.phraseIds, now)),
    suggested: suggestedSetId(learner, now),
    buckets: recallBuckets(learner, now),
    weeks: learnedPerWeek(learner, now),
  };
}

const logIds = (learner: LearnerState) => learner.log.map((e) => e.id);

/** A learner whose café phrases were each rated Easy once, a month ago: all due now. */
function dueReview(): { state: AppState; now: number } {
  const s = fresh();
  const log: LogEntry[] = cafe().flatMap((id, i) => [
    { id: `old.h-${i}`, at: T0 + i, device: 'old', kind: 'heard' as const, key: keyOf(s.learner, id), phraseId: id, setId: 'set-cafe', targetMs: 1000, nativeMs: 1000 },
    { id: `old.r-${i}`, at: T0 + i + 1, device: 'old', kind: 'rated' as const, key: keyOf(s.learner, id), phraseId: id, setId: 'set-cafe', grade: 'easy' as const },
  ]);
  return { state: { ...s, learner: { ...s.learner, log } }, now: T0 + 30 * DAY };
}

/** Plays the current phrase to its rating hold and rates it there; returns the time used. */
function playAndRate(s: AppState, now: number, grade: 'missed' | 'hard' | 'easy'): [AppState, number] {
  let t = now;
  for (let i = 0; i < 12 && s.player.phase !== 'rate'; i++) s = done(s, (t += 1000));
  return [run(s, { type: 'RATE', grade, now: (t += 500) }), t];
}

describe('the provisional view', () => {
  it('a finished review stops reading as due at once, and commits without a jump', () => {
    const { state, now } = dueReview();
    const review = reviewQueue(displayLearner(state), now);
    assert.deepEqual(review, cafe(), 'all five are due');
    let s = load(state, now, review, null);
    let t = now;
    for (let i = 0; i < review.length; i++) [s, t] = playAndRate(s, t, 'easy');
    const view = displayLearner(s);
    assert.deepEqual(duePhraseIds(view, t), [], 'nothing is due any more');
    assert.deepEqual(reviewQueue(view, t), []);
    assert.equal(learnerStats(view, t).due, 0);
    assert.equal(duePhraseIds(s.learner, t).length, 5, 'the committed log alone still has them due');
    // The summary's Next review agrees with Home, and with the rating's own promise.
    const summary = sessionSummary(s, t)!;
    assert.equal(summary.dueNow, 0);
    assert.deepEqual(summary.nextDue, nextDue(view, t));
    const last = s.pending.find((p) => p.phraseId === review[review.length - 1])!;
    assert.equal(phraseProgress(view, last.phraseId, t).dueAt, previewDue(s.learner, last.phraseId, 'easy', last.at));
    // Points wait for the window.
    assert.equal(points(view) > points(s.learner), true, 'the view would pay them…');
    assert.equal(summary.pendingRatings, 5, '…so the summary counts them as pending');
    // The window closes: the same figures, from the log alone.
    const later = t + RATING_WINDOW_MS;
    const before = figures(view, later);
    const committed = run(s, { type: 'COMMIT', now: later });
    assert.equal(committed.pending.length, 0);
    assert.deepEqual(figures(committed.learner, later), before);
    assert.equal(displayLearner(committed), committed.learner, 'nothing pending: the view is the learner itself');
  });

  it('undo takes the rating out of every figure at once', () => {
    const { state, now } = dueReview();
    let s = load(state, now, ['cafe-01'], null);
    const before = figures(displayLearner(s), now + MINUTE);
    s = run(s, { type: 'RATE', grade: 'easy', now: now + 1000 });
    assert.ok(!duePhraseIds(displayLearner(s), now + MINUTE).includes('cafe-01'));
    s = run(s, { type: 'UNRATE', now: now + 2000 });
    assert.deepEqual(figures(displayLearner(s), now + MINUTE), before);
    assert.equal(displayLearner(s), s.learner, "an undo's tombstone isn't a rating");
  });

  it('a rating changed inside its window shows the new grade, at the original time', () => {
    const { state, now } = dueReview();
    let s = load(state, now, ['cafe-01'], null);
    s = run(s, { type: 'RATE', grade: 'missed', now: now + 1000 });
    s = run(s, { type: 'RATE', grade: 'easy', now: now + 3 * MINUTE });
    assert.equal(displayMemory(s, 'cafe-01').lastGrade, 'easy');
    assert.equal(displayMemory(s, 'cafe-01').fsrs?.due, previewDue(s.learner, 'cafe-01', 'easy', now + 1000));
    assert.deepEqual(recentlyMissedIds(displayLearner(s), now + 4 * MINUTE), []);
  });

  it('auto repetitions follow the pending rating, so a play is as long before and after it commits', () => {
    let s = load(fresh());
    s = run(s, { type: 'RATE', grade: 'easy', now: T0 + 100 });
    // A first Easy puts a new phrase under review: once through, as it will be after the window.
    assert.equal(repeatsFor(s, 'cafe-01'), 1);
    assert.equal(repeatsFor(run(s, { type: 'COMMIT', now: T0 + 100 + RATING_WINDOW_MS }), 'cafe-01'), 1);
    assert.equal(repeatsFor(run(s, { type: 'UNRATE', now: T0 + 200 }), 'cafe-01'), 3);
  });

  it('a missed phrase still comes back later in the same queue', () => {
    const { state, now } = dueReview();
    let s = load(state, now, cafe(), null);
    [s] = playAndRate(s, now, 'missed');
    assert.equal(s.player.order.filter((id) => id === 'cafe-01').length, 2, 'the relearn copy is queued');
    assert.ok(!duePhraseIds(displayLearner(s), now + MINUTE).includes('cafe-01'), 'and it is not due again for ten minutes');
  });

  it("continue mode doesn't queue the review just rated again", () => {
    // Every phrase of the course learned; the café ones fell due long ago, the rest are months off.
    const base = fresh({ playMode: 'continue' });
    const log: LogEntry[] = coursePhrases(base.learner).flatMap((p, n) => {
      const shift = cafe().includes(p.id) ? -1000 * DAY : 0;
      return [0, 3, 10, 30, 80].flatMap((d, i) => [
        { id: `old.h-${n}-${i}`, at: T0 + shift + d * DAY + n, device: 'old', kind: 'heard' as const, key: keyOf(base.learner, p.id), phraseId: p.id, setId: p.setId, targetMs: 1000, nativeMs: 1000 },
        { id: `old.r-${n}-${i}`, at: T0 + shift + d * DAY + n + 1, device: 'old', kind: 'rated' as const, key: keyOf(base.learner, p.id), phraseId: p.id, setId: p.setId, grade: 'easy' as const },
      ]);
    });
    const now = T0 + 81 * DAY;
    const state: AppState = { ...base, learner: { ...base.learner, log: log.sort((a, b) => a.at - b.at) } };
    assert.deepEqual(reviewQueue(state.learner, now), cafe());
    let s = load(state, now, cafe(), null);
    let t = now;
    for (let i = 0; i < cafe().length; i++) [s, t] = playAndRate(s, t, 'easy');
    assert.equal(s.player.order.length, cafe().length, 'nothing was added after the review');
    assert.equal(s.player.ended, true);
  });

  it("two tabs: another tab's rating shows here, and its commit counts once", () => {
    const { state, now } = dueReview();
    let a = load(state, now, ['cafe-01'], null);
    a = run(a, { type: 'RATE', grade: 'easy', now: now + 1000 });
    // Tab B: the same browser (device), another instance.
    const b0: AppState = { ...initialState('dev', 'tab-b'), learner: state.learner, prefs: a.prefs };
    let b = run(b0, { type: 'MERGE_REMOTE', learner: a.learner, pending: a.pending, now: now + 2000 });
    assert.deepEqual(figures(displayLearner(b), now + MINUTE), figures(displayLearner(a), now + MINUTE));
    // Tab A commits; B merges its log before its own copy of the rating has committed.
    a = run(a, { type: 'COMMIT', now: now + 1000 + RATING_WINDOW_MS });
    b = run(b, { type: 'MERGE_REMOTE', learner: a.learner, pending: a.pending, now: now + 1000 + RATING_WINDOW_MS });
    assert.equal(b.pending.length, 1, "B's copy is still pending…");
    const rated = displayLearner(b).log.filter((e) => e.kind === 'rated' && e.phraseId === 'cafe-01');
    assert.equal(rated.length, 2, '…but the view holds the new rating once (beside the month-old one)');
    assert.deepEqual(figures(displayLearner(b), now + DAY), figures(a.learner, now + DAY));
    // An undo in one tab reaches the other.
    const rated2 = run(load(state, now, ['cafe-02'], null), { type: 'RATE', grade: 'easy', now: now + 1000 });
    const undone2 = run(rated2, { type: 'UNRATE', now: now + 2000 });
    let d = run(b0, { type: 'MERGE_REMOTE', learner: rated2.learner, pending: rated2.pending, now: now + 1500 });
    assert.ok(!duePhraseIds(displayLearner(d), now + MINUTE).includes('cafe-02'));
    d = run(d, { type: 'MERGE_REMOTE', learner: undone2.learner, pending: undone2.pending, now: now + 2500 });
    assert.ok(duePhraseIds(displayLearner(d), now + MINUTE).includes('cafe-02'));
  });

  it('is cached: the same state gives the same view object', () => {
    const { state, now } = dueReview();
    const s = run(load(state, now, ['cafe-01'], null), { type: 'RATE', grade: 'hard', now: now + 1000 });
    assert.equal(displayLearner(s), displayLearner({ ...s }));
    assert.notEqual(displayLearner(s), s.learner);
  });
});

// ---------- property: any sequence of plays, ratings, changes, undos and commits ----------

const ids = cafe();

const event = (now: number): fc.Arbitrary<AppEvent> =>
  fc.oneof(
    { weight: 1, arbitrary: fc.record({ type: fc.constant('LOAD' as const), phraseIds: fc.subarray(ids, { minLength: 1 }), setId: fc.constant(null), startIndex: fc.nat(4), shuffle: fc.constant(false), now: fc.constant(now), seed: fc.nat() }) },
    { weight: 5, arbitrary: fc.record({ type: fc.constant('PHASE_DONE' as const), cycle: fc.constant(0), now: fc.constant(now), measuredMs: fc.integer({ min: 500, max: 3000 }) }) },
    { weight: 4, arbitrary: fc.record({ type: fc.constant('RATE' as const), grade: fc.constantFrom('missed' as const, 'hard' as const, 'easy' as const), now: fc.constant(now) }) },
    { weight: 1, arbitrary: fc.constant({ type: 'UNRATE' as const, now }) },
    { weight: 1, arbitrary: fc.constant({ type: 'COMMIT' as const, now }) },
    { weight: 1, arbitrary: fc.constant({ type: 'NEXT' as const, now }) },
    { weight: 1, arbitrary: fc.record({ type: fc.constant('JUMP' as const), index: fc.nat(6), now: fc.constant(now), play: fc.constant(true) }) },
  );

/** Steps from a second to a few minutes apart, so windows open, change, close and commit. */
const scenario = fc.array(fc.integer({ min: 1000, max: 4 * MINUTE }), { minLength: 1, maxLength: 40 }).chain((steps) => {
  let t = T0 + 30 * DAY;
  return fc.tuple(...steps.map((dt) => ((t += dt), event(t))));
});

describe('the provisional view, for any sequence', () => {
  it('commits without moving a figure, and an undo restores the figures from before the rating', () => {
    fc.assert(
      fc.property(scenario, fc.boolean(), fc.integer({ min: 0, max: 2 * RATING_WINDOW_MS }), (events, reviewed, commitAfter) => {
        // Playing from the start: new phrases, or phrases under review (rated a month ago).
        let t = T0 + 30 * DAY;
        let s = reviewed ? load(dueReview().state, t, cafe(), null) : load(fresh(), t);
        for (const raw of events) {
          t = (raw as { now: number }).now;
          const e = raw.type === 'PHASE_DONE' ? { ...raw, cycle: s.player.cycle } : raw;
          // Undo right after a new rating (not a change of one): every figure is back where it was.
          // In the rating hold a rating moves on to the next phrase, whose undo that would be.
          const current = s.player.order[s.player.index];
          const open = current !== undefined && s.pending.some((p) => p.phraseId === current && !p.undone);
          if (e.type === 'RATE' && s.player.phase !== 'rate' && current !== undefined && !open) {
            const before = figures(displayLearner(s), t);
            const undone = run(s, e, { type: 'UNRATE', now: t });
            assert.deepEqual(figures(displayLearner(undone), t), before);
          }
          s = transition(s, e);
          // A commit, whenever it runs, leaves the view as it was: the same entries.
          const commit = run(s, { type: 'COMMIT', now: t + commitAfter });
          assert.deepEqual(logIds(displayLearner(commit)), logIds(displayLearner(s)));
        }
        // Everything committed: the log alone gives the view's figures.
        const end = t + RATING_WINDOW_MS;
        const committed = run(s, { type: 'COMMIT', now: end });
        assert.equal(committed.pending.length, 0);
        assert.deepEqual(figures(committed.learner, end), figures(displayLearner(s), end));
      }),
      { numRuns: 100 },
    );
  });
});
