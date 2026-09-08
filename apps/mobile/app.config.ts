import type { ExpoConfig } from 'expo/config'
import { withAndroidStyles } from 'expo/config-plugins'

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
const previewPlugins: NonNullable<ExpoConfig['plugins']> = localApk
  ? [
      [
        'expo-splash-screen',
        {
          android: {
            drawable: { icon: './assets/preview/splash.xml' },
            backgroundColor: '#f6f2ea',
          },
        },
      ],
    ]
  : []

export default (): ExpoConfig => ({
  name: localApk ? 'Loro Preview' : 'Loro',
  slug: 'loro',
  version: VERSION,
  orientation: 'default',
  scheme: 'loro',
  userInterfaceStyle: 'light', // dark theme is v1.1
  newArchEnabled: true,

  // Splash artwork is not supplied; keep Expo's native defaults.

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
    package: localApk ? 'app.loro.android.preview' : 'app.loro.android',
    versionCode: 1,
    // Use Expo's default icon until reviewed adaptive-icon artwork is supplied.
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

  // Only plugins for installed packages. The local loro-core module is autolinked;
  // audio, speech and notifications remain future work. See README.md.
  plugins: [
    ...previewPlugins,
    // Expo's template references a logo even when no splash image exists. Removing
    // that item lets Android use its default icon without inventing artwork.
    (config) =>
      withAndroidStyles(config, (mod) => {
        if (localApk) return mod
        for (const style of mod.modResults.resources.style ?? []) {
          if (style.$.name === 'Theme.App.SplashScreen') {
            style.item = style.item?.filter(
              (item) => item.$.name !== 'windowSplashScreenAnimatedIcon',
            )
          }
        }
        return mod
      }),
    'expo-router',
    'expo-web-browser',
    'expo-secure-store',
    ['expo-localization', { supportedLocales: ['en', 'bg', 'ru'] }],
  ],

  experiments: {
    typedRoutes: true,
  },

  extra: {
    eas: localApk ? undefined : { projectId: 'PLACEHOLDER' },
  },
})
