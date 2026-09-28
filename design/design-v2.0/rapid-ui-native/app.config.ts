import type { ExpoConfig } from 'expo/config';

/**
 * The v2.0 prototype as an Expo app (plan 104). A development build is required: the Rust core
 * runs through apps/mobile's LoroCore native module, which Expo Go doesn't contain.
 */
export default (): ExpoConfig => ({
  name: 'Loro v2',
  slug: 'loro-prototype-native',
  version: '0.1.0',
  scheme: 'loro-v2',
  orientation: 'default',
  // Light only, as the web prototype (its index.html).
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  icon: '../rapid-ui-prototype/public/icons/icon-512.png',
  backgroundColor: '#fcf9f4',
  splash: { backgroundColor: '#fcf9f4', resizeMode: 'contain', image: '../rapid-ui-prototype/public/icons/icon-512.png' },
  ios: { bundleIdentifier: 'com.loro.prototype', supportsTablet: true },
  android: {
    package: 'com.loro.prototype',
    adaptiveIcon: { foregroundImage: '../rapid-ui-prototype/public/icons/icon-maskable-512.png', backgroundColor: '#fcf9f4' },
  },
  web: { bundler: 'metro', output: 'single', favicon: '../rapid-ui-prototype/public/icons/icon-192.png' },
  plugins: ['expo-router', 'expo-font', 'expo-splash-screen'],
  // Metro resolves @shared itself (metro.config.js); tsconfig's paths are for the type checker only.
  experiments: { typedRoutes: false, tsconfigPaths: false },
});
