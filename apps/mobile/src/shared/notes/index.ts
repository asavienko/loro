// Notes worked out on the device (plan 105), for a phrase the learner typed that neither the phrase
// bank nor the AI writer has notes for, so that every phrase has its picture, its sounds, a memory
// hint and a grammar rule. Each is derived from the phrase itself by written rules — its spelling,
// its constructions, its words — and none is invented: where Loro doesn't know something (a
// Bulgarian word's stress) the note says so rather than guessing.
import type { LanguageCode, Phrase, PhraseNotes } from '../content';
import { transcribeBulgarian } from './bg';
import { transcribeSpanish } from './es';
import { BULGARIAN_GRAMMAR, GrammarRule, SPANISH_GRAMMAR } from './grammar';
import { NOTE_LANGUAGES, NoteLocale, NoteText } from './locale';
import { memoryNote } from './memory';
import { pictureFor } from './picture';
import { pronunciationNote } from './pronunciation';

export interface DeviceNotesInput {
  target: string;
  native: string;
  targetLang: LanguageCode;
  nativeLang: LanguageCode;
}

export interface DeviceNotes {
  image: string[];
  notes: PhraseNotes;
  noteTranslations: Phrase['noteTranslations'];
}

/** The course languages the device has sound rules for. */
export const DEVICE_NOTE_LANGUAGES: readonly LanguageCode[] = ['es-ES', 'bg-BG'];

function grammarNote(rules: GrammarRule[], text: string): Partial<Record<NoteLocale, NoteText>> {
  for (const rule of rules) {
    const found = rule.find(text);
    if (found === null) continue;
    return Object.fromEntries(Object.entries(rule.say).map(([locale, say]) => [locale, say(found)]));
  }
  return {};
}

/**
 * Notes for a text with nothing to say aloud. The store refuses such a phrase (limits.sayable), so
 * this is only a floor under a state that shouldn't arise: it still has every note, and says why.
 */
function silent(input: DeviceNotesInput): DeviceNotes {
  const note = { title: 'Nothing to say aloud', text: 'This phrase has no letters or digits, so it has no sounds, and nothing for a rule or a hint to hold on to.' };
  return { image: pictureFor(input.target, input.native), notes: { mnemonic: note, grammar: note, pronunciation: { ...note, ipa: '[ ]', respelling: '—' } }, noteTranslations: {} };
}

function compose(input: DeviceNotesInput): DeviceNotes {
  const spanish = input.targetLang === 'es-ES';
  const sound = spanish ? transcribeSpanish(input.target) : transcribeBulgarian(input.target);
  if (sound.words.length === 0) return silent(input);
  const lang = spanish ? 'es-ES' : 'bg-BG';
  const byKind = {
    mnemonic: memoryNote({ ...input, sound }) as Partial<Record<NoteLocale, NoteText>>,
    grammar: grammarNote(spanish ? SPANISH_GRAMMAR : BULGARIAN_GRAMMAR, input.target),
    pronunciation: pronunciationNote(lang, sound),
  };
  const en = (kind: keyof typeof byKind) => byKind[kind].en as NoteText;
  const notes: PhraseNotes = {
    mnemonic: en('mnemonic'),
    grammar: en('grammar'),
    pronunciation: { ...en('pronunciation'), ipa: sound.ipa, respelling: sound.respelling },
  };
  // The other note languages, never the phrase's own (a Bulgarian speaker doesn't learn Bulgarian).
  const noteTranslations: Phrase['noteTranslations'] = {};
  for (const kind of Object.keys(byKind) as (keyof typeof byKind)[]) {
    const versions = NOTE_LANGUAGES.filter((l) => l.locale !== 'en' && l.code !== input.targetLang && byKind[kind][l.locale]);
    noteTranslations[kind] = Object.fromEntries(versions.map((l) => [l.code, byKind[kind][l.locale]!]));
  }
  return { image: pictureFor(input.target, input.native), notes, noteTranslations };
}

const cache = new Map<string, DeviceNotes>();
const CACHE_LIMIT = 500;

/** The phrase's notes and picture, worked out once per text and meaning. */
export function deviceNotes(input: DeviceNotesInput): DeviceNotes {
  const key = [input.targetLang, input.nativeLang, input.target, input.native].join('\u0000');
  const hit = cache.get(key);
  if (hit) return hit;
  const made = compose(input);
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
  cache.set(key, made);
  return made;
}
