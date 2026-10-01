import type { ExpoConfig } from 'expo/config';

// One app, three Android identities, so they install side by side: the store build, the local
// preview APK (scripts/apk-local.mjs sets LORO_LOCAL_APK) and the development client
// (scripts/android-development.mjs sets LORO_ANDROID_DEV_CLIENT).
const localApk = process.env.LORO_LOCAL_APK === '1';
const developmentClient = process.env.LORO_ANDROID_DEV_CLIENT === '1';

/**
 * Loro. A development build is required: the Rust core runs through the LoroCore native module
 * (modules/loro-core), which Expo Go doesn't contain.
 */
export default (): ExpoConfig => ({
  name: localApk ? 'Loro Preview' : 'Loro',
  slug: 'loro',
  version: '0.1.0',
  scheme: developmentClient ? 'loro-dev' : 'loro',
  orientation: 'default',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  icon: './assets/icons/icon-512.png',
  backgroundColor: '#fcf9f4',
  splash: { backgroundColor: '#fcf9f4', resizeMode: 'contain', image: './assets/icons/icon-512.png' },
  // Songs keep playing with the screen locked (the music player's lock-screen controls).
  ios: { bundleIdentifier: 'app.loro.ios', supportsTablet: true, infoPlist: { UIBackgroundModes: ['audio'] } },
  android: {
    package: localApk ? 'app.loro.android.preview' : developmentClient ? 'app.loro.android.dev' : 'app.loro.android',
    adaptiveIcon: { foregroundImage: './assets/icons/icon-maskable-512.png', backgroundColor: '#fcf9f4' },
  },
  web: { bundler: 'metro', output: 'single', favicon: './assets/icons/icon-192.png' },
  plugins: ['expo-router', 'expo-font', 'expo-splash-screen', 'expo-audio', 'expo-secure-store', 'expo-web-browser', 'expo-localization'],
  // Metro resolves @shared itself (metro.config.js); tsconfig's paths are for the type checker only.
  experiments: { typedRoutes: false, tsconfigPaths: false },
});
