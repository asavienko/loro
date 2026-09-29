// What the device's sound rules produce (plan 105): each word as syllables of sounds, each sound
// knowing the letters it came from, and where the stress falls when it is known.
import type { Token } from './text';

/** One sound: a consonant, a vowel (a syllable's nucleus) or a glide beside it. */
export interface Sound {
  ipa: string;
  /** The letters it is written with ('' for the second sound of a letter such as x or щ). */
  letters: string;
  kind: 'C' | 'V' | 'G';
  /** A glide after its vowel («hay» [aj]) rather than before it («tienen» [tje]). */
  post?: boolean;
}

export type Syllable = Sound[];

export interface SoundWord {
  token: Token;
  syllables: Syllable[];
  /** The stressed syllable; null when unstressed (a clitic) or, in Bulgarian, not known. */
  stress: number | null;
  /** A word of several syllables whose stress the device doesn't know. */
  stressUnknown: boolean;
}

export interface Transcription {
  words: SoundWord[];
  ipa: string;
  respelling: string;
}

/** The word's sounds as IPA, with a stress mark before the stressed syllable. */
export function wordIpa(word: SoundWord, dots: boolean): string {
  return word.syllables
    .map((syllable, i) => {
      const sounds = syllable.map((s) => s.ipa).join('');
      if (i === word.stress) return `ˈ${sounds}`;
      return i > 0 && dots ? `.${sounds}` : sounds;
    })
    .join('');
}

/** The phrase in [square brackets], one word after another. */
export function phraseIpa(words: SoundWord[], dots: boolean): string {
  // A word hyphened to the next is said with it: «по-бавно» [ˌpɔˈbavno].
  const text = words.map((w, i) => {
    const ipa = w.token.joined ? wordIpa(w, dots).replace('ˈ', 'ˌ') : wordIpa(w, dots);
    return i < words.length - 1 && !w.token.joined ? `${ipa} ` : ipa;
  });
  return `[${text.join('')}]`;
}

/** Syllables as they are written, capitals and all, for quoting a word's beats: «cor·TA·do». */
export function writtenSyllables(word: SoundWord): string[] {
  const lower = word.syllables.map((syllable) => syllable.map((s) => s.letters).join(''));
  // The sounds were read from the word in lower case; take each syllable's letters from the word as written.
  if (lower.join('') !== word.token.word || word.token.written.length !== word.token.word.length) return lower;
  let at = 0;
  return lower.map((part) => word.token.written.slice(at, (at += part.length)));
}

/**
 * Split a word's sounds into syllables: every vowel is a nucleus; between two, one consonant starts
 * the next syllable, and of several the last does (the last two when `onset` says they begin a
 * syllable together, as «pl» or «tr» do).
 */
export function syllabify(sounds: Sound[], onset: (a: Sound, b: Sound) => boolean): Syllable[] {
  const nuclei = sounds.flatMap((s, i) => (s.kind === 'V' ? [i] : []));
  if (nuclei.length <= 1) return [sounds];
  const starts: number[] = [0];
  for (let k = 0; k < nuclei.length - 1; k++) {
    // A glide after a nucleus stays with it; one before the next nucleus goes with that.
    let from = nuclei[k] + 1;
    while (from < nuclei[k + 1] && sounds[from].post) from++;
    let to = nuclei[k + 1];
    while (to > from && sounds[to - 1].kind === 'G' && !sounds[to - 1].post) to--;
    const consonants = to - from;
    let start: number;
    if (consonants <= 1) start = from;
    else if (onset(sounds[to - 2], sounds[to - 1])) start = to - 2;
    else start = to - 1;
    starts.push(start);
  }
  return starts.map((start, i) => sounds.slice(start, starts[i + 1] ?? sounds.length));
}
