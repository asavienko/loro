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

export default (): ExpoConfig => ({
  name: 'Loro',
  slug: 'loro',
  version: VERSION,
  orientation: 'default',
  scheme: 'loro',
  userInterfaceStyle: 'light', // dark theme is v1.1
  newArchEnabled: true,

  splash: {
    backgroundColor: '#f6f2ea', // surface.app
    resizeMode: 'contain',
    image: './assets/images/splash.png',
  },

  updates: {
    // OTA is for FIXES, not features. Staged 5% → 25% → 100%.
    // See docs/process/ci-cd.md#ota-updates
    url: 'https://u.expo.dev/PLACEHOLDER',
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
        'Loro listens while you practise speaking. Your recordings are scored on this device and never uploaded.',
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
    package: 'app.loro.android',
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#f6f2ea',
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

  // Only plugins for INSTALLED packages. The native modules (loro-audio,
  // loro-speech, loro-core) and notifications / secure-store / localization arrive
  // with their packages — see README.md.
  plugins: ['expo-router'],

  experiments: {
    typedRoutes: true,
  },

  extra: {
    eas: { projectId: 'PLACEHOLDER' },
  },
})
