// Spanish (Castilian) sounds from spelling (plan 105). Spanish spelling says how a word sounds and
// where its stress falls, so these rules transcribe any phrase: the letters' sounds, glides and
// syllables, the written-accent and vowel-n-s stress rule, then the phrase's connected speech — b, d
// and g soften after a vowel, and n takes the place of the consonant after it. Conventions follow
// the course's own transcriptions: [ˈteŋ.ɡo], [koɾˈta.ðo], [ˈaj].
import {
  type Sound,
  type SoundWord,
  type Syllable,
  syllabify,
  type Transcription,
  phraseIpa,
} from './sounds.js'
import { spellNumbers } from './numbers.js'
import { type Token, tokenize } from './text.js'

const VOWEL = /[aeiouáéíóúü]/
const ACCENTED: Record<string, string> = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' }
const FRONT = /[eiéí]/
const DIGRAPHS: Record<string, string> = { ch: 'tʃ', ll: 'ʝ', rr: 'r', qu: 'k' }

/** Unstressed words of one syllable: articles, prepositions, pronouns, que, no. */
const CLITICS = new Set([
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
])

interface Letter {
  ipa: string
  letters: string
  kind: 'C' | 'V'
  /** A vowel: i, u or ü without an accent (y at the end of a word too), which glides. */
  weak?: boolean
  accent?: boolean
  /** A vowel written y at the end of a word («hay», «muy»): it leans on the vowel before. */
  finalY?: boolean
}

/** The word's letters as sounds, before vowels are grouped into syllables. */
function letters(word: string): Letter[] {
  const out: Letter[] = []
  let silent = ''
  const push = (ipa: string, written: string, kind: 'C' | 'V', extra: Partial<Letter> = {}) => {
    out.push({ ipa, letters: silent + written, kind, ...extra })
    silent = ''
  }
  for (let i = 0; i < word.length;) {
    const ch = word.charAt(i)
    const next = word[i + 1] ?? ''
    const two = ch + next
    if (DIGRAPHS[two] || (two === 'gu' && FRONT.test(word[i + 2] ?? ''))) {
      push(DIGRAPHS[two] ?? 'ɡ', two, 'C')
      i += 2
      continue
    }
    i++
    if (ch === 'h') silent += ch
    else if (ch === 'c') push(FRONT.test(next) ? 'θ' : 'k', ch, 'C')
    else if (ch === 'z') push('θ', ch, 'C')
    else if (ch === 'g') push(FRONT.test(next) ? 'x' : 'ɡ', ch, 'C')
    else if (ch === 'j') push('x', ch, 'C')
    else if (ch === 'ñ') push('ɲ', ch, 'C')
    else if (ch === 'v' || ch === 'b') push('b', ch, 'C')
    else if (ch === 'x') {
      push('k', ch, 'C')
      push('s', '', 'C')
    } else if (ch === 'y') {
      if (VOWEL.test(next)) push('ʝ', ch, 'C')
      else push('i', ch, 'V', { weak: true, finalY: out.length > 0 })
    } else if (ch === 'r') push(i === 1 || /[nls]/.test(word[i - 2] ?? '') ? 'r' : 'ɾ', ch, 'C')
    else if (ACCENTED[ch]) push(ACCENTED[ch], ch, 'V', { accent: true })
    else if (ch === 'ü' || ch === 'i' || ch === 'u')
      push(ch === 'ü' ? 'u' : ch, ch, 'V', { weak: true })
    else if (/[aeo]/.test(ch)) push(ch, ch, 'V')
    else push(ch, ch, 'C')
  }
  const last = out[out.length - 1]
  if (silent && last) last.letters += silent
  return out
}

/**
 * Vowels next to each other as nuclei and glides: a strong vowel (a, e, o, or any with an accent)
 * is a nucleus; an unaccented i or u beside it glides; two strong vowels are two syllables.
 */
function withGlides(word: Letter[]): { sounds: Sound[]; accented: number } {
  const sounds: Sound[] = []
  let accented = -1
  for (let i = 0; i < word.length;) {
    const first = word[i]
    if (first === undefined) break
    if (first.kind === 'C') {
      sounds.push({ ipa: first.ipa, letters: first.letters, kind: 'C' })
      i++
      continue
    }
    let end = i
    while (end < word.length && word[end]?.kind === 'V') end++
    const run = word.slice(i, end)
    const strong = run.map((v) => !v.weak)
    run.forEach((v, k) => {
      let glide: 'pre' | 'post' | null = null
      if (v.weak) {
        const strongBefore = k > 0 && strong[k - 1]
        const strongAfter = k < run.length - 1 && strong[k + 1]
        if (strongAfter && !strongBefore) glide = 'pre'
        else if (strongBefore) glide = 'post'
        else if (!run.some((_, j) => strong[j])) {
          // Only weak vowels: the last is the nucleus («cuidado», «ciudad»), unless it is a
          // final y, which leans back on the one before («muy»).
          const nucleus =
            run[run.length - 1]?.finalY && run.length > 1 ? run.length - 2 : run.length - 1
          glide = k === nucleus ? null : k < nucleus ? 'pre' : 'post'
        }
      }
      if (glide)
        sounds.push({
          ipa: v.ipa === 'i' ? 'j' : glide === 'pre' ? 'w' : 'u̯',
          letters: v.letters,
          kind: 'G',
          post: glide === 'post',
        })
      else {
        if (v.accent) accented = sounds.filter((s) => s.kind === 'V').length
        sounds.push({ ipa: v.ipa, letters: v.letters, kind: 'V' })
      }
    })
    i = end
  }
  return { sounds, accented }
}

const ONSET_FIRST = new Set(['p', 'b', 'f', 'k', 'ɡ', 't', 'd'])
const onset = (a: Sound, b: Sound) =>
  ONSET_FIRST.has(a.ipa) &&
  (b.ipa === 'ɾ' || b.ipa === 'l') &&
  !(b.ipa === 'l' && (a.ipa === 't' || a.ipa === 'd'))

function soundWord(token: Token): SoundWord {
  const { sounds, accented } = withGlides(letters(token.word))
  const syllables = syllabify(sounds, onset)
  const nuclei = syllables.length
  let stress: number | null
  if (accented >= 0) stress = accented
  else if (!sounds.some((s) => s.kind === 'V')) stress = null
  else if (nuclei === 1) stress = CLITICS.has(token.word) ? null : 0
  else stress = /[aeiouns]$/.test(token.word) ? nuclei - 2 : nuclei - 1
  return { token, syllables, stress, stressUnknown: false }
}

const NASAL = new Set(['m', 'n', 'ɲ', 'ŋ'])
const SOFT: Record<string, string> = { b: 'β', d: 'ð', ɡ: 'ɣ' }

/**
 * Connected speech across the phrase, pause to pause: b, d and g are soft (β ð ɣ) except after a
 * pause or a nasal (and d after l); n is m before p, b and m, and ŋ before k, g and j.
 */
function connect(words: SoundWord[]): void {
  const flat: { sound: Sound; pause: boolean }[] = []
  for (const w of words)
    w.syllables
      .flat()
      .forEach((sound, i) => flat.push({ sound, pause: i === 0 && w.token.pauseBefore }))
  const base = flat.map((f) => f.sound.ipa)
  flat.forEach(({ sound, pause }, i) => {
    const before = pause || i === 0 ? null : (flat[i - 1]?.sound.ipa ?? null)
    const after = i + 1 < flat.length && !flat[i + 1]?.pause ? (base[i + 1] ?? null) : null
    const soft = SOFT[sound.ipa]
    if (soft && before !== null && !NASAL.has(before) && !(sound.ipa === 'd' && before === 'l'))
      sound.ipa = soft
    else if (sound.ipa === 'n' && after && /^[pbm]$/.test(after)) sound.ipa = 'm'
    else if (sound.ipa === 'n' && after && /^[kɡx]$/.test(after)) sound.ipa = 'ŋ'
  })
}

const CONSONANTS: Record<string, string> = {
  p: 'p',
  t: 't',
  d: 'd',
  ð: 'd',
  k: 'k',
  ɡ: 'g',
  ɣ: 'g',
  f: 'f',
  θ: 'th',
  s: 's',
  x: 'h',
  tʃ: 'ch',
  m: 'm',
  n: 'n',
  ɲ: 'ny',
  ŋ: 'ng',
  l: 'l',
  ʝ: 'y',
  ɾ: 'r',
  r: 'rr',
  w: 'w',
}
const OPEN: Record<string, string> = { a: 'ah', e: 'eh', i: 'ee', o: 'oh', u: 'oo' }
const CLOSED: Record<string, string> = { a: 'a', e: 'e', i: 'ee', o: 'o', u: 'oo' }
const CLOSED_A = (vowel: string, next: string): string | undefined =>
  vowel === 'a' && next === 's' ? 'ah' : undefined
const FALLING: Record<string, string> = {
  aj: 'eye',
  ej: 'ay',
  oj: 'oy',
  uj: 'ooy',
  au̯: 'ow',
  eu̯: 'eh-oo',
  ou̯: 'oh-oo',
}

/** A syllable in English letters, as the course's respellings write them: «kor», «TAH», «EYE». */
function respellSyllable(syllable: Syllable): string {
  const nucleus = syllable.findIndex((s) => s.kind === 'V')
  const offglide = syllable.find((s, i) => i > nucleus && s.kind === 'G')
  const coda = syllable.filter((s, i) => i > nucleus && s.kind === 'C')
  const firstCoda = coda[0]
  return syllable
    .map((s, i) => {
      if (s.kind === 'C') {
        // b and v sound the same; the respelling keeps the letter the learner sees.
        if (s.ipa === 'b' || s.ipa === 'β') return s.letters.includes('v') ? 'v' : 'b'
        return CONSONANTS[s.ipa] ?? s.letters
      }
      if (s.kind === 'G') return i < nucleus ? (s.ipa === 'j' ? 'y' : 'w') : ''
      if (offglide) return FALLING[s.ipa + offglide.ipa] ?? OPEN[s.ipa]
      if (firstCoda === undefined) return OPEN[s.ipa]
      return CLOSED_A(s.ipa, firstCoda.ipa) ?? CLOSED[s.ipa]
    })
    .join('')
}

export function respellSpanish(words: SoundWord[]): string {
  return words
    .map(
      (w) =>
        w.syllables
          .map((syllable, i) =>
            i === w.stress ? respellSyllable(syllable).toUpperCase() : respellSyllable(syllable),
          )
          .join('-') + (w.token.commaAfter ? ',' : ''),
    )
    .join(' ')
}

export function transcribeSpanish(text: string): Transcription {
  const words = tokenize(spellNumbers(text, 'es-ES')).map(soundWord)
  connect(words)
  return { words, ipa: phraseIpa(words, true), respelling: respellSpanish(words) }
}
