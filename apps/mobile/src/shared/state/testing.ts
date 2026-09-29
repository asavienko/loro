// Helpers for the state tests: a known device, a learner past onboarding, and
// a way to play phases without audio.
import { getSet } from '../content';
import { DAY, MINUTE } from './clock';
import { initialState } from './initial';
import { AppEvent, transition } from './machine';
import type { AppState } from './types';

export const T0 = Date.UTC(2026, 8, 1, 9, 0, 0);
export { DAY, MINUTE };

export function fresh(overrides: Partial<AppState['prefs']> = {}): AppState {
  const s = initialState('dev', 'tab');
  return {
    ...s,
    learner: { ...s.learner, profile: { ...s.learner.profile, name: 'Ana', onboarded: true } },
    prefs: { ...s.prefs, ...overrides },
  };
}

export function run(state: AppState, ...events: AppEvent[]): AppState {
  return events.reduce(transition, state);
}

export const cafe = () => getSet('set-cafe').phraseIds;

export function load(state: AppState, now = T0, phraseIds = cafe(), setId: string | null = 'set-cafe'): AppState {
  return transition(state, { type: 'LOAD', phraseIds, setId, now, seed: 1 });
}

/** Completes the current phase as if the audio finished, with a measurement. */
export function done(state: AppState, now: number, measuredMs = 1200): AppState {
  return transition(state, { type: 'PHASE_DONE', cycle: state.player.cycle, now, measuredMs });
}

/** Plays phases until the phrase index changes or `limit` phases pass; returns the time used. */
export function playPhrase(state: AppState, now: number, limit = 20): [AppState, number] {
  const start = state.player.index;
  let s = state;
  let t = now;
  for (let i = 0; i < limit && s.player.index === start && s.player.status === 'playing'; i++) {
    t += 2000;
    s = done(s, t);
  }
  return [s, t];
}
