// Words, as the device's notes read them (plan 105): a phrase split into words, each knowing whether
// a pause comes before it, and letters normalised so a Spanish, Bulgarian, Russian or English word
// can be compared with another.

export interface Token {
  /** The word in lower case, without punctuation. */
  word: string
  /** As written, for quoting it back. */
  written: string
  /** Punctuation (or the start of the phrase) comes before it: a pause. */
  pauseBefore: boolean
  /** A comma follows it, which the respelling keeps. */
  commaAfter: boolean
  /** A hyphen joins it to the next word, as «по» in «по-голям»: it carries its own stress. */
  joined: boolean
}

const PAUSE = /[,.;:!?¡¿…()"«»“”]/

/**
 * The phrase's words — runs of letters or digits — each knowing the punctuation around it. A word
 * hyphened to the next (Bulgarian «по-голям») is said as one with it.
 */
export function tokenize(text: string): Token[] {
  const out: Token[] = []
  let pause = true
  for (const [, word, gap = ''] of text.matchAll(/([\p{L}\p{M}\p{N}]+)|([^\p{L}\p{M}\p{N}]+)/gu)) {
    if (word) {
      out.push({
        word: word.toLowerCase(),
        written: word,
        pauseBefore: pause,
        commaAfter: false,
        joined: false,
      })
      pause = false
      continue
    }
    const last = out[out.length - 1]
    if (last && gap.includes(',')) last.commaAfter = true
    if (last && /^[-‑]$/.test(gap)) last.joined = true
    if (PAUSE.test(gap)) pause = true
  }
  return out
}

const CYRILLIC: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'i',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sht',
  ъ: 'a',
  ы: 'i',
  ь: '',
  э: 'e',
  ю: 'iu',
  я: 'ia',
  ѝ: 'i',
}

/**
 * A word as sounds in plain Latin letters, so that «farmacia», «pharmacy» and «фармация» meet:
 * Cyrillic transliterated, accents dropped, and spellings of one sound made one (ph/f, c/k, v/b…).
 */
export function soundKey(word: string): string {
  const latin = Array.from(word.toLowerCase())
    .map((ch) => CYRILLIC[ch] ?? ch)
    .join('')
  return latin
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z]/g, '')
    .replace(/ph/g, 'f')
    .replace(/th/g, 't')
    .replace(/qu/g, 'k')
    .replace(/ck/g, 'k')
    .replace(/c(?=[eiy])/g, 's')
    .replace(/[cq]/g, 'k')
    .replace(/v/g, 'b')
    .replace(/y/g, 'i')
    .replace(/h/g, '')
    .replace(/(.)\1+/g, '$1')
}

/** Edit distance, for telling a cognate from a coincidence. */
export function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0] ?? 0
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const above = row[j] ?? 0
      row[j] = Math.min(
        above + 1,
        (row[j - 1] ?? 0) + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
      diagonal = above
    }
  }
  return row[b.length] ?? 0
}

/** Words that carry no picture and no memory hook on their own: articles, prepositions, pronouns. */
export const FUNCTION_WORDS = new Set([
  // Spanish
  'a',
  'al',
  'con',
  'de',
  'del',
  'el',
  'en',
  'es',
  'la',
  'las',
  'le',
  'les',
  'lo',
  'los',
  'me',
  'mi',
  'mis',
  'nos',
  'os',
  'para',
  'por',
  'que',
  'se',
  'sin',
  'su',
  'sus',
  'te',
  'tu',
  'tus',
  'un',
  'una',
  'unos',
  'unas',
  'y',
  'o',
  'u',
  'e',
  'ni',
  'no',
  'he',
  'ha',
  'han',
  'has',
  'favor',
  'muy',
  'este',
  'esta',
  'esto',
  'eso',
  'yo',
  'tú',
  'usted',
  // Bulgarian
  'и',
  'в',
  'във',
  'на',
  'за',
  'с',
  'със',
  'от',
  'до',
  'по',
  'към',
  'да',
  'ли',
  'не',
  'ще',
  'се',
  'си',
  'ме',
  'ми',
  'те',
  'ти',
  'го',
  'му',
  'ѝ',
  'я',
  'ни',
  'ви',
  'им',
  'ги',
  'е',
  'са',
  'съм',
  'сме',
  'сте',
  'аз',
  'ти',
  'той',
  'тя',
  'то',
  'ние',
  'вие',
  'те',
  'моля',
  'един',
  'една',
  'едно',
  'този',
  'тази',
  'това',
  'а',
  'но',
  'пред',
  'при',
  'без',
  // Russian (for a Russian speaker's meaning)
  'у',
  'к',
  'о',
  'об',
  'из',
  'же',
  'бы',
  'мне',
  'меня',
  'вы',
  'он',
  'она',
  'оно',
  'они',
  'мы',
  'это',
  'пожалуйста',
  // English
  'the',
  'an',
  'of',
  'to',
  'in',
  'on',
  'at',
  'for',
  'with',
  'and',
  'or',
  'is',
  'are',
  'am',
  'be',
  'it',
  'i',
  'you',
  'we',
  'they',
  'he',
  'she',
  'my',
  'your',
  'me',
  'please',
  'this',
  'that',
  'do',
  'does',
  'can',
  'could',
  'will',
  'would',
  'not',
  "it's",
  "i'm",
  "don't",
  'some',
  'any',
  'there',
  'here',
  'what',
  'where',
  'how',
  'when',
  'have',
  'has',
  'get',
])

export function contentWords(text: string): string[] {
  return tokenize(text)
    .map((t) => t.word)
    .filter((w) => w.length >= 3 && !FUNCTION_WORDS.has(w))
}
