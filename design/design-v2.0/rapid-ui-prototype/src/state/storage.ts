// Where saved progress lives. IndexedDB holds it (its quota is far larger
// than localStorage's ~5 MB); localStorage is the fallback where IndexedDB is
// missing or refuses to open. Progress saved by an older version in
// localStorage moves to IndexedDB on first load. Tabs tell each other about
// saves over a BroadcastChannel.
export const STORAGE_KEY = 'loro.prototype.state';
/**
 * A page that is going away can't wait for IndexedDB, so its last state goes
 * to localStorage synchronously; the next start merges it in and clears it
 * after the next successful save.
 */
const PENDING_KEY = 'loro.prototype.pending';
const DB_NAME = 'loro-prototype';
const STORE = 'kv';
const RECORD = 'state';
const OPEN_TIMEOUT_MS = 2000;

let db: IDBDatabase | null = null;

function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('no IndexedDB'));
    const timer = setTimeout(() => reject(new Error('IndexedDB open timed out')), OPEN_TIMEOUT_MS);
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onsuccess = () => {
      clearTimeout(timer);
      resolve(open.result);
    };
    open.onerror = () => {
      clearTimeout(timer);
      reject(open.error);
    };
  });
}

function localGet(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export interface Stored {
  /** The saved progress (JSON). */
  saved: string | null;
  /** What a page that closed wrote on its way out, if any. */
  pending: string | null;
}

function pendingGet(): string | null {
  try {
    return localStorage.getItem(PENDING_KEY);
  } catch {
    return null;
  }
}

/** Opens storage and returns what it holds, moving an older localStorage save into IndexedDB. */
export async function openStorage(): Promise<Stored> {
  const pending = pendingGet();
  try {
    db = await openDb();
  } catch {
    db = null;
    return { saved: localGet(), pending };
  }
  const saved = await readRaw();
  if (saved !== null) return { saved, pending };
  const legacy = localGet();
  if (legacy !== null) {
    await writeRaw(legacy);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Keeping the old copy does no harm.
    }
  }
  return { saved: legacy, pending };
}

/** Synchronous last-chance copy for a page that is being hidden or closed. */
export function writePending(json: string): void {
  try {
    localStorage.setItem(PENDING_KEY, json);
  } catch {
    // Storage full or blocked: the regular save is the only copy.
  }
}

export function clearPending(): void {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    // Nothing there.
  }
}

export async function readRaw(): Promise<string | null> {
  if (!db) return localGet();
  const value = await request(db.transaction(STORE, 'readonly').objectStore(STORE).get(RECORD));
  return typeof value === 'string' ? value : null;
}

/** Writes the progress; throws (e.g. QuotaExceededError) if it can't. */
export async function writeRaw(json: string): Promise<void> {
  if (!db) {
    localStorage.setItem(STORAGE_KEY, json);
    return;
  }
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).put(json, RECORD);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new DOMException('aborted', 'AbortError'));
  });
}

export async function clearRaw(): Promise<void> {
  clearPending();
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing there.
  }
  if (db) await request(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(RECORD));
}

// ---------- tabs ----------

let channel: BroadcastChannel | null | undefined;

/** Created on first use, and only in a browser (an open channel would keep Node running). */
function tabs(): BroadcastChannel | null {
  if (channel === undefined) {
    channel = typeof window === 'undefined' || typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('loro-state');
  }
  return channel;
}

/** Tells other tabs that progress was saved. */
export function announceSave(): void {
  tabs()?.postMessage('saved');
}

/** Calls `onSave` when another tab saves; returns the unsubscribe. */
export function onOtherTabSave(onSave: () => void): () => void {
  const ch = tabs();
  if (!ch) return () => {};
  const listener = () => onSave();
  ch.addEventListener('message', listener);
  return () => ch.removeEventListener('message', listener);
}
