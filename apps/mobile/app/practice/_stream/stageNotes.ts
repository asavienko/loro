/** Real catalog / learner fields for the focused stage pills. Invents nothing. */

export type StagePane = 'mnemonic' | 'grammar' | 'phonetics'

export function nonempty(value: string | null | undefined): string | undefined {
  return value !== undefined && value !== null && value.length > 0 ? value : undefined
}

export function stageNoteFields(phrase: {
  note: string | null
  catalog: {
    hint?: string
    note?: string
    resp?: string
    respIpa?: string
  } | null
}): {
  mnemonic: string | undefined
  grammar: string | undefined
  phonetics: string | undefined
} {
  return {
    mnemonic: nonempty(phrase.catalog?.hint),
    grammar: nonempty(phrase.catalog?.note) ?? nonempty(phrase.note),
    phonetics: nonempty(phrase.catalog?.resp) ?? nonempty(phrase.catalog?.respIpa),
  }
}
