// Cues on iOS and Android: a haptic in place of the web prototype's soft Web Audio tones (its
// src/audio/cues.ts, whose exports this mirrors; metro.config.js swaps it in). The words on screen
// and the speech carry the meaning; these only mark the moment.
import * as Haptics from 'expo-haptics';

const tap = (style: Haptics.ImpactFeedbackStyle) => void Haptics.impactAsync(style).catch(() => {});

export function prepareAudio(): void {}
export function resumeAudio(): void {}

/** Your turn to say it. */
export function turnCue() {
  tap(Haptics.ImpactFeedbackStyle.Light);
}

/** The hold for a rating. */
export function holdCue() {
  tap(Haptics.ImpactFeedbackStyle.Soft);
}

export function easyCue() {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function gentleCue() {
  tap(Haptics.ImpactFeedbackStyle.Soft);
}

export function learnedCue() {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
