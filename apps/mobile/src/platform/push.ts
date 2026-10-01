// Notifications on iOS and Android (plan 113): expo-notifications, in place of the web's nothing
// (src/shared/push.ts, whose exports this mirrors; metro.config.js swaps it in). The phone is told
// when a song is ready: by the server through Expo's push service when the app registered its
// token, or by the app itself when it saw the song finish while in the background. A tap opens the
// album. In the foreground the app's own toast says it, so no banner is shown then.
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';
import type { DeviceToken, SongTap } from '@shared/push';

/** The Android channel a song's notifications post to. */
const CHANNEL = 'songs';

let handlerSet = false;
function ensureHandler(): void {
  if (handlerSet) return;
  handlerSet = true;
  Notifications.setNotificationHandler({
    handleNotification: () => {
      const inBackground = AppState.currentState !== 'active';
      return Promise.resolve({ shouldShowBanner: inBackground, shouldShowList: true, shouldPlaySound: inBackground, shouldSetBadge: false });
    },
  });
}

async function allowed(ask: boolean): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.status === Notifications.PermissionStatus.GRANTED) return true;
  if (!ask || !current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).status === Notifications.PermissionStatus.GRANTED;
}

export async function enablePush(channelName: string): Promise<DeviceToken | null> {
  try {
    ensureHandler();
    if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync(CHANNEL, { name: channelName, importance: Notifications.AndroidImportance.DEFAULT });
    if (!(await allowed(true))) return null;
    // A push token needs the EAS project; a build without one (a local APK) keeps to local notifications.
    const extra = Constants.expoConfig?.extra as { eas?: { projectId?: unknown } } | undefined;
    const projectId = extra?.eas?.projectId;
    if (typeof projectId !== 'string' || !projectId) return null;
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return { token: data, platform: Platform.OS === 'ios' ? 'ios' : 'android' };
  } catch {
    return null;
  }
}

export async function notifyLocally(notice: { title: string; body: string; data: SongTap }): Promise<boolean> {
  try {
    ensureHandler();
    if (!(await allowed(false))) return false;
    await Notifications.scheduleNotificationAsync({
      content: { title: notice.title, body: notice.body, data: { ...notice.data }, sound: 'default' },
      trigger: Platform.OS === 'android' ? { channelId: CHANNEL } : null,
    });
    return true;
  } catch {
    return false;
  }
}

function tapOf(response: Notifications.NotificationResponse | null): SongTap | null {
  const data = response?.notification.request.content.data as Partial<SongTap> | undefined;
  if (!data || data.kind !== 'song' || typeof data.songId !== 'string' || typeof data.albumId !== 'string') return null;
  return { kind: 'song', songId: data.songId, albumId: data.albumId, outcome: data.outcome === 'failed' ? 'failed' : 'ready' };
}

export function onNotificationTap(handler: (tap: SongTap) => void): () => void {
  ensureHandler();
  // The response that launched the app may also reach the listener: each is handled once.
  const handled = new Set<string>();
  const read = (response: Notifications.NotificationResponse | null) => {
    const tap = tapOf(response);
    const id = response?.notification.request.identifier;
    if (!tap || !id || handled.has(id)) return;
    handled.add(id);
    handler(tap);
  };
  void Notifications.getLastNotificationResponseAsync()
    .then(read)
    .catch(() => {});
  const subscription = Notifications.addNotificationResponseReceivedListener(read);
  return () => subscription.remove();
}
