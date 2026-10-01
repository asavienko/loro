// Notes for a phrase of a course Loro has no sound rules for (English, Russian): English spelling
// doesn't give its sounds, and a Russian word's sounds hang on a stress the spelling doesn't show.
// So the grammar rule and the sound to practise are chosen by written rules that read only the
// phrase's words and spelling, and the IPA and respelling come only from Loro's own phrases, word
// by word. A word Loro hasn't transcribed is named and left out, never guessed.
import { KNOWN_PHRASES, type LanguageCode } from './content.js'
import type { NoteLocale, NoteText } from './locale.js'
import { type SoundTip } from './tips.js'

/** A word as the transcriptions are keyed: lower case, apostrophes kept («i'd»), edge marks gone. */
function key(word: string): string {
  return word
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
}

/** The phrase's words, split where it has spaces, as written and as keyed. */
function words(text: string): { written: string; key: string }[] {
  return text
    .split(/\s+/)
    .map((w) => ({ written: w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''), key: key(w) }))
    .filter((w) => w.key.length > 0)
}

/** The parts of a transcription that stand for words: pause marks («|», «‖») and commas dropped. */
function parts(text: string): string[] {
  return text
    .split(/\s+/)
    .map((p) => p.replace(/^[[,]+|[\],.]+$/g, ''))
    .filter((p) => /[\p{L}ˈˌ]/u.test(p))
}

interface Known {
  ipa: string
  respelling: string | null
}

/** A whole phrase's transcription, which always has its respelling. */
interface KnownPhrase {
  ipa: string
  respelling: string
}

const lexicons = new Map<
  LanguageCode,
  { phrases: Map<string, KnownPhrase>; words: Map<string, Known> }
>()

/**
 * What Loro's own phrases in the language say of their sounds: each whole phrase, and each word of
 * a phrase whose transcription has one part per word (where they don't line up, as when a
 * preposition is said with the next word, none of that phrase's words is taken). The course's
 * phrases come first, so theirs is the transcription a word keeps.
 */
function lexicon(lang: LanguageCode) {
  const hit = lexicons.get(lang)
  if (hit) return hit
  const phrases = new Map<string, KnownPhrase>()
  const known = new Map<string, Known>()
  for (const phrase of KNOWN_PHRASES) {
    if (phrase.targetLang !== lang) continue
    const { ipa, respelling } = phrase.notes.pronunciation
    const phraseKey = words(phrase.target)
      .map((w) => w.key)
      .join(' ')
    if (!phrases.has(phraseKey)) phrases.set(phraseKey, { ipa, respelling })
    const own = words(phrase.target)
    const sounds = parts(ipa.slice(1, -1))
    if (sounds.length !== own.length) continue
    const spelt = parts(respelling)
    own.forEach((w, i) => {
      if (known.has(w.key)) return
      known.set(w.key, {
        ipa: sounds[i] ?? '',
        respelling: spelt.length === own.length ? (spelt[i] ?? null) : null,
      })
    })
  }
  const made = { phrases, words: known }
  lexicons.set(lang, made)
  return made
}

/**
 * What the note adds when some words aren't in Loro's phrases, in each note language: short, so a
 * tip (at most 225 characters) and it stay within a note's 300.
 */
const UNTRANSCRIBED: Record<NoteLocale, string> = {
  en: ' The … stands for words Loro hasn’t transcribed yet: listen to the clip.',
  bg: ' Многоточието замества думи без транскрипция в Loro засега: чуйте записа.',
  ru: ' Многоточие стоит вместо слов без транскрипции в Loro: послушайте запись.',
  pl: ' Wielokropek zastępuje słowa, których Loro jeszcze nie transkrybowało: posłuchaj nagrania.',
  cs: ' Tři tečky nahrazují slova, která Loro ještě nepřepsalo: poslechněte si nahrávku.',
}

export interface LearnedSounds {
  ipa: string
  respelling: string
  /** The words, as written, that Loro has no transcription for. */
  unknown: string[]
}

/** The phrase's IPA and respelling from Loro's own phrases, … where a word isn't in them. */
export function learnedSounds(text: string, lang: LanguageCode): LearnedSounds {
  const { phrases, words: known } = lexicon(lang)
  const own = words(text)
  const whole = phrases.get(own.map((w) => w.key).join(' '))
  if (whole) return { ipa: whole.ipa, respelling: whole.respelling, unknown: [] }
  const found = own.map((w) => known.get(w.key))
  const unknown = own.filter((_, i) => !found[i]).map((w) => w.written)
  if (found.every((f) => !f)) return { ipa: '[…]', respelling: '—', unknown }
  const respelt = found.every((f) => f?.respelling)
  return {
    ipa: `[${found.map((f) => f?.ipa ?? '…').join(' ')}]`,
    respelling: respelt ? found.map((f) => f?.respelling ?? '').join(' ') : '—',
    unknown,
  }
}

/**
 * The pronunciation note: the first of the language's sound tips the phrase's spelling shows, and
 * whatever Loro's own phrases say of its sounds.
 */
export function learnedPronunciation(
  tips: SoundTip[],
  text: string,
  lang: LanguageCode,
): { say: Partial<Record<NoteLocale, NoteText>>; sounds: LearnedSounds } {
  const sounds = learnedSounds(text, lang)
  const say: Partial<Record<NoteLocale, NoteText>> = {}
  for (const tip of tips) {
    const found = tip.find(text)
    if (found === null) continue
    for (const [locale, write] of Object.entries(tip.say) as [
      NoteLocale,
      (w: string) => NoteText,
    ][]) {
      const note = write(found)
      say[locale] =
        sounds.unknown.length > 0 ? { ...note, text: note.text + UNTRANSCRIBED[locale] } : note
    }
    break
  }
  return { say, sounds }
}
