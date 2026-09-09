import { useState } from 'react'
import type { Difficulty, Tag } from '@loro/core'
import type { DisplayPhrase as CatalogPhrase } from '../../src/store/learningCatalog'

/** What the learner is about to add: the phrase the sheet is open on, and its draft rating. */
export interface AddDraft {
  phrase: CatalogPhrase | null
  difficulty: Difficulty
  tags: Tag[]
  open: (phrase: CatalogPhrase) => void
  /**
   * Dismiss WITHOUT clearing the draft — reopening the sheet keeps what was picked, which is
   * what the hand-rolled version did. Only a confirmed add resets it.
   */
  close: () => void
  setDifficulty: (difficulty: Difficulty) => void
  toggleTag: (tag: Tag) => void
  /** After a confirmed add: the sheet closes and the draft returns to its defaults. */
  reset: () => void
}

export function useAddDraft(): AddDraft {
  const [phrase, setPhrase] = useState<CatalogPhrase | null>(null)
  const [difficulty, setDifficulty] = useState<Difficulty>('med')
  const [tags, setTags] = useState<Tag[]>([])
  return {
    phrase,
    difficulty,
    tags,
    open: setPhrase,
    close: () => {
      setPhrase(null)
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
