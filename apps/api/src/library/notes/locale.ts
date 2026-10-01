// The languages notes are written in: the UI's (plan 105). A note's English version is its main
// text; the others sit beside it by language code, as the course's note translations do.
import type { LanguageCode } from './content.js'

export type NoteLocale = 'en' | 'bg' | 'ru' | 'pl' | 'cs'

export interface NoteText {
  title: string
  text: string
}

/** Each note language and the native language whose learners read it. */
export const NOTE_LANGUAGES: { locale: NoteLocale; code: LanguageCode }[] = [
  { locale: 'en', code: 'en-GB' },
  { locale: 'bg', code: 'bg-BG' },
  { locale: 'ru', code: 'ru-RU' },
  { locale: 'pl', code: 'pl-PL' },
  { locale: 'cs', code: 'cs-CZ' },
]

/** «a», «b» and «c» in the note's language. */
export function list(items: string[], locale: NoteLocale): string {
  const quoted = items.map((item) => `«${item}»`)
  if (quoted.length <= 1) return quoted.join('')
  const and = locale === 'en' ? 'and' : locale === 'pl' ? 'i' : locale === 'cs' ? 'a' : 'и'
  return `${quoted.slice(0, -1).join(', ')} ${and} ${quoted[quoted.length - 1] ?? ''}`
}
