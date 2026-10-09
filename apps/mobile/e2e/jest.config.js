// The headless end-to-end suite: the whole app (expo-router, every screen and sheet, the store, the
// Rust core's WASM build) rendered in Node by React Native Testing Library, against an in-memory API
// (e2e/fakes/api.ts) and fake audio (e2e/fakes/audio.ts). No browser, simulator or device.
//
// As on iOS (metro.config.js), the shared platform-edge modules are swapped for the native ones
// (e2e/resolver.js); the native libraries under those are the fakes in e2e/setup.ts.
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const preset = require('jest-expo/jest-preset');

/** @type {import('jest').Config} */
module.exports = {
  ...preset,
  rootDir: projectRoot,
  roots: ['<rootDir>/e2e'],
  testMatch: ['<rootDir>/e2e/flows/**/*.e2e.tsx'],
  resolver: '<rootDir>/e2e/resolver.js',
  moduleNameMapper: {
    ...preset.moduleNameMapper,
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFiles: [...preset.setupFiles, '<rootDir>/e2e/env.ts'],
  setupFilesAfterEnv: ['<rootDir>/e2e/setup.ts'],
  // Packages shipped untranspiled, beyond Expo's list; the Rust core's 900 kB WASM build is plain
  // CommonJS and is left as it is.
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|posthog-react-native|@posthog|react-native-.*))',
    '/node_modules/react-native-reanimated/plugin/',
    '/packages/core-rs/browser/',
  ],
  cacheDirectory: path.join(projectRoot, 'node_modules/.cache/jest-e2e'),
  testTimeout: 30_000,
};
