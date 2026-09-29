// Where the refresh token is kept (plan 106). On the web, the browser's localStorage: the only
// place a static web app has, readable by script on this origin; the token is revoked on sign-out
// and rotates on every refresh. metro.config.js swaps in src/platform/secrets.ts (the Keychain and
// Android Keystore through expo-secure-store) on iOS and Android.

export async function secretGet(key: string): Promise<string | null> {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function secretSet(key: string, value: string): Promise<void> {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Refused: the learner signs in again next time.
  }
}

export async function secretRemove(key: string): Promise<void> {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing to do.
  }
}
