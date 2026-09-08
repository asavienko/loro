import { requireOptionalNativeModule } from 'expo-modules-core'
import type { NativeAudioSpeech } from './audioSpeechController'

export const nativeAudioSpeech = requireOptionalNativeModule<NativeAudioSpeech>('LoroAudioSpeech')
