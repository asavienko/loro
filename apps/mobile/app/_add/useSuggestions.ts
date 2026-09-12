import { useMemo, useState } from 'react'
import { foldSearchText, type BrowsableTheme, type PhraseState } from '@loro/core'
import {
  useLearningCatalog,
  type DisplayPhrase as CatalogPhrase,
} from '../../src/store/learningCatalog'
import { copy, themeLabel } from '../../src/lib/copy'
import type { AddMode } from './mode'

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
  /** After a confirmed add: anchor on that theme, so the next list is "more like it". */
  anchorOn: (theme: string) => void
  /** Confirmed custom add: clear the query without moving the association theme. */
  clearDiscoverQuery: () => void
}

/**
 * The suggestion algorithm, unchanged.
 *
 * Every branch, every order and both limits are the ones the screen shipped with: a drilled
 * theme wins, then a search over es/en/theme capped at 8, then a scenario's own arc, then
 * the association anchor's theme first and everything else after, capped at 6. It arguably
 * belongs in `@loro/core` (plans/60 wants to rank these) — moving it now would risk changing
 * the ORDER or the COUNT of what a learner sees, which is the one thing this refactor
 * promises not to do.
 */
export function useSuggestions(owned: readonly PhraseState[]): Suggestions {
  const { phrases: catalogPhrases, scenarios } = useLearningCatalog()
  const [mode, setModeState] = useState<AddMode>('discover')
  const [query, setQuery] = useState('')
  const [scenario, setScenario] = useState<string | null>(null)
  const [browseTheme, setBrowseTheme] = useState<BrowsableTheme | null>(null)
  // The association anchor: after adding, suggestions become "more like that".
  const [anchorTheme, setAnchorTheme] = useState<string | null>(null)
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
    if (anchorTheme !== null) {
      // Association: same-theme first, then everything else.
      const same = pool.filter((p) => p.theme === anchorTheme)
      const rest = pool.filter((p) => p.theme !== anchorTheme)
      return [...same, ...rest].slice(0, 6)
    }
    return pool.slice(0, 6)
  }, [mode, browseTheme, query, scenario, anchorTheme, pool, scenarios])
  const contextLabel =
    query.trim().length > 0
      ? phrases.length > 0
        ? copy.add.context.matches(query.trim())
        : copy.add.context.noMatches
      : scenario !== null
        ? copy.add.context.forScenario(scenarios.find((s) => s.id === scenario)?.label ?? '')
        : anchorTheme !== null
          ? copy.add.context.moreLike(themeLabel(anchorTheme))
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
      setAnchorTheme(null)
    },
    browse: setBrowseTheme,
    backToThemes: () => {
      setBrowseTheme(null)
    },
    countFor: (theme) => pool.filter((p) => p.theme === theme).length,
    totalFor: (theme) => catalogPhrases.filter((p) => p.theme === theme).length,
    anchorOn: (theme) => {
      setAnchorTheme(theme)
      setQuery('')
      setScenario(null)
    },
    clearDiscoverQuery: () => {
      setQuery('')
      setScenario(null)
    },
  }
}
