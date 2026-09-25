// AppState is plain JSON: these helpers read it back safely, keep it on the
// device and merge it with other copies.
//
// A saved state may be older than the code (version) and older than the
// content (a phrase renamed or removed), so parsing migrates it forward and
// drops anything the content no longer has.
import {
  CONTENT_VERSION,
  coursesFor,
  findContentPhrase,
  findSet,
  LANGUAGES,
  LanguageCode,
  NATIVE_LANGUAGES,
  RENAMED_PHRASE_IDS,
} from '../content';
import { OWN_PHRASE_PREFIX, OWN_SET_PREFIX } from './catalog';
import { clock } from './clock';
// The same limits the forms apply, for data that arrives by sync or migration.
import { clip, LIMITS } from './limits';
import { decodeLog, encodeLog } from './compactLog';
import { initialLearner, initialPlayer, initialPrefs, initialProfile } from './initial';
import { derive, memoryKey } from './memory';
import { committedIn, mergeLearner, mergePending, mergePrefs } from './merge';
import { announceSave, clearOtherPendings, clearPending, clearRaw, clearStray, readRaw, Stored, writePending, writeRaw } from './storage';
import {
  AppState,
  Device,
  Grade,
  LearnerState,
  Like,
  LogEntry,
  OwnPhrase,
  OwnSet,
  PendingRating,
  PlayerState,
  Prefs,
  Profile,
  STATE_VERSION,
} from './types';


type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);
const num = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const str = (value: unknown): value is string => typeof value === 'string';
const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter(str) : []);
const GRADES: readonly string[] = ['missed', 'hard', 'easy'];
const MAX_CARRYOVER = 1_000_000;
/** Epoch ms the core accepts: not negative, within JavaScript's safe range. */
const validTime = (value: unknown): value is number => num(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;

/** Content ids that were renamed are followed to their new name. */
function renamed(id: string): string {
  return RENAMED_PHRASE_IDS[id] ?? id;
}

function knownPhrase(id: string, own: Record<string, OwnPhrase>): boolean {
  return Boolean(findContentPhrase(id)) || Boolean(own[id]);
}

// ---------- v1/v2 → v3 ----------

/**
 * States v1 and v2 kept points, a custom memory model and a trimmed history.
 * The review log is rebuilt from that history (real ratings at their real
 * times, replayed through FSRS); points earned beyond what the trimmed history
 * explains are carried over as one entry, so the total never drops.
 */
function migrateLegacy(value: Json, device: Device): Json {
  const learner = isObject(value.learner) ? value.learner : {};
  const history = Array.isArray(learner.history) ? learner.history.filter(isObject) : [];
  const key = (phraseId: string) => memoryKey('en-GB', 'es-ES', phraseId);
  const log: LogEntry[] = [];
  history.forEach((h, i) => {
    const phraseId = str(h.phraseId) ? renamed(h.phraseId) : '';
    if (!num(h.at) || !findContentPhrase(phraseId)) return;
    const base = { id: `${device.id}.v2-${i.toString(36)}`, at: h.at, device: device.id, key: key(phraseId), phraseId };
    const setId = findContentPhrase(phraseId)?.setId ?? null;
    if (h.event === 'heard') log.push({ ...base, kind: 'heard', setId, targetMs: null, nativeMs: null });
    if (h.event === 'hard' || h.event === 'easy') log.push({ ...base, kind: 'rated', setId, grade: h.event });
  });
  log.sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
  const earned = num(learner.points) ? learner.points : 0;
  const explained = derive(log).points;
  if (earned > explained) {
    log.unshift({ id: `${device.id}.v2-carry`, at: 0, device: device.id, kind: 'carryover', points: earned - explained });
  }
  const likes: Record<string, Like> = {};
  for (const id of strings(learner.savedPhraseIds)) likes[`phrase:${renamed(id)}`] = { liked: true, at: 0 };
  for (const id of strings(learner.likedSetIds)) likes[`set:${id}`] = { liked: true, at: 0 };
  const oldPlayer = isObject(value.player) ? value.player : {};
  return {
    version: STATE_VERSION,
    learner: { ...initialLearner(), log, likes, profile: { ...initialProfile(), name: 'Clara', onboarded: true } },
    prefs: { speed: oldPlayer.speed },
    player: {
      order: strings(oldPlayer.order).map(renamed),
      baseOrder: strings(oldPlayer.baseOrder).map(renamed),
      index: oldPlayer.index,
      setId: oldPlayer.setId,
    },
  };
}

// ---------- v3 sanitising ----------

function sanitizeProfile(value: unknown): Profile {
  const fresh = initialProfile();
  if (!isObject(value)) return fresh;
  const native = NATIVE_LANGUAGES.find((l) => l === value.nativeLang) ?? fresh.nativeLang;
  const target = coursesFor(native).find((l) => l === value.targetLang) ?? coursesFor(native)[0];
  return {
    name: str(value.name) ? clip(value.name, LIMITS.name) : '',
    nativeLang: native,
    targetLang: target,
    onboarded: value.onboarded === true,
    updatedAt: num(value.updatedAt) ? value.updatedAt : 0,
  };
}

function sanitizeOwnPhrases(value: unknown): Record<string, OwnPhrase> {
  const out: Record<string, OwnPhrase> = {};
  if (!isObject(value)) return out;
  for (const [id, p] of Object.entries(value)) {
    if (!id.startsWith(OWN_PHRASE_PREFIX) || !isObject(p) || !str(p.target) || !str(p.native)) continue;
    if (!str(p.targetLang) || !str(p.nativeLang)) continue;
    out[id] = {
      id,
      target: clip(p.target, LIMITS.phrase),
      native: clip(p.native, LIMITS.phrase),
      targetLang: p.targetLang as LanguageCode,
      nativeLang: p.nativeLang as LanguageCode,
      createdAt: num(p.createdAt) ? p.createdAt : 0,
      updatedAt: num(p.updatedAt) ? p.updatedAt : 0,
      deleted: p.deleted === true,
    };
  }
  return out;
}

function sanitizeOwnSets(value: unknown, own: Record<string, OwnPhrase>): Record<string, OwnSet> {
  const out: Record<string, OwnSet> = {};
  if (!isObject(value)) return out;
  for (const [id, s] of Object.entries(value)) {
    if (!id.startsWith(OWN_SET_PREFIX) || !isObject(s) || !str(s.title) || !str(s.targetLang)) continue;
    out[id] = {
      id,
      title: clip(s.title, LIMITS.title),
      targetLang: s.targetLang as LanguageCode,
      phraseIds: strings(s.phraseIds).map(renamed).filter((pid) => knownPhrase(pid, own)),
      createdAt: num(s.createdAt) ? s.createdAt : 0,
      updatedAt: num(s.updatedAt) ? s.updatedAt : 0,
      deleted: s.deleted === true,
    };
  }
  return out;
}

function sanitizeLog(value: unknown, own: Record<string, OwnPhrase>): LogEntry[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: LogEntry[] = [];
  for (const e of value) {
    if (!isObject(e) || !str(e.id) || !validTime(e.at) || !str(e.device) || seen.has(e.id)) continue;
    seen.add(e.id);
    if (e.kind === 'carryover') {
      // Carried-over points are a real past total: a whole, non-negative number.
      if (num(e.points) && e.points >= 0) out.push({ id: e.id, at: e.at, device: e.device, kind: 'carryover', points: Math.min(Math.round(e.points), MAX_CARRYOVER) });
      continue;
    }
    if (!str(e.phraseId) || !str(e.key)) continue;
    const phraseId = renamed(e.phraseId);
    if (!knownPhrase(phraseId, own)) continue;
    const key = e.phraseId === phraseId ? e.key : e.key.replace(/:[^:]*$/, `:${phraseId}`);
    const setId = str(e.setId) ? e.setId : null;
    const base = { id: e.id, at: e.at, device: e.device, key, phraseId, setId };
    if (e.kind === 'heard') {
      out.push({ ...base, kind: 'heard', targetMs: num(e.targetMs) ? e.targetMs : null, nativeMs: num(e.nativeMs) ? e.nativeMs : null });
    } else if (e.kind === 'rated' && GRADES.includes(e.grade as string)) {
      out.push({ ...base, kind: 'rated', grade: e.grade as Grade });
    }
  }
  return out.sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function sanitizeLikes(value: unknown, own: Record<string, OwnPhrase>, sets: Record<string, OwnSet>): Record<string, Like> {
  const out: Record<string, Like> = {};
  if (!isObject(value)) return out;
  for (const [k, like] of Object.entries(value)) {
    if (!isObject(like) || typeof like.liked !== 'boolean' || !num(like.at)) continue;
    const [kind, rawId] = [k.slice(0, k.indexOf(':')), k.slice(k.indexOf(':') + 1)];
    if (kind === 'phrase') {
      const id = renamed(rawId);
      if (knownPhrase(id, own)) out[`phrase:${id}`] = { liked: like.liked, at: like.at };
    } else if (kind === 'set' && (findSet(rawId) || sets[rawId])) {
      out[k] = { liked: like.liked, at: like.at };
    }
  }
  return out;
}

export function sanitizeLearner(value: unknown): LearnerState {
  if (!isObject(value)) return initialLearner();
  const ownPhrases = sanitizeOwnPhrases(value.ownPhrases);
  const ownSets = sanitizeOwnSets(value.ownSets, ownPhrases);
  return {
    profile: sanitizeProfile(value.profile),
    log: sanitizeLog(decodeLog(value.log), ownPhrases),
    likes: sanitizeLikes(value.likes, ownPhrases, ownSets),
    ownPhrases,
    ownSets,
  };
}

function sanitizePending(value: unknown, learner: LearnerState): PendingRating[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isObject).flatMap((p) => {
    if (!str(p.key) || !str(p.phraseId) || !num(p.at) || !GRADES.includes(p.grade as string)) return [];
    const phraseId = renamed(p.phraseId);
    if (!knownPhrase(phraseId, learner.ownPhrases)) return [];
    const key = p.phraseId === phraseId ? p.key : p.key.replace(/:[^:]*$/, `:${phraseId}`);
    // Saved before ratings synced between tabs: its last change is its own time.
    const changedAt = num(p.changedAt) ? p.changedAt : p.at;
    return [{ key, phraseId, setId: str(p.setId) ? p.setId : null, grade: p.grade as Grade, at: p.at, changedAt, ...(p.undone === true ? { undone: true } : {}) }];
  });
}

function sanitizePrefs(value: unknown): Prefs {
  const fresh = initialPrefs();
  if (!isObject(value)) return fresh;
  const sortBySet: Prefs['sortBySet'] = {};
  if (isObject(value.sortBySet)) {
    for (const [id, sort] of Object.entries(value.sortBySet)) {
      if (sort === 'set' || sort === 'az' || sort === 'due' || sort === 'weakest') sortBySet[id] = sort;
    }
  }
  return {
    playMode: value.playMode === 'continue' ? 'continue' : 'repeat',
    repeats: value.repeats === 1 || value.repeats === 3 ? value.repeats : 'auto',
    speed: value.speed === 0.8 || value.speed === 1.25 ? value.speed : 1,
    announceEveryStep: value.announceEveryStep === true,
    sortBySet,
    skippedDemo: value.skippedDemo === true,
    voiceByLang: Object.fromEntries(
      Object.entries(isObject(value.voiceByLang) ? value.voiceByLang : {}).filter(
        ([lang, name]) => LANGUAGES.some((l) => l.code === lang) && typeof name === 'string' && name.length > 0 && name.length <= 200,
      ),
    ) as Prefs['voiceByLang'],
    updatedAt: num(value.updatedAt) ? value.updatedAt : 0,
  };
}

function sanitizePlayer(value: unknown, learner: LearnerState): PlayerState {
  const fresh = initialPlayer();
  if (!isObject(value)) return fresh;
  const known = (id: string) => knownPhrase(id, learner.ownPhrases) && !learner.ownPhrases[id]?.deleted;
  const rawOrder = strings(value.order).map(renamed);
  const rawIndex = num(value.index) ? Math.max(0, Math.trunc(value.index)) : 0;
  const order = rawOrder.filter(known);
  // The same occurrence after filtering: a phrase can be queued twice (a missed one
  // comes back), so searching for its id would jump to the first copy. If the current
  // phrase itself was dropped, the next one takes its place.
  const keptBefore = rawOrder.slice(0, rawIndex).filter(known).length;
  const index = Math.min(keptBefore, Math.max(0, order.length - 1));
  const setId = str(value.setId) && (findSet(value.setId) || learner.ownSets[value.setId]) ? value.setId : null;
  const session = isObject(value.session) && str(value.session.id) && num(value.session.startedAt)
    ? { id: value.session.id, startedAt: value.session.startedAt, passes: num(value.session.passes) ? value.session.passes : 0 }
    : null;
  // A saved state never resumes mid-playback: audio needs a fresh user gesture.
  return {
    ...fresh,
    status: order.length > 0 ? 'paused' : 'idle',
    repeats: value.repeats === 1 ? 1 : 3,
    shuffle: value.shuffle === true,
    setId,
    order,
    baseOrder: strings(value.baseOrder).map(renamed).filter(known),
    index,
    ended: value.ended === true,
    session,
  };
}

/**
 * Anything → a valid AppState for this device, or null if it isn't a (migratable)
 * Loro state. The device keeps its own identity; the saved one is ignored.
 */
export function sanitizeState(raw: unknown, device: Device): AppState | null {
  if (!isObject(raw)) return null;
  let value = raw;
  if (value.version === 1 || value.version === 2) value = migrateLegacy(value, device);
  if (value.version !== STATE_VERSION) return null;
  const learner = sanitizeLearner(value.learner);
  return {
    version: STATE_VERSION,
    contentVersion: CONTENT_VERSION,
    device,
    learner,
    pending: sanitizePending(value.pending, learner),
    prefs: sanitizePrefs(value.prefs),
    player: sanitizePlayer(value.player, learner),
  };
}

export function parseState(json: string, device: Device): AppState | null {
  try {
    return sanitizeState(JSON.parse(json), device);
  } catch {
    return null;
  }
}

/** State as stored: the log in its compact form (compactLog.ts). */
export function serializeState(state: AppState): string {
  return JSON.stringify({ ...state, learner: { ...state.learner, log: encodeLog(state.learner.log) } });
}

// ---------- device storage ----------

const DEVICE_KEY = 'loro.prototype.device';

function randomId(): string {
  return Math.random().toString(36).slice(2, 8);
}

/** This installation's id, kept apart from progress so Reset keeps it. */
function deviceId(): string {
  try {
    const saved = localStorage.getItem(DEVICE_KEY);
    if (saved) return saved;
    const id = randomId();
    localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    return randomId();
  }
}

/**
 * What this tab last wrote (or loaded); if storage still holds it, no other
 * tab has saved since and the next save needs no merge.
 */
let lastWritten: string | null = null;

/**
 * A closing page's copy that still has to reach storage (see storage.ts): the state
 * it holds, or 'loaded' for one found at start-up (merged into the loaded state).
 * Only the save of that state clears it: an older save finishing later must not
 * remove the newer copy before its own write lands.
 */
let pendingFor: AppState | 'loaded' | null = null;

/**
 * State from what storage holds, or a fresh one. A copy left by a page that
 * closed is newer than the saved one for this device's own fields; learner data
 * from both is merged, so another tab's later progress is kept too.
 */
/** A localStorage copy merged at load (see Stored.stray) that a successful save may now remove. */
let strayOutstanding = false;

export function loadState({ saved, pending, others = [], stray = null }: Stored, initial: (device: Device) => AppState): AppState {
  const state = loadWithoutStray({ saved, pending }, initial);
  // Learning progress comes from these, and so do another tab's pending ratings (that
  // tab may have closed inside the window; a rating commits once whichever tab does
  // it). Its queue and prefs stay with it.
  const extra = [...(stray && stray !== saved ? [stray] : []), ...others].flatMap((json) => {
    const parsed = parseState(json, state.device);
    return parsed ? [parsed] : [];
  });
  strayOutstanding = stray !== null || others.length > 0;
  const learner = extra.reduce((merged, more) => mergeLearner(merged, more.learner), state.learner);
  const committed = committedIn(learner.log, state.device.id);
  const pendingRatings = extra.reduce((merged, more) => mergePending(merged, more.pending, committed, clock.now()), state.pending);
  return { ...state, pending: pendingRatings, learner };
}

function loadWithoutStray({ saved, pending }: Stored, initial: (device: Device) => AppState): AppState {
  const device: Device = { id: deviceId(), instance: randomId(), seq: 0 };
  lastWritten = saved;
  const fromSaved = saved ? parseState(saved, device) : null;
  const fromPending = pending ? parseState(pending, device) : null;
  pendingFor = pending !== null ? 'loaded' : null;
  if (!fromPending) return fromSaved ?? initial(device);
  return fromSaved ? { ...fromPending, learner: mergeLearner(fromPending.learner, fromSaved.learner) } : fromPending;
}

/** `outdated`: a newer version of the app saved last; this (older) tab mustn't write over it. */
export type SaveResult = 'saved' | 'full' | 'unavailable' | 'outdated';

/** Content versions look like "2026-09-24.4": the date, then the day's edition as a number. */
export function contentIsNewer(theirs: string, ours: string): boolean {
  const split = (v: string) => {
    const [date, edition] = v.split('.');
    return [date ?? '', Number(edition ?? 0) || 0] as const;
  };
  const [[td, te], [od, oe]] = [split(theirs), split(ours)];
  return td > od || (td === od && te > oe);
}

/** Whether stored JSON was written by a newer app than this one (after an update, in another tab). */
function writtenByNewer(json: string): boolean {
  try {
    const value: unknown = JSON.parse(json);
    if (!isObject(value)) return false;
    return (num(value.version) && value.version > STATE_VERSION) || (str(value.contentVersion) && contentIsNewer(value.contentVersion, CONTENT_VERSION));
  } catch {
    return false;
  }
}

/** Event the shell listens for, so a failed save is never silent. */
export const SAVE_FAILED_EVENT = 'loro:save-failed';

let queue: Promise<unknown> = Promise.resolve();

/**
 * Saves the state, first merging in whatever another tab saved since, so two
 * open tabs never overwrite each other's progress. Saves run one at a time.
 */
export function saveState(state: AppState): Promise<SaveResult> {
  const result = queue.then(() => writeState(state));
  queue = result;
  void result.then((r) => {
    if (r !== 'saved' && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent<SaveResult>(SAVE_FAILED_EVENT, { detail: r }));
    }
  });
  return result;
}

async function writeState(state: AppState): Promise<SaveResult> {
  try {
    const current = await readRaw();
    // A tab still running the old app after an update would drop what it can't read (new
    // fields, new phrase ids) and write over the newer save. It stops saving instead; its own
    // close copy still reaches the next launch, which runs the new app and merges it.
    if (current !== null && current !== lastWritten && writtenByNewer(current)) return 'outdated';
    // Parsing and merging the stored copy is only needed when another tab changed it. Its
    // pending ratings merge too: a rating given in another tab mustn't be written over.
    const stored = current !== null && current !== lastWritten ? parseState(current, state.device) : null;
    const learner = stored ? mergeLearner(state.learner, stored.learner) : state.learner;
    const committed = committedIn(learner.log, state.device.id);
    const pending = stored ? mergePending(state.pending, stored.pending, committed, clock.now()) : state.pending;
    // Settings changed in another tab since this one's last change are kept, not reverted.
    const prefs = stored ? mergePrefs(state.prefs, stored.prefs) : state.prefs;
    const unchanged = learner === state.learner && pending === state.pending && prefs === state.prefs;
    const json = serializeState(unchanged ? state : { ...state, learner, pending, prefs });
    await writeRaw(json);
    lastWritten = json;
    if (pendingFor === 'loaded' || pendingFor === state) {
      clearPending();
      pendingFor = null;
    }
    if (strayOutstanding) {
      clearStray();
      clearOtherPendings();
      strayOutstanding = false;
    }
    announceSave();
    return 'saved';
  } catch (error) {
    // The session still works; the shell tells the learner that progress isn't being kept.
    const full = error instanceof DOMException && (error.name === 'QuotaExceededError' || error.code === 22);
    return full ? 'full' : 'unavailable';
  }
}

/**
 * The page is being hidden or closed: keep a synchronous copy, then try the
 * regular write, which may not finish before the page is gone.
 */
export function flushState(state: AppState): void {
  const json = serializeState(state);
  if (json === lastWritten) return;
  writePending(json);
  pendingFor = state;
  void saveState(state);
}

export async function clearSavedState(): Promise<void> {
  try {
    await clearRaw();
  } catch {
    // Nothing saved to clear.
  }
}

/** The last saved progress, for the error screen's "copy" before a reset. */
export function rawSavedState(): string | null {
  return lastWritten;
}

/**
 * The sync seam: fetch the server's copy, merge, send the merge back. The
 * endpoint is not part of the prototype; the merge rules are (merge.ts).
 * Returns the merged learner for a MERGE_REMOTE event.
 */
export async function syncWithServer(learner: LearnerState, endpoint: string): Promise<LearnerState> {
  const response = await fetch(endpoint, { headers: { Accept: 'application/json' } });
  if (!response.ok && response.status !== 404) throw new Error(`Sync failed: ${response.status}`);
  const remote = response.status === 404 ? null : sanitizeLearner(await response.json());
  const merged = remote ? mergeLearner(learner, remote) : learner;
  const put = await fetch(endpoint, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(merged),
  });
  if (!put.ok) throw new Error(`Sync failed: ${put.status}`);
  return merged;
}
