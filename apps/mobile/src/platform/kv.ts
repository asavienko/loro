// The key-value store on iOS and Android: AsyncStorage (src/shared/api/kv.ts on the web;
// metro.config.js swaps this in).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export const PLATFORM: 'ios' | 'android' | 'web' = Platform.OS === 'ios' ? 'ios' : 'android';

export async function kvGet(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function kvSet(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    // Full or refused: the copy is only a convenience.
  }
}

export async function kvRemove(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // Nothing to do.
  }
}
