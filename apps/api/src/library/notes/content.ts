// What the note rules learn from (plan 108): Loro's phrases and the phrase bank, each with its
// course. On the server the content is the seed's and never changes while the process runs.
import { V2_CONTENT, type V2Language, type V2Notes } from '@loro/content/v2'

export type LanguageCode = V2Language
export type PhraseNotes = V2Notes

export interface KnownPhrase {
  id: string
  targetLang: LanguageCode
  target: string
  translations: Partial<Record<LanguageCode, string>>
  image: readonly string[]
  notes: PhraseNotes
}

const courseOf = new Map(
  V2_CONTENT.sets.flatMap((set) => set.phraseIds.map((id) => [id, set.targetLang] as const)),
)

/** Every phrase of Loro's courses and of the bank, the courses' first. */
export const KNOWN_PHRASES: readonly KnownPhrase[] = [
  ...V2_CONTENT.phrases.flatMap((p) => {
    const targetLang = courseOf.get(p.id)
    return targetLang ? [{ ...p, targetLang }] : []
  }),
  ...V2_CONTENT.bank.phrases,
]
