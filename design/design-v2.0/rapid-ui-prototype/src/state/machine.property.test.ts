// Property tests: any sequence of events keeps the machine's invariants.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fc from 'fast-check';
import { CONTENT_PHRASES } from '../content';
import { AppEvent, transition } from './machine';
import { sanitizeState } from './persistence';
import { compareEntries, derive } from './memory';
import { fresh, T0 } from './testing';

const ids = CONTENT_PHRASES.filter((p) => p.targetLang === 'es-ES').map((p) => p.id);

const event = (now: number): fc.Arbitrary<AppEvent> =>
  fc.oneof(
    fc.record({ type: fc.constant('LOAD' as const), phraseIds: fc.subarray(ids, { minLength: 1 }), setId: fc.constant(null), startIndex: fc.nat(10), shuffle: fc.boolean(), now: fc.constant(now), seed: fc.nat() }),
    fc.constant({ type: 'PLAY' as const, now }),
    fc.constant({ type: 'PAUSE' as const, now }),
    fc.record({ type: fc.constant('PHASE_DONE' as const), cycle: fc.nat(3).map((d) => -d), now: fc.constant(now), measuredMs: fc.integer({ min: 200, max: 5000 }), unconfirmed: fc.boolean() }),
    fc.constant({ type: 'NEXT' as const, now }),
    fc.constant({ type: 'PREV' as const, now }),
    fc.record({ type: fc.constant('JUMP' as const), index: fc.integer({ min: -1, max: 30 }), now: fc.constant(now), play: fc.boolean() }),
    fc.record({ type: fc.constant('RATE' as const), grade: fc.constantFrom('missed' as const, 'hard' as const, 'easy' as const), now: fc.constant(now) }),
    fc.constant({ type: 'UNRATE' as const, now }),
    fc.constant({ type: 'COMMIT' as const, now }),
    fc.record({ type: fc.constant('TOGGLE_SHUFFLE' as const), seed: fc.nat() }),
    fc.record({ type: fc.constant('REMOVE_FROM_QUEUE' as const), position: fc.integer({ min: -1, max: 30 }) }),
    fc.record({ type: fc.constant('ENQUEUE' as const), phraseIds: fc.subarray(ids, { minLength: 1, maxLength: 4 }), setId: fc.constant(null), at: fc.constantFrom('next' as const, 'end' as const), now: fc.constant(now) }),
    fc.constant({ type: 'CLEAR_QUEUE' as const }),
    fc.record({ type: fc.constant('SET_PREFS' as const), prefs: fc.record({ playMode: fc.constantFrom('repeat' as const, 'continue' as const) }) }),
  );

/** Steps a minute or so apart; PHASE_DONE uses the current cycle (offset back by 0–3 to test stale ones). */
const scenario = fc.array(fc.tuple(fc.integer({ min: 0, max: 400_000 }), fc.nat()), { maxLength: 60 }).chain((steps) => {
  let t = T0;
  return fc.tuple(...steps.map(([dt]) => ((t += dt), event(t))));
});

describe('machine invariants', () => {
  it('hold after any sequence of events', () => {
    fc.assert(
      fc.property(scenario, (events) => {
        let s = fresh();
        for (const raw of events) {
          const e = raw.type === 'PHASE_DONE' ? { ...raw, cycle: s.player.cycle + raw.cycle } : raw;
          s = transition(s, e);
          const { player, learner, pending } = s;
          // The index points into the queue (or the queue is empty).
          assert.ok(player.order.length === 0 ? player.index === 0 : player.index >= 0 && player.index < player.order.length);
          assert.ok(player.repetition >= 1 && player.repetition <= player.repeats);
          assert.ok(player.status === 'idle' ? player.order.length === 0 : true);
          // The log stays sorted, ids unique.
          for (let i = 1; i < learner.log.length; i++) assert.ok(compareEntries(learner.log[i - 1], learner.log[i]) < 0);
          // At most one pending rating per phrase key.
          assert.equal(new Set(pending.map((p) => p.key)).size, pending.length);
        }
        // Points and memory are a pure function of the log.
        const again = derive([...s.learner.log]);
        assert.equal(again.points, derive(s.learner.log).points);
        assert.ok(again.points >= 0);
      }),
      { numRuns: 150 },
    );
  });
});

describe('loading anything', () => {
  it('any saved state, however broken, loads without throwing', () => {
    const entry = fc.record({
      id: fc.oneof(fc.string(), fc.constant('dup')),
      at: fc.oneof(fc.integer({ min: -1e3, max: 2e12 }), fc.double(), fc.constant(Number.NaN)),
      device: fc.string(),
      kind: fc.constantFrom('heard', 'rated', 'carryover', 'nonsense'),
      key: fc.constantFrom('en-GB>es-ES:cafe-01', 'en-GB>es-ES:gone-01', 'bad'),
      phraseId: fc.constantFrom('cafe-01', 'tapas-02', 'gone-01', 'phrase-1'),
      setId: fc.oneof(fc.constant(null), fc.string()),
      grade: fc.constantFrom('missed', 'hard', 'easy', 'great'),
      targetMs: fc.oneof(fc.integer(), fc.constant(null)),
      points: fc.integer(),
    });
    fc.assert(
      fc.property(fc.array(entry, { maxLength: 40 }), fc.anything(), (log, junk) => {
        const raw = { version: 3, learner: { profile: junk, log, likes: junk, ownPhrases: junk, ownSets: junk }, pending: junk, prefs: junk, player: junk };
        const s = sanitizeState(raw, { id: 'd', instance: 'i', seq: 0 });
        assert.ok(s);
        assert.ok(Number.isFinite(derive(s.learner.log).points));
      }),
      { numRuns: 300 },
    );
  });
});
