// Before any module loads: no analytics key (nothing is sent), the API the fake answers, and Node's
// own text codecs. jest-expo installs Expo's JavaScript TextDecoder, which reads nothing from the
// Rust core's WASM memory (every `core_call` would answer ''); a browser, where the WASM build
// runs, has native ones.
import { TextDecoder, TextEncoder } from 'node:util';

process.env.EXPO_PUBLIC_POSTHOG_KEY = '';
process.env.EXPO_PUBLIC_API_URL = 'http://api.loro.test/v1';
process.env.TZ = 'UTC';

for (const [name, value] of Object.entries({ TextDecoder, TextEncoder })) {
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
}
