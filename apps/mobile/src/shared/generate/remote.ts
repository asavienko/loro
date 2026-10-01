// The API's phrase and notes writers (plan 106: POST /library/generate/phrases and /notes), the only
// place suggestions and notes come from (plan 108). The server answers with a model where it writes,
// otherwise with its phrase bank (phrases) or its written rules (notes), and says which. A failure
// is the caller's to show. The app ships without zod, so the reply is checked by hand.
import { api, ApiError, apiUrl } from '../api/client';
import type { LanguageCode } from '../content';
import { ICON_NAMES } from '../ui/icons';
import type { OwnNotes } from '../state/types';
import type { SuggestRequest } from './types';

/** Where a deck is asked for (plan 111): written in the background, then read from `/library/decks/:id`. */
export const SUGGEST_URL = apiUrl('/library/decks');
export const NOTES_URL = apiUrl('/library/generate/notes');

/** Notes for one phrase take seconds; a writer that hangs longer than this has failed. */
const SUGGEST_TIMEOUT_MS = 90_000;
/** What the server accepts as phrases not to write again. */
const MAX_AVOID = 100;
const MAX_TEXT = 120;

export interface WrittenPhrase {
  target: string;
  native: string;
  image: string[];
  notes: OwnNotes;
  /** Written by a model just now, or a phrase of Loro's bank (by its id). */
  source: 'ai' | 'bank';
  bankId?: string;
  /** Its clips by language, where the server has a voice. */
  audio?: Partial<Record<LanguageCode, string>>;
}

export interface WrittenPhrases {
  /** Who answered: a model, or the server's phrase bank. */
  provider: 'ai' | 'bank';
  phrases: WrittenPhrase[];
}

export interface WrittenNotes {
  /** Who wrote them: a model, or the server's written rules. */
  provider: 'ai' | 'rules';
  image: string[];
  notes: OwnNotes;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

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

/** Clip paths by language, as URLs the app can load. */
export function readAudio(v: unknown): Partial<Record<LanguageCode, string>> | undefined {
  if (!isObject(v)) return undefined;
  const out = Object.fromEntries(Object.entries(v).flatMap(([lang, path]) => (typeof path === 'string' && path ? [[lang, apiUrl(path)]] : [])));
  return Object.keys(out).length > 0 ? out : undefined;
}

/** The reply's phrases, each with its picture and notes, or null if it isn't a list of them. */
export function readPhrases(body: unknown): WrittenPhrases | null {
  if (!isObject(body) || !Array.isArray(body.phrases)) return null;
  // Anything but the bank is a model's (`ai`; an older server said `claude`).
  const provider = body.provider === 'bank' ? 'bank' : 'ai';
  const phrases: WrittenPhrase[] = [];
  for (const item of body.phrases) {
    if (!isObject(item) || typeof item.target !== 'string' || typeof item.native !== 'string') return null;
    const target = item.target.trim();
    const native = item.native.trim();
    const notes = readNotes(item.notes);
    const image = readImage(item.image);
    const bankId = item.source === 'bank' && typeof item.bankId === 'string' ? item.bankId : undefined;
    const audio = readAudio(item.audio);
    // Every phrase has its notes and picture (plan 105): one that came without is left out.
    if (target && native && target.length <= MAX_TEXT && native.length <= MAX_TEXT && notes && image) {
      phrases.push({ target, native, image, notes, source: bankId ? 'bank' : 'ai', ...(bankId ? { bankId } : {}), ...(audio ? { audio } : {}) });
    }
  }
  return { provider, phrases };
}

/** Notes and a picture for a phrase the learner wrote; throws when the server can't be asked or answers nonsense. */
export async function writeNotes(
  phrase: { target: string; native: string; targetLang: LanguageCode; nativeLang: LanguageCode },
  signal?: AbortSignal,
): Promise<WrittenNotes> {
  const body = await api<unknown>('/library/generate/notes', { method: 'POST', body: phrase, auth: 'required', timeoutMs: SUGGEST_TIMEOUT_MS, signal });
  const notes = isObject(body) ? readNotes(body.notes) : null;
  const image = isObject(body) ? readImage(body.image) : null;
  if (!notes || !image) throw new Error('unreadable reply');
  return { provider: isObject(body) && body.provider === 'rules' ? 'rules' : 'ai', notes, image };
}

/** The notes a learner can ask to have written again. */
export type RewritableNote = 'mnemonic' | 'grammar';
/** How many notes the learner already read are sent with the ask, as the server accepts. */
export const MAX_PREVIOUS_NOTES = 10;

/**
 * Another mnemonic or grammar note for a phrase: sends the phrase, the language to write in and the
 * notes the learner already read (oldest first), which the server tells the model to differ from.
 * Throws when the server can't be asked, has no writer, or answers nonsense.
 */
export async function rewriteNote(
  request: {
    kind: RewritableNote;
    target: string;
    native: string;
    targetLang: LanguageCode;
    nativeLang: LanguageCode;
    previous: { title: string; text: string }[];
  },
  signal?: AbortSignal,
): Promise<{ title: string; text: string }> {
  const previous = request.previous.slice(-MAX_PREVIOUS_NOTES).map((n) => ({ title: n.title.slice(0, 60), text: n.text.slice(0, 300) }));
  const body = await api<unknown>('/library/generate/note', {
    method: 'POST',
    body: { ...request, target: request.target.slice(0, MAX_TEXT), native: request.native.slice(0, MAX_TEXT), previous },
    auth: 'required',
    timeoutMs: SUGGEST_TIMEOUT_MS,
    signal,
  });
  const written = isObject(body) ? note(body.note) : null;
  if (!written) throw new Error('unreadable reply');
  return written;
}

const DECK_POLL_MS = 1_500;
/** About two and a half minutes: longer than the server's writer and its fallback allow themselves. */
const DECK_POLLS = 100;

/** A pause between asks that the learner leaving the screen cuts short. */
function pause(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new ApiError(0, 'CANCELLED', 'Cancelled'));
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => (clearTimeout(timer), reject(new ApiError(0, 'CANCELLED', 'Cancelled'))), { once: true });
  });
}

/**
 * Phrases written for the request, none of `avoid`; throws when the server can't be asked, fails or
 * answers nonsense. The server writes in the background (plan 111) and is asked where the deck
 * stands until it is ready; without a model it answers from its bank at once.
 */
export async function writePhrases(
  request: SuggestRequest,
  avoid: string[],
  signal?: AbortSignal,
  pace = { pollMs: DECK_POLL_MS, polls: DECK_POLLS },
): Promise<WrittenPhrases> {
  let body = await api<unknown>('/library/decks', {
    method: 'POST',
    body: { ...request, avoid: avoid.slice(-MAX_AVOID).map((a) => a.slice(0, MAX_TEXT)) },
    auth: 'required',
    signal,
  });
  for (let polls = 0; isObject(body) && body.status === 'writing' && typeof body.id === 'string'; polls++) {
    if (polls >= pace.polls) throw new ApiError(0, 'PROVIDER_UNAVAILABLE', 'The phrases are still being written');
    await pause(pace.pollMs, signal);
    body = await api<unknown>(`/library/decks/${encodeURIComponent(body.id)}`, { auth: 'required', signal });
  }
  if (isObject(body) && body.status === 'failed') throw new ApiError(0, 'PROVIDER_UNAVAILABLE', 'The phrases could not be written');
  const written = readPhrases(body);
  if (!written) throw new Error('unreadable reply');
  return written;
}
