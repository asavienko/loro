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
import { ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BROWSABLE_THEMES, TAGS, type BrowsableTheme, type Difficulty, type Tag } from '@loro/core'
import {
  useLearningCatalog,
  type DisplayPhrase as CatalogPhrase,
} from '../src/store/learningCatalog'
import { ImportPhrases } from './_add/ImportPhrases'
import type { AddMode } from './_add/mode'
import { useAddDraft } from './_add/useAddDraft'
import { useSuggestions } from './_add/useSuggestions'
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
import { accent, border, ink, line, radius, space, surface } from '../src/ui/theme'
import { copy } from '../src/lib/copy'
import { useApp } from '../src/store'
import { importDraftKey } from '../src/lib/importDraft'
/**
 * The themes Browse offers.
 *
 * Core owns the browsable key set (excluding learner-originated synthetic themes), while
 * `copy.add.themes` exhaustively maps those keys to their presentation.
 */
// a11y-lang: English UI category labels. "Café" is the English loanword, and a screen
// reader should read this list in the interface language, not Spanish.
const THEMES = BROWSABLE_THEMES
/** The discover / browse switch. The ids are state; only their labels are copy. */
const MODES: readonly SegmentedOption<AddMode>[] = [
  { value: 'discover', label: copy.add.modes.discover },
  { value: 'browse', label: copy.add.modes.browse },
  { value: 'import', label: copy.add.modes.import },
]
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
  mode: AddMode
  onModeChange: (mode: AddMode) => void
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
  // ── TaggingSheet ──
  sheetPhraseLines: { flex: 1 },
})
