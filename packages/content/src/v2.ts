/**
 * The v2.0 app's pre-generated content (plan 106): Loro's phrase sets, their phrases and notes, the
 * topics, the phrase bank that answers "Make a set" when no writer is configured, and the languages
 * the app offers. The API seeds these into PostgreSQL and serves them; the app no longer bundles
 * them (its copy of the languages goes in plan 108's app half). The shapes are the app's
 * (`apps/mobile/src/shared/content/schema.ts`), whose tests validate these files.
 */
import phrasesJson from '../v2/phrases.json' with { type: 'json' }
import setsJson from '../v2/sets.json' with { type: 'json' }
import topicsJson from '../v2/topics.json' with { type: 'json' }
import noteTranslationsJson from '../v2/note-translations.json' with { type: 'json' }
import bankJson from '../v2/bank.json' with { type: 'json' }
import bankNoteTranslationsJson from '../v2/bank-note-translations.json' with { type: 'json' }
import metaJson from '../v2/meta.json' with { type: 'json' }
import iconsJson from '../v2/icons.json' with { type: 'json' }
import languagesJson from '../v2/languages.json' with { type: 'json' }
import coursesJson from '../v2/courses.compiled.json' with { type: 'json' }
import type { V2WrittenContent } from './courses.js'

export type { V2WrittenContent, V2WrittenPhrase, V2WrittenSet } from './courses.js'

export type V2Language = 'en-GB' | 'en-US' | 'es-ES' | 'bg-BG' | 'ru-RU' | 'pl-PL' | 'cs-CZ'
export interface V2Localized {
  en: string
  bg: string
  ru: string
  pl: string
  cs: string
}
export interface V2Note {
  title: string
  text: string
}
export interface V2Notes {
  mnemonic: V2Note
  grammar: V2Note
  pronunciation: V2Note & { ipa: string; respelling: string }
}
export interface V2Phrase {
  id: string
  target: string
  translations: Partial<Record<V2Language, string>>
  register: 'formal' | 'informal' | 'neutral'
  region: string
  tags: string[]
  image: string[]
  words: Record<string, Partial<Record<V2Language, string>>>
  notes: V2Notes
  audio?: Partial<Record<V2Language, string>>
  durationMs?: Partial<Record<V2Language, number>>
}
export interface V2Set {
  id: string
  title: string
  subtitle: V2Localized
  topicId: string
  level: 'A1' | 'A2' | 'B1'
  coverIcon: string
  targetLang: V2Language
  phraseIds: string[]
}
export interface V2Topic {
  id: string
  title: V2Localized
  icon: string
  tone: 'primary' | 'secondary' | 'tertiary'
}
export interface V2BankTheme {
  id: string
  title: V2Localized
  keywords: string[]
}
export interface V2BankPhrase {
  id: string
  theme: string
  targetLang: V2Language
  target: string
  translations: Partial<Record<V2Language, string>>
  image: string[]
  notes: V2Notes
}
/** "<phraseId>.<note kind>" → the note's title and text per native language. */
export type V2NoteTranslations = Record<string, Partial<Record<V2Language, V2Note>>>

export interface V2Content {
  version: string
  phrases: V2Phrase[]
  sets: V2Set[]
  topics: V2Topic[]
  noteTranslations: V2NoteTranslations
  bank: { themes: V2BankTheme[]; phrases: V2BankPhrase[] }
  bankNoteTranslations: V2NoteTranslations
  /**
   * The course writer's sets (plan 112), compiled from `v2/courses/` by `build:courses`: only those
   * complete in every interface language, without notes (the seed writes them by Loro's rules) and
   * without songs in Loro's albums.
   */
  written: V2WrittenContent
}

/** The files' inferred types are wider (plain strings); the app's content tests prove the narrow ones. */
export const V2_CONTENT: V2Content = {
  // The writer's batches change the content without a hand-edited version: their hash is part of it.
  version: `${metaJson.version}+${coursesJson.version}`,
  phrases: phrasesJson as unknown as V2Phrase[],
  sets: setsJson as unknown as V2Set[],
  topics: topicsJson as unknown as V2Topic[],
  noteTranslations: noteTranslationsJson,
  bank: bankJson as unknown as V2Content['bank'],
  bankNoteTranslations: bankNoteTranslationsJson,
  written: coursesJson as unknown as V2WrittenContent,
}

/** A language the app offers (plan 108); the API serves the list at `GET /v1/library/languages`. */
export interface V2LanguageInfo {
  code: V2Language
  flag: string
  /** The app's interface language for a learner who speaks it; null when the app can't speak it. */
  uiLocale: 'en' | 'bg' | 'ru' | 'pl' | 'cs' | null
  /** Whether a course teaches it. */
  canTarget: boolean
}

export const V2_LANGUAGES: readonly V2LanguageInfo[] = languagesJson as V2LanguageInfo[]

/** The languages a course can teach, and the native languages the app speaks. */
export const V2_COURSES: readonly V2Language[] = V2_LANGUAGES.filter((l) => l.canTarget).map(
  (l) => l.code,
)
export const V2_NATIVES: readonly V2Language[] = V2_LANGUAGES.filter(
  (l) => l.uiLocale !== null,
).map((l) => l.code)

/**
 * Every icon the app can draw (the app's `ICON_NAMES`; its tests keep the two equal), so a writer
 * only ever chooses a picture the app has.
 */
export const V2_ICON_NAMES: readonly string[] = iconsJson
