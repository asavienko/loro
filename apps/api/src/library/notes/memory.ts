// A mnemonic for a phrase the learner typed (plan 105), from what is true of it: a word that
// sounds like one in the learner's own meaning, a word it shares with a phrase of Loro's, or else
// its shape — the pieces it breaks into, or the beats of its longest word (or, in a course without
// sound rules, echoing its clip). The first that fits.
import { KNOWN_PHRASES, type LanguageCode } from './content.js'
import type { NoteLocale, NoteText } from './locale.js'
import { type SoundWord, type Transcription, writtenSyllables } from './sounds.js'
import { distance, FUNCTION_WORDS, soundKey, type Token, tokenize } from './text.js'

export interface MemoryInput {
  target: string
  native: string
  targetLang: LanguageCode
  nativeLang: LanguageCode
  sound: Transcription
}

/** The phrase and its meaning, without its sounds. */
type Words = Omit<MemoryInput, 'sound'>

type Say = Record<NoteLocale, NoteText>

const meaningful = (t: Token) => t.word.length >= 4 && !FUNCTION_WORDS.has(t.word)

/** A word of the phrase and a word of its meaning that sound alike: «farmacia», «pharmacy». */
function cognate(input: Words): Say | null {
  let best: { target: string; native: string; score: number } | null = null
  for (const t of tokenize(input.target).filter(meaningful)) {
    for (const n of tokenize(input.native).filter(meaningful)) {
      const a = soundKey(t.word)
      const b = soundKey(n.word)
      if (Math.min(a.length, b.length) < 4) continue
      const score = 1 - distance(a, b) / Math.max(a.length, b.length)
      if (score >= 0.6 && (!best || score > best.score))
        best = { target: t.written, native: n.written, score }
    }
  }
  if (!best) return null
  const { target: t, native: n } = best
  return {
    en: {
      title: `«${t}» and «${n}»`,
      text: `«${t}» sounds like «${n}» in your meaning: let one call up the other.`,
    },
    bg: {
      title: `«${t}» и «${n}»`,
      text: `«${t}» звучи като «${n}» от вашия превод — нека едното ви напомня за другото.`,
    },
    ru: {
      title: `«${t}» и «${n}»`,
      text: `«${t}» звучит как «${n}» из вашего перевода — пусть одно напоминает о другом.`,
    },
  }
}

/** A word the phrase shares with one of Loro's phrases, the course's before the bank's. */
function link(input: Words): Say | null {
  const own = tokenize(input.target).filter(meaningful)
  const ownKey = tokenize(input.target)
    .map((t) => t.word)
    .join(' ')
  const phrases = KNOWN_PHRASES.filter((p) => p.targetLang === input.targetLang)
  for (const t of [...own].sort((a, b) => b.word.length - a.word.length)) {
    const other = phrases.find((p) => {
      const words = tokenize(p.target).map((x) => x.word)
      return words.join(' ') !== ownKey && words.includes(t.word)
    })
    if (!other) continue
    const meaning = other.translations[input.nativeLang] ?? other.translations['en-GB'] ?? ''
    const w = t.written
    const o = other.target
    return {
      en: {
        title: `«${w}» again`,
        text: `«${w}» is also in «${o}» — “${meaning}”. Hang this phrase on that one.`,
      },
      bg: {
        title: `Пак «${w}»`,
        text: `«${w}» се среща и във фразата «${o}» — „${meaning}“. Вържете новата фраза за нея.`,
      },
      ru: {
        title: `Снова «${w}»`,
        text: `«${w}» есть и во фразе «${o}» — «${meaning}». Привяжите новую фразу к этой.`,
      },
    }
  }
  return null
}

/** The phrase in pieces of a word or three, each ending on a word that carries meaning. */
export function pieces(text: string): string[] {
  const tokens = tokenize(text)
  const out: string[] = []
  let current: Token[] = []
  tokens.forEach((t, i) => {
    current.push(t)
    const last = i === tokens.length - 1
    if (last || t.commaAfter || (current.length >= 2 && !FUNCTION_WORDS.has(t.word))) {
      out.push(current.map((x) => x.written).join(' '))
      current = []
    }
  })
  return out
}

function chunks(input: Words): Say | null {
  const parts = pieces(input.target)
  if (parts.length < 2) return null
  const joined = parts.map((p) => `«${p}»`).join(' · ')
  return {
    en: {
      title: `In ${parts.length} pieces`,
      text: `Learn it in pieces: ${joined}. Say each one twice, then join them up.`,
    },
    bg: {
      title: `На ${parts.length} части`,
      text: `Учете я на части: ${joined}. Кажете всяка два пъти, после ги съединете.`,
    },
    ru: {
      title: 'По частям',
      text: `Учите её по частям: ${joined}. Скажите каждую дважды, затем соедините.`,
    },
  }
}

/** The beats of the phrase's longest word, the strong one in capitals when the stress is known. */
function beats(input: MemoryInput): Say {
  const words = input.sound.words.filter((w) => w.syllables.flat().some((s) => s.kind === 'V'))
  const word: SoundWord | undefined =
    [...words].sort((a, b) => b.syllables.length - a.syllables.length)[0] ?? input.sound.words[0]
  // deviceNotes only asks for the notes of a phrase with words.
  if (!word) throw new Error('No words to beat out')
  const w = word.token.written
  const syllables = writtenSyllables(word)
  if (word.stress === null) {
    const shown = syllables.join('·')
    return {
      en: {
        title: `Beat by beat: «${w}»`,
        text: `Say it slowly, one beat at a time — ${shown} — then at full speed.`,
      },
      bg: {
        title: `Сричка по сричка: «${w}»`,
        text: `Кажете я бавно, сричка по сричка — ${shown}, — после с пълна скорост.`,
      },
      ru: {
        title: `По слогам: «${w}»`,
        text: `Скажите её медленно, по слогам — ${shown}, — затем в полном темпе.`,
      },
    }
  }
  const strong = syllables[word.stress] ?? ''
  const shown = syllables.map((s, i) => (i === word.stress ? s.toUpperCase() : s)).join('·')
  return {
    en: {
      title: `Tap out «${w}»`,
      text: `${shown}: one tap a beat, the strong one on «${strong}». Tap them out as you say it.`,
    },
    bg: {
      title: `Изтропайте «${w}»`,
      text: `${shown}: по едно почукване на сричка, силната е «${strong}». Почуквайте, докато я казвате.`,
    },
    ru: {
      title: `Отстучите «${w}»`,
      text: `${shown}: по удару на слог, ударный — «${strong}». Отстукивайте ритм, пока произносите.`,
    },
  }
}

export function memoryNote(input: MemoryInput): Say {
  return cognate(input) ?? link(input) ?? chunks(input) ?? beats(input)
}

/** A phrase too short for pieces, in a course whose syllables Loro can't split: echo the clip. */
function echo(input: Words): Say {
  const t = input.target.trim()
  return {
    en: {
      title: 'Echo the clip',
      text: `Play the clip and say «${t}» straight after it, in the same rhythm: three times with it, then once without.`,
    },
    bg: {
      title: 'Повтаряйте след записа',
      text: `Пуснете записа и кажете «${t}» веднага след него, в същия ритъм: три пъти със записа, после веднъж без него.`,
    },
    ru: {
      title: 'Повторяйте за записью',
      text: `Включите запись и скажите «${t}» сразу после неё, в том же ритме: три раза с записью, затем один раз без неё.`,
    },
  }
}

/** The memory hint for a course without sound rules: as memoryNote, but echoing the clip for beats. */
export function memoryNoteBySpelling(input: Words): Say {
  return cognate(input) ?? link(input) ?? chunks(input) ?? echo(input)
}
