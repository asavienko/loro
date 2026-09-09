import { useEffect, useMemo, useRef, useState } from 'react'
import {
  canonicalPhraseText,
  containsPromptInjection,
  filterNewCandidates,
  isExactLibraryMatch,
  matchNearestScenario,
  shouldOfferOwnPhrase,
  shouldRequestSuggestions,
  type NativeLanguage,
  type PhraseCandidate,
  type PhraseState,
  type TargetLocale,
} from '@loro/core'
import {
  bundledTopicSuggestions,
  type DisplayPhrase as CatalogPhrase,
} from '../../src/store/learningCatalog'
import { ownedPhraseLines, ownedTargetTexts } from './ownedPhrases'
import type { AddMode } from './mode'

const SUGGEST_DEBOUNCE_MS = 280

export function useDiscoverReach(
  mode: AddMode,
  query: string,
  catalogHits: readonly CatalogPhrase[],
  catalog: readonly CatalogPhrase[],
  owned: readonly PhraseState[],
  scenarios: readonly { id: string; label: string; emoji: string }[],
  nativeLanguage: NativeLanguage,
  targetLocale: TargetLocale,
): {
  offerOwn: boolean
  nearest: { id: string; label: string; emoji: string } | null
  generating: boolean
  suggested: readonly PhraseCandidate[]
} {
  const nearest = mode === 'discover' ? matchNearestScenario(query, scenarios) : null
  const existingTexts = useMemo(
    () => [...ownedTargetTexts(owned, catalog), ...catalog.map((phrase) => phrase.targetText)],
    [owned, catalog],
  )
  const exact = useMemo(
    () =>
      isExactLibraryMatch(query, catalog) ||
      isExactLibraryMatch(query, ownedPhraseLines(owned, catalog)),
    [query, catalog, owned],
  )
  const offerOwn = mode === 'discover' && shouldOfferOwnPhrase(query, exact)
  const wantSuggest =
    mode === 'discover' && shouldRequestSuggestions(query, catalogHits.length, exact)
  const requestKey = `${nativeLanguage}:${targetLocale}:${canonicalPhraseText(query)}`
  const [generating, setGenerating] = useState(false)
  const [suggested, setSuggested] = useState<{ key: string; rows: PhraseCandidate[] }>({
    key: '',
    rows: [],
  })
  const seq = useRef(0)
  useEffect(() => {
    const id = ++seq.current
    if (!wantSuggest) {
      setGenerating(false)
      setSuggested({ key: '', rows: [] })
      return
    }
    setGenerating(true)
    const handle = setTimeout(() => {
      if (id !== seq.current) return
      const rows = containsPromptInjection(query)
        ? []
        : filterNewCandidates(
            bundledTopicSuggestions(query, nativeLanguage, targetLocale),
            existingTexts,
          )
      if (id !== seq.current) return
      setSuggested({ key: requestKey, rows })
      setGenerating(false)
    }, SUGGEST_DEBOUNCE_MS)
    return () => {
      clearTimeout(handle)
    }
  }, [wantSuggest, query, nativeLanguage, targetLocale, existingTexts, requestKey])
  const visibleSuggested = wantSuggest && suggested.key === requestKey ? suggested.rows : []
  return {
    offerOwn,
    nearest,
    generating: wantSuggest && (generating || suggested.key !== requestKey),
    suggested: visibleSuggested,
  }
}
