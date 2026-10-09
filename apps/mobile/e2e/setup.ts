// The native libraries under the app's platform modules, faked for Node (e2e/jest.config.js): what
// they would do on a phone happens in memory, where a test can see and steer it (e2e/fakes).
import 'react-native-gesture-handler/jestSetup';
import { Alert, Linking, Share } from 'react-native';
import { audio } from './fakes/audio';
import { device } from './fakes/device';
import { world } from './world';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('react-native-keyboard-controller', () => require('react-native-keyboard-controller/jest'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
// Reanimated's own mock, with reduced motion on: every animation lands at once.
jest.mock('react-native-reanimated', () => ({ ...require('react-native-reanimated/mock'), useReducedMotion: () => true }));
jest.mock('expo-audio', () => require('./fakes/audio'));

jest.mock('expo-secure-store', () => {
  const { device: d } = require('./fakes/device');
  return {
    getItemAsync: async (key: string) => d.secure.get(key) ?? null,
    setItemAsync: async (key: string, value: string) => void d.secure.set(key, value),
    deleteItemAsync: async (key: string) => void d.secure.delete(key),
  };
});

jest.mock('expo-crypto', () => {
  const crypto = require('node:crypto');
  return {
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    getRandomBytes: (n: number) => new Uint8Array(crypto.randomBytes(n)),
    digest: async (_algorithm: string, data: Uint8Array) => {
      const hash = crypto.createHash('sha256').update(Buffer.from(data)).digest();
      return hash.buffer.slice(hash.byteOffset, hash.byteOffset + hash.byteLength);
    },
    randomUUID: () => crypto.randomUUID(),
  };
});

// The provider's sign-in page: it returns to the app signed in as `device.authSession.email`, or is closed.
jest.mock('expo-web-browser', () => {
  const { device: d } = require('./fakes/device');
  return {
    maybeCompleteAuthSession: () => ({ type: 'failed' }),
    openBrowserAsync: async (url: string) => {
      d.opened.push(url);
      return { type: 'opened' };
    },
    openAuthSessionAsync: async (url: string, returnTo: string) => {
      d.authPages.push(url);
      const email = d.authSession.email;
      if (!email) return { type: 'cancel' };
      const provider = /accounts\.(\w+)\.test/.exec(url)?.[1] ?? 'google';
      const state = /[?&]state=([^&]+)/.exec(url)?.[1] ?? '';
      return { type: 'success', url: `${returnTo}?state=${state}&ticket=${encodeURIComponent(`ticket:${provider}:${email}`)}` };
    },
  };
});

jest.mock('expo-notifications', () => {
  const { device: d } = require('./fakes/device');
  const granted = () => ({ status: d.notificationsAllowed ? 'granted' : 'denied', canAskAgain: true, granted: d.notificationsAllowed });
  return {
    PermissionStatus: { GRANTED: 'granted', DENIED: 'denied', UNDETERMINED: 'undetermined' },
    AndroidImportance: { DEFAULT: 3 },
    setNotificationHandler: () => {},
    setNotificationChannelAsync: async () => null,
    getPermissionsAsync: async () => granted(),
    requestPermissionsAsync: async () => granted(),
    getExpoPushTokenAsync: async () => ({ data: 'ExponentPushToken[e2e-device-0000000000]', type: 'expo' }),
    scheduleNotificationAsync: async ({ content }: { content: { title: string; body: string; data: Record<string, unknown> } }) => {
      d.notifications.push({ title: content.title, body: content.body, data: content.data });
      return `local-${d.notifications.length}`;
    },
    getLastNotificationResponseAsync: async () => null,
    addNotificationResponseReceivedListener: (listener: (response: unknown) => void) => {
      d.notificationListeners.add(listener);
      return { remove: () => d.notificationListeners.delete(listener) };
    },
  };
});

// The app's config as a store build has it: its scheme, and the EAS project when a test gives one.
jest.mock('expo-constants', () => {
  const actual = jest.requireActual('expo-constants');
  const { device: d } = require('./fakes/device');
  const config = () => actual.default.expoConfig ?? {};
  const constants = Object.create(actual.default, {
    expoConfig: { get: () => ({ ...config(), scheme: 'loro', extra: { ...config().extra, eas: d.pushProject ? { projectId: d.pushProject } : undefined } }) },
  });
  return { ...actual, __esModule: true, default: constants };
});

// Links into the app use its scheme, as a store build's do.
jest.mock('expo-linking', () => ({ ...jest.requireActual('expo-linking'), createURL: (path: string) => `loro:/${path.startsWith('/') ? path : `/${path}`}` }));

// Fonts are bundled assets on a phone: here they are "loaded" at once.
jest.mock('expo-font', () => ({
  ...jest.requireActual('expo-font'),
  useFonts: () => [true, null],
  loadAsync: async () => {},
  isLoaded: () => true,
}));

beforeAll(() => {
  jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => {
    device.dialogs.push({ title: title ?? '', message: message ?? '', buttons: (buttons ?? [{ text: 'OK' }]) as never });
  });
  jest.spyOn(Share, 'share').mockImplementation(async (content) => {
    device.shared.push(content as never);
    return { action: Share.sharedAction };
  });
  jest.spyOn(Linking, 'openURL').mockImplementation(async (url) => {
    device.opened.push(url);
    return true;
  });
});

// The lock-screen module (modules/loro-media), present when a file sets `device.lockScreen`.
const loroMedia = {
  show: (nowPlaying: never) => {
    device.nowPlaying = nowPlaying;
    device.lockScreenLog.push(nowPlaying);
  },
  hide: () => {
    device.nowPlaying = null;
    device.lockScreenLog.push('hidden');
  },
  wait: (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  addListener: (_event: string, listener: never) => {
    device.mediaListeners.add(listener);
    return { remove: () => device.mediaListeners.delete(listener) };
  },
};
const expoGlobal = globalThis as unknown as { expo: { modules?: Record<string, unknown> } };
expoGlobal.expo.modules ??= {};
Object.defineProperty(expoGlobal.expo.modules, 'LoroMedia', { configurable: true, get: () => (device.lockScreen ? loroMedia : undefined) });

// The fake API answers the app's requests (src/shared/api/client.ts and the native clip checks).
globalThis.fetch = ((input: string, init: never) => world.api.fetch(input, init)) as unknown as typeof fetch;
globalThis.XMLHttpRequest = require('./fakes/api').fakeXhr(() => world.api) as never;

beforeEach(() => {
  audio.reset();
  device.reset();
});

afterEach(() => {
  const unhandled = world.api.unhandled;
  if (unhandled.length > 0) {
    world.api.unhandled = [];
    throw new Error(`The app asked the fake API for routes it doesn't answer: ${[...new Set(unhandled)].join(', ')} (add them to e2e/fakes)`);
  }
});
