/**
 * Adaptive stream — Loro.dc.html:600–677, logic 2516–2632.
 *
 * The one screen every persona uses. Live re-rating re-ranks the queue immediately,
 * and the toast explains the consequence — that's what teaches the model.
 *
 * Four pieces: `NowPlayingCard` (with its `TransportBar`), `RerateRow`, `UpNextList`, and the
 * note that says which of this screen's numbers are real.
 */

import { useMemo, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { streamStats, type Difficulty, type PhraseState } from '@loro/core'
import { copy } from '../../src/lib/copy'
import { DifficultySelector, EmptyState, PhraseRow } from '../../src/ui/components'
import {
  Card,
  Chip,
  DarkCard,
  Dots,
  IconButton,
  Pill,
  Pressable,
  ProgressBar,
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

/** The transport's play button is a circle, so its radius is half of this. */
const PLAY_DIAMETER = 60

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

/**
 * How many repeats the current phrase gets — a duplicate of `core-rs`'s `repeat_target`
 * (`rank.rs:37`, reached through `ctx.core.repeatTarget` in `StreamEngine`). Local for the same
 * reason as `rank`: calling the engine instead is plans/05's change, not this one's.
 *
 * The inline form this replaces also answered 3 when there was no current phrase; that branch
 * was unreachable past the empty-queue guard, and `med` answers 3 anyway.
 */
const repeatTargetFor = (difficulty: Difficulty): number =>
  difficulty === 'hard' ? 4 : difficulty === 'easy' ? 2 : 3

export default function Stream() {
  const insets = useSafeAreaInsets()
  const phrases = useApp((s) => s.phrases)
  const setDifficulty = useApp((s) => s.setDifficulty)
  const toggleLoved = useApp((s) => s.toggleLoved)
  const markLearned = useApp((s) => s.markLearned)
  const recordPlay = useApp((s) => s.recordPlay)
  const [cursor, setCursor] = useState(0)

  const queue = useMemo(
    () =>
      phrases
        .filter((p) => !p.learned)
        .slice()
        .sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id))
        .map(toView),
    [phrases],
  )

  const stats = streamStats(phrases)
  const current = queue[cursor % Math.max(1, queue.length)]

  if (queue.length === 0 || current === undefined) {
    return (
      <Screen>
        <EmptyState
          title={copy.stream.empty.title}
          body={copy.stream.empty.body}
          gap={space['2']}
        />
      </Screen>
    )
  }

  const advance = (): void => {
    recordPlay(current.id)
    setCursor((c) => c + 1)
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + space['5'] }]}
      >
        <NowPlayingCard
          phrase={current}
          position={copy.stream.counter(cursor + 1, queue.length)}
          repeatTarget={repeatTargetFor(current.difficulty)}
          onPrevious={() => {
            setCursor((c) => Math.max(0, c - 1))
          }}
          onNext={advance}
          onSkip={advance}
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

        <UpNextList upcoming={queue.slice(cursor + 1, cursor + 1 + UP_NEXT_ROWS)} stats={stats} />

        <Card>
          <Text variant="captionSm" color={ink.muted} align="center">
            {copy.stream.audioNote}
          </Text>
        </Card>
      </ScrollView>
    </Screen>
  )
}

/**
 * The dark hero: what is playing, how many repeats it gets, and the transport under it.
 */
function NowPlayingCard({
  phrase,
  position,
  repeatTarget,
  onPrevious,
  onNext,
  onSkip,
}: {
  phrase: PhraseView
  /** `1 / 10` — formatted by the caller, because it counts the QUEUE, not this card. */
  position: string
  repeatTarget: number
  onPrevious: () => void
  onNext: () => void
  onSkip: () => void
}) {
  return (
    <DarkCard>
      <Row justify="space-between">
        <Pill size="capsuleSm" tone="onDark" emoji={phrase.emoji} label={phrase.theme} />
        <Text variant="labelSm" color={onDark.muted}>
          {position}
        </Text>
      </Row>

      <Stack gap={space['2']} style={s.phraseBlock}>
        <Text variant="title2" color={onDark.primary} align="center" lang="es">
          {phrase.es}
        </Text>
        <Text variant="caption" color={onDark.tertiary} align="center">
          {phrase.en}
        </Text>
      </Stack>

      <Row gap={space['1.5']} justify="center" style={s.repeatRow}>
        <Text variant="labelSm" color={onDark.muted}>
          {copy.stream.repeatLabel}
        </Text>
        <Dots count={repeatTarget} filled={0} />
      </Row>

      <View style={s.progressWrap}>
        {/* Deliberately UNNAMED, so assistive tech does not announce it.
            `value={0.35}` is a hardcoded number over silence — there is no audio to be
            35% through — which is a rule-2 violation owned by
            plans/50-interface-integrity-defects.md. Naming it would announce the
            fabricated number to a learner who cannot see that it never moves. It is kept
            as a bare literal, not a named constant or a prop default, so that it still
            reads as the placeholder it is. */}
        <ProgressBar value={0.35} color={accent.accent} track={onDark.line} height={4} />
      </View>

      <TransportBar onPrevious={onPrevious} onNext={onNext} onSkip={onSkip} />
    </DarkCard>
  )
}

/**
 * Previous · play · skip. Glyphs, not icons — they are the rendered text, which is why each one
 * needs a spoken name of its own.
 *
 * The play circle is a `Pressable`, not an `IconButton`: it is deliberately 60 px rather than the
 * 44 px floor, and it presses with `feedback="button"` — `IconButton` is fixed to `feedback="icon"`,
 * a different press scale.
 */
function TransportBar({
  onPrevious,
  onNext,
  onSkip,
}: {
  onPrevious: () => void
  onNext: () => void
  onSkip: () => void
}) {
  return (
    <Row justify="center" gap={space['5']} style={s.transport}>
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
        <Text variant="title2" color={onDark.primary}>
          {copy.stream.controls.play}
        </Text>
      </Pressable>
      <IconButton
        glyph={copy.stream.controls.skip}
        label={copy.a11y.stream.skip}
        color={onDark.muted}
        onPress={onSkip}
      />
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
      <DifficultySelector layout="segmented" value={phrase.difficulty} onChange={onRate} />
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
            es={p.es}
            en={p.en}
            emoji={p.emoji}
            accessibilityLabel={copy.a11y.stream.queueRow(
              p.es,
              p.en,
              difficultyMeta[p.difficulty].label,
            )}
            accessibilityHint={copy.a11y.common.opensPhraseDetails}
            onPress={() => {
              router.push(`/phrase/${p.id}`)
            }}
            trailing={
              <Pill
                size="sm"
                label={difficultyMeta[p.difficulty].label}
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
  progressWrap: { marginTop: space['3'] },
  transport: { marginTop: space['4'] },
  playButton: {
    width: PLAY_DIAMETER,
    height: PLAY_DIAMETER,
    borderRadius: PLAY_DIAMETER / 2,
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
