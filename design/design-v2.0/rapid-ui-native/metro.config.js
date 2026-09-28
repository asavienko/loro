/* global require, module, __dirname */
/* eslint-disable @typescript-eslint/no-require-imports */
// Metro for the prototype's native app (plan 104).
//
// The app runs the web prototype's own modules (content, state machine, copy, generator), imported
// through the `@shared/*` path. Two things make that work:
//
//  1. ONE COPY OF EACH PACKAGE. Shared files resolve `react` and friends as if this app imported
//     them, never from the web prototype's node_modules, so there is one React.
//
//  2. THE PLATFORM EDGE. On iOS and Android four leaf modules are swapped for native ones; on the
//     web the originals run (NATIVE below).
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const prototypeRoot = path.resolve(projectRoot, '../rapid-ui-prototype');
const repoRoot = path.resolve(projectRoot, '../../..');
const coreBrowser = path.join(repoRoot, 'packages/core-rs/browser/loro_core.js');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [path.join(prototypeRoot, 'src'), path.dirname(coreBrowser)];
config.resolver.nodeModulesPaths = [path.join(projectRoot, 'node_modules')];
// The prototype's tests and Node-only content validation never reach the app.
config.resolver.blockList = [/rapid-ui-prototype[/\\](?:node_modules|dist|e2e|server)[/\\]/, /\.test\.[cm]?[jt]sx?$/];

/** Shared module → its native stand-in. */
const NATIVE = {
  // Saved progress: AsyncStorage instead of IndexedDB/localStorage.
  [path.join(prototypeRoot, 'src/state/storage.ts')]: path.join(projectRoot, 'src/platform/storage.ts'),
  // The device voice: expo-speech instead of the Web Speech API.
  [path.join(prototypeRoot, 'src/audio/speech.ts')]: path.join(projectRoot, 'src/platform/speech.ts'),
  // Cues: haptics instead of Web Audio tones.
  [path.join(prototypeRoot, 'src/audio/cues.ts')]: path.join(projectRoot, 'src/platform/cues.ts'),
  // The Rust core: apps/mobile's LoroCore module instead of WASM (Hermes has no WebAssembly).
  [coreBrowser]: path.join(projectRoot, 'src/platform/loroCore.ts'),
};

const SHARED = '@shared/';

const isBare = (name) => !name.startsWith('.') && !path.isAbsolute(name);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // `@shared/…` is the web prototype's src (tsconfig.json says the same to the type checker).
  const name = moduleName.startsWith(SHARED) ? path.join(prototypeRoot, 'src', moduleName.slice(SHARED.length)) : moduleName;
  // A package imported by a shared file comes from this app, as if the app imported it: never
  // the web prototype's own node_modules (a second React). Packages nested inside this app's
  // node_modules (react-native's own) still resolve the usual way.
  const outside = !context.originModulePath.startsWith(projectRoot + path.sep);
  const from = outside && isBare(name) ? { ...context, originModulePath: path.join(projectRoot, 'package.json') } : context;
  const resolved = context.resolveRequest(from, name, platform);
  if (platform !== 'web' && resolved.type === 'sourceFile' && NATIVE[resolved.filePath]) {
    return { type: 'sourceFile', filePath: NATIVE[resolved.filePath] };
  }
  return resolved;
};

module.exports = config;
