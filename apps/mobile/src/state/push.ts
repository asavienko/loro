// The device's push registration (plan 113): once the learner has asked for a song, the phone asks
// to show notifications and, with an EAS project, gives the server its Expo push token with the UI
// language, so a song's "ready" comes even with the app closed. The token is kept here so signing
// out can take it back. Without a registration the app notifies locally when it sees a song finish.
import type { Copy } from '@shared/copy';
import { forgetPushToken, registerPushToken } from '@shared/api/library';
import { kvGet, kvRemove, kvSet } from '@shared/api/kv';
import { enablePush } from '@shared/push';

const TOKEN_KEY = 'loro.push.token';
const LANGS = ['en', 'bg', 'ru', 'pl', 'cs'] as const;
let registered: boolean | null = null;

/** The UI language a message to this device is written in: the copy's locale, as the server names it. */
function langOf(c: Copy): (typeof LANGS)[number] {
  const prefix = c.locale.slice(0, 2);
  return LANGS.find((lang) => lang === prefix) ?? 'en';
}

/** Whether the server has this device's token: then it sends the word, and the app's own is not needed. */
export function pushRegistered(): boolean {
  return registered === true;
}

/** Registers this device for a word when a song is ready; quiet when it can't (the web, refused, no project). */
export async function registerForPush(c: Copy): Promise<void> {
  const device = await enablePush(c.music.notificationChannel);
  if (!device) {
    registered = false;
    return;
  }
  try {
    await registerPushToken({ token: device.token, lang: langOf(c), platform: device.platform });
    await kvSet(TOKEN_KEY, device.token);
    registered = true;
  } catch {
    registered = false;
  }
}

/** Before signing out: the server forgets this device, so the next account's songs don't reach it. */
export async function forgetPush(): Promise<void> {
  const token = await kvGet(TOKEN_KEY);
  registered = null;
  if (!token) return;
  await kvRemove(TOKEN_KEY);
  await forgetPushToken(token).catch(() => {});
}
