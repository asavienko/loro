import { requireNativeModule } from 'expo-modules-core'
import { jsonRuntime, type CoreRuntime } from './runtime'

let loaded: CoreRuntime | undefined
export function loadCore(): Promise<CoreRuntime> {
  if (!loaded) {
    const native = requireNativeModule<{ coreCall(request: string): string }>('LoroCore')
    loaded = jsonRuntime((request) => native.coreCall(request))
  }
  return Promise.resolve(loaded)
}
export function getCore(): CoreRuntime {
  if (!loaded) throw new Error('Canonical core is not ready')
  return loaded
}
