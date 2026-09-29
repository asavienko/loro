// The API's phrase writer (plan 106: POST /library/generate/phrases and /notes), for a signed-in
// learner on a server whose writer is Claude. Any failure reads as "not available": the caller falls
// back to the phrases on the device and says so. The app ships without zod, so the reply is checked
// by hand.
import { api, apiUrl } from '../api/client';
import { fetchUsage } from '../api/library';
import { sessionState } from '../api/session';
import type { LanguageCode } from '../content';
import { clock } from '../state/clock';
import { ICON_NAMES } from '../ui/icons';
import type { OwnNotes } from '../state/types';
import type { SuggestRequest } from './types';

export const SUGGEST_URL = apiUrl('/library/generate/phrases');
export const NOTES_URL = apiUrl('/library/generate/notes');

/** Writing a dozen phrases takes a while; a writer that hangs longer than this has failed. */
const SUGGEST_TIMEOUT_MS = 90_000;
/** What the server accepts as phrases not to write again. */
const MAX_AVOID = 100;
const MAX_TEXT = 120;
/** How long the answer to "is Claude writing here?" is trusted. */
const STATUS_TTL_MS = 5 * 60_000;

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

let status: { user: string; at: number; live: Promise<boolean> } | null = null;

/**
 * Whether the AI writer answers this learner: signed in, and the server's writer is Claude. Without
 * it the phrase bank on the device answers, the same as the server would, at no cost to the allowance.
 */
export function liveAvailable(): Promise<boolean> {
  const session = sessionState();
  if (session.status !== 'signedIn' || !session.account) return Promise.resolve(false);
  const user = session.account.userId;
  if (!status || status.user !== user || clock.now() - status.at > STATUS_TTL_MS) {
    status = {
      user,
      at: clock.now(),
      live: fetchUsage()
        .then((usage) => usage.writers.phrases === 'claude' && usage.daily.phrases.used < usage.daily.phrases.limit)
        .catch(() => false),
    };
  }
  return status.live;
}

/** After writing: the allowance may be spent now, so ask again next time. */
function forgetStatus(): void {
  status = null;
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
  const body = await api<unknown>('/library/generate/notes', { method: 'POST', body: phrase, timeoutMs: SUGGEST_TIMEOUT_MS, signal });
  forgetStatus();
  const notes = isObject(body) ? readNotes(body.notes) : null;
  const image = isObject(body) ? readImage(body.image) : null;
  if (!notes || !image) throw new Error('unreadable reply');
  return { notes, image };
}

/**
 * Phrases written for the request, none of `avoid`; throws when the writer fails, answers nonsense,
 * or the server answered from its phrase bank instead (the device has the same bank).
 */
export async function writePhrases(request: SuggestRequest, avoid: string[], signal?: AbortSignal): Promise<WrittenPhrase[]> {
  const body = await api<unknown>('/library/generate/phrases', {
    method: 'POST',
    body: { ...request, avoid: avoid.slice(-MAX_AVOID).map((a) => a.slice(0, MAX_TEXT)) },
    timeoutMs: SUGGEST_TIMEOUT_MS,
    signal,
  });
  forgetStatus();
  if (isObject(body) && body.provider === 'bank') throw new Error('no writer');
  const phrases = readPhrases(body);
  if (!phrases) throw new Error('unreadable reply');
  return phrases;
}
