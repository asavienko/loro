// The first-review cap counts the learner's calendar days as they lived them: each log entry
// carries its local day, so every device replays one log to the same schedule, whatever its
// own time zone, and so does this device after travel (R-04).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { keyOf } from './catalog';
import { decodeLog, encodeLog } from './compactLog';
import { applyEntry, emptyMemory, RATING_WINDOW_MS } from './memory';
import { mergeLearner } from './merge';
import { parseState, sanitizeState, serializeState } from './persistence';
import { previewDue } from './selectors';
import { HOUR } from './clock';
import { DAY, done, fresh, load, run } from './testing';
import type { LearnerState, LogEntry } from './types';

/** Runs `body` with the process in time zone `tz`, as a device set to that zone would. */
function inZone<T>(tz: string, body: () => T): T {
  const before = process.env.TZ;
  process.env.TZ = tz;
  try {
    return body();
  } finally {
    if (before === undefined) delete process.env.TZ;
    else process.env.TZ = before;
  }
}

const MADRID = 'Europe/Madrid';
const NEW_YORK = 'America/New_York';
// Heard at 23:30 in Madrid (17:30 in New York), rated Easy an hour later: 00:30 the next day in
// Madrid, still the same day in New York.
const HEARD = Date.UTC(2026, 8, 1, 21, 30);
const RATED = HEARD + HOUR;

/** Hears cafe-01 once and rates it Easy, on a device in `tz`; with the preview the grade showed. */
function rateInZone(tz: string): { learner: LearnerState; preview: number } {
  return inZone(tz, () => {
    let s = load(fresh(), HEARD);
    s = done(done(done(s, HEARD + 1), HEARD + 2), HEARD + 3);
    const preview = previewDue(s.learner, 'cafe-01', 'easy', RATED);
    s = run(s, { type: 'RATE', grade: 'easy', now: RATED }, { type: 'COMMIT', now: RATED + RATING_WINDOW_MS });
    return { learner: s.learner, preview };
  });
}

/** When cafe-01 is due, replaying `learner`'s log on a device in `tz` that has never replayed it. */
function dueInZone(tz: string, learner: LearnerState): number {
  return inZone(tz, () => {
    const key = keyOf(learner, 'cafe-01');
    const memory = learner.log.filter((e) => e.kind !== 'carryover' && e.key === key).reduce(applyEntry, emptyMemory());
    return memory.fsrs!.due;
  });
}

const withoutDays = (learner: LearnerState): LearnerState => ({
  ...learner,
  log: learner.log.map((e) => {
    const copy: Record<string, unknown> = { ...e };
    delete copy.day;
    return copy as LogEntry;
  }),
});

describe('the first-review cap across time zones (R-04)', () => {
  it('one log schedules the same on devices in two zones, as the preview promised', () => {
    const madrid = rateInZone(MADRID);
    // Rated on the day after it was first heard, as lived in Madrid: capped at four days, not one.
    assert.ok(madrid.preview - RATED > DAY, 'the Madrid preview uses the earlier-day cap');
    assert.equal(dueInZone(MADRID, madrid.learner), madrid.preview);
    assert.equal(dueInZone(NEW_YORK, madrid.learner), madrid.preview, 'the same due date in New York');

    const newYork = rateInZone(NEW_YORK);
    // Heard and rated on one day, as lived in New York: back within a day.
    assert.equal(newYork.preview - RATED, DAY);
    assert.equal(dueInZone(NEW_YORK, newYork.learner), newYork.preview);
    assert.equal(dueInZone(MADRID, newYork.learner), newYork.preview, 'the same due date in Madrid');
  });

  it('stamps the local day on the entries it writes, and a pending rating keeps its own', () => {
    const { learner } = rateInZone(MADRID);
    const days = learner.log.map((e) => (e.kind === 'carryover' ? null : [e.kind, e.day]));
    assert.deepEqual(days, [
      ['heard', '2026-09-01'],
      ['rated', '2026-09-02'],
    ]);
    // Rated in Madrid, committed after the device moved to New York: the day it was given.
    const committed = inZone(MADRID, () => {
      let s = load(fresh(), HEARD);
      s = run(s, { type: 'RATE', grade: 'easy', now: RATED });
      return s;
    });
    const later = inZone(NEW_YORK, () => run(committed, { type: 'COMMIT', now: RATED + RATING_WINDOW_MS }));
    const rated = later.learner.log.find((e) => e.kind === 'rated');
    assert.equal(rated?.kind === 'rated' && rated.day, '2026-09-02');
  });

  it('entries from before the stamp fall back to the replaying device’s calendar', () => {
    const old = withoutDays(rateInZone(MADRID).learner);
    assert.ok(dueInZone(MADRID, old) - RATED > DAY);
    assert.equal(dueInZone(NEW_YORK, old) - RATED, DAY);
  });

  it('keeps the day through storage, the compact log and sync; drops one that is not a real day of that time', () => {
    const { learner } = rateInZone(MADRID);
    assert.deepEqual(decodeLog(encodeLog(learner.log)), learner.log.map((e) => ({ ...e })));
    const s = { ...fresh(), learner };
    const back = parseState(serializeState(s), s.device)!;
    assert.deepEqual(back.learner.log, learner.log);
    // Another device merges the synced copy with the days as they were stamped.
    assert.deepEqual(mergeLearner(fresh().learner, back.learner).log, learner.log);
    // An older compact log (no day on its rows) reads back without days.
    const compact = encodeLog(withoutDays(learner).log);
    assert.ok(compact.rows.every((row) => row.length === (row[0] === 'h' ? 8 : 7)), 'no day, no extra field');
    assert.deepEqual(decodeLog(compact), withoutDays(learner).log);
    // Sanitising: a malformed day, or one no time zone could give that moment, is dropped.
    const raw = JSON.parse(JSON.stringify({ ...s, learner: { ...learner, log: learner.log } }));
    raw.learner.log[0].day = '2026-9-1';
    raw.learner.log[1].day = '2026-09-05';
    const dayOfFirst = () => {
      const e = sanitizeState(raw, s.device)!.learner.log[0];
      return e.kind === 'carryover' ? null : e.day;
    };
    assert.equal(dayOfFirst(), undefined);
    const cleaned = sanitizeState(raw, s.device)!.learner.log;
    assert.equal(cleaned[1].kind === 'rated' && cleaned[1].day, undefined);
    // 21:30 UTC on 1 September is the 1st from UTC−12 to UTC+2, and the 2nd from UTC+3 to UTC+14.
    for (const [day, kept] of [['2026-09-01', true], ['2026-09-02', true], ['2026-08-31', false], ['2026-09-03', false]] as const) {
      raw.learner.log[0].day = day;
      assert.equal(dayOfFirst(), kept ? day : undefined, day);
    }
  });
});
