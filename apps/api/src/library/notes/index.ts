// Notes worked out on the device (plan 105), for a phrase the learner typed that neither the phrase
// bank nor the AI writer has notes for, so that every phrase has its picture, its sounds, a memory
// hint and a grammar rule. Each is derived from the phrase itself by written rules — its spelling,
// its constructions, its words — and none is invented: where Loro doesn't know something (a
// Bulgarian word's stress) the note says so rather than guessing.
import type { V2Note } from '@loro/content/v2'
import type { LanguageCode, PhraseNotes } from './content.js'
import { transcribeBulgarian } from './bg.js'
import { transcribeSpanish } from './es.js'
import { BULGARIAN_GRAMMAR, type GrammarRule, SPANISH_GRAMMAR } from './grammar.js'
import { NOTE_LANGUAGES, type NoteLocale, type NoteText } from './locale.js'
import { memoryNote } from './memory.js'
import { pictureFor } from './picture.js'
import { pronunciationNote } from './pronunciation.js'

/** A note's other languages, by note kind, then by native language. */
export type NoteTranslations = Partial<
  Record<keyof PhraseNotes, Partial<Record<LanguageCode, V2Note>>>
>

export interface DeviceNotesInput {
  target: string
  native: string
  targetLang: LanguageCode
  nativeLang: LanguageCode
}

export interface DeviceNotes {
  image: string[]
  notes: PhraseNotes
  noteTranslations: NoteTranslations
}

/** The course languages the device has sound rules for. */
export const DEVICE_NOTE_LANGUAGES: readonly LanguageCode[] = ['es-ES', 'bg-BG']

function grammarNote(rules: GrammarRule[], text: string): Partial<Record<NoteLocale, NoteText>> {
  for (const rule of rules) {
    const found = rule.find(text)
    if (found === null) continue
    return Object.fromEntries(Object.entries(rule.say).map(([locale, say]) => [locale, say(found)]))
  }
  return {}
}

/**
 * Notes for a text with nothing to say aloud. The store refuses such a phrase (limits.sayable), so
 * this is only a floor under a state that shouldn't arise: it still has every note, and says why.
 */
function silent(input: DeviceNotesInput): DeviceNotes {
  const note = {
    title: 'Nothing to say aloud',
    text: 'This phrase has no letters or digits, so it has no sounds, and nothing for a rule or a hint to hold on to.',
  }
  return {
    image: pictureFor(input.target, input.native),
    notes: {
      mnemonic: note,
      grammar: note,
      pronunciation: { ...note, ipa: '[ ]', respelling: '—' },
    },
    noteTranslations: {},
  }
}

function compose(input: DeviceNotesInput): DeviceNotes {
  const spanish = input.targetLang === 'es-ES'
  const sound = spanish ? transcribeSpanish(input.target) : transcribeBulgarian(input.target)
  if (sound.words.length === 0) return silent(input)
  const lang = spanish ? 'es-ES' : 'bg-BG'
  const byKind = {
    mnemonic: memoryNote({ ...input, sound }) as Partial<Record<NoteLocale, NoteText>>,
    grammar: grammarNote(spanish ? SPANISH_GRAMMAR : BULGARIAN_GRAMMAR, input.target),
    pronunciation: pronunciationNote(lang, sound),
  }
  const en = (kind: keyof typeof byKind): NoteText => {
    const note = byKind[kind].en
    // Every rule list ends in one that always applies, and every rule speaks English.
    if (!note) throw new Error(`No English ${kind} note`)
    return note
  }
  const notes: PhraseNotes = {
    mnemonic: en('mnemonic'),
    grammar: en('grammar'),
    pronunciation: { ...en('pronunciation'), ipa: sound.ipa, respelling: sound.respelling },
  }
  // The other note languages, never the phrase's own (a Bulgarian speaker doesn't learn Bulgarian).
  const noteTranslations: NoteTranslations = {}
  for (const kind of Object.keys(byKind) as (keyof typeof byKind)[]) {
    noteTranslations[kind] = Object.fromEntries(
      NOTE_LANGUAGES.flatMap((l) => {
        const note = byKind[kind][l.locale]
        return l.locale !== 'en' && l.code !== input.targetLang && note ? [[l.code, note]] : []
      }),
    )
  }
  return { image: pictureFor(input.target, input.native), notes, noteTranslations }
}

const cache = new Map<string, DeviceNotes>()
const CACHE_LIMIT = 500

/** The phrase's notes and picture, worked out once per text and meaning. */
export function deviceNotes(input: DeviceNotesInput): DeviceNotes {
  const key = [input.targetLang, input.nativeLang, input.target, input.native].join('\u0000')
  const hit = cache.get(key)
  if (hit) return hit
  const made = compose(input)
  const oldest = cache.keys().next()
  if (cache.size >= CACHE_LIMIT && !oldest.done) cache.delete(oldest.value)
  cache.set(key, made)
  return made
}
