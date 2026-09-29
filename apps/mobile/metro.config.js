/* global require, module, __dirname */
/* eslint-disable @typescript-eslint/no-require-imports */
// Metro for the app.
//
//  1. SHARED BEHAVIOUR. `@shared/*` is src/shared: content, the state machine, persistence, copy,
//     the phrase notes and the suggestion generator. It is platform-neutral; tsconfig.json maps the
//     same path for the type checker.
//
//  2. THE PLATFORM EDGE. On iOS and Android six leaf modules are swapped for native ones; on the
//     web the originals run (NATIVE below).
//
//  3. THE WORKSPACE. pnpm hoists packages to the repository root (.npmrc), and the Rust core's
//     browser build lives in packages/core-rs.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const sharedRoot = path.join(projectRoot, 'src/shared');
const workspaceRoot = path.resolve(projectRoot, '../..');
const coreBrowser = path.join(workspaceRoot, 'packages/core-rs/browser/loro_core.js');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [path.join(projectRoot, 'node_modules'), path.join(workspaceRoot, 'node_modules')];
const escapePath = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Native and Rust build products are large, fast-changing trees, never JS inputs; tests never
// reach the app.
config.resolver.blockList = [
  new RegExp(`^${escapePath(path.join(workspaceRoot, 'packages/core-rs/target'))}[/\\\\]`),
  new RegExp(`^${escapePath(projectRoot)}[/\\\\](?:android|ios)[/\\\\]`),
  new RegExp(`^${escapePath(projectRoot)}[/\\\\]modules[/\\\\][^/\\\\]+[/\\\\](?:android[/\\\\])?build[/\\\\]`),
  /\.test\.[cm]?[jt]sx?$/,
];

/** Shared module → its native stand-in. */
const NATIVE = {
  // Saved progress: AsyncStorage instead of IndexedDB/localStorage.
  [path.join(sharedRoot, 'state/storage.ts')]: path.join(projectRoot, 'src/platform/storage.ts'),
  // The device voice: expo-speech instead of the Web Speech API.
  [path.join(sharedRoot, 'audio/speech.ts')]: path.join(projectRoot, 'src/platform/speech.ts'),
  // Cues: haptics instead of Web Audio tones.
  [path.join(sharedRoot, 'audio/cues.ts')]: path.join(projectRoot, 'src/platform/cues.ts'),
  // The Rust core: the LoroCore native module instead of WASM (Hermes has no WebAssembly).
  [coreBrowser]: path.join(projectRoot, 'src/platform/loroCore.ts'),
  // Content packs and account details: AsyncStorage instead of localStorage.
  [path.join(sharedRoot, 'api/kv.ts')]: path.join(projectRoot, 'src/platform/kv.ts'),
  // The refresh token: the Keychain / Keystore instead of localStorage.
  [path.join(sharedRoot, 'api/secrets.ts')]: path.join(projectRoot, 'src/platform/secrets.ts'),
  // A provider's sign-in page: an auth session that returns to the app instead of leaving it.
  [path.join(sharedRoot, 'api/oauth.ts')]: path.join(projectRoot, 'src/platform/oauth.ts'),
};

const SHARED = '@shared/';

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const name = moduleName.startsWith(SHARED) ? path.join(sharedRoot, moduleName.slice(SHARED.length)) : moduleName;
  const resolved = context.resolveRequest(context, name, platform);
  if (platform !== 'web' && resolved.type === 'sourceFile' && NATIVE[resolved.filePath]) {
    return { type: 'sourceFile', filePath: NATIVE[resolved.filePath] };
  }
  return resolved;
};

module.exports = config;
