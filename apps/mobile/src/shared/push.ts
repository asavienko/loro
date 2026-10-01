// Notifications on the web (plan 113): none. The toast says when a song is ready while the app is
// open, and nothing can reach a closed tab. metro.config.js swaps in src/platform/push.ts
// (expo-notifications) on iOS and Android, whose exports this mirrors.

/** What a notification about a song carries, so a tap can open its album. */
export interface SongTap {
  kind: 'song';
  songId: string;
  albumId: string;
  outcome: 'ready' | 'failed';
}

/** A device's Expo push token, for the server to send to. */
export interface DeviceToken {
  token: string;
  platform: 'ios' | 'android';
}

/**
 * Asks the system to show notifications, once the learner has asked for a song, and returns the
 * device's Expo push token for the server to keep; null when there is none to register (the web,
 * permission refused, or a build without an EAS project id).
 */
export async function enablePush(_channelName: string): Promise<DeviceToken | null> {
  return null;
}

/** Shows a notification on the device now (the app is in the background); false when it can't. */
export async function notifyLocally(_notice: { title: string; body: string; data: SongTap }): Promise<boolean> {
  return false;
}

/** Calls `handler` when the learner opens the app by tapping a song's notification, the one that launched it included. */
export function onNotificationTap(_handler: (tap: SongTap) => void): () => void {
  return () => {};
}
