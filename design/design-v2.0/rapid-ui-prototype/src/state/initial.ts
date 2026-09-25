import { CONTENT_VERSION } from '../content';
import { AppState, LearnerState, PlayerState, Prefs, Profile, STATE_VERSION } from './types';

export function initialProfile(): Profile {
  return { name: '', nativeLang: 'en-GB', targetLang: 'es-ES', onboarded: false, updatedAt: 0 };
}

export function initialLearner(): LearnerState {
  return { profile: initialProfile(), log: [], likes: {}, ownPhrases: {}, ownSets: {} };
}

export function initialPrefs(): Prefs {
  return { playMode: 'repeat', repeats: 'auto', speed: 1, announceEveryStep: false, sortBySet: {}, skippedDemo: false, voiceByLang: {}, changedAt: {} };
}

export function initialPlayer(): PlayerState {
  return {
    status: 'idle',
    phase: 'native',
    repetition: 1,
    repeats: 3,
    shuffle: false,
    setId: null,
    baseOrder: [],
    order: [],
    index: 0,
    cycle: 0,
    playingSince: null,
    elapsedMs: 0,
    nativeMsThisRep: null,
    ended: false,
    audioError: null,
    session: null,
  };
}

export function initialState(deviceId: string, instance = deviceId): AppState {
  return {
    version: STATE_VERSION,
    contentVersion: CONTENT_VERSION,
    device: { id: deviceId, instance, seq: 0 },
    learner: initialLearner(),
    pending: [],
    prefs: initialPrefs(),
    player: initialPlayer(),
  };
}

