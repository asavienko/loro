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
import { useMemo, useState } from 'react'
import { ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  BROWSABLE_THEMES,
  foldSearchText,
  TAGS,
  type BrowsableTheme,
  type Difficulty,
  type PhraseState,
  type Tag,
} from '@loro/core'
import {
  useLearningCatalog,
  type DisplayPhrase as CatalogPhrase,
} from '../src/store/learningCatalog'
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
  isImportTooLarge,
  IMPORT_MAX_CHARACTERS,
  IMPORT_MAX_ROWS,
  normalizeImportedText,
  parseImportedPhrases,
  reviewImportedCandidates,
  type ImportCandidate,
} from '../src/lib/importPhrases'
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
/** What the learner is about to add: the phrase the sheet is open on, and its draft rating. */
interface AddDraft {
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
function useAddDraft(): AddDraft {
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
// ─── The screen ──────────────────────────────────────────────────────────────
export default function Add() {
  useLocale()
  const insets = useSafeAreaInsets()
  const owned = useApp((s) => s.phrases)
  const addPhrase = useApp((s) => s.addPhrase)
  const addOwnPhrase = useApp((s) => s.addOwnPhrase)
  const list = useSuggestions(owned)
  const draft = useAddDraft()
  const confirmAdd = (): void => {
    const phrase = draft.phrase
    if (phrase === null) return
    addPhrase(phrase.id, {
      difficulty: draft.difficulty,
      tags: draft.tags,
      source: 'discover',
    })
    list.anchorOn(phrase.theme)
    draft.reset()
  }
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
          <ImportPhrases owned={owned} addOwnPhrase={addOwnPhrase} />
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

            <SuggestionList
              phrases={list.phrases}
              drilledTheme={list.browseTheme !== null}
              onSelect={draft.open}
            />
          </>
        )}
      </ScrollView>

      <TaggingSheet
        phrase={draft.phrase}
        difficulty={draft.difficulty}
        tags={draft.tags}
        onDifficultyChange={draft.setDifficulty}
        onToggleTag={draft.toggleTag}
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

/**
 * A deliberately local, offline-only import review. Parsing is separate from persistence so a
 * pasted line never becomes a learner row until this surface's explicit Add action.
 */
function ImportPhrases({
  owned,
  addOwnPhrase,
}: {
  owned: readonly PhraseState[]
  addOwnPhrase: (draft: { targetText: string; translation: string }) => string
}) {
  useLocale()
  const [input, setInput] = useState('')
  const [review, setReview] = useState<ImportCandidate[] | null>(null)
  const [tooLarge, setTooLarge] = useState(false)
  const existing = useMemo(
    () =>
      owned.flatMap((phrase) => {
        const view = phrase.phraseId === null ? [phrase.ownEs] : []
        return view.filter((text): text is string => typeof text === 'string')
      }),
    [owned],
  )
  const preview = () => {
    const exceedsLimit = isImportTooLarge(input)
    setTooLarge(exceedsLimit)
    setReview(exceedsLimit ? null : parseImportedPhrases(input, existing))
  }
  const update = (index: number, field: 'targetText' | 'translation', value: string) => {
    setReview((current) =>
      current === null
        ? null
        : reviewImportedCandidates(
            current.map((candidate, candidateIndex) =>
              candidateIndex === index
                ? { ...candidate, [field]: normalizeImportedText(value) }
                : candidate,
            ),
            existing,
          ),
    )
  }
  const accepted = (review ?? []).filter(
    (candidate) =>
      candidate.issue === null && candidate.targetText !== '' && candidate.translation !== '',
  )
  const save = () => {
    const keys = new Set(existing.map(importedPhraseKey))
    for (const candidate of accepted) {
      const key = importedPhraseKey(candidate.targetText)
      if (keys.has(key)) continue
      keys.add(key)
      addOwnPhrase({ targetText: candidate.targetText, translation: candidate.translation })
    }
    setInput('')
    setReview(null)
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
          onChangeText={(value) => {
            setInput(value)
            setTooLarge(false)
            setReview(null)
          }}
          placeholder={copy.add.import.placeholder}
          placeholderTextColor={ink.muted2}
          accessibilityLabel={copy.a11y.add.importInput}
          style={s.importInput}
        />
      </Card>
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
            disabled={accepted.length === 0}
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
  onDismiss,
  onConfirm,
}: {
  phrase: CatalogPhrase | null
  difficulty: Difficulty
  tags: readonly Tag[]
  onDifficultyChange: (difficulty: Difficulty) => void
  onToggleTag: (tag: Tag) => void
  onDismiss: () => void
  onConfirm: () => void
}) {
  useLocale()
  return (
    <Sheet visible={phrase !== null} onDismiss={onDismiss} dismissLabel={copy.a11y.common.dismiss}>
      {/* The guard stays INSIDE the sheet: `Modal` mounts its children either way. */}
      {phrase !== null && (
        <>
          <Card>
            <Row gap={metrics.sheetPhrase}>
              <EmojiTile emoji={phrase.emoji} />
              <View style={s.sheetPhraseLines}>
                <Text variant="headline" color={ink.ink} lang="target">
                  {phrase.targetText}
                </Text>
                <Text variant="captionSm" color={ink.muted}>
                  {phrase.translation}
                </Text>
              </View>
            </Row>
          </Card>

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

          <Button label={copy.add.confirm} onPress={onConfirm} />
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
