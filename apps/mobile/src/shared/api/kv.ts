// A small key-value store for what the app keeps beside progress: installed content packs, the
// account's public details, the installation's ids (plan 106). The browser's localStorage here;
// metro.config.js swaps in src/platform/kv.ts (AsyncStorage) on iOS and Android. A store that
// refuses a write (private mode, full) only costs the offline copy, never the session.

/** Which platform this build is, as the API's device registration names it. */
export const PLATFORM: 'ios' | 'android' | 'web' = 'web';

const storage = (): Storage | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};

export async function kvGet(key: string): Promise<string | null> {
  try {
    return storage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export async function kvSet(key: string, value: string): Promise<void> {
  try {
    storage()?.setItem(key, value);
  } catch {
    // Full or refused: the copy is only a convenience.
  }
}

export async function kvRemove(key: string): Promise<void> {
  try {
    storage()?.removeItem(key);
  } catch {
    // Nothing to do.
  }
}
