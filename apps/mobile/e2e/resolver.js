// Resolves as Metro does for iOS (metro.config.js): each shared platform-edge module is replaced by
// its native stand-in in src/platform, so the suite runs the code the phone runs. The one exception
// is the Rust core: the phone's LoroCore native module can't load in Node, and the WASM build the
// web uses is the same core behind the same `core_call` boundary.
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const shared = (file) => path.join(projectRoot, 'src/shared', file);
const platform = (file) => path.join(projectRoot, 'src/platform', file);

/** Shared module → its native stand-in (metro.config.js's NATIVE, without the Rust core). */
const NATIVE = {
  [shared('state/storage.ts')]: platform('storage.ts'),
  [shared('audio/speech.ts')]: platform('speech.ts'),
  [shared('audio/cues.ts')]: platform('cues.ts'),
  [shared('ui/haptics.ts')]: platform('haptics.ts'),
  [shared('api/kv.ts')]: platform('kv.ts'),
  [shared('api/secrets.ts')]: platform('secrets.ts'),
  [shared('api/oauth.ts')]: platform('oauth.ts'),
  [shared('push.ts')]: platform('push.ts'),
  // Hermes lacks Intl's newer parts and the phone polyfills them; Node has full ICU, as the web does.
  [platform('intl.native.ts')]: platform('intl.ts'),
};

module.exports = (request, options) => {
  const resolved = options.defaultResolver(request, options);
  return NATIVE[resolved] ?? resolved;
};
