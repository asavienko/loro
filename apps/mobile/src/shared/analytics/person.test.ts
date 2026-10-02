import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { accountProperties, learnerProperties } from './person';
import { localDay } from '../state/clock';
import { learnerStats, points } from '../state/selectors';
import { fresh, load, MINUTE, run, T0 } from '../state/testing';

describe('person properties', () => {
  it('describes a new learner by name and course, with every figure at zero', () => {
    const state = fresh();
    const { profile } = state.learner;
    assert.deepEqual(learnerProperties(state.learner, T0), {
      name: 'Ana',
      course: profile.targetLang,
      ui_lang: profile.nativeLang,
      onboarded: true,
      points: 0,
      phrases_started: 0,
      phrases_rated: 0,
      phrases_learned: 0,
      phrases_due: 0,
      average_recall: null,
      active_days: 0,
      first_active_day: null,
      last_active_day: null,
      own_sets: 0,
      own_phrases: 0,
      likes: 0,
    });
  });

  it('counts the days practised and reports the figures the screens show', () => {
    const later = T0 + 6 * MINUTE;
    const state = run(load(fresh()), { type: 'RATE', grade: 'easy', now: T0 }, { type: 'COMMIT', now: later }, { type: 'TOGGLE_LIKE', kind: 'set', id: 'set-cafe', now: later });
    const stats = learnerStats(state.learner, later);
    assert.equal(stats.rated, 1);
    const properties = learnerProperties(state.learner, later);
    assert.equal(properties.points, points(state.learner));
    assert.equal(properties.phrases_rated, 1);
    assert.equal(properties.phrases_started, stats.started);
    assert.equal(properties.average_recall, stats.averageRecall);
    assert.equal(properties.active_days, 1);
    assert.equal(properties.first_active_day, localDay(T0));
    assert.equal(properties.last_active_day, localDay(T0));
    assert.equal(properties.likes, 1);
  });

  it('sends an unnamed learner and an unnamed account as null, never as an empty string', () => {
    const state = fresh();
    const learner = { ...state.learner, profile: { ...state.learner.profile, name: '' } };
    assert.equal(learnerProperties(learner, T0).name, null);
    assert.deepEqual(accountProperties({ userId: 'u1', email: null, provider: 'apple', displayName: null }), {
      user_id: 'u1',
      email: null,
      provider: 'apple',
      display_name: null,
    });
  });
});
