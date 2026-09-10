import { AudioCacheController } from './audioCacheController'
import { nativeAudioCache } from './audioCacheBridge'

export const audioCache = new AudioCacheController(nativeAudioCache)
export { AudioCacheController, AudioCacheError } from './audioCacheController'
export type { AudioCacheObject, NativeAudioCache } from './audioCacheController'
