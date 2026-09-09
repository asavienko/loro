import { useState } from 'react'
import type { Difficulty, PhraseHandoff, PhraseHandoffSource, Tag, Theme } from '@loro/core'
import type { DisplayPhrase as CatalogPhrase } from '../../src/store/learningCatalog'

export type SheetPhrase =
  | { kind: 'catalog'; phrase: CatalogPhrase }
  | {
      kind: 'own'
      source: PhraseHandoffSource
      targetText: string
      translation: string
      theme?: Theme
      emoji?: string
    }

/** What the learner is about to add: a catalog row or an own-phrase handoff. */
export interface AddDraft {
  phrase: SheetPhrase | null
  difficulty: Difficulty
  tags: Tag[]
  openCatalog: (phrase: CatalogPhrase) => void
  openHandoff: (handoff: PhraseHandoff) => void
  setOwnField: (field: 'targetText' | 'translation', value: string) => void
  /** Dismiss clears tagging so a later row does not inherit abandoned difficulty or tags. */
  close: () => void
  setDifficulty: (difficulty: Difficulty) => void
  toggleTag: (tag: Tag) => void
  /** After a confirmed add: the sheet closes and the draft returns to its defaults. */
  reset: () => void
}

export function useAddDraft(): AddDraft {
  const [phrase, setPhrase] = useState<SheetPhrase | null>(null)
  const [difficulty, setDifficulty] = useState<Difficulty>('med')
  const [tags, setTags] = useState<Tag[]>([])
  return {
    phrase,
    difficulty,
    tags,
    openCatalog: (next) => {
      setPhrase({ kind: 'catalog', phrase: next })
      setDifficulty('med')
      setTags([])
    },
    openHandoff: (handoff) => {
      setPhrase({
        kind: 'own',
        source: handoff.source,
        targetText: handoff.draft.targetText,
        translation: handoff.draft.translation,
        ...(handoff.draft.theme === undefined ? {} : { theme: handoff.draft.theme }),
        ...(handoff.draft.emoji === undefined ? {} : { emoji: handoff.draft.emoji }),
      })
      setDifficulty('med')
      setTags([])
    },
    setOwnField: (field, value) => {
      setPhrase((cur) => (cur?.kind === 'own' ? { ...cur, [field]: value } : cur))
    },
    close: () => {
      setPhrase(null)
      setDifficulty('med')
      setTags([])
    },
    setDifficulty,
    toggleTag: (tag) => {
      setTags((cur) => (cur.includes(tag) ? cur.filter((x) => x !== tag) : [...cur, tag]))
    },
    reset: () => {
      setPhrase(null)
      setDifficulty('med')
      setTags([])
    },
  }
}
