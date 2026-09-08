import type { NativeAudioSpeech } from './audioSpeechController'

/** Web intentionally has no speech recognizer: browser providers may upload recordings. */
export const nativeAudioSpeech: NativeAudioSpeech | null = null
