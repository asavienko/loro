// Bulgarian sounds from spelling (plan 105). The letters say the sounds; the stress they don't, and
// it can fall on any syllable. So a word's stress comes from the course's and bank's own
// transcriptions — the word itself, or it with an article added, which never moves the stress
// (сметка, сметката) — and a word Loro hasn't seen keeps its full vowels with no stress mark, which
// its pronunciation note says. Nothing is guessed. Conventions follow the course: [ˈmɔʎɐ],
// [kɐˈdɛ], [ˈfkusnɔ].
import { KNOWN_PHRASES } from './content.js'
import {
  type Sound,
  type SoundWord,
  type Syllable,
  syllabify,
  type Transcription,
  phraseIpa,
} from './sounds.js'
import { BULGARIAN_NUMBER_STRESS, spellNumbers } from './numbers.js'
import { type Token, tokenize } from './text.js'

const LETTERS: Record<string, string> = {
  б: 'b',
  в: 'v',
  г: 'ɡ',
  д: 'd',
  ж: 'ʒ',
  з: 'z',
  й: 'j',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  ф: 'f',
  х: 'x',
  ц: 't͡s',
  ч: 't͡ʃ',
  ш: 'ʃ',
}
const VOWELS: Record<string, string> = {
  а: 'a',
  ъ: 'ɤ',
  о: 'ɔ',
  е: 'ɛ',
  и: 'i',
  ѝ: 'i',
  у: 'u',
  я: 'a',
  ю: 'u',
}
/** Unstressed vowels: а and ъ meet in [ɐ], о closes to [o]. */
const REDUCED: Record<string, string> = { a: 'ɐ', ɤ: 'ɐ', ɔ: 'o' }

/** Unstressed words of one syllable: prepositions, particles, short pronouns, forms of съм. */
const CLITICS = new Set([
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
  'ни',
  'ви',
  'им',
  'ги',
  'е',
  'са',
  'съм',
  'сме',
  'сте',
  'би',
  'пред',
  'при',
  'без',
  'а',
  'но',
  'че',
])

/** The word's letters as sounds; я, ю and ьо soften the consonant before them (л becomes ʎ, н ɲ). */
function sounds(word: string): Sound[] {
  const out: Sound[] = []
  const soften = () => {
    const last = out[out.length - 1]
    if (last?.kind !== 'C') return false
    last.ipa = last.ipa === 'l' ? 'ʎ' : last.ipa === 'n' ? 'ɲ' : `${last.ipa}ʲ`
    return true
  }
  for (let i = 0; i < word.length; i++) {
    const ch = word.charAt(i)
    const prev = word[i - 1]
    const vowel = VOWELS[ch]
    if (ch === 'д' && word[i + 1] === 'ж') {
      out.push({ ipa: 'd͡ʒ', letters: 'дж', kind: 'C' })
      i++
    } else if (ch === 'щ') {
      out.push({ ipa: 'ʃ', letters: 'щ', kind: 'C' }, { ipa: 't', letters: '', kind: 'C' })
    } else if (ch === 'ь') {
      if (word[i + 1] === 'о') soften()
      const last = out[out.length - 1]
      if (last) last.letters += ch
    } else if (ch === 'я' || ch === 'ю') {
      const afterConsonant = prev !== undefined && !VOWELS[prev] && prev !== 'ь' && prev !== 'ъ'
      if (!afterConsonant || !soften()) out.push({ ipa: 'j', letters: '', kind: 'C' })
      out.push({ ipa: vowel ?? '', letters: ch, kind: 'V' })
    } else if (vowel) out.push({ ipa: vowel, letters: ch, kind: 'V' })
    else out.push({ ipa: LETTERS[ch] ?? ch, letters: ch, kind: 'C' })
  }
  return out
}

const OBSTRUENT_FIRST = /^[bvɡdʒzkptfsʃx]/
const onset = (a: Sound, b: Sound) =>
  OBSTRUENT_FIRST.test(a.ipa) && /^[rlʎ]/.test(b.ipa) && a.ipa !== b.ipa

const vowelCount = (word: string) => Array.from(word).filter((ch) => VOWELS[ch]).length
const IPA_VOWEL = /[aɐɛeiɔouɤ]/g

/** Stressed vowel (0-based) per word, from every Bulgarian transcription in the course and bank. */
let lexicon: Map<string, number> | null = null
export function stressLexicon(): Map<string, number> {
  if (lexicon) return lexicon
  const learned = new Map<string, number>()
  lexicon = learned
  const learn = (word: string, ipa: string, vowelsBefore = 0) => {
    const mark = ipa.search(/ˈ/)
    const vowels = vowelCount(word)
    if (mark < 0 || vowels < 2 || learned.has(word)) return
    const stressed = (ipa.slice(0, mark).match(IPA_VOWEL) ?? []).length - vowelsBefore
    if (stressed >= 0 && stressed < vowels) learned.set(word, stressed)
  }
  for (const phrase of KNOWN_PHRASES) {
    if (phrase.targetLang !== 'bg-BG') continue
    const ipa = phrase.notes.pronunciation.ipa.replace(/^\[|\]$/g, '').split(/\s+/)
    const tokens = tokenize(phrase.target)
    if (tokens.length === ipa.length) {
      tokens.forEach((t, i) => {
        const word = ipa[i] ?? ''
        if ((word.match(IPA_VOWEL) ?? []).length === vowelCount(t.word)) learn(t.word, word)
      })
      continue
    }
    // Written «по-бавно», transcribed as one word [ˌpɔˈbavno]: the part after the hyphen learns its stress.
    const joined: { words: string[] }[] = []
    tokens.forEach((t, i) => {
      const last = joined[joined.length - 1]
      if (i > 0 && tokens[i - 1]?.joined && last) last.words.push(t.word)
      else joined.push({ words: [t.word] })
    })
    if (joined.length !== ipa.length) continue
    joined.forEach(({ words }, i) => {
      let before = 0
      for (const word of words) {
        learn(word, ipa[i] ?? '', before)
        before += vowelCount(word)
      }
    })
  }
  return lexicon
}

/** Endings that add «the» and never move the stress: сметка → сметката, полет → полетът. */
const ARTICLES = ['та', 'то', 'те', 'ът', 'ят', 'а', 'я']

/** The word's stressed vowel, when the course or bank has the word, or has it with or without its article. */
export function knownStress(word: string): number | null {
  const known = stressLexicon()
  const exact = known.get(word) ?? BULGARIAN_NUMBER_STRESS[word]
  if (exact !== undefined) return exact
  for (const ending of ARTICLES) {
    const base = known.get(word.slice(0, -ending.length))
    if (word.endsWith(ending) && base !== undefined) return base
    const withArticle = known.get(word + ending)
    if (withArticle !== undefined && withArticle < vowelCount(word)) return withArticle
  }
  return null
}

function soundWord(token: Token): SoundWord {
  const all = sounds(token.word)
  const vowels = all.filter((s) => s.kind === 'V')
  let stressVowel: number | null = null
  let stressUnknown = false
  let clitic = false
  if (vowels.length === 1) {
    clitic = CLITICS.has(token.word) && !token.joined
    stressVowel = clitic ? null : 0
  } else if (vowels.length > 1) {
    stressVowel = knownStress(token.word)
    stressUnknown = stressVowel === null
  }
  // Vowel quality: full when stressed, or when the stress isn't known; reduced otherwise.
  vowels.forEach((v, i) => {
    if (i !== stressVowel && !stressUnknown) v.ipa = REDUCED[v.ipa] ?? v.ipa
  })
  const syllables = syllabify(all, onset)
  return { token, syllables, stress: stressVowel, stressUnknown }
}

const VOICED: Record<string, string> = { b: 'p', v: 'f', ɡ: 'k', d: 't', ʒ: 'ʃ', z: 's', d͡ʒ: 't͡ʃ' }
const VOICELESS: Record<string, string> = Object.fromEntries(
  Object.entries(VOICED).map(([v, f]) => [f, v]),
)
const base = (ipa: string) => ipa.replace('ʲ', '')
const isVoicedObstruent = (ipa: string) => base(ipa) in VOICED
const isVoicelessObstruent = (ipa: string) =>
  base(ipa) in VOICELESS || ['x', 't͡s'].includes(base(ipa))
const swap = (ipa: string, to: Record<string, string>) =>
  (to[base(ipa)] ?? base(ipa)) + (ipa.endsWith('ʲ') ? 'ʲ' : '')

/**
 * Voicing across the phrase, pause to pause, from the end: an obstruent takes the voicing of the
 * obstruent after it (в takes it but doesn't give it), and a word's last one is voiceless unless the
 * next word starts with a voiced one.
 */
function connect(words: SoundWord[]): void {
  const flat: { sound: Sound; pause: boolean; start: boolean }[] = []
  for (const w of words)
    w.syllables
      .flat()
      .forEach((sound, i) =>
        flat.push({ sound, pause: i === 0 && w.token.pauseBefore, start: i === 0 }),
      )
  for (let i = flat.length - 1; i >= 0; i--) {
    const entry = flat[i]
    if (!entry) continue
    const { sound } = entry
    if (sound.kind !== 'C' || !(isVoicedObstruent(sound.ipa) || isVoicelessObstruent(sound.ipa)))
      continue
    const after = flat[i + 1]
    const next = after && !after.pause ? after : null
    const voicedNext =
      next !== null &&
      next.sound.kind === 'C' &&
      isVoicedObstruent(next.sound.ipa) &&
      base(next.sound.ipa) !== 'v'
    // A word's last consonant is voiceless unless a voiced one follows («хляб» [xʎap], «друг ден»).
    if (!next || (next.start && !voicedNext)) sound.ipa = swap(sound.ipa, VOICED)
    else if (next.sound.kind === 'C' && isVoicelessObstruent(next.sound.ipa))
      sound.ipa = swap(sound.ipa, VOICED)
    // Voicing spreads back within a word; across words only devoicing does («пет години» keeps its t).
    else if (!next.start && voicedNext) sound.ipa = swap(sound.ipa, VOICELESS)
  }
}

const CONSONANTS: Record<string, string> = {
  b: 'b',
  p: 'p',
  v: 'v',
  f: 'f',
  ɡ: 'g',
  k: 'k',
  d: 'd',
  t: 't',
  ʒ: 'zh',
  ʃ: 'sh',
  z: 'z',
  s: 's',
  x: 'h',
  t͡s: 'ts',
  t͡ʃ: 'ch',
  d͡ʒ: 'j',
  m: 'm',
  n: 'n',
  l: 'l',
  r: 'r',
  j: 'y',
  ʎ: 'ly',
  ɲ: 'ny',
}
const VOWEL_LETTERS: Record<string, [open: string, closed: string]> = {
  a: ['a', 'a'],
  ɤ: ['uh', 'uh'],
  ɛ: ['eh', 'e'],
  ɔ: ['o', 'o'],
  o: ['o', 'o'],
  i: ['ee', 'ee'],
  u: ['oo', 'oo'],
}

function respellSyllable(syllable: Syllable): string {
  const nucleus = syllable.findIndex((s) => s.kind === 'V')
  const closed = syllable.some((s, i) => i > nucleus && s.kind === 'C')
  const glide = syllable[nucleus + 1]?.ipa === 'j'
  return syllable
    .map((s, i) => {
      if (i === nucleus + 1 && glide) return ''
      if (s.kind === 'V') {
        // A reduced vowel is written as the letter the learner sees: ъ «uh», а «a».
        if (glide)
          return s.ipa === 'ɛ'
            ? 'ay'
            : s.ipa === 'ɔ' || s.ipa === 'o'
              ? 'oy'
              : s.ipa === 'u'
                ? 'ooy'
                : s.ipa === 'i'
                  ? 'eey'
                  : 'ai'
        if (s.ipa === 'ɐ') return s.letters === 'ъ' ? 'uh' : 'a'
        return VOWEL_LETTERS[s.ipa]?.[closed ? 1 : 0] ?? s.ipa
      }
      const soft = s.ipa.endsWith('ʲ')
      return (CONSONANTS[base(s.ipa)] ?? s.letters) + (soft ? 'y' : '')
    })
    .join('')
}

export function respellBulgarian(words: SoundWord[]): string {
  return words
    .map(
      (w) =>
        w.syllables
          .map((syllable, i) =>
            i === w.stress ? respellSyllable(syllable).toUpperCase() : respellSyllable(syllable),
          )
          .join('-') +
        (w.token.commaAfter ? ',' : '') +
        (w.token.joined ? '-' : ' '),
    )
    .join('')
    .trim()
}

export function transcribeBulgarian(text: string): Transcription {
  const words = tokenize(spellNumbers(text, 'bg-BG')).map(soundWord)
  connect(words)
  return { words, ipa: phraseIpa(words, false), respelling: respellBulgarian(words) }
}
