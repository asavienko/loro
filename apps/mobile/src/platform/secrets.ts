// The refresh token on iOS and Android: the Keychain and the Android Keystore through
// expo-secure-store (src/shared/api/secrets.ts on the web; metro.config.js swaps this in).
import * as SecureStore from 'expo-secure-store';

export async function secretGet(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function secretSet(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    // Refused: the learner signs in again next time.
  }
}

export async function secretRemove(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // Nothing to do.
  }
}
