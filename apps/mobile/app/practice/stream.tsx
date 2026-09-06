import { useLocale } from '../../src/lib/i18n'
/**
 * Adaptive stream — Loro.dc.html:600–677, logic 2516–2632.
 *
 * The one screen every persona uses. Live re-rating re-ranks the queue immediately,
 * and the toast explains the consequence — that's what teaches the model.
 *
 * The phrase card exposes manual navigation until native audio playback is available.
 */
import { useMemo } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { streamStats, type Difficulty, type PhraseState } from '@loro/core'
import { copy, themeLabel } from '../../src/lib/copy'
import { DifficultySelector, EmptyState, PhraseRow } from '../../src/ui/components'
import {
  Chip,
  DarkCard,
  IconButton,
  Pill,
  Pressable,
  Row,
  Screen,
  Stack,
  Text,
} from '../../src/ui/primitives'
import {
  accent,
  border,
  chip,
  difficultyMeta,
  ink,
  line,
  onDark,
  radius,
  semantic,
  space,
  surface,
} from '../../src/ui/theme'
import { toView, useApp, type PhraseView } from '../../src/store'
/** How many phrases "Up next" shows. */
const UP_NEXT_ROWS = 7
/** The two gaps in this screen that no `space` step names. */
const RERATE_GAP = 7
const PILL_GAP = 5
/**
 * The queue's rank — `plays + (hard −6 | easy +4) + (loved −3)`, ascending.
 *
 * ── Deliberately LOCAL, and knowingly divergent ──
 * `store/index.ts` and `core-rs/src/rank.rs:57` (`stream_rank`) compute the same rank and both
 * subtract 4 for a phrase whose SRS review is due. This copy omits that term, so the queue the
 * learner scrolls is ordered differently from the one `StreamEngine.plan()` would produce —
 * defect 1 in plans/52, owned by plans/05-fix-shared-maths-duplication. Adding the missing term
 * reorders the visible queue, which this refactor promises not to do, so the formula is left
 * byte-for-byte as it was and merely given a name and this note.
 */
const rank = (p: PhraseState): number =>
  p.plays + (p.difficulty === 'hard' ? -6 : p.difficulty === 'easy' ? 4 : 0) + (p.loved ? -3 : 0)
export default function Stream() {
  useLocale()
  const insets = useSafeAreaInsets()
  const nativeLanguage = useApp((s) => s.nativeLanguage)
  const phrases = useApp((s) => s.phrases)
  const setDifficulty = useApp((s) => s.setDifficulty)
  const toggleLoved = useApp((s) => s.toggleLoved)
  const markLearned = useApp((s) => s.markLearned)
  const cursor = useApp((state) => state.streamCursor)
  const setCursor = (streamCursor: number): void => {
    useApp.setState({ streamCursor })
  }
  const queue = useMemo(
    () =>
      phrases
        .filter((p) => !p.learned)
        .slice()
        .sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id))
        .map(toView),
    [phrases, nativeLanguage],
  )
  const stats = streamStats(phrases)
  const position = cursor % Math.max(1, queue.length)
  const current = queue[position]
  if (queue.length === 0 || current === undefined) {
    return (
      <Screen>
        <EmptyState
          title={copy.stream.empty.title}
          body={copy.stream.empty.body}
          action={{
            label: copy.stream.empty.action,
            onPress: () => {
              router.push('/add')
            },
          }}
          gap={space['2']}
        />
      </Screen>
    )
  }
  const advance = (): void => {
    setCursor((position + 1) % queue.length)
  }
  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + space['5'] }]}
      >
        <NowPlayingCard
          phrase={current}
          position={copy.stream.counter(position + 1, queue.length)}
          onPrevious={() => {
            setCursor(Math.max(0, position - 1))
          }}
          onNext={advance}
        />

        <RerateRow
          phrase={current}
          onRate={(d) => {
            setDifficulty(current.id, d)
          }}
          onToggleLoved={() => {
            toggleLoved(current.id)
          }}
          onMarkLearned={() => {
            markLearned(current.id, true)
          }}
        />

        <UpNextList
          upcoming={queue.slice(position + 1, position + 1 + UP_NEXT_ROWS)}
          stats={stats}
        />
      </ScrollView>
    </Screen>
  )
}
/**
 * The dark hero: the current phrase, audio availability, and manual phrase navigation.
 */
function NowPlayingCard({
  phrase,
  position,
  onPrevious,
  onNext,
}: {
  phrase: PhraseView
  /** `1 / 10` — formatted by the caller, because it counts the QUEUE, not this card. */
  position: string
  onPrevious: () => void
  onNext: () => void
}) {
  useLocale()
  return (
    <DarkCard>
      <Row justify="space-between">
        <Pill
          size="capsuleSm"
          tone="onDark"
          emoji={phrase.emoji}
          label={themeLabel(phrase.theme)}
        />
        <Text variant="labelSm" color={onDark.muted}>
          {position}
        </Text>
      </Row>

      <Stack gap={space['2']} style={s.phraseBlock}>
        <Text variant="title2" color={onDark.primary} align="center" lang="target">
          {phrase.targetText}
        </Text>
        <Text variant="caption" color={onDark.tertiary} align="center">
          {phrase.translation}
        </Text>
      </Stack>

      <Text variant="captionSm" color={onDark.tertiary} align="center" style={s.repeatRow}>
        {copy.stream.audioNote}
      </Text>
      <TransportBar onPrevious={onPrevious} onNext={onNext} />
    </DarkCard>
  )
}
/**
 * Previous and Next phrase browse the queue without claiming or recording audio playback.
 */
function TransportBar({ onPrevious, onNext }: { onPrevious: () => void; onNext: () => void }) {
  useLocale()
  return (
    <Row wrap justify="center" gap={space['5']} style={s.transport}>
      <IconButton
        glyph={copy.stream.controls.prev}
        label={copy.a11y.stream.previous}
        color={onDark.muted}
        onPress={onPrevious}
      />
      <Pressable
        feedback="button"
        accessibilityLabel={copy.a11y.stream.next}
        onPress={onNext}
        style={s.playButton}
      >
        <Text variant="caption" color={onDark.primary}>
          {copy.stream.controls.next}
        </Text>
      </Pressable>
    </Row>
  )
}
/**
 * Live re-rating: love it, retire it, or move it between the three difficulties. Every one of
 * these re-ranks the queue on the next render, which is the screen's whole point.
 */
function RerateRow({
  phrase,
  onRate,
  onToggleLoved,
  onMarkLearned,
}: {
  phrase: PhraseView
  onRate: (difficulty: Difficulty) => void
  onToggleLoved: () => void
  onMarkLearned: () => void
}) {
  useLocale()
  return (
    <Stack gap={space['2']}>
      {/* `wrap` is load-bearing, not cosmetic: the row grows DOWNWARD at large text sizes
            rather than pushing "✓ Learned" off the right edge, where it is neither readable nor
            tappable. accessibility.md#text-and-layout: rows grow vertically. */}
      <Row gap={RERATE_GAP} wrap>
        <Text variant="labelSm" color={ink.muted}>
          {copy.stream.rateQuestion}
        </Text>
        <View style={s.spacer} />
        <Chip
          variant="toggle"
          label={phrase.loved ? copy.stream.lovedBadge : copy.stream.loveLabel}
          accessibilityLabel={
            phrase.loved ? copy.a11y.common.removeFromLoved : copy.a11y.stream.loveThisPhrase
          }
          selected={phrase.loved}
          onPress={onToggleLoved}
        />
        {/* NOT a `Chip`, on purpose. Its ink is `semantic.success` and its border a hairline,
            while `Chip`'s `toggle` variant is accent-toned and carries the 1.5-px border in
            both states — forcing it through would change two rendered values. `ui-api.md` §4
            reaches the same conclusion; the shape is shared, the tone is not. */}
        <Pressable
          feedback="smallButton"
          accessibilityLabel={copy.common.markLearned}
          onPress={onMarkLearned}
          style={s.learnedButton}
        >
          <Text variant="labelSm" color={semantic.success.text}>
            {copy.common.learnedBadge}
          </Text>
        </Pressable>
      </Row>

      {/* `segmented` is the stream's inset track. Its inactive label is `ink.ink3` rather than
            `ink.muted` — on `surface.sunken2` muted is 4.41:1, under AA for 12 px text — and that
            decision now lives in `primitives/controlStyle.ts` beside the reasoning. */}
      <DifficultySelector
        layout="segmented"
        value={phrase.difficulty}
        labels={copy.difficulty}
        onChange={onRate}
      />
    </Stack>
  )
}
/**
 * What is coming, with the roll-up counts beside the heading.
 *
 * A fragment, not a wrapper: the heading and the list are two children of the screen's scroll
 * container, and that container's `gap` is what sets the space between them.
 */
function UpNextList({
  upcoming,
  stats,
}: {
  upcoming: readonly PhraseView[]
  stats: ReturnType<typeof streamStats>
}) {
  useLocale()
  return (
    <>
      <Row justify="space-between">
        <Text variant="caption" color={ink.ink}>
          {copy.stream.upNext}
        </Text>
        <Row gap={PILL_GAP}>
          <Pill size="sm" tone="accent" label={copy.stream.pills.loved(stats.loved)} />
          <Pill
            size="sm"
            label={copy.stream.pills.hard(stats.hard)}
            color={semantic.danger.text}
            background={semantic.danger.bg}
          />
          <Pill
            size="sm"
            label={copy.stream.pills.learned(stats.learned)}
            color={semantic.success.text}
            background={semantic.success.bg}
          />
        </Row>
      </Row>

      <Stack gap={space['2']}>
        {upcoming.map((p) => (
          <PhraseRow
            key={p.id}
            targetText={p.targetText}
            translation={p.translation}
            emoji={p.emoji}
            accessibilityLabel={copy.a11y.stream.queueRow(
              p.targetText,
              p.translation,
              copy.difficulty[p.difficulty],
            )}
            accessibilityHint={copy.a11y.common.opensPhraseDetails}
            onPress={() => {
              router.push(`/phrase/${p.id}`)
            }}
            trailing={
              <Pill
                size="sm"
                label={copy.difficulty[p.difficulty]}
                color={difficultyMeta[p.difficulty].color}
                background={difficultyMeta[p.difficulty].bg}
              />
            }
          />
        ))}
      </Stack>
    </>
  )
}
const s = StyleSheet.create({
  content: { padding: space['4'], gap: space['3.5'] },
  // NowPlayingCard
  phraseBlock: { marginTop: space['4'], alignItems: 'center' },
  repeatRow: { marginTop: space['3.5'] },
  transport: { marginTop: space['4'] },
  playButton: {
    maxWidth: '100%',
    minHeight: 48,
    paddingHorizontal: space['5'],
    paddingVertical: space['3'],
    borderRadius: radius.xl,
    backgroundColor: accent.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // RerateRow
  spacer: { flex: 1 },
  /** The `Chip` metrics, because it is the same shape beside it — only the tone differs. */
  learnedButton: {
    paddingHorizontal: chip.toggle.paddingHorizontal,
    paddingVertical: chip.toggle.paddingVertical,
    borderRadius: radius.lg,
    borderWidth: border.hairline,
    borderColor: line.strong,
    backgroundColor: surface.card,
  },
})
