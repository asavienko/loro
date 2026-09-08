/** Generated Rust WASM, instantiated synchronously before any progress write. */
import { core_call } from '@loro/core-rs/browser'

export const coreAvailable = (): boolean => true
export const callCore = (method: string, input: string): string => core_call(method, input)
