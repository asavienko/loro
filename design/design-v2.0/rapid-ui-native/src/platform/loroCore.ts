// The Rust core on iOS and Android: apps/mobile's LoroCore module, the same `core_call` JSON
// boundary the web prototype reaches through WASM (Hermes has no WebAssembly). Metro puts this in
// place of packages/core-rs/browser/loro_core.js on native (metro.config.js).
import { requireOptionalNativeModule } from 'expo-modules-core';

interface NativeCore {
  call(method: string, input: string): string;
}

const core = requireOptionalNativeModule<NativeCore>('LoroCore');

/** Whether this build carries the core: a development build does, Expo Go doesn't. */
export const coreAvailable = core !== null;

export function core_call(method: string, input: string): string {
  // No scheduling without the core: there is no JavaScript copy of FSRS to fall back on.
  if (!core) throw new Error('LoroCore is missing: run a development build (npm run android), not Expo Go.');
  return core.call(method, input);
}
