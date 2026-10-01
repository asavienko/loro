import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { analyticsEvent } from './events';
import { currentPhraseId } from '../state/selectors';
import { fresh, load, T0 } from '../state/testing';

describe('analytics events', () => {
  it('names a rating after the event and the phrase it rated', () => {
    const playing = load(fresh());
    const recorded = analyticsEvent({ type: 'RATE', grade: 'easy', now: T0 }, playing);
    assert.deepEqual(recorded, {
      name: 'rate',
      properties: { grade: 'easy', phrase_id: currentPhraseId(playing.player), phase: playing.player.phase, set_id: 'set-cafe' },
    });
  });

  it('counts lists, drops clocks and seeds, and keeps the event’s own set', () => {
    const recorded = analyticsEvent({ type: 'LOAD', phraseIds: ['a', 'b', 'c'], setId: 'set-x', shuffle: true, now: T0, seed: 7 }, fresh());
    assert.deepEqual(recorded, { name: 'load', properties: { phrase_ids_count: 3, set_id: 'set-x', shuffle: true } });
  });

  it('flattens nested fields one level', () => {
    const recorded = analyticsEvent({ type: 'SET_PREFS', prefs: { pauseLength: 'longer' }, now: T0 }, fresh());
    assert.deepEqual(recorded, { name: 'set_prefs', properties: { prefs_pause_length: 'longer' } });
  });

  it('skips bookkeeping, and records a phase only when its audio failed', () => {
    const playing = load(fresh());
    assert.equal(analyticsEvent({ type: 'COMMIT', now: T0 }, playing), null);
    assert.equal(analyticsEvent({ type: 'PHASE_DONE', cycle: playing.player.cycle, now: T0 }, playing), null);
    const failed = analyticsEvent({ type: 'PHASE_DONE', cycle: playing.player.cycle, now: T0, failure: { lang: 'es-ES', reason: 'no-voice' } }, playing);
    assert.equal(failed?.name, 'audio_failed');
    assert.equal(failed?.properties.reason, 'no-voice');
  });
});
