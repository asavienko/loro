// The mnemonics and grammar notes a learner asked to have written again, kept on the device by
// phrase, note and language, newest first: the phrase shows the newest before its own note, and the
// next ask sends them all as what the learner already read. Only a convenience: a store that loses
// them costs the extra notes, never the phrase's own.
import type { LanguageCode } from '../content';
import { kvGet, kvSet } from '../api/kv';
import type { RewritableNote } from './remote';

export interface WrittenNote {
  title: string;
  text: string;
}

/** How many written-again notes a phrase keeps per note and language. */
export const MAX_KEPT_NOTES = 10;

const keyOf = (phraseId: string, kind: RewritableNote, lang: LanguageCode) => `loro.notes.again.${lang}.${kind}.${phraseId}`;

/** What is already read in this session, so a reopened phrase shows them at once. */
const memory = new Map<string, WrittenNote[]>();

const isNote = (v: unknown): v is WrittenNote =>
  typeof v === 'object' && v !== null && typeof (v as WrittenNote).title === 'string' && typeof (v as WrittenNote).text === 'string';

/** The notes kept in memory, newest first, or undefined when the device copy is not read yet. */
export function keptNotesNow(phraseId: string, kind: RewritableNote, lang: LanguageCode): WrittenNote[] | undefined {
  return memory.get(keyOf(phraseId, kind, lang));
}

/** The notes written again for this phrase, newest first. */
export async function keptNotes(phraseId: string, kind: RewritableNote, lang: LanguageCode): Promise<WrittenNote[]> {
  const key = keyOf(phraseId, kind, lang);
  const known = memory.get(key);
  if (known) return known;
  let notes: WrittenNote[] = [];
  try {
    const raw = await kvGet(key);
    const value: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(value)) notes = value.filter(isNote).slice(0, MAX_KEPT_NOTES);
  } catch {
    // Unreadable: as if none were kept.
  }
  // A note kept while this read was waiting wins.
  const now = memory.get(key) ?? notes;
  memory.set(key, now);
  return now;
}

/** Keeps a new note first; resolves to every kept note, newest first. */
export async function keepNote(phraseId: string, kind: RewritableNote, lang: LanguageCode, note: WrittenNote): Promise<WrittenNote[]> {
  const key = keyOf(phraseId, kind, lang);
  const notes = [note, ...(await keptNotes(phraseId, kind, lang))].slice(0, MAX_KEPT_NOTES);
  memory.set(key, notes);
  await kvSet(key, JSON.stringify(notes));
  return notes;
}

/** For tests: forget what is in memory. */
export function forgetKeptNotes(): void {
  memory.clear();
}
