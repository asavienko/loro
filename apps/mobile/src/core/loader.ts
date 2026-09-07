import { core_call } from '@loro/core-rs/wasm'
import { jsonRuntime, type CoreRuntime } from './runtime'

let loaded: CoreRuntime | undefined
export function loadCore(): Promise<CoreRuntime> {
  loaded ??= jsonRuntime(core_call)
  return Promise.resolve(loaded)
}
export function getCore(): CoreRuntime {
  if (!loaded) throw new Error('Canonical core is not ready')
  return loaded
}
