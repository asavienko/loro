// The dev server's phrase writer (server/suggest.ts), when it has one. Any failure reads as "not
// available": the caller falls back to the phrases on the device and says so. The app ships without
// zod, so the reply is checked by hand.
import type { LanguageCode } from '../content';
import { ICON_NAMES } from '../ui/icons';
import type { OwnNotes } from '../state/types';
import type { SuggestRequest } from './types';

export const STATUS_URL = '/api/phrases/status';
export const SUGGEST_URL = '/api/phrases/suggest';
export const NOTES_URL = '/api/phrases/notes';

const STATUS_TIMEOUT_MS = 3000;
/** Writing a dozen phrases takes a while; a writer that hangs longer than this has failed. */
const SUGGEST_TIMEOUT_MS = 45_000;
/** What the server accepts as phrases not to write again. */
const MAX_AVOID = 100;
const MAX_TEXT = 120;

export interface WrittenPhrase {
  target: string;
  native: string;
  image: string[];
  notes: OwnNotes;
}

export interface WrittenNotes {
  image: string[];
  notes: OwnNotes;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** JSON from the server, or a throw: a static host answers these routes with its page, not JSON. */
async function fetchJson(url: string, init: RequestInit, timeoutMs: number, signal?: AbortSignal): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) throw new Error(`status ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

let status: Promise<boolean> | null = null;

/** Whether this server writes suggestions; asked once per page. */
export function liveAvailable(): Promise<boolean> {
  status ??= fetchJson(STATUS_URL, { method: 'GET' }, STATUS_TIMEOUT_MS)
    .then((body) => isObject(body) && body.live === true)
    .catch(() => false);
  return status;
}

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const note = (v: unknown) => (isObject(v) && text(v.title) && text(v.text) ? { title: text(v.title)!, text: text(v.text)! } : null);

/** Whole notes (all three, the sounds with IPA and respelling), or null. */
export function readNotes(v: unknown): OwnNotes | null {
  if (!isObject(v)) return null;
  const mnemonic = note(v.mnemonic);
  const grammar = note(v.grammar);
  const sounds = note(v.pronunciation);
  const p = isObject(v.pronunciation) ? v.pronunciation : {};
  if (!mnemonic || !grammar || !sounds || !text(p.ipa) || !text(p.respelling)) return null;
  return { mnemonic, grammar, pronunciation: { ...sounds, ipa: text(p.ipa)!, respelling: text(p.respelling)! } };
}

/** A picture of icons the app can draw, or null. */
export function readImage(v: unknown): string[] | null {
  const icons: readonly string[] = ICON_NAMES;
  const image = Array.isArray(v) ? v.filter((n): n is string => typeof n === 'string' && icons.includes(n)).slice(0, 3) : [];
  return image.length > 0 ? image : null;
}

/** The reply's phrases, each with its picture and notes, or null if it isn't a list of them. */
export function readPhrases(body: unknown): WrittenPhrase[] | null {
  if (!isObject(body) || !Array.isArray(body.phrases)) return null;
  const out: WrittenPhrase[] = [];
  for (const item of body.phrases) {
    if (!isObject(item) || typeof item.target !== 'string' || typeof item.native !== 'string') return null;
    const target = item.target.trim();
    const native = item.native.trim();
    const notes = readNotes(item.notes);
    const image = readImage(item.image);
    // Every phrase has its notes and picture (plan 105): one that came without is left out.
    if (target && native && target.length <= MAX_TEXT && native.length <= MAX_TEXT && notes && image) out.push({ target, native, image, notes });
  }
  return out;
}

/** Notes and a picture for a phrase the learner wrote; throws when the writer fails or answers nonsense. */
export async function writeNotes(
  phrase: { target: string; native: string; targetLang: LanguageCode; nativeLang: LanguageCode },
  signal?: AbortSignal,
): Promise<WrittenNotes> {
  const body = await fetchJson(NOTES_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(phrase) }, SUGGEST_TIMEOUT_MS, signal);
  const notes = isObject(body) ? readNotes(body.notes) : null;
  const image = isObject(body) ? readImage(body.image) : null;
  if (!notes || !image) throw new Error('unreadable reply');
  return { notes, image };
}

/** Phrases written for the request, none of `avoid`; throws when the writer fails or answers nonsense. */
export async function writePhrases(request: SuggestRequest, avoid: string[], signal?: AbortSignal): Promise<WrittenPhrase[]> {
  const body = await fetchJson(
    SUGGEST_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...request, avoid: avoid.slice(-MAX_AVOID).map((a) => a.slice(0, MAX_TEXT)) }),
    },
    SUGGEST_TIMEOUT_MS,
    signal,
  );
  const phrases = readPhrases(body);
  if (!phrases) throw new Error('unreadable reply');
  return phrases;
}
