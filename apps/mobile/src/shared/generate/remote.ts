// The API's phrase and notes writers (plan 106: POST /library/generate/phrases and /notes), the only
// place suggestions and notes come from (plan 108). The server answers with Claude where it writes,
// otherwise with its phrase bank (phrases) or its written rules (notes), and says which. A failure
// is the caller's to show. The app ships without zod, so the reply is checked by hand.
import { api, apiUrl } from '../api/client';
import type { LanguageCode } from '../content';
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

export interface WrittenPhrase {
  target: string;
  native: string;
  image: string[];
  notes: OwnNotes;
  /** Written by Claude just now, or a phrase of Loro's bank (by its id). */
  source: 'ai' | 'bank';
  bankId?: string;
  /** Its clips by language, where the server has a voice. */
  audio?: Partial<Record<LanguageCode, string>>;
}

export interface WrittenPhrases {
  /** Who answered: Claude, or the server's phrase bank. */
  provider: 'claude' | 'bank';
  phrases: WrittenPhrase[];
}

export interface WrittenNotes {
  /** Who wrote them: Claude, or the server's written rules. */
  provider: 'claude' | 'rules';
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
  const provider = body.provider === 'bank' ? 'bank' : 'claude';
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
  return { provider: isObject(body) && body.provider === 'rules' ? 'rules' : 'claude', notes, image };
}

/** Phrases written for the request, none of `avoid`; throws when the server can't be asked or answers nonsense. */
export async function writePhrases(request: SuggestRequest, avoid: string[], signal?: AbortSignal): Promise<WrittenPhrases> {
  const body = await api<unknown>('/library/generate/phrases', {
    method: 'POST',
    body: { ...request, avoid: avoid.slice(-MAX_AVOID).map((a) => a.slice(0, MAX_TEXT)) },
    auth: 'required',
    timeoutMs: SUGGEST_TIMEOUT_MS,
    signal,
  });
  const written = readPhrases(body);
  if (!written) throw new Error('unreadable reply');
  return written;
}
