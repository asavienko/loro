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
import { ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  BROWSABLE_THEMES,
  MAX_OWN_PHRASE_TEXT_CODE_UNITS,
  TAGS,
  candidateIsAddable,
  ownPhraseIsAddable,
  phraseHandoff,
  typedOwnPhraseHandoff,
  type BrowsableTheme,
  type Difficulty,
  type PhraseCandidate,
  type Tag,
} from '@loro/core'
import {
  useLearningCatalog,
  type DisplayPhrase as CatalogPhrase,
} from '../src/store/learningCatalog'
import { OWN_PHRASE_FALLBACK } from '../src/store/phraseFactory'
import { ImportPhrases } from './_add/ImportPhrases'
import type { AddMode } from './_add/mode'
import { targetLanguageInputProps } from './_add/targetLanguage'
import { themePackProgress } from './_add/themePack'
import { useAddDraft, type SheetPhrase } from './_add/useAddDraft'
import { useDiscoverReach } from './_add/useDiscoverReach'
import { useSuggestions } from './_add/useSuggestions'
import {
  Button,
  Card,
  Chip,
  EmojiTile,
  Field,
  Grid,
  Pressable,
  ProgressBar,
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
import { stationeryElevation } from '../src/ui/elevation'
import { accent, border, ink, radius, semantic, space, surface, type } from '../src/ui/theme'
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
  /** The browse grid: two pack cards to a row (`gap-2.5` in the v1.2 specimen). */
  themeGrid: 10,
  /** The pack card's emoji plate — 32 px, matching the v1.2 8×8 well. */
  themeEmoji: 32,
  /** The plate's glyph, 18 px on that 32 px well. */
  themeEmojiGlyph: 18,
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
      list.anchorOn({
        catalogId: sheet.phrase.id,
        phrase: sheet.phrase.targetText,
        theme: sheet.phrase.theme,
        difficulty: draft.difficulty,
        tags: draft.tags,
      })
      draft.reset()
      return
    }
    if (sheet.source === 'custom' ? !ownPhraseIsAddable(sheet) : !candidateIsAddable(sheet)) return
    addOwnPhrase(
      {
        targetText: sheet.targetText,
        translation: sheet.translation,
        ...(sheet.theme === undefined ? {} : { theme: sheet.theme }),
        ...(sheet.emoji === undefined ? {} : { emoji: sheet.emoji }),
      },
      { difficulty: draft.difficulty, tags: draft.tags, source: sheet.source },
    )
    if (sheet.source !== 'custom' && sheet.theme !== undefined)
      list.anchorOn({
        catalogId: '',
        phrase: sheet.targetText,
        theme: sheet.theme,
        difficulty: draft.difficulty,
        tags: draft.tags,
      })
    else list.clearDiscoverQuery()
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
            catalog={catalogPhrases}
            addOwnPhrase={addOwnPhrase}
            importDrafts={importDrafts}
            targetLocale={targetLocale}
            nativeLanguage={nativeLanguage}
            saveImportDraft={saveImportDraft}
            clearImportDraft={clearImportDraft}
          />
        ) : list.mode === 'browse' && list.browseTheme === null ? (
          <ThemeGrid countFor={list.countFor} totalFor={list.totalFor} onSelect={list.browse} />
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

            {list.mode === 'discover' && reach.offerOwn ? (
              <OwnPhraseRow
                query={list.query.trim()}
                onPress={() => {
                  draft.openHandoff(typedOwnPhraseHandoff(list.query))
                }}
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
        <View style={s.streamBadge}>
          <Text variant="caption" color={accent.accentInk}>
            {copy.add.inStream(ownedCount)}
          </Text>
        </View>
      </Row>

      <Segmented value={mode} options={MODES} onChange={onModeChange} />

      {mode === 'discover' && (
        <>
          <Card
            padding={0}
            radius={radius.xl}
            background={surface.card}
            border={query.length > 0 ? accent.accent : false}
            borderWidth={border.selected}
            style={[s.searchField, stationeryElevation('fieldInset')]}
          >
            <Row align="center" gap={space['2']}>
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Text variant="bodySm" color={ink.muted}>
                  {copy.add.searchGlyph}
                </Text>
              </View>
              <Field
                value={query}
                onChangeText={onQueryChange}
                placeholder={copy.add.searchPlaceholder}
                placeholderTextColor={ink.muted2}
                accessibilityLabel={copy.a11y.add.searchInput}
                style={[s.searchInput, s.searchInputGrow]}
              />
            </Row>
          </Card>

          <View>
            <SectionLabel>{copy.add.scenarioLabel}</SectionLabel>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.scenarioStrip}
            >
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
          </View>
        </>
      )}
    </View>
  )
}
/** Browse's landing: one editorial pack card per theme, with real leftover / catalog counts. */
function ThemeGrid({
  countFor,
  totalFor,
  onSelect,
}: {
  countFor: (theme: string) => number
  totalFor: (theme: string) => number
  onSelect: (theme: BrowsableTheme) => void
}) {
  useLocale()
  return (
    <Stack gap={space['3']}>
      <Stack gap={space['1']}>
        <Text variant="title2" color={ink.ink}>
          {copy.add.browseHeading}
        </Text>
        <Text variant="bodySm" color={ink.muted}>
          {copy.add.browseHelper}
        </Text>
      </Stack>
      <Grid gap={metrics.themeGrid}>
        {THEMES.map((t) => {
          const theme = copy.add.themes[t]
          const pack = themePackProgress(countFor(t), totalFor(t))
          // One line, read AND shown. It used to be derived twice, and the two disagreed: a
          // finished theme was announced as "0 to add" while it displayed "all added ✓".
          const remaining = pack.complete ? copy.add.allAdded : copy.add.toAdd(pack.remaining)
          const supporting = pack.complete
            ? copy.add.packPhrases(pack.total)
            : copy.add.packPhrasesLeft(pack.total, pack.remaining)
          return (
            <Pressable
              key={t}
              feedback="row"
              pressMotion="deboss"
              elevation="card"
              accessibilityLabel={copy.a11y.add.themeTile(theme.label, remaining)}
              onPress={() => {
                onSelect(t)
              }}
              style={s.themeTile}
            >
              <View>
                <EmojiTile
                  emoji={theme.emoji}
                  size={metrics.themeEmoji}
                  radius={radius.lg}
                  background={surface.sunken2}
                  fontSize={metrics.themeEmojiGlyph}
                />
                <Text variant="title3" color={ink.ink} style={s.themeName}>
                  {theme.label}
                </Text>
                <Text variant="bodySm" color={ink.muted} style={s.themeMeta}>
                  {supporting}
                </Text>
              </View>
              {pack.complete ? (
                <Text
                  variant="captionSm"
                  color={semantic.successAlt.text}
                  style={s.themeCompleteBadge}
                >
                  {copy.add.allAdded}
                </Text>
              ) : (
                <View style={s.themeProgress}>
                  <ProgressBar
                    value={pack.percent / 100}
                    track={surface.sunken}
                    radius={radius.pill}
                  />
                  <Row justify="space-between" align="center">
                    <Text variant="labelSm" color={ink.muted}>
                      {copy.add.packOwnedOf(pack.owned, pack.total)}
                    </Text>
                    <Text variant="labelSm" color={accent.accentInk}>
                      {copy.add.packPercent(pack.percent)}
                    </Text>
                  </Row>
                </View>
              )}
            </Pressable>
          )
        })}
      </Grid>
    </Stack>
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
          eyebrow={discoverEyebrow(p.theme)}
          accessibilityLabel={copy.a11y.add.suggestionRow(p.targetText, p.translation)}
          accessibilityHint={copy.a11y.add.opensSheet}
          onPress={() => {
            onSelect(p)
          }}
          trailing={<QueueGlyph />}
        />
      ))}
    </>
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
        <Text variant="bodySm" color={ink.ink}>
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
          key={canonicalSuggestedKey(candidate)}
          variant="suggestion"
          targetText={candidate.targetText}
          translation={candidate.translation}
          emoji={candidate.emoji ?? OWN_PHRASE_FALLBACK.emoji}
          eyebrow={discoverEyebrow(candidate.theme)}
          accessibilityLabel={copy.a11y.add.suggestedRow(
            candidate.targetText,
            candidate.translation,
          )}
          accessibilityHint={copy.a11y.add.opensSheet}
          onPress={() => {
            onSelect(candidate)
          }}
          trailing={<QueueGlyph />}
        />
      ))}
    </>
  )
}

function canonicalSuggestedKey(candidate: PhraseCandidate): string {
  return `${candidate.targetText}\u0000${candidate.translation}`
}

function discoverEyebrow(theme: string | undefined): string | undefined {
  if (theme === undefined) return undefined
  return theme in copy.add.themes ? copy.add.themes[theme as BrowsableTheme].label : theme
}

function QueueGlyph() {
  useLocale()
  return (
    <View style={s.queueGlyph}>
      <Text variant="labelSm" color={surface.app}>
        {copy.add.queue}
      </Text>
    </View>
  )
}

/** The `+` circle on an own-phrase row. Decorative — the row's own name is the affordance. */
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
    phrase === null
      ? false
      : phrase.kind === 'catalog' ||
        (phrase.source === 'custom' ? ownPhraseIsAddable(phrase) : candidateIsAddable(phrase))
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
                  <Text variant="prose" color={ink.ink} lang="target">
                    {catalog.targetText}
                  </Text>
                  <Text variant="caption" color={ink.ink2} style={s.italic}>
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
                    <Field
                      literary
                      value={own.targetText}
                      onChangeText={(value) => {
                        onOwnFieldChange('targetText', value)
                      }}
                      placeholder={copy.add.sheet.targetPlaceholder}
                      placeholderTextColor={ink.muted2}
                      accessibilityLabel={copy.a11y.add.sheetTarget}
                      {...targetLanguageInputProps()}
                      maxLength={MAX_OWN_PHRASE_TEXT_CODE_UNITS}
                      style={s.sheetInput}
                    />
                    <Field
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
  header: { paddingHorizontal: space['5'], paddingTop: space['2'], gap: space['3'] },
  streamBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: accent.wash,
  },
  /** 13 is the field's own inset, so a 46-px input is not edge-to-edge. Not a `space` step. */
  searchField: { paddingHorizontal: 13, paddingVertical: space['1'] },
  /** Discover search uses DESIGN.md body-sm; Field's empty body-md is the fallback. */
  searchInput: {
    minHeight: 46,
    paddingHorizontal: 0,
    fontSize: type.bodySm.fontSize,
    fontWeight: type.bodySm.fontWeight,
    fontFamily: type.bodySm.fontFamily,
    lineHeight: type.bodySm.lineHeight,
    color: ink.ink,
    outlineWidth: 0,
  },
  searchInputGrow: { flex: 1 },
  scenarioStrip: { gap: 7, paddingTop: space['2'] },
  // ── The scroll body ──
  body: { padding: space['5'], gap: space['2.5'] },
  italic: { fontStyle: 'italic' },
  // ── ThemeGrid ──
  themeTile: {
    width: '48%',
    flexDirection: 'column',
    justifyContent: 'space-between',
    backgroundColor: surface.card,
    borderRadius: radius.xl,
    padding: 14,
    ...stationeryElevation('card'),
  },
  themeCompleteBadge: {
    alignSelf: 'flex-start',
    marginTop: space['4'],
    paddingHorizontal: space['2'],
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: semantic.success.bg,
    overflow: 'hidden',
  },
  themeName: { marginTop: 10 },
  themeMeta: { marginTop: 2 },
  themeProgress: { marginTop: space['4'], gap: 6 },
  // ── ThemesBackLink ──
  // `paddingVertical` is a TAP-TARGET measurement, not a spacing step that happens to equal
  // one: the bare label is 17 px tall — 33 even with `hitSlop` — under the 44 floor. Padding
  // rather than `minHeight` so the label stays vertically centred in the row it shares with
  // the section label.
  backToThemes: { paddingVertical: 8, paddingRight: space['2'] },
  // ── SuggestionList ──
  queueGlyph: {
    paddingHorizontal: space['3'],
    paddingVertical: space['1.5'],
    borderRadius: radius.pill,
    backgroundColor: accent.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addGlyph: {
    minWidth: 32,
    minHeight: 32,
    paddingHorizontal: space['2'],
    borderRadius: radius.pill,
    backgroundColor: accent.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── TaggingSheet ──
  sheetPhraseLines: { flex: 1 },
  sheetInput: {
    minHeight: 38,
    fontSize: 16,
    fontWeight: '700',
    color: ink.ink,
  },
  ownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: surface.card,
    borderRadius: radius.xl,
    padding: space['4'],
  },
})
