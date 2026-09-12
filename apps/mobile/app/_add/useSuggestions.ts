import { useMemo, useState } from 'react'
import {
  foldSearchText,
  type BrowsableTheme,
  type Difficulty,
  type PhraseState,
  type Tag,
} from '@loro/core'
import {
  useLearningCatalog,
  type DisplayPhrase as CatalogPhrase,
} from '../../src/store/learningCatalog'
import { copy, themeLabel } from '../../src/lib/copy'
import {
  catalogAssociationFlags,
  highestOwnedCefr,
  orderAssociatedIds,
  ownedCountsByTheme,
} from '../../src/lib/association'
import { useLocale } from '../../src/lib/i18n'
import type { AddMode } from './mode'

export interface AssociationAnchor {
  /** Catalog id, or empty when the added row has no graph node. */
  catalogId: string
  /** Learner-visible phrase text for the artifact context line. */
  phrase: string
  theme: string
  difficulty: Difficulty
  tags: readonly Tag[]
}

export interface Suggestions {
  mode: AddMode
  query: string
  scenario: string | null
  /**
   * The drilled theme, or `null` on the grid. Narrower than the `string` it was, because the
   * drilled header now looks its label up in `copy.add.themes` — which is keyed exhaustively by
   * `BrowsableTheme`, so the key set and the copy table cannot drift apart without a type error.
   */
  browseTheme: BrowsableTheme | null
  /** The rows to offer, in order. */
  phrases: readonly CatalogPhrase[]
  /** What the list is showing, in the learner's terms. */
  contextLabel: string
  /** Switching mode drops the theme drill-down and the query, as it always did. */
  setMode: (mode: AddMode) => void
  setQuery: (query: string) => void
  /** Tapping the active scenario clears it. */
  toggleScenario: (id: string) => void
  browse: (theme: BrowsableTheme) => void
  backToThemes: () => void
  /** How many of a theme's phrases the learner does not own yet — the pack's leftover. */
  countFor: (theme: string) => number
  /** How many catalog phrases the theme has — the pack's denominator. */
  totalFor: (theme: string) => number
  /** After a confirmed add: rank “more like that” inside the authored theme bands. */
  anchorOn: (anchor: AssociationAnchor) => void
  /** Confirmed custom add: clear the query without moving the association theme. */
  clearDiscoverQuery: () => void
}

function associate(
  pool: readonly CatalogPhrase[],
  catalog: readonly CatalogPhrase[],
  owned: readonly PhraseState[],
  edges: readonly { from: string; to: string; relation: string; weight: number }[],
  anchor: AssociationAnchor,
): CatalogPhrase[] {
  const byId = new Map(catalog.map((phrase, index) => [phrase.id, { phrase, index }]))
  const catalogAnchor = byId.get(anchor.catalogId)?.phrase
  const peakCefr = highestOwnedCefr(owned, catalog)
  const ownedInTheme = ownedCountsByTheme(owned, catalog)
  const ids = orderAssociatedIds({
    anchor: {
      id: anchor.catalogId,
      difficulty: anchor.difficulty,
      tags: [...anchor.tags],
      theme: anchor.theme,
      ...(catalogAnchor?.cefr === undefined ? {} : { cefr: catalogAnchor.cefr }),
      ...(catalogAnchor?.register === undefined ? {} : { register: catalogAnchor.register }),
    },
    candidates: pool.map((phrase) => {
      const index = byId.get(phrase.id)?.index ?? catalog.length
      const flags = catalogAssociationFlags(phrase)
      return {
        id: phrase.id,
        theme: phrase.theme,
        ...(phrase.cefr === undefined ? {} : { cefr: phrase.cefr }),
        ...(phrase.register === undefined ? {} : { register: phrase.register }),
        ...flags,
        catalogIndex: index,
        ownedInTheme: ownedInTheme.get(phrase.theme) ?? 0,
      }
    }),
    edges,
    ...(peakCefr === undefined ? {} : { highestOwnedCefr: peakCefr }),
  })
  const poolById = new Map(pool.map((phrase) => [phrase.id, phrase]))
  return ids.flatMap((id) => {
    const phrase = poolById.get(id)
    return phrase === undefined ? [] : [phrase]
  })
}

/**
 * Discover / Browse suggestion branches.
 *
 * Query, browse and scenario keep their existing order. Association ranks inside the
 * authored same-theme-first bands through Rust `assoc_order`.
 */
export function useSuggestions(owned: readonly PhraseState[]): Suggestions {
  useLocale()
  const { phrases: catalogPhrases, scenarios, graph } = useLearningCatalog()
  const [mode, setModeState] = useState<AddMode>('discover')
  const [query, setQuery] = useState('')
  const [scenario, setScenario] = useState<string | null>(null)
  const [browseTheme, setBrowseTheme] = useState<BrowsableTheme | null>(null)
  const [anchor, setAnchor] = useState<AssociationAnchor | null>(null)
  // Joined on the CATALOG id, not the row id. They happen to be equal today, but
  // they are different id spaces — a learner-authored phrase has a row id and no
  // catalog id — and `UserPhraseId`/`CatalogPhraseId` are branded so the join can't
  // drift silently. `Set<string>` because the catalog's own ids are unbranded.
  const ownedCatalogIds = useMemo(
    () => new Set<string>(owned.flatMap((p) => (p.phraseId === null ? [] : [p.phraseId]))),
    [owned],
  )
  const pool = useMemo(
    () => catalogPhrases.filter((p) => !ownedCatalogIds.has(p.id)),
    [ownedCatalogIds, catalogPhrases],
  )
  const phrases = useMemo(() => {
    if (mode === 'browse' && browseTheme !== null) {
      return pool.filter((p) => p.theme === browseTheme)
    }
    const q = foldSearchText(query.trim())
    if (q.length >= 1) {
      return pool
        .filter(
          (p) =>
            foldSearchText(p.targetText).includes(q) ||
            foldSearchText(p.translation).includes(q) ||
            foldSearchText(themeLabel(p.theme)).includes(q),
        )
        .slice(0, 8)
    }
    if (scenario !== null) {
      const sc = scenarios.find((s) => s.id === scenario)
      return (sc?.phrases ?? [])
        .map((id) => pool.find((p) => p.id === id))
        .filter((p): p is CatalogPhrase => p !== undefined)
    }
    if (anchor !== null) {
      return associate(pool, catalogPhrases, owned, graph.edges, anchor)
    }
    return pool.slice(0, 6)
  }, [mode, browseTheme, query, scenario, anchor, pool, scenarios, catalogPhrases, owned, graph])
  const contextLabel =
    query.trim().length > 0
      ? phrases.length > 0
        ? copy.add.context.matches(query.trim())
        : copy.add.context.noMatches
      : scenario !== null
        ? copy.add.context.forScenario(scenarios.find((s) => s.id === scenario)?.label ?? '')
        : anchor !== null
          ? copy.add.context.moreLike(anchor.phrase)
          : copy.add.context.popular
  return {
    mode,
    query,
    scenario,
    browseTheme,
    phrases,
    contextLabel,
    setMode: (next) => {
      setModeState(next)
      setBrowseTheme(null)
      setQuery('')
    },
    setQuery,
    toggleScenario: (id) => {
      setScenario((cur) => (cur === id ? null : id))
      setQuery('')
      setAnchor(null)
    },
    browse: setBrowseTheme,
    backToThemes: () => {
      setBrowseTheme(null)
    },
    countFor: (theme) => pool.filter((p) => p.theme === theme).length,
    totalFor: (theme) => catalogPhrases.filter((p) => p.theme === theme).length,
    anchorOn: (next) => {
      setAnchor(next)
      setQuery('')
      setScenario(null)
    },
    clearDiscoverQuery: () => {
      setQuery('')
      setScenario(null)
    },
  }
}
