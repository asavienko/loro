import type { NativeAudioCache } from './audioCacheController'

/** Browser has no native file cache; listen streams API download URLs instead. */
export const nativeAudioCache: NativeAudioCache | null = null
