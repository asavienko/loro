import { useLocale } from '../src/lib/i18n'
/**
 * Add phrases — Loro.dc.html:222–427, logic 2176–2433.
 *
 * Discover (search + association + scenarios) and Browse (by theme). The tagging
 * sheet is where the connective thread starts: difficulty + "what's tricky", set at
 * add time, reshape everything downstream.
 *
 * The screen is a composition of four named pieces — `AddHeader` over either `ThemeGrid`
 * or `SuggestionList`, with `TaggingSheet` above both — driven by two hooks:
 * `useSuggestions` holds what the learner is LOOKING AT, `useAddDraft` holds what they are
 * ABOUT TO ADD. Splitting the state that way is what let the render collapse: the sheet no
 * longer reads the search box's state, and the list no longer reads the draft's.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { ScrollView, StyleSheet, TextInput, View } from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import { File as ExpoFile } from 'expo-file-system'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  BROWSABLE_THEMES,
  foldSearchText,
  MAX_OWN_PHRASE_TEXT_CODE_UNITS,
  TAGS,
  candidateIsAddable,
  canonicalPhraseText,
  containsPromptInjection,
  filterNewCandidates,
  isExactLibraryMatch,
  matchNearestScenario,
  phraseHandoff,
  shouldOfferOwnPhrase,
  shouldRequestSuggestions,
  typedOwnPhraseHandoff,
  type BrowsableTheme,
  type Difficulty,
  type NativeLanguage,
  type PhraseCandidate,
  type PhraseHandoff,
  type PhraseHandoffSource,
  type PhraseState,
  type Tag,
  type TargetLocale,
  type Theme,
} from '@loro/core'
import {
  bundledTopicSuggestions,
  useLearningCatalog,
  type DisplayPhrase as CatalogPhrase,
} from '../src/store/learningCatalog'
import { OWN_PHRASE_FALLBACK } from '../src/store/phraseFactory'
import {
  Button,
  Card,
  Chip,
  EmojiTile,
  Grid,
  Pressable,
  Row,
  Screen,
  SectionHeader,
  SectionLabel,
  Segmented,
  Sheet,
  Stack,
  Text,
  type SegmentedOption,
} from '../src/ui/primitives'
import { DifficultySelector, PhraseRow, TagChips } from '../src/ui/components'
import { accent, border, ink, line, radius, semantic, space, surface } from '../src/ui/theme'
import { copy, themeLabel } from '../src/lib/copy'
import { useApp } from '../src/store'
import {
  importedPhraseKey,
  importInputForCandidates,
  isImportTooLarge,
  isReviewedImportTooLarge,
  IMPORT_MAX_CHARACTERS,
  IMPORT_MAX_ROWS,
  normalizeImportedText,
  parseImportedPhrases,
  reviewImportedCandidates,
  unsavedImportCandidates,
  type ImportCandidate,
} from '../src/lib/importPhrases'
import {
  IMPORT_MAX_FILE_BYTES,
  decodeImportFile,
  type ImportFileError,
} from '../src/lib/importFile'
import { importDraftKey, type ImportDrafts } from '../src/lib/importDraft'
import { readBoundedImportFile } from '../src/lib/readBoundedImportFile'
/**
 * The themes Browse offers.
 *
 * Core owns the browsable key set (excluding learner-originated synthetic themes), while
 * `copy.add.themes` exhaustively maps those keys to their presentation.
 */
// a11y-lang: English UI category labels. "Café" is the English loanword, and a screen
// reader should read this list in the interface language, not Spanish.
const THEMES = BROWSABLE_THEMES
type Mode = 'discover' | 'browse' | 'import'
/** The discover / browse switch. The ids are state; only their labels are copy. */
const MODES: readonly SegmentedOption<Mode>[] = [
  { value: 'discover', label: copy.add.modes.discover },
  { value: 'browse', label: copy.add.modes.browse },
  { value: 'import', label: copy.add.modes.import },
]
/**
 * Diacritic-insensitive fold, so "alergico" finds "alérgico" (`e2e/add.spec.ts:9`).
 *
 * Case-folding remains search behavior; the shared helper owns only diacritic folding.
 */
const norm = foldSearchText
/**
 * The three numbers this screen passes as PROPS, where a `StyleSheet` cannot hold them.
 *
 * Same rule as the styles below: each is transcribed from the markup it replaced, and none
 * is a design token, because none has a second call site anywhere in the app —
 * `src/ui/tokens/sizing.ts`: a token used once is not a token.
 */
const metrics = {
  /** The browse grid: two tiles to a row, at a gap one wider than `grid.gap`. */
  themeGrid: 9,
  /** The browse tile's emoji square. */
  themeEmoji: 40,
  /** The sheet's question → its control. */
  sheetGroup: 9,
  /** The sheet's phrase card: emoji tile → the two lines. */
  sheetPhrase: 11,
  /** `‹ Themes` → the drilled theme's title, per the authored header (`Loro.dc.html:304`). */
  drilledTitle: 8,
  /** Debounce before bundled Discover garnish so typing never blocks the keyboard. */
  suggestDebounce: 280,
} as const
// ─── State ───────────────────────────────────────────────────────────────────
/** What the learner is looking at: the mode, the filters, and the list they produce. */
interface Suggestions {
  mode: Mode
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
  setMode: (mode: Mode) => void
  setQuery: (query: string) => void
  /** Tapping the active scenario clears it. */
  toggleScenario: (id: string) => void
  browse: (theme: BrowsableTheme) => void
  backToThemes: () => void
  /** How many of a theme's phrases the learner does not own yet — the tile's count. */
  countFor: (theme: string) => number
  /** After a confirmed add: anchor on that theme, so the next list is "more like it". */
  anchorOn: (theme: string) => void
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
function useSuggestions(owned: readonly PhraseState[]): Suggestions {
  const { phrases: catalogPhrases, scenarios } = useLearningCatalog()
  const [mode, setModeState] = useState<Mode>('discover')
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
    const q = norm(query.trim())
    if (q.length >= 1) {
      return pool
        .filter(
          (p) =>
            norm(p.targetText).includes(q) ||
            norm(p.translation).includes(q) ||
            norm(themeLabel(p.theme)).includes(q),
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
    anchorOn: (theme) => {
      setAnchorTheme(theme)
      setQuery('')
      setScenario(null)
    },
  }
}
/** What the learner is about to add: a catalog row or an own-phrase handoff. */
type SheetPhrase =
  | { kind: 'catalog'; phrase: CatalogPhrase }
  | {
      kind: 'own'
      source: PhraseHandoffSource
      targetText: string
      translation: string
      theme?: Theme
      emoji?: string
    }
interface AddDraft {
  phrase: SheetPhrase | null
  difficulty: Difficulty
  tags: Tag[]
  openCatalog: (phrase: CatalogPhrase) => void
  openHandoff: (handoff: PhraseHandoff) => void
  setOwnField: (field: 'targetText' | 'translation', value: string) => void
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
function useAddDraft(): AddDraft {
  const [phrase, setPhrase] = useState<SheetPhrase | null>(null)
  const [difficulty, setDifficulty] = useState<Difficulty>('med')
  const [tags, setTags] = useState<Tag[]>([])
  return {
    phrase,
    difficulty,
    tags,
    openCatalog: (next) => {
      setPhrase({ kind: 'catalog', phrase: next })
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
    },
    setOwnField: (field, value) => {
      setPhrase((cur) => (cur?.kind === 'own' ? { ...cur, [field]: value } : cur))
    },
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

function ownedTargetTexts(
  owned: readonly PhraseState[],
  catalog: readonly CatalogPhrase[],
): string[] {
  const catalogById = new Map(catalog.map((phrase) => [phrase.id, phrase.targetText]))
  const texts: string[] = []
  for (const row of owned) {
    if (row.phraseId === null) {
      if (row.ownEs !== undefined && row.ownEs.length > 0) texts.push(row.ownEs)
      continue
    }
    const target = catalogById.get(row.phraseId)
    if (target !== undefined) texts.push(target)
  }
  return texts
}

function useDiscoverReach(
  mode: Mode,
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
  const exact = useMemo(() => isExactLibraryMatch(query, catalog), [query, catalog])
  const offerOwn = mode === 'discover' && shouldOfferOwnPhrase(query, exact)
  const nearest = mode === 'discover' ? matchNearestScenario(query, scenarios) : null
  const wantSuggest =
    mode === 'discover' && shouldRequestSuggestions(query, catalogHits.length, exact)
  const existingTexts = useMemo(
    () => [...ownedTargetTexts(owned, catalog), ...catalog.map((phrase) => phrase.targetText)],
    [owned, catalog],
  )
  const [generating, setGenerating] = useState(false)
  const [suggested, setSuggested] = useState<PhraseCandidate[]>([])
  const seq = useRef(0)
  useEffect(() => {
    const id = ++seq.current
    if (!wantSuggest) {
      setGenerating(false)
      setSuggested([])
      return
    }
    setGenerating(true)
    setSuggested([])
    const handle = setTimeout(() => {
      if (id !== seq.current) return
      const rows = containsPromptInjection(query)
        ? []
        : filterNewCandidates(
            bundledTopicSuggestions(query, nativeLanguage, targetLocale),
            existingTexts,
          )
      if (id !== seq.current) return
      setSuggested(rows)
      setGenerating(false)
    }, metrics.suggestDebounce)
    return () => {
      clearTimeout(handle)
    }
  }, [wantSuggest, query, nativeLanguage, targetLocale, existingTexts])
  return { offerOwn, nearest, generating, suggested }
}
// ─── The screen ──────────────────────────────────────────────────────────────
export default function Add() {
  useLocale()
  const insets = useSafeAreaInsets()
  const owned = useApp((s) => s.phrases)
  const addPhrase = useApp((s) => s.addPhrase)
  const addOwnPhrase = useApp((s) => s.addOwnPhrase)
  const importDrafts = useApp((s) => s.importDrafts)
  const saveImportDraft = useApp((s) => s.saveImportDraft)
  const clearImportDraft = useApp((s) => s.clearImportDraft)
  const targetLocale = useApp((s) => s.targetLocale)
  const nativeLanguage = useApp((s) => s.nativeLanguage)
  const { phrases: catalogPhrases, scenarios } = useLearningCatalog()
  const list = useSuggestions(owned)
  const draft = useAddDraft()
  const reach = useDiscoverReach(
    list.mode,
    list.query,
    list.phrases,
    catalogPhrases,
    owned,
    scenarios,
    nativeLanguage,
    targetLocale,
  )
  const confirmAdd = (): void => {
    const sheet = draft.phrase
    if (sheet === null) return
    if (sheet.kind === 'catalog') {
      addPhrase(sheet.phrase.id, {
        difficulty: draft.difficulty,
        tags: draft.tags,
        source: 'discover',
      })
      list.anchorOn(sheet.phrase.theme)
      draft.reset()
      return
    }
    if (!candidateIsAddable(sheet)) return
    addOwnPhrase(
      {
        targetText: sheet.targetText,
        translation: sheet.translation,
        ...(sheet.theme === undefined ? {} : { theme: sheet.theme }),
        ...(sheet.emoji === undefined ? {} : { emoji: sheet.emoji }),
      },
      { difficulty: draft.difficulty, tags: draft.tags, source: sheet.source },
    )
    if (sheet.source !== 'custom' && sheet.theme !== undefined) list.anchorOn(sheet.theme)
    draft.reset()
  }
  const showCatalogEmpty =
    list.phrases.length === 0 &&
    (list.browseTheme !== null ||
      !(
        list.mode === 'discover' &&
        (reach.offerOwn || reach.generating || reach.suggested.length > 0)
      ))
  return (
    <Screen>
      <AddHeader
        ownedCount={owned.length}
        mode={list.mode}
        onModeChange={list.setMode}
        query={list.query}
        onQueryChange={list.setQuery}
        scenario={list.scenario}
        onScenarioToggle={list.toggleScenario}
      />

      <ScrollView contentContainerStyle={[s.body, { paddingBottom: insets.bottom + space['5'] }]}>
        {list.mode === 'import' ? (
          <ImportPhrases
            key={importDraftKey({ targetLocale, nativeLanguage })}
            owned={owned}
            addOwnPhrase={addOwnPhrase}
            importDrafts={importDrafts}
            targetLocale={targetLocale}
            nativeLanguage={nativeLanguage}
            saveImportDraft={saveImportDraft}
            clearImportDraft={clearImportDraft}
          />
        ) : list.mode === 'browse' && list.browseTheme === null ? (
          <ThemeGrid countFor={list.countFor} onSelect={list.browse} />
        ) : (
          <>
            <Row justify="space-between" align="center" gap={metrics.drilledTitle}>
              {list.browseTheme === null ? (
                <SectionLabel>{list.contextLabel}</SectionLabel>
              ) : (
                <>
                  <ThemesBackLink onPress={list.backToThemes} />
                  {/* The authored drilled header names the theme and how much of it is left
                      (`Loro.dc.html:306`). Without it the list was anonymous: the tile said
                      "Dining, 4 to add" and the screen it opened said neither. */}
                  <Text variant="caption" color={ink.ink} numberOfLines={1} style={s.grow}>
                    {copy.add.browseTitle(
                      copy.add.themes[list.browseTheme].label,
                      list.phrases.length,
                    )}
                  </Text>
                </>
              )}
            </Row>

            {list.mode === 'discover' && reach.nearest !== null ? (
              <NearestScenarioHint
                scenario={reach.nearest}
                selected={list.scenario === reach.nearest.id}
                onToggle={list.toggleScenario}
              />
            ) : null}

            {list.phrases.length > 0 || showCatalogEmpty ? (
              <SuggestionList
                phrases={list.phrases}
                drilledTheme={list.browseTheme !== null}
                onSelect={draft.openCatalog}
              />
            ) : null}

            {list.mode === 'discover' && reach.generating ? (
              <View accessibilityLiveRegion="polite">
                <Text variant="caption" color={ink.muted}>
                  {copy.add.suggested.looking}
                </Text>
              </View>
            ) : null}

            {list.mode === 'discover' && !reach.generating && reach.suggested.length > 0 ? (
              <SuggestedList
                candidates={reach.suggested}
                onSelect={(candidate) => {
                  draft.openHandoff(phraseHandoff(candidate))
                }}
              />
            ) : null}

            {list.mode === 'discover' && reach.offerOwn ? (
              <OwnPhraseRow
                query={list.query.trim()}
                onPress={() => {
                  draft.openHandoff(typedOwnPhraseHandoff(list.query))
                }}
              />
            ) : null}
          </>
        )}
      </ScrollView>

      <TaggingSheet
        phrase={draft.phrase}
        difficulty={draft.difficulty}
        tags={draft.tags}
        onDifficultyChange={draft.setDifficulty}
        onToggleTag={draft.toggleTag}
        onOwnFieldChange={draft.setOwnField}
        onDismiss={draft.close}
        onConfirm={confirmAdd}
      />
    </Screen>
  )
}
/** The stream count, the mode switch, and — in discover — the search field and scenarios. */
function AddHeader({
  ownedCount,
  mode,
  onModeChange,
  query,
  onQueryChange,
  scenario,
  onScenarioToggle,
}: {
  ownedCount: number
  mode: Mode
  onModeChange: (mode: Mode) => void
  query: string
  onQueryChange: (query: string) => void
  scenario: string | null
  onScenarioToggle: (id: string) => void
}) {
  useLocale()
  const { scenarios } = useLearningCatalog()
  return (
    <View style={s.header}>
      {/*
          A one-child `Row`, kept: inside a row the count sits at its intrinsic width, and
          dropping the row would let it stretch and rewrap at 310% text — which
          `e2e/text-scale.spec.ts` is watching.
        */}
      <Row justify="space-between">
        <Text variant="labelSm" color={ink.muted}>
          {copy.add.inStream(ownedCount)}
        </Text>
      </Row>

      <Segmented value={mode} options={MODES} onChange={onModeChange} />

      {mode === 'discover' && (
        <>
          {/* A typed query is a selected state, hence the accent border at `border.selected`. */}
          <Card
            padding={0}
            border={query.length > 0 ? accent.accent : line.default}
            borderWidth={border.selected}
            style={s.searchField}
          >
            <TextInput
              value={query}
              onChangeText={onQueryChange}
              placeholder={copy.add.searchPlaceholder}
              placeholderTextColor={ink.muted2}
              accessibilityLabel={copy.a11y.add.searchInput}
              style={s.searchInput}
            />
          </Card>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.scenarioStrip}
          >
            <Text variant="labelSm" color={ink.muted} style={s.scenarioLabel}>
              {copy.add.scenarioLabel}
            </Text>
            {scenarios.map((sc) => (
              <Chip
                key={sc.id}
                variant="scenario"
                tone="solid"
                emoji={sc.emoji}
                label={sc.label}
                selected={scenario === sc.id}
                onPress={() => {
                  onScenarioToggle(sc.id)
                }}
              />
            ))}
          </ScrollView>
        </>
      )}
    </View>
  )
}
/** Browse's landing: one tile per theme, with how much of it is left to add. */
function ThemeGrid({
  countFor,
  onSelect,
}: {
  countFor: (theme: string) => number
  onSelect: (theme: BrowsableTheme) => void
}) {
  useLocale()
  return (
    <Grid gap={metrics.themeGrid}>
      {THEMES.map((t) => {
        const theme = copy.add.themes[t]
        const count = countFor(t)
        // One line, read AND shown. It used to be derived twice, and the two disagreed: a
        // finished theme was announced as "0 to add" while it displayed "all added ✓".
        const remaining = count > 0 ? copy.add.toAdd(count) : copy.add.allAdded
        return (
          <Pressable
            key={t}
            feedback="row"
            accessibilityLabel={copy.a11y.add.themeTile(theme.label, remaining)}
            onPress={() => {
              onSelect(t)
            }}
            style={s.themeTile}
          >
            <EmojiTile emoji={theme.emoji} size={metrics.themeEmoji} />
            <Text variant="bodySm" color={ink.ink} style={s.themeName}>
              {theme.label}
            </Text>
            <Text variant="labelSm" color={ink.muted}>
              {remaining}
            </Text>
          </Pressable>
        )
      })}
    </Grid>
  )
}
/** Back out of a drilled theme, to the grid. */
function ThemesBackLink({ onPress }: { onPress: () => void }) {
  useLocale()
  return (
    <Pressable
      feedback="smallButton"
      accessibilityLabel={copy.a11y.add.backToThemes}
      onPress={onPress}
      style={s.backToThemes}
    >
      <Text variant="captionSm" color={ink.ink2}>
        {copy.add.backToThemes}
      </Text>
    </Pressable>
  )
}
/** The offer: one tappable row per phrase, or the note that there is nothing left here. */
function SuggestionList({
  phrases,
  drilledTheme,
  onSelect,
}: {
  phrases: readonly CatalogPhrase[]
  /**
   * Whether the empty list is a finished THEME rather than a search or scenario with nothing
   * left. The two dead ends are different facts and the wording differs: the discover copy sends
   * the learner to the search field and the scenario strip, and browse mode renders neither.
   */
  drilledTheme: boolean
  onSelect: (phrase: CatalogPhrase) => void
}) {
  useLocale()
  // Not an `EmptyState`: this is one centred line with a break in it, and no title. Passing
  // an empty title would render a `title3` node and its gap that are not there today.
  if (phrases.length === 0) {
    return (
      <Card>
        <Text variant="caption" color={ink.muted} align="center">
          {drilledTheme ? copy.add.empty.themeComplete : copy.add.empty.body}
        </Text>
      </Card>
    )
  }
  return (
    <>
      {phrases.map((p) => (
        <PhraseRow
          key={p.id}
          variant="suggestion"
          targetText={p.targetText}
          translation={p.translation}
          emoji={p.emoji}
          accessibilityLabel={copy.a11y.add.suggestionRow(p.targetText, p.translation)}
          accessibilityHint={copy.a11y.add.opensSheet}
          onPress={() => {
            onSelect(p)
          }}
          trailing={<AddGlyph />}
        />
      ))}
    </>
  )
}
/** The `+` circle on a suggestion row. Decorative — the row's own name is the affordance. */
function AddGlyph() {
  useLocale()
  return (
    <View style={s.addGlyph}>
      <Text variant="headline" color={accent.accentInk}>
        {copy.add.addGlyph}
      </Text>
    </View>
  )
}

function SuggestedGlyph() {
  useLocale()
  return (
    <View style={s.suggestedGlyph}>
      <Text variant="headline" color={ink.ink2}>
        {copy.add.addGlyph}
      </Text>
    </View>
  )
}

function NearestScenarioHint({
  scenario,
  selected,
  onToggle,
}: {
  scenario: { id: string; label: string; emoji: string }
  selected: boolean
  onToggle: (id: string) => void
}) {
  useLocale()
  return (
    <Chip
      variant="scenario"
      tone="solid"
      emoji={scenario.emoji}
      label={copy.add.context.forScenario(scenario.label)}
      selected={selected}
      accessibilityLabel={copy.a11y.add.nearestScenario(scenario.label)}
      onPress={() => {
        onToggle(scenario.id)
      }}
    />
  )
}

function OwnPhraseRow({ query, onPress }: { query: string; onPress: () => void }) {
  useLocale()
  return (
    <Pressable
      feedback="row"
      accessibilityLabel={copy.a11y.add.ownRow(query)}
      accessibilityHint={copy.a11y.add.opensSheet}
      onPress={onPress}
      style={s.ownRow}
    >
      <Text variant="title3">{OWN_PHRASE_FALLBACK.emoji}</Text>
      <View style={s.grow}>
        <Text variant="bodySm" color={ink.ink} lang="target">
          {query}
        </Text>
        <Text variant="captionSm" color={ink.muted}>
          {copy.add.own.action}
        </Text>
      </View>
      <AddGlyph />
    </Pressable>
  )
}

function SuggestedList({
  candidates,
  onSelect,
}: {
  candidates: readonly PhraseCandidate[]
  onSelect: (candidate: PhraseCandidate) => void
}) {
  useLocale()
  return (
    <>
      <SectionLabel>{copy.add.suggested.title}</SectionLabel>
      <Text variant="captionSm" color={ink.muted}>
        {copy.add.suggested.provenance}
      </Text>
      {candidates.map((candidate) => (
        <PhraseRow
          key={canonicalPhraseText(candidate.targetText)}
          variant="suggestion"
          targetText={candidate.targetText}
          translation={candidate.translation}
          emoji={candidate.emoji ?? OWN_PHRASE_FALLBACK.emoji}
          accessibilityLabel={copy.a11y.add.suggestedRow(
            candidate.targetText,
            candidate.translation,
          )}
          accessibilityHint={copy.a11y.add.opensSheet}
          onPress={() => {
            onSelect(candidate)
          }}
          trailing={<SuggestedGlyph />}
        />
      ))}
    </>
  )
}

/**
 * A deliberately local, offline-only import review. Parsing is separate from persistence so a
 * pasted line never becomes a learner row until this surface's explicit Add action.
 */
function ImportPhrases({
  owned,
  addOwnPhrase,
  importDrafts,
  targetLocale,
  nativeLanguage,
  saveImportDraft,
  clearImportDraft,
}: {
  owned: readonly PhraseState[]
  addOwnPhrase: (draft: { targetText: string; translation: string }) => string
  importDrafts: ImportDrafts
  targetLocale: TargetLocale
  nativeLanguage: NativeLanguage
  saveImportDraft: (draft: {
    targetLocale: TargetLocale
    nativeLanguage: NativeLanguage
    input: string
  }) => void
  clearImportDraft: () => void
}) {
  useLocale()
  const restored = importDrafts[importDraftKey({ targetLocale, nativeLanguage })]?.input ?? ''
  const [input, setInput] = useState(restored)
  const [review, setReview] = useState<ImportCandidate[] | null>(null)
  const [tooLarge, setTooLarge] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const [fileError, setFileError] = useState<ImportFileError | null>(null)
  const fileRequest = useRef(0)
  useEffect(() => {
    fileRequest.current += 1
    return () => {
      fileRequest.current += 1
    }
  }, [nativeLanguage, targetLocale])
  const existing = useMemo(
    () =>
      owned.flatMap((phrase) => {
        const view = phrase.phraseId === null ? [phrase.ownEs] : []
        return view.filter((text): text is string => typeof text === 'string')
      }),
    [owned],
  )
  const preview = () => {
    fileRequest.current += 1
    const exceedsLimit = isImportTooLarge(input)
    setTooLarge(exceedsLimit)
    setSaveFailed(false)
    setReview(exceedsLimit ? null : parseImportedPhrases(input, existing))
  }
  const persistDraft = (value: string): boolean => {
    try {
      saveImportDraft({ targetLocale, nativeLanguage, input: value })
      return true
    } catch {
      setSaveFailed(true)
      return false
    }
  }
  const updateInput = (value: string) => {
    fileRequest.current += 1
    if (!persistDraft(value)) return
    setInput(value)
    setTooLarge(false)
    setSaveFailed(false)
    setFileError(null)
    setReview(null)
  }
  const chooseFile = async () => {
    const request = fileRequest.current + 1
    fileRequest.current = request
    setFileError(null)
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['text/plain', 'text/tab-separated-values'],
        // Android document providers return content:// URIs when cache copying is disabled.
        // ExpoFile's stream() is backed by a random-access local file and rejects those URIs.
        // Cache first, then retain the bounded reader so decoding still has a hard byte limit.
        copyToCacheDirectory: true,
        multiple: false,
        base64: false,
      })
      if (request !== fileRequest.current || picked.canceled) return
      const asset = picked.assets[0]
      if (asset === undefined) return
      if (asset.size !== undefined && asset.size > IMPORT_MAX_FILE_BYTES) {
        setFileError('too-large')
        return
      }
      const stream =
        asset.file === undefined
          ? new ExpoFile(asset.uri).stream()
          : (asset.file.stream() as ReadableStream<Uint8Array>)
      const bytes = await readBoundedImportFile(stream, IMPORT_MAX_FILE_BYTES)
      if (request !== fileRequest.current) return
      if (bytes === null) {
        setFileError('too-large')
        return
      }
      const result = decodeImportFile({ name: asset.name, bytes })
      if (!result.ok) {
        setFileError(result.error)
        return
      }
      updateInput(result.text)
    } catch {
      if (request === fileRequest.current) setFileError('unsupported-encoding')
    }
  }
  const update = (index: number, field: 'targetText' | 'translation', value: string) => {
    fileRequest.current += 1
    setSaveFailed(false)
    if (review === null) return
    const updated = reviewImportedCandidates(
      review.map((candidate, candidateIndex) =>
        candidateIndex === index
          ? { ...candidate, [field]: normalizeImportedText(value) }
          : candidate,
      ),
      existing,
    )
    const persistedInput = importInputForCandidates(updated)
    if (!persistDraft(persistedInput)) return
    setReview(updated)
    setInput(persistedInput)
  }
  const accepted = (review ?? []).filter(
    (candidate) =>
      candidate.issue === null && candidate.targetText !== '' && candidate.translation !== '',
  )
  const reviewedBatchTooLarge = review !== null && isReviewedImportTooLarge(review)
  const save = () => {
    fileRequest.current += 1
    if (review === null || reviewedBatchTooLarge) return
    const checked = reviewImportedCandidates(review, existing)
    if (isReviewedImportTooLarge(checked)) {
      setReview(checked)
      return
    }
    const acceptedChecked = checked.filter((candidate) => candidate.issue === null)
    if (acceptedChecked.length === 0) {
      setReview(checked)
      return
    }
    const keys = new Set(existing.map(importedPhraseKey))
    const savedLines = new Set<number>()
    const savedTargetTexts: string[] = []
    let failed = false
    for (const candidate of acceptedChecked) {
      const key = importedPhraseKey(candidate.targetText)
      if (keys.has(key)) continue
      try {
        addOwnPhrase({ targetText: candidate.targetText, translation: candidate.translation })
        keys.add(key)
        savedLines.add(candidate.line)
        savedTargetTexts.push(candidate.targetText)
      } catch {
        failed = true
        break
      }
    }
    const remaining = unsavedImportCandidates(checked, savedLines)
    if (remaining.length === 0) {
      setInput('')
      setReview(null)
      setSaveFailed(false)
      clearImportDraft()
      return
    }
    const remainingInput = importInputForCandidates(remaining)
    setInput(remainingInput)
    setReview(reviewImportedCandidates(remaining, [...existing, ...savedTargetTexts]))
    setSaveFailed(failed)
    saveImportDraft({ targetLocale, nativeLanguage, input: remainingInput })
  }
  return (
    <Stack gap={space['3']}>
      <Stack gap={space['1']}>
        <Text variant="title3" color={ink.ink}>
          {copy.add.import.title}
        </Text>
        <Text variant="caption" color={ink.muted}>
          {copy.add.import.help}
        </Text>
      </Stack>
      <Card padding={0} style={s.importInputCard}>
        <TextInput
          multiline
          value={input}
          onChangeText={updateInput}
          placeholder={copy.add.import.placeholder}
          placeholderTextColor={ink.muted2}
          accessibilityLabel={copy.a11y.add.importInput}
          style={s.importInput}
        />
      </Card>
      <Button
        label={copy.add.import.chooseFile}
        variant="secondary"
        onPress={() => {
          void chooseFile()
        }}
      />
      {fileError !== null && (
        <View accessibilityRole="alert">
          <Text variant="caption" color={semantic.warn.text}>
            {fileError === 'unsupported-format'
              ? copy.add.import.unsupportedFormat
              : fileError === 'too-large'
                ? copy.add.import.fileTooLarge
                : copy.add.import.unsupportedEncoding}
          </Text>
        </View>
      )}
      {saveFailed && (
        <View accessibilityRole="alert">
          <Text variant="caption" color={semantic.warn.text}>
            {copy.add.import.saveFailed}
          </Text>
        </View>
      )}
      <Button label={copy.add.import.preview} variant="secondary" onPress={preview} />
      {tooLarge && (
        <View accessibilityRole="alert">
          <Text variant="caption" color={semantic.warn.text}>
            {copy.add.import.tooLarge(IMPORT_MAX_ROWS, IMPORT_MAX_CHARACTERS)}
          </Text>
        </View>
      )}
      {review !== null && (
        <Stack gap={space['2']}>
          <SectionHeader
            variant="caption"
            label={copy.add.import.review(accepted.length)}
            hint={copy.add.import.reviewHint}
          />
          {reviewedBatchTooLarge && (
            <View accessibilityRole="alert">
              <Text variant="caption" color={semantic.warn.text}>
                {copy.add.import.tooLarge(IMPORT_MAX_ROWS, IMPORT_MAX_CHARACTERS)}
              </Text>
            </View>
          )}
          {review.length === 0 ? (
            <Card>
              <Text variant="caption" color={ink.muted}>
                {copy.add.import.empty}
              </Text>
            </Card>
          ) : (
            review.map((candidate, index) => (
              <Card
                key={candidate.line}
                style={candidate.issue === null ? undefined : s.importIssue}
              >
                <Stack gap={space['2']}>
                  <TextInput
                    value={candidate.targetText}
                    onChangeText={(value) => {
                      update(index, 'targetText', value)
                    }}
                    placeholder={copy.add.import.targetPlaceholder}
                    placeholderTextColor={ink.muted2}
                    accessibilityLabel={copy.a11y.add.importTarget(candidate.line)}
                    style={s.reviewInput}
                  />
                  <TextInput
                    value={candidate.translation}
                    onChangeText={(value) => {
                      update(index, 'translation', value)
                    }}
                    placeholder={copy.add.import.meaningPlaceholder}
                    placeholderTextColor={ink.muted2}
                    accessibilityLabel={copy.a11y.add.importMeaning(candidate.line)}
                    style={s.reviewInput}
                  />
                  {candidate.issue !== null && (
                    <Text variant="captionSm" color={semantic.warn.text}>
                      {candidate.issue === 'duplicate'
                        ? copy.add.import.duplicate
                        : candidate.issue === 'too-long'
                          ? copy.add.import.tooLong(MAX_OWN_PHRASE_TEXT_CODE_UNITS)
                          : copy.add.import.invalid}
                    </Text>
                  )}
                </Stack>
              </Card>
            ))
          )}
          <Button
            label={copy.add.import.add(accepted.length)}
            onPress={save}
            disabled={accepted.length === 0 || reviewedBatchTooLarge}
          />
        </Stack>
      )}
    </Stack>
  )
}
/** ── The tagging sheet: where the connective thread starts ── */
function TaggingSheet({
  phrase,
  difficulty,
  tags,
  onDifficultyChange,
  onToggleTag,
  onOwnFieldChange,
  onDismiss,
  onConfirm,
}: {
  phrase: SheetPhrase | null
  difficulty: Difficulty
  tags: readonly Tag[]
  onDifficultyChange: (difficulty: Difficulty) => void
  onToggleTag: (tag: Tag) => void
  onOwnFieldChange: (field: 'targetText' | 'translation', value: string) => void
  onDismiss: () => void
  onConfirm: () => void
}) {
  useLocale()
  const catalog = phrase?.kind === 'catalog' ? phrase.phrase : null
  const own = phrase?.kind === 'own' ? phrase : null
  const canConfirm =
    phrase === null ? false : phrase.kind === 'catalog' || candidateIsAddable(phrase)
  return (
    <Sheet visible={phrase !== null} onDismiss={onDismiss} dismissLabel={copy.a11y.common.dismiss}>
      {/* The guard stays INSIDE the sheet: `Modal` mounts its children either way. */}
      {phrase !== null && (
        <>
          {catalog !== null ? (
            <Card>
              <Row gap={metrics.sheetPhrase}>
                <EmojiTile emoji={catalog.emoji} />
                <View style={s.sheetPhraseLines}>
                  <Text variant="headline" color={ink.ink} lang="target">
                    {catalog.targetText}
                  </Text>
                  <Text variant="captionSm" color={ink.muted}>
                    {catalog.translation}
                  </Text>
                </View>
              </Row>
            </Card>
          ) : null}
          {own !== null ? (
            <Stack gap={space['2']}>
              <Card>
                <Row gap={metrics.sheetPhrase}>
                  <EmojiTile emoji={own.emoji ?? OWN_PHRASE_FALLBACK.emoji} />
                  <View style={s.sheetPhraseLines}>
                    <TextInput
                      value={own.targetText}
                      onChangeText={(value) => {
                        onOwnFieldChange('targetText', value)
                      }}
                      placeholder={copy.add.sheet.targetPlaceholder}
                      placeholderTextColor={ink.muted2}
                      accessibilityLabel={copy.a11y.add.sheetTarget}
                      maxLength={MAX_OWN_PHRASE_TEXT_CODE_UNITS}
                      style={s.sheetInput}
                    />
                    <TextInput
                      value={own.translation}
                      onChangeText={(value) => {
                        onOwnFieldChange('translation', value)
                      }}
                      placeholder={copy.add.sheet.meaningPlaceholder}
                      placeholderTextColor={ink.muted2}
                      accessibilityLabel={copy.a11y.add.sheetMeaning}
                      maxLength={MAX_OWN_PHRASE_TEXT_CODE_UNITS}
                      style={s.sheetInput}
                    />
                  </View>
                </Row>
              </Card>
              <Text variant="captionSm" color={ink.muted}>
                {copy.add.own.hint}
              </Text>
            </Stack>
          ) : null}

          <Stack gap={metrics.sheetGroup}>
            <Text variant="caption" color={ink.ink}>
              {copy.common.difficultyQuestion}
            </Text>
            {/* The add sheet is the DEFAULT density — `paddingVertical: 12`. Phrase detail's
                `tight` is a pixel shorter, so `density` is deliberately not passed. */}
            <DifficultySelector
              layout="cards"
              value={difficulty}
              labels={copy.difficulty}
              onChange={onDifficultyChange}
            />
          </Stack>

          <Stack gap={metrics.sheetGroup}>
            {/* `caption`, not the uppercase `label`: inside the sheet an uppercase header
                would compete with the sheet's own title. */}
            <SectionHeader
              variant="caption"
              label={copy.add.tagsQuestion}
              hint={copy.add.tagsHelper}
            />
            <TagChips
              value={tags}
              order={TAGS}
              labels={copy.tags}
              onToggle={onToggleTag}
              selectedSuffix={copy.common.selectedSuffix}
            />
          </Stack>

          <Button label={copy.add.confirm} onPress={onConfirm} disabled={!canConfirm} />
        </>
      )}
    </Sheet>
  )
}
/**
 * The numbers this screen owns.
 *
 * Every value is transcribed from the markup it replaced — none was rounded on the way in —
 * and every one stays local rather than becoming a design token, because none of them has a
 * second call site: `src/ui/tokens/sizing.ts`, a token used once is not a token.
 */
const s = StyleSheet.create({
  /** The drilled theme's title takes the room `‹ Themes` does not need. */
  grow: { flex: 1 },

  // ── AddHeader ──
  header: { paddingHorizontal: space['4'], paddingTop: space['2'], gap: space['2.5'] },
  /** 13 is the field's own inset, so a 46-px input is not edge-to-edge. Not a `space` step. */
  searchField: { paddingHorizontal: 13 },
  /** 14 at weight 600 sits between `caption` and `bodySm`, so it is not a type variant. */
  searchInput: {
    minHeight: 46,
    paddingHorizontal: space['3'],
    fontSize: 14,
    fontWeight: '600',
    color: ink.ink,
  },
  scenarioStrip: { gap: 7 },
  scenarioLabel: { alignSelf: 'center' },
  // ── The scroll body ──
  body: { padding: space['4'], gap: space['2'] },
  // ── ThemeGrid ──
  themeTile: {
    width: '48%',
    backgroundColor: surface.card,
    borderWidth: border.hairline,
    borderColor: line.default,
    borderRadius: radius.lg,
    padding: 14,
  },
  themeName: { marginTop: 10 },
  // ── ThemesBackLink ──
  // `paddingVertical` is a TAP-TARGET measurement, not a spacing step that happens to equal
  // one: the bare label is 17 px tall — 33 even with `hitSlop` — under the 44 floor. Padding
  // rather than `minHeight` so the label stays vertically centred in the row it shares with
  // the section label.
  backToThemes: { paddingVertical: 8, paddingRight: space['2'] },
  // ── SuggestionList ──
  addGlyph: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: accent.wash,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestedGlyph: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: border.hairline,
    borderColor: line.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 11,
    backgroundColor: surface.card,
    borderWidth: border.selected,
    borderColor: accent.accent,
    borderRadius: radius.lg,
    padding: 14,
  },
  sheetInput: {
    minHeight: 44,
    paddingHorizontal: space['2'],
    color: ink.ink,
    borderBottomWidth: border.hairline,
    borderBottomColor: line.default,
  },
  // ── Import review ──
  importInputCard: { paddingHorizontal: 13 },
  importInput: {
    minHeight: 132,
    paddingHorizontal: space['3'],
    paddingVertical: space['3'],
    fontSize: 14,
    fontWeight: '600',
    color: ink.ink,
    textAlignVertical: 'top',
  },
  reviewInput: {
    minHeight: 44,
    paddingHorizontal: space['2'],
    color: ink.ink,
    borderBottomWidth: border.hairline,
    borderBottomColor: line.default,
  },
  importIssue: { borderColor: semantic.warn.text, borderWidth: border.hairline },
  // ── TaggingSheet ──
  sheetPhraseLines: { flex: 1 },
})
