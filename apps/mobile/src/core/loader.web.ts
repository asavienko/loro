import bytes from '@loro/core-rs/web-bytes'
import init, { core_call } from '@loro/core-rs/web'
import { jsonRuntime, type CoreRuntime } from './runtime'

let loaded: CoreRuntime | undefined
let loading: Promise<CoreRuntime> | undefined
export function loadCore(): Promise<CoreRuntime> {
  loading ??= init({ module_or_path: bytes })
    .then(() => {
      loaded = jsonRuntime(core_call)
      return loaded
    })
    .catch((error: unknown) => {
      loading = undefined
      throw error
    })
  return loading
}
export function getCore(): CoreRuntime {
  if (!loaded) throw new Error('Canonical core is not ready')
  return loaded
}
