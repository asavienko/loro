import { requireOptionalNativeModule } from 'expo-modules-core'

interface NativeCore {
  call(method: string, input: string): string
}
const nativeCore = requireOptionalNativeModule<NativeCore>('LoroCore')
export const coreAvailable = (): boolean => nativeCore !== null
export function callCore(method: string, input: string): string {
  if (nativeCore === null) throw new Error('LoroCore requires a native development build')
  return nativeCore.call(method, input)
}
