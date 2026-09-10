import type { NativeAudioCache } from './audioCacheController'

/** Browser has no native file cache or encoder; generate/listen stay unavailable. */
export const nativeAudioCache: NativeAudioCache | null = null
