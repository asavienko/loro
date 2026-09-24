// Vocabulary lives in the JSON files next to this module. Nothing here is
// learner progress: every learner number is derived from the state machine
// in src/state/.
import phrasesJson from './phrases.json';
import setsJson from './sets.json';
import topicsJson from './topics.json';
import languagesJson from './languages.json';
import profileJson from './profile.json';

/** BCP 47 code of a language listed in languages.json, e.g. "es-ES". */
export type LanguageCode = string;

export interface Language {
  code: LanguageCode;
  name: string;
  flag: string;
}

export interface Utterance {
  lang: LanguageCode;
  text: string;
}

export interface PhraseNotes {
  mnemonic?: { title: string; text: string };
  grammar?: { title: string; text: string };
  pronunciation?: { title: string; ipa: string; respelling: string; text: string };
}

export interface Phrase {
  id: string;
  setId: string;
  target: Utterance;
  native: Utterance;
  notes?: PhraseNotes;
}

export interface PhraseSet {
  id: string;
  title: string;
  subtitle: string;
  topicId: string;
  /** Material Symbols icon drawn on the set's cover. */
  coverIcon: string;
  targetLang: LanguageCode;
  phraseIds: string[];
}

export type TopicTone = 'primary' | 'secondary' | 'tertiary';

export interface Topic {
  id: string;
  title: string;
  icon: string;
  tone: TopicTone;
}

export interface Profile {
  name: string;
  nativeLang: LanguageCode;
  targetLang: LanguageCode;
}

export const PHRASES = phrasesJson as Phrase[];
export const SETS = setsJson as PhraseSet[];
export const TOPICS = topicsJson as Topic[];
export const LANGUAGES = languagesJson as Language[];
export const PROFILE = profileJson as Profile;

const phraseById = new Map(PHRASES.map((p) => [p.id, p]));
const setById = new Map(SETS.map((s) => [s.id, s]));

export function getPhrase(id: string): Phrase {
  const phrase = phraseById.get(id);
  if (!phrase) throw new Error(`Unknown phrase: ${id}`);
  return phrase;
}

export function findPhrase(id: string | null | undefined): Phrase | undefined {
  return id ? phraseById.get(id) : undefined;
}

export function getSet(id: string): PhraseSet {
  const set = setById.get(id);
  if (!set) throw new Error(`Unknown set: ${id}`);
  return set;
}

export function findSet(id: string | null | undefined): PhraseSet | undefined {
  return id ? setById.get(id) : undefined;
}

export function getLanguage(code: LanguageCode): Language {
  const language = LANGUAGES.find((l) => l.code === code);
  if (!language) throw new Error(`Unknown language: ${code}`);
  return language;
}

export function getTopic(id: string): Topic | undefined {
  return TOPICS.find((t) => t.id === id);
}

export function phrasesOfSet(setId: string): Phrase[] {
  return getSet(setId).phraseIds.map(getPhrase);
}
