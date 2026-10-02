// The player's cue sounds: short clips made with ElevenLabs' sound generator, trimmed, softened above
// 12 kHz and levelled to sit under the phrase voice (docs/design/v2-prototype-decisions.md, "Cue
// sounds"). Bundled with the app, so they play offline and at once. Each is an asset module for
// expo-asset (web) or expo-audio (iOS, Android).
// Bundled assets load by require() in React Native.
/* eslint-disable @typescript-eslint/no-require-imports */
export const SOUNDS = {
  turn: require('../../../assets/sounds/turn.mp3'),
  hold: require('../../../assets/sounds/hold.mp3'),
  easy: require('../../../assets/sounds/easy.mp3'),
  gentle: require('../../../assets/sounds/gentle.mp3'),
  learned: require('../../../assets/sounds/learned.mp3'),
  pass: require('../../../assets/sounds/pass.mp3'),
} as const;
/* eslint-enable @typescript-eslint/no-require-imports */

export type SoundName = keyof typeof SOUNDS;

/** Every cue plays a little under full scale: the phrase is what the learner listens for. */
export const CUE_VOLUME = 0.8;
