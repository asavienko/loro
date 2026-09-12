import type { ExpoConfig } from 'expo/config'

/**
 * Expo config.
 *
 * Two things here are load-bearing rather than boilerplate:
 *
 *  1. The MICROPHONE PURPOSE STRING states the privacy promise. The permission dialog
 *     is where a learner decides whether to trust us, and the prosody screen prints
 *     the same promise (Loro.dc.html:1281). See ADR-0011.
 *
 *  2. Background audio modes. The stream and the ambient loop must survive
 *     backgrounding and the lock screen. See ADR-0007.
 */

const VERSION = '0.1.0'
const localApk = process.env['LORO_LOCAL_APK'] === '1'
const androidDevelopmentClient = !localApk && process.env['LORO_ANDROID_DEV_CLIENT'] === '1'
const nativeRedirectUri = androidDevelopmentClient ? 'loro-dev://account' : 'loro://account'
const splashPlugins: NonNullable<ExpoConfig['plugins']> = localApk
  ? [
      [
        'expo-splash-screen',
        {
          android: {
            drawable: { icon: './assets/preview/splash.xml' },
            backgroundColor: '#fcf9f4',
          },
        },
      ],
    ]
  : ['./plugins/with-default-splash-icon.cjs']

export default (): ExpoConfig => ({
  name: localApk ? 'Loro Preview' : 'Loro',
  slug: 'loro',
  version: VERSION,
  orientation: 'default',
  // Keep the development client separate from Preview and the future production app so
  // `expo run:android` can launch the correct installation without Android's app chooser.
  scheme: androidDevelopmentClient ? 'loro-dev' : 'loro',
  userInterfaceStyle: 'light', // dark theme is v1.1
  newArchEnabled: true,

  splash: {
    backgroundColor: '#fcf9f4', // surface.app
    resizeMode: 'contain',
  },

  updates: {
    // OTA is for FIXES, not features. Staged 5% → 25% → 100%.
    // See docs/process/ci-cd.md#ota-updates
    enabled: !localApk,
    url: localApk ? undefined : 'https://u.expo.dev/PLACEHOLDER',
    fallbackToCacheTimeout: 0,
  },
  // An OTA cannot target a binary whose native surface differs.
  runtimeVersion: { policy: 'appVersion' },

  assetBundlePatterns: ['**/*'],

  ios: {
    bundleIdentifier: 'app.loro.ios',
    supportsTablet: false, // phone-only; iPad runs it scaled
    buildNumber: '1',
    infoPlist: {
      // The promise, at the moment of decision.
      NSMicrophoneUsageDescription:
        'Loro listens while you practise speaking. Speech is recognized on this device and recordings are never uploaded.',
      NSSpeechRecognitionUsageDescription:
        'Speech recognition runs on your device so you can practise offline.',
      NSCameraUsageDescription: 'Photograph a sign or menu to add the phrases you see.',
      // Background audio: the stream and the ambient loop.
      UIBackgroundModes: ['audio'],
      // A muted language app is broken, so we do not respect the silent switch for playback.
      ITSAppUsesNonExemptEncryption: false,
    },
    entitlements: {
      // Widgets read a snapshot the app publishes. See widgets-notifications.md
      'com.apple.security.application-groups': ['group.app.loro'],
    },
  },

  android: {
    package: localApk
      ? 'app.loro.android.preview'
      : androidDevelopmentClient
        ? 'app.loro.android.dev'
        : 'app.loro.android',
    versionCode: 1,
    adaptiveIcon: localApk
      ? undefined
      : {
          backgroundColor: '#fcf9f4',
        },
    permissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.CAMERA',
      'android.permission.POST_NOTIFICATIONS',
      // Background playback needs a foreground service.
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
    ],
    blockedPermissions: [
      // Explicitly not wanted, ever. See docs/architecture/security-privacy.md
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.READ_CONTACTS',
      'android.permission.READ_EXTERNAL_STORAGE',
    ],
  },

  // Local Expo modules in ./modules are discovered by Expo autolinking during prebuild.
  plugins: [
    ...splashPlugins,
    'expo-router',
    'expo-web-browser',
    'expo-secure-store',
    ['expo-localization', { supportedLocales: ['en', 'bg', 'ru'] }],
    './plugins/with-dev-client-identity.cjs',
  ],

  experiments: {
    typedRoutes: true,
  },

  extra: {
    nativeRedirectUri,
    eas: localApk ? undefined : { projectId: 'PLACEHOLDER' },
  },
})
