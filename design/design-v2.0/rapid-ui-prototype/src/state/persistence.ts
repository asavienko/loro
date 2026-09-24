// AppState is plain JSON: these helpers copy it, keep it on the device and
// hand it to a server. The server endpoint is not part of the prototype.
//
// A saved state may be older than the code (version) and older than the
// content (a phrase or set was removed), so parsing migrates it forward and
// drops anything the content no longer has.
import { findPhrase, findSet } from '../content';
import { AppState, HistoryEntry, initialState, LearnerState, PlayerState, restored, STATE_VERSION } from './machine';
import { newMemory, PhraseMemory } from './memory';

const STORAGE_KEY = 'loro.prototype.state';

export function serializeState(state: AppState): string {
  return JSON.stringify(state);
}

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const stringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];

/**
 * Brings an older saved state to the current version, one step at a time.
 * v1 → v2: downloads were removed and the player gained `ended`/`audioError`.
 */
function migrate(value: Json): Json | null {
  let version = value.version;
  let out = value;
  if (version === 1) {
    const learner = isObject(out.learner) ? { ...out.learner } : {};
    delete learner.downloadedSetIds;
    out = { ...out, version: 2, learner };
    version = 2;
  }
  return version === STATE_VERSION ? out : null;
}

function sanitizeMemory(value: unknown): PhraseMemory | null {
  if (!isObject(value) || typeof value.firstHeardAt !== 'number') return null;
  return { ...newMemory(value.firstHeardAt), ...value } as PhraseMemory;
}

function sanitizeLearner(value: unknown): LearnerState {
  const fresh = initialState().learner;
  if (!isObject(value)) return fresh;
  const phrases: Record<string, PhraseMemory> = {};
  if (isObject(value.phrases)) {
    for (const [id, memory] of Object.entries(value.phrases)) {
      const clean = findPhrase(id) && sanitizeMemory(memory);
      if (clean) phrases[id] = clean;
    }
  }
  const history = (Array.isArray(value.history) ? value.history : []).filter(
    (entry): entry is HistoryEntry => isObject(entry) && typeof entry.at === 'number' && Boolean(findPhrase(entry.phraseId as string)),
  );
  return {
    // Points are earned history; they stay even if some content was removed.
    points: typeof value.points === 'number' ? value.points : fresh.points,
    phrases,
    savedPhraseIds: stringArray(value.savedPhraseIds).filter((id) => findPhrase(id)),
    likedSetIds: stringArray(value.likedSetIds).filter((id) => findSet(id)),
    history,
  };
}

function sanitizePlayer(value: unknown): PlayerState {
  const fresh = initialState().player;
  if (!isObject(value)) return fresh;
  const player = { ...fresh, ...value } as PlayerState;
  const current = player.order?.[player.index];
  const order = stringArray(player.order).filter((id) => findPhrase(id));
  const baseOrder = stringArray(player.baseOrder).filter((id) => findPhrase(id));
  const found = current ? order.indexOf(current) : -1;
  const index = found >= 0 ? found : Math.min(Math.max(0, Number(player.index) || 0), Math.max(0, order.length - 1));
  return {
    ...player,
    order,
    baseOrder,
    index,
    setId: findSet(player.setId) ? player.setId : null,
  };
}

/** Parses a serialized state; returns null for anything that is not a (migratable) AppState. */
export function parseState(json: string): AppState | null {
  try {
    const raw: unknown = JSON.parse(json);
    if (!isObject(raw)) return null;
    const value = migrate(raw);
    if (!value || !isObject(value.learner) || !isObject(value.player)) return null;
    return restored({
      version: STATE_VERSION,
      learner: sanitizeLearner(value.learner),
      player: sanitizePlayer(value.player),
    });
  } catch {
    return null;
  }
}

export function loadState(): AppState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return (saved && parseState(saved)) || initialState();
  } catch {
    return initialState();
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, serializeState(state));
  } catch {
    // Storage can be unavailable (private mode); the session still works.
  }
}

export function clearSavedState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing saved to clear.
  }
}

/** Uploads the snapshot as JSON. Wire `endpoint` to the sync API when it exists. */
export async function saveToServer(state: AppState, endpoint: string): Promise<void> {
  const response = await fetch(endpoint, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: serializeState(state),
  });
  if (!response.ok) throw new Error(`Sync failed: ${response.status}`);
}
