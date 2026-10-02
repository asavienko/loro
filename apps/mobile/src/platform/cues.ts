// Cues on iOS and Android (metro.config.js swaps this in for src/shared/audio/cues.ts, whose exports
// this mirrors): the bundled cue sounds (@shared/audio/sounds) through expo-audio, with a haptic on
// each. The words on screen and the speech carry the meaning; these only mark the moment. One
// player per sound, made on first use and kept, so a cue starts at once; like the phrase clips they
// keep the audio session up, so the loop plays on with the screen locked (P3-11).
import { AudioPlayer, createAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { CUE_VOLUME, SOUNDS, type SoundName } from '@shared/audio/sounds';

const tap = (style: Haptics.ImpactFeedbackStyle) => void Haptics.impactAsync(style).catch(() => {});
const notify = (type: Haptics.NotificationFeedbackType) => void Haptics.notificationAsync(type).catch(() => {});

const players: Partial<Record<SoundName, AudioPlayer>> = {};

function player(name: SoundName): AudioPlayer {
  let made = players[name];
  if (!made) {
    made = createAudioPlayer(SOUNDS[name], { keepAudioSessionActive: true });
    made.volume = CUE_VOLUME;
    players[name] = made;
  }
  return made;
}

function sound(name: SoundName) {
  try {
    const p = player(name);
    void p
      .seekTo(0)
      .then(() => p.play())
      .catch(() => {});
  } catch {
    // A cue that can't play leaves the haptic to mark the moment.
  }
}

/** Loads the players ahead of their first moment. */
export function prepareAudio(): void {
  for (const name of Object.keys(SOUNDS) as SoundName[]) player(name);
}
export function resumeAudio(): void {}

/** Your turn to say it. */
export function turnCue() {
  tap(Haptics.ImpactFeedbackStyle.Light);
  sound('turn');
}

/** The hold for a rating. */
export function holdCue() {
  tap(Haptics.ImpactFeedbackStyle.Soft);
  sound('hold');
}

export function easyCue() {
  notify(Haptics.NotificationFeedbackType.Success);
  sound('easy');
}

export function gentleCue() {
  tap(Haptics.ImpactFeedbackStyle.Soft);
  sound('gentle');
}

export function learnedCue() {
  notify(Haptics.NotificationFeedbackType.Success);
  sound('learned');
}

/** The queue was played through. */
export function passCue() {
  sound('pass');
}
