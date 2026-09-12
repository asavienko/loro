import { useLocale } from '../../src/lib/i18n'
/**
 * Phrase detail — Loro.dc.html:436–581, logic 2435–2514.
 *
 * ONE source of truth per phrase. Every list in the app opens this screen, and every
 * rating control here writes to the same row the stream and Progress read.
 *
 * The screen is nine sections stacked in one scroll view. Each section that carries layout of
 * its own is a named component below, so the route function reads as the list of sections it
 * is: hero, words, difficulty, tags, example, hook, status. The two editors — difficulty and
 * tags — are the shared ones the add sheet uses, so a rating control cannot drift between the
 * two places a learner meets it.
 */

import { Platform, ScrollView, StyleSheet, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useBottomBar } from '../../src/ui/BottomBarContext'
import { masteryBucket, TAGS } from '@loro/core'
import {
  Button,
  Card,
  Divider,
  Grid,
  IconButton,
  Pill,
  Pressable,
  Row,
  Screen,
  SectionHeader,
  SectionLabel,
  Stack,
  Text,
} from '../../src/ui/primitives'
import { ActionBar, DifficultySelector, EmptyState, TagChips } from '../../src/ui/components'
import {
  accent,
  actionBar,
  border,
  ink,
  line,
  radius,
  semantic,
  space,
  surface,
} from '../../src/ui/theme'
import { copy, themeLabel } from '../../src/lib/copy'
import { toView, useApp } from '../../src/store'
import { audioSpeech, audioPlaybackNote, useAudioSpeech } from '../../src/lib/audioSpeech'
import { AudioControls } from '../../src/ui/components'
/**
 * The gap between a section's label and its body, on all five labelled sections. Not a `space`
 * step — it sits between 8 and 12, and moving it to either would shift every section on the
 * screen, which `e2e/text-scale.spec.ts` reads at 200% and 310%.
 */
const SECTION_GAP = 9
/** Between the three memory-hook offers — tighter than a section, they are one list. */
const HOOK_OFFER_GAP = 7
export default function PhraseDetail() {
  useLocale()
  const { id } = useLocalSearchParams<{
    id: string
  }>()
  const insets = useSafeAreaInsets()
  const { height: bottomBarHeight } = useBottomBar()
  const phrases = useApp((s) => s.phrases)
  const targetLocale = useApp((s) => s.targetLocale)
  const state = phrases.find((p) => p.id === id)
  const audio = useAudioSpeech(
    targetLocale,
    state === undefined ? undefined : toView(state).catalog?.audio,
  )
  const setDifficulty = useApp((s) => s.setDifficulty)
  const toggleTag = useApp((s) => s.toggleTag)
  const toggleLoved = useApp((s) => s.toggleLoved)
  const markLearned = useApp((s) => s.markLearned)
  const removePhrase = useApp((s) => s.removePhrase)
  const setNote = useApp((s) => s.setNote)
  if (state === undefined) {
    return <PhraseNotFound />
  }
  const p = toView(state)
  const cat = p.catalog
  const bucket = masteryBucket(state)
  // The three offers made when the learner has no note yet. `tie` reads the phrase's opening
  // words, so the SLICING stays here — it is derivation from the phrase, not authored text —
  // and only the sentence comes from `copy`. The catalog's own hint, when there is one, goes
  // in front of them.
  const hooks = [
    copy.phrase.hooks.sayAloud,
    copy.phrase.hooks.tie(p.targetText.split(' ').slice(0, 2).join(' ')),
    copy.phrase.hooks.picture,
  ]
  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          padding: space['4'],
          // The bar below is absolute and reserves nothing, so the last row needs the
          // clearance using its measured height, with the authored minimum before layout.
          paddingBottom: Math.max(
            insets.bottom + actionBar.clearance.phraseDetail,
            bottomBarHeight + space['4'],
          ),
          gap: space['4'],
        }}
      >
        <Row justify="space-between">
          <Pill label={themeLabel(p.theme)} />
          {/*
          `IconButton` for the 44×44 floor, not just the label: a bare heart glyph measured
          17×23, and it is `Pressable`'s `feedback="icon"` underneath that puts the minimum
          back. Do not restyle it into something smaller.
        */}
          <IconButton
            glyph={state.loved ? copy.common.hearts.filled : copy.common.hearts.outline}
            label={state.loved ? copy.a11y.common.removeFromLoved : copy.a11y.phrase.markLoved}
            color={state.loved ? accent.accentInk : ink.muted2}
            onPress={() => {
              toggleLoved(p.id)
            }}
          />
        </Row>

        <PhraseHero targetText={p.targetText} translation={p.translation} resp={cat?.resp} />
        <AudioControls
          label={
            audio.phraseId === p.id && audio.playback === 'playing'
              ? copy.audioSpeech.stop
              : copy.audioSpeech.play
          }
          note={audioPlaybackNote(
            audio.source,
            audio.phraseId === p.id ? audio.playback : 'idle',
            audio.phraseId === p.id ? audio.playbackError : null,
          )}
          enabled={audio.canPlay}
          onPress={() => {
            if (audio.phraseId === p.id && audio.playback === 'playing') {
              void audioSpeech.stopPlayback()
            } else {
              void audioSpeech.play(p.id, p.targetText, targetLocale, 0.92, undefined, cat?.audio)
            }
          }}
        />
        <Button
          label={copy.audioSpeech.practiceSpeak}
          variant="secondary"
          onPress={() => {
            router.push('/practice/speak')
          }}
        />
        {cat === null && <Text>{copy.languages.personalMeaning(p.meaningLanguage)}</Text>}

        {cat?.words !== undefined && cat.words.length > 0 && <WordChips words={cat.words} />}

        {/*
          The same editor as the add sheet, at `density="tight"` — this screen's cards are one
          pixel shorter than the sheet's, and that pixel is kept rather than unified: changing it
          moves every row below the selector, which `e2e/text-scale.spec.ts` reads at 310%.
        */}
        <Stack gap={SECTION_GAP}>
          <SectionLabel>{copy.common.difficultyQuestion}</SectionLabel>
          <DifficultySelector
            layout="cards"
            density="tight"
            value={state.difficulty}
            labels={copy.difficulty}
            onChange={(d) => {
              setDifficulty(p.id, d)
            }}
          />
        </Stack>

        <Stack gap={SECTION_GAP}>
          <SectionHeader label={copy.phrase.sections.tricky} hint={copy.phrase.tagsHelper} />
          <TagChips
            value={state.tags}
            order={TAGS}
            labels={copy.tags}
            selectedSuffix={copy.common.selectedSuffix}
            onToggle={(t) => {
              toggleTag(p.id, t)
            }}
          />
        </Stack>

        {cat?.example !== undefined && (
          <ExampleCard targetText={cat.example.targetText} translation={cat.example.translation} />
        )}

        <MemoryHookCard
          note={state.note}
          offers={cat?.hint !== undefined ? [cat.hint, ...hooks] : hooks}
          onAdopt={(h) => {
            setNote(p.id, h)
          }}
          onClear={() => {
            setNote(p.id, '')
          }}
        />

        <Divider />

        <StatusRow
          learned={state.learned}
          reps={state.reps}
          bucket={bucket}
          onToggle={() => {
            markLearned(p.id, !state.learned)
          }}
        />
      </ScrollView>

      <ActionBar direction="row" gap={space['2.5']}>
        <Button
          label={copy.phrase.actions.remove}
          variant="destructive"
          onPress={() => {
            removePhrase(p.id)
            router.back()
          }}
        />
        <View style={[s.grow, Platform.OS === 'web' && { minWidth: 'auto' }]}>
          <Button
            label={copy.phrase.actions.practiceNow}
            onPress={() => {
              router.push('/practice/refrain')
            }}
          />
        </View>
      </ActionBar>
    </Screen>
  )
}
/** No row behind the id — a stale link, or a phrase removed while this screen was open. */
function PhraseNotFound() {
  useLocale()
  return (
    <Screen>
      <EmptyState
        title={copy.phrase.missing.title}
        body={copy.phrase.missing.body}
        action={{
          label: copy.phrase.missing.action,
          onPress: () => {
            router.replace('/')
          },
        }}
        gap={space['2']}
        padding={space['5']}
      />
    </Screen>
  )
}
/**
 * The hero: the phrase, its English, and the reply the catalog expects back.
 *
 * `resp` is italic because it is someone else speaking — the product's voice, not decoration.
 */
function PhraseHero({
  targetText,
  translation,
  resp,
}: {
  targetText: string
  translation: string
  resp: string | undefined
}) {
  useLocale()
  return (
    <Stack gap={space['2']} style={s.hero}>
      <Text variant="hero" color={ink.ink} align="center" lang="target">
        {targetText}
      </Text>
      <Text variant="prose" color={ink.ink2} align="center" style={s.resp}>
        {copy.phrase.quotedTranslation(translation)}
      </Text>
      {resp !== undefined && (
        <Text variant="caption" color={ink.muted} align="center" style={s.resp}>
          {resp}
        </Text>
      )}
    </Stack>
  )
}
/**
 * Word by word — one card per word, its gloss under it.
 *
 * Not a `Chip`: these are not selectable and they stack two lines. They share the grid, which
 * wraps rather than scrolls so nothing runs off the edge at a large text scale.
 */
function WordChips({
  words,
}: {
  words: readonly {
    targetText: string
    gloss: string
  }[]
}) {
  useLocale()
  return (
    <Stack gap={SECTION_GAP}>
      <SectionLabel>{copy.phrase.sections.wordByWord}</SectionLabel>
      <Grid>
        {words.map((w, i) => (
          <Card key={i} padding={8} style={s.wordCard}>
            <Text variant="prose" color={ink.ink} lang="target">
              {w.targetText}
            </Text>
            <Text variant="labelSm" color={ink.muted}>
              {w.gloss}
            </Text>
          </Card>
        ))}
      </Grid>
    </Stack>
  )
}
/** In context — the catalog's example sentence, and its English underneath. */
function ExampleCard({ targetText, translation }: { targetText: string; translation: string }) {
  useLocale()
  return (
    <Stack gap={SECTION_GAP}>
      <SectionLabel>{copy.phrase.sections.inContext}</SectionLabel>
      <Card>
        <Text variant="prose" color={ink.ink} lang="target">
          {targetText}
        </Text>
        <Text variant="captionSm" color={ink.muted} style={s.exampleEn}>
          {translation}
        </Text>
      </Card>
    </Stack>
  )
}
/**
 * Memory hook — either the note the learner adopted, or the offers to adopt one.
 *
 * Tapping the adopted note clears it, which is how the offers come back; the accessible name
 * says so, because the visible "tap to change" is the only other place it is written.
 */
function MemoryHookCard({
  note,
  offers,
  onAdopt,
  onClear,
}: {
  note: string | null
  offers: readonly string[]
  onAdopt: (hook: string) => void
  onClear: () => void
}) {
  useLocale()
  return (
    <Stack gap={SECTION_GAP}>
      <SectionHeader label={copy.phrase.sections.memoryHook} hint={copy.phrase.hookHelper} />
      {note !== null && note.length > 0 ? (
        <Pressable
          feedback="row"
          accessibilityLabel={copy.a11y.phrase.currentHook(note)}
          onPress={onClear}
          style={s.hookAdopted}
        >
          <Row gap={space['2.5']} align="flex-start">
            <Text style={s.hookGlyph}>{copy.phrase.hookGlyph}</Text>
            <View style={s.grow}>
              <Text variant="caption" color={semantic.hook.text}>
                {note}
              </Text>
              <Text variant="labelSm" color={semantic.hookMeta.text} style={s.hookMeta}>
                {copy.phrase.tapToChange}
              </Text>
            </View>
          </Row>
        </Pressable>
      ) : (
        <Stack gap={HOOK_OFFER_GAP}>
          {offers.map((h, i) => (
            <Pressable
              key={i}
              feedback="row"
              accessibilityLabel={copy.a11y.phrase.useHook(h)}
              onPress={() => {
                onAdopt(h)
              }}
              style={s.hookOffer}
            >
              <Text variant="captionSm" color={semantic.hook.text}>
                {h}
              </Text>
            </Pressable>
          ))}
        </Stack>
      )}
    </Stack>
  )
}
/**
 * Learned / Learning, with the toggle opposite and the rep count under it.
 *
 * The row WRAPS, for the same reason as the stream's re-rating row: at a large font scale the
 * button must drop to the next line, not off the screen, where it is neither readable nor
 * tappable. Two of the `e2e/text-scale.spec.ts` cases exist for exactly this.
 */
function StatusRow({
  learned,
  reps,
  bucket,
  onToggle,
}: {
  learned: boolean
  reps: number
  bucket: string
  onToggle: () => void
}) {
  useLocale()
  return (
    <Row justify="space-between" style={s.status}>
      <View>
        <Text variant="caption" color={ink.ink}>
          {learned ? copy.phrase.status.learned : copy.phrase.status.learning}
        </Text>
        <Text variant="captionSm" color={ink.muted}>
          {copy.phrase.status.reps(reps, bucket)}
        </Text>
      </View>
      <Pressable
        feedback="smallButton"
        accessibilityLabel={learned ? copy.a11y.phrase.markStillLearning : copy.common.markLearned}
        onPress={onToggle}
        style={[s.learnedToggle, learned ? s.learnedOn : s.learnedOff]}
      >
        <Text variant="labelSm" color={learned ? semantic.success.text : ink.ink2}>
          {learned ? copy.common.learnedBadge : copy.common.markLearned}
        </Text>
      </Pressable>
    </Row>
  )
}
const s = StyleSheet.create({
  /**
   * Takes the room the other child in the row does not need: the hook's text beside its 💡, and
   * "Practice now" beside a "Remove" that is only as wide as its label.
   */
  grow: { flex: 1 },
  hero: { alignItems: 'center' },
  /** Someone else speaking. See `PhraseHero`. */
  resp: { fontStyle: 'italic' },
  wordCard: {
    alignItems: 'center',
  },
  exampleEn: { marginTop: 5 },
  hookAdopted: { backgroundColor: semantic.hook.bg, borderRadius: radius.lg, padding: 13 },
  /** Bigger than the `caption` it inherits from, and only here. */
  hookGlyph: { fontSize: 16 },
  hookMeta: { marginTop: 6 },
  hookOffer: { backgroundColor: surface.card, borderRadius: radius.lg, padding: 12 },
  status: {
    backgroundColor: surface.sunken,
    borderRadius: radius.xl,
    padding: 13,
    flexWrap: 'wrap',
  },
  /** `borderColor` is set in both states; only the width changes, so the row cannot reflow. */
  learnedToggle: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: radius.lg,
    borderColor: line.strong,
  },
  learnedOn: { backgroundColor: semantic.success.bg, borderWidth: 0 },
  learnedOff: { backgroundColor: surface.card, borderWidth: border.hairline },
})
