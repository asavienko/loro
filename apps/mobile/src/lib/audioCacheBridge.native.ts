import { requireOptionalNativeModule } from 'expo-modules-core'
import type { NativeAudioCache } from './audioCacheController'

export const nativeAudioCache = requireOptionalNativeModule<NativeAudioCache>('LoroAudioCache')
