// Saved progress on iOS and Android: AsyncStorage in place of the web prototype's IndexedDB and
// localStorage (its src/state/storage.ts, whose exports this mirrors; metro.config.js swaps it in).
// One app, one copy: there are no other tabs to merge with. Reads the prototype makes synchronously
// (the device id) come from what openStorage loaded.
import AsyncStorage from '@react-native-async-storage/async-storage';

export const STORAGE_KEY = 'loro.prototype.state';
const PENDING_KEY = 'loro.prototype.pending';
const DEVICE_KEY = 'loro.prototype.device';

let deviceId: string | null = null;

export interface Stored {
  saved: string | null;
  pending: string | null;
  others?: string[];
  stray?: string | null;
}

/** What the app saved last, and what it wrote on its way to the background, if that write finished first. */
export async function openStorage(): Promise<Stored> {
  const values = new Map(await AsyncStorage.multiGet([STORAGE_KEY, PENDING_KEY, DEVICE_KEY]));
  deviceId = values.get(DEVICE_KEY) ?? null;
  return { saved: values.get(STORAGE_KEY) ?? null, pending: values.get(PENDING_KEY) ?? null };
}

export function readDeviceId(): string | null {
  return deviceId;
}

export function writeDeviceId(id: string): void {
  deviceId = id;
  void AsyncStorage.setItem(DEVICE_KEY, id).catch(() => {});
}

export async function readRaw(): Promise<string | null> {
  return AsyncStorage.getItem(STORAGE_KEY);
}

export async function writeRaw(json: string): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, json);
}

export async function clearRaw(): Promise<void> {
  await AsyncStorage.multiRemove([STORAGE_KEY, PENDING_KEY]);
}

/** The app is going to the background: a copy the next start merges in if the regular save didn't finish. */
export function writePending(json: string): void {
  void AsyncStorage.setItem(PENDING_KEY, json).catch(() => {});
}

export function clearPending(): void {
  void AsyncStorage.removeItem(PENDING_KEY).catch(() => {});
}

// Tabs are a web concern: nothing to clear, announce or listen for.
export function clearOtherPendings(): void {}
export function clearStray(): void {}
export function announceSave(): void {}
export function onOtherTabSave(_onSave: () => void): () => void {
  return () => {};
}
