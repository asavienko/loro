import type { ConfigPlugin } from 'expo/config-plugins';
import { withEntitlementsPlist } from 'expo/config-plugins';
import type { ExpoConfig } from 'expo/config';

// One app, three Android identities, so they install side by side: the store build, the local
// preview APK (scripts/apk-local.mjs sets LORO_LOCAL_APK) and the development client
// (scripts/android-development.mjs sets LORO_ANDROID_DEV_CLIENT).
const localApk = process.env.LORO_LOCAL_APK === '1';
const developmentClient = process.env.LORO_ANDROID_DEV_CLIENT === '1';
// iOS has two: the store build (and TestFlight) and the local preview IPA (scripts/ipa-local.mjs
// sets LORO_LOCAL_IPA, and LORO_IOS_BUNDLE_ID when a personal team needs an identifier of its own).
const localIpa = process.env.LORO_LOCAL_IPA === '1';
const iosBundleIdentifier = localIpa ? process.env.LORO_IOS_BUNDLE_ID || 'app.loro.ios.preview' : 'app.loro.ios';
const easProjectId = process.env.EAS_PROJECT_ID;

// Without the EAS project id the app never asks for a push token (src/platform/push.ts), so it needs
// no push entitlement, which expo-notifications always adds and a free Apple ID can't sign. Applied
// before the listed plugins, so its change runs after theirs.
const withoutRemotePush: ConfigPlugin = (config) =>
  withEntitlementsPlist(config, (mod) => {
    delete mod.modResults['aps-environment'];
    return mod;
  });

/**
 * Loro. A development build is required: the Rust core runs through the LoroCore native module
 * (modules/loro-core), which Expo Go doesn't contain.
 */
const config: ExpoConfig = {
  name: localApk || localIpa ? 'Loro Preview' : 'Loro',
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
  // TestFlight refuses a build number it has seen, so the IPA runner passes one (the commit count).
  ios: {
    bundleIdentifier: iosBundleIdentifier,
    ...(process.env.LORO_IOS_BUILD_NUMBER ? { buildNumber: process.env.LORO_IOS_BUILD_NUMBER } : {}),
    supportsTablet: true,
    infoPlist: { UIBackgroundModes: ['audio'] },
  },
  android: {
    package: localApk ? 'app.loro.android.preview' : developmentClient ? 'app.loro.android.dev' : 'app.loro.android',
    adaptiveIcon: { foregroundImage: './assets/icons/icon-maskable-512.png', backgroundColor: '#fcf9f4' },
    // The app records nothing (ADR-0011): no microphone, and none of the template's storage or
    // overlay permissions. expo-audio's own manifest asks for the microphone, so it is blocked here.
    blockedPermissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
    ],
  },
  web: { bundler: 'metro', output: 'single', favicon: './assets/icons/icon-192.png' },
  // A word when a song is ready (plan 113): a push through Expo's service needs the EAS project id;
  // without one (a local APK) the app notifies itself only while it runs in the background.
  ...(easProjectId ? { extra: { eas: { projectId: easProjectId } } } : {}),
  plugins: [
    'expo-router',
    'expo-font',
    'expo-splash-screen',
    ['expo-audio', { microphonePermission: false, recordAudioAndroid: false }],
    'expo-secure-store',
    'expo-web-browser',
    'expo-localization',
    ['expo-notifications', { color: '#fcf9f4' }],
  ],
  // Metro resolves @shared itself (metro.config.js); tsconfig's paths are for the type checker only.
  experiments: { typedRoutes: false, tsconfigPaths: false },
};

export default (): ExpoConfig => (easProjectId ? config : withoutRemotePush(config));
