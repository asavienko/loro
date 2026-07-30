/**
 * Progress — Loro.dc.html:1787–1876, logic 2815–2871.
 *
 * The connective thread closing its loop: "What's tricky in your stream" rolls up
 * the learner's OWN tags, and tapping a row drills exactly those phrases.
 *
 * Nothing on this screen shames a missed day.
 *
 * One rollup hook and five blocks, in the blueprint's order: `StreakCard` → `StatRow` →
 * `MasteryBar` → `TrickyRollup` → `MilestoneList`. Every number they show comes from
 * `useProgressSummary`, so there is one place to read what this screen counts.
 */

import { useMemo } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { masteryBucket, streak as streakOf, type PhraseState, type Tag } from '@loro/core'
import {
  Card,
  CardHeader,
  ChartSummary,
  DarkCard,
  Dot,
  Grid,
  Pressable,
  ProgressBar,
  Row,
  Screen,
  SectionLabel,
  Stack,
  Text,
} from '../src/ui/primitives'
import { StatRow } from '../src/ui/components'
import {
  accent,
  border,
  ink,
  line,
  masteryMeta,
  onDark,
  radius,
  semantic,
  space,
  surface,
  tagMeta,
} from '../src/ui/theme'
import { useApp } from '../src/store'
import { copy } from '../src/lib/copy'
import { deviceClock, recentLocalDays } from '../src/lib/clock'

export default function Progress() {
  const insets = useSafeAreaInsets()
  const phrases = useApp((s) => s.phrases)
  const practiceDays = useApp((s) => s.practiceDays)
  const showToast = useApp((s) => s.showToast)

  const summary = useProgressSummary(phrases, practiceDays)

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[screenStyles.scroll, { paddingBottom: insets.bottom + space['5'] }]}
      >
        <StreakCard streak={summary.streak} week={summary.week} weekSummary={summary.weekSummary} />

        <StatRow
          stats={[
            { value: String(phrases.length), label: copy.progress.stats.phrasesInStream },
            { value: String(summary.totalReps), label: copy.progress.stats.repsDone },
            { value: String(summary.mastered), label: copy.progress.stats.mastered },
          ]}
        />

        <MasteryBar mastery={summary.mastery} total={summary.total} collected={phrases.length} />

        <TrickyRollup
          rows={summary.tricky}
          onDrill={(row) => {
            showToast(copy.toast.drilling(row.count, row.label))
            router.push('/practice/refrain')
          }}
        />

        <MilestoneList phrases={phrases} mastered={summary.mastered} />
      </ScrollView>
    </Screen>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// The rollups
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Everything this screen shows, derived from the practice history and the phrase list.
 * Nothing here is stored: the streak, the week, the histogram and the tag counts are all
 * recomputed on render, so there is no second copy of them to fall out of date.
 *
 * A pure function of its two inputs — the store reads stay in the screen.
 */
function useProgressSummary(phrases: readonly PhraseState[], practiceDays: readonly string[]) {
  /**
   * Derived from the practice history, never stored. The same function `core-rs` exposes
   * to the widget, so the two show the same number (ADR-0002).
   */
  const streak = useMemo(() => streakOf(practiceDays, deviceClock.streakDay()), [practiceDays])

  const week = useMemo(() => {
    const practised = new Set(practiceDays)
    return recentLocalDays(7).map((d) => ({ ...d, practised: practised.has(d.day) }))
  }, [practiceDays])

  const weekSummary = useMemo(() => {
    const count = week.filter((d) => d.practised).length
    // Stated as what happened, with no comparison to what could have happened.
    return copy.a11y.progress.weekSummary(count)
  }, [week])

  /**
   * The mastery histogram.
   *
   * `useMastery()` in the store computes the same four counts, and this deliberately does
   * NOT call it: the two build their shape differently (this one carries `masteryMeta`'s
   * label and colour through, so the legend, the bar and the chart summary all read one
   * array). Real duplication, flagged rather than half-fixed — unifying them is a store
   * change, not a screen one.
   */
  const mastery = useMemo(() => {
    const counts: Record<string, number> = { new: 0, learning: 0, strong: 0, mastered: 0 }
    for (const p of phrases) counts[masteryBucket(p)] = (counts[masteryBucket(p)] ?? 0) + 1
    return masteryMeta.map((m) => ({ ...m, count: counts[m.key] ?? 0 }))
  }, [phrases])

  const total = Math.max(1, phrases.length)

  const tricky = useMemo(() => {
    const rows = (Object.keys(tagMeta) as Tag[])
      .map((t) => ({
        tag: t,
        ...tagMeta[t],
        count: phrases.filter((p) => p.tags.includes(t)).length,
      }))
      .filter((r) => r.count > 0)
    const max = Math.max(1, ...rows.map((r) => r.count))
    return rows.map((r) => ({ ...r, pct: r.count / max }))
  }, [phrases])

  const totalReps = phrases.reduce((n, p) => n + p.reps, 0)

  return {
    streak,
    week,
    weekSummary,
    mastery,
    total,
    /** The fourth bucket. Read once here, shown as a stat and as a milestone. */
    mastered: mastery[3]?.count ?? 0,
    tricky,
    totalReps,
  }
}

type Summary = ReturnType<typeof useProgressSummary>

// ─────────────────────────────────────────────────────────────────────────────
// The cards
// ─────────────────────────────────────────────────────────────────────────────

/** The streak: warm and central, never punitive — and the last seven real days under it. */
function StreakCard({
  streak,
  week,
  weekSummary,
}: {
  streak: number
  week: Summary['week']
  weekSummary: string
}) {
  return (
    <DarkCard>
      <Row justify="space-between" align="flex-end">
        <View>
          <Text variant="labelSm" color={onDark.muted}>
            {copy.progress.streak.label}
          </Text>
          <Row gap={space['2']} align="baseline" style={streakStyles.value}>
            <Text variant="hero" color={onDark.primary}>
              {/* No streak yet reads as an absence, not a zero. Nothing here
                  apologises for a day that has not happened. */}
              {streak === 0 ? copy.common.noValue : streak}
            </Text>
            <Text variant="body" color={onDark.tertiary}>
              {streak === 0 ? copy.progress.streak.empty : copy.progress.streak.days(streak)}
            </Text>
          </Row>
        </View>
      </Row>
      {/* The last seven REAL days, filled from the practice history. This used to be
          `i < streak`: a bar chart pretending to be a calendar, which drew a
          seven-day streak for a learner who had practised once. */}
      {/* One accessible group: seven separate cells would be read as seven
          meaningless letters. */}
      <View accessible accessibilityLabel={weekSummary} style={streakStyles.week}>
        <Row gap={space['1.5']}>
          {week.map((d) => (
            <View key={d.day} style={streakStyles.day}>
              <View
                style={[
                  streakStyles.dayBar,
                  // An unpractised day is neutral: no red, no dash, no penalty.
                  { backgroundColor: d.practised ? accent.accent : onDark.surface },
                ]}
              >
                <Text variant="captionSm">{d.practised ? copy.common.flame : ''}</Text>
              </View>
              <Text variant="labelSm" color={onDark.muted}>
                {d.initial}
              </Text>
            </View>
          ))}
        </Row>
      </View>
    </DarkCard>
  )
}

/** Phrase mastery: one stacked bar, its legend, and the summary that must sit beside it. */
function MasteryBar({
  mastery,
  total,
  collected,
}: {
  mastery: Summary['mastery']
  total: number
  collected: number
}) {
  return (
    <Card>
      <CardHeader
        title={copy.progress.mastery.title}
        meta={copy.progress.mastery.total(collected)}
        metaVariant="captionSm"
      />

      <View style={masteryStyles.bar}>
        {mastery.map((m) =>
          m.count > 0 ? (
            <View key={m.key} style={{ flex: m.count / total, backgroundColor: m.color }} />
          ) : null,
        )}
      </View>

      <Grid gap={space['3.5']} style={masteryStyles.legend}>
        {mastery.map((m) => (
          <Row key={m.key} gap={metrics.legendItem}>
            <Dot size={metrics.legendDot} color={m.color} />
            <Text variant="captionSm" color={ink.ink4}>
              {m.label}
            </Text>
            <Text variant="captionSm" color={ink.ink}>
              {m.count}
            </Text>
          </Row>
        ))}
      </Grid>

      {/* Every chart carries a visible summary — checked in CI. */}
      <ChartSummary>{copy.progress.mastery.chartSummary(mastery)}</ChartSummary>
    </Card>
  )
}

/** The thread closing its loop: the learner's own tags, and a row that drills exactly them. */
function TrickyRollup({
  rows,
  onDrill,
}: {
  rows: Summary['tricky']
  onDrill: (row: Summary['tricky'][number]) => void
}) {
  return (
    <Stack gap={space['2.5']}>
      <SectionLabel>{copy.progress.tricky.title}</SectionLabel>

      {rows.length === 0 ? (
        <Card>
          <Text variant="caption" color={ink.muted}>
            {copy.progress.tricky.empty}
          </Text>
        </Card>
      ) : (
        rows.map((r) => (
          <Pressable
            key={r.tag}
            feedback="row"
            accessibilityLabel={copy.a11y.progress.trickyRow(r.label, r.count)}
            accessibilityHint={copy.a11y.progress.trickyHint}
            onPress={() => {
              onDrill(r)
            }}
            style={trickyStyles.row}
          >
            <Row gap={metrics.trickyRow} style={trickyStyles.head}>
              <Dot size={metrics.trickyDot} color={r.color} />
              <Text variant="caption" color={ink.ink} style={trickyStyles.label}>
                {r.label}
              </Text>
              <Text variant="caption" color={r.color}>
                {r.count}
              </Text>
              <Text variant="body" color={ink.muted2}>
                {copy.common.chevron.right}
              </Text>
            </Row>
            {/*
              This tag's count as a share of the biggest tag's. No `label`, so `ProgressBar`
              hides itself from the accessibility tree — right here, because the row's own
              name already carries the count and a second unnamed bar would read the number
              twice.

              `radius` is passed because these bars shipped fully round: 8 on a 7px bar, where
              every announced bar in the app uses `barRadius` (2). Squaring them to reuse this
              primitive would have changed what a learner sees, so the primitive took a prop
              instead. The only other difference is the CLAMP, and it is unreachable today —
              `pct` is `count / max` over these same rows — so it is a latent-overflow guard.
            */}
            <ProgressBar
              value={r.pct}
              color={r.color}
              height={metrics.trickyBar}
              radius={radius.sm}
              track={surface.sunken}
            />
          </Pressable>
        ))
      )}
    </Stack>
  )
}

/** Milestones. Every one is earned by a signal that cannot go backwards. */
function MilestoneList({
  phrases,
  mastered,
}: {
  phrases: readonly PhraseState[]
  mastered: number
}) {
  const milestone = copy.progress.milestones
  return (
    <Stack gap={space['2.5']}>
      <SectionLabel>{milestone.title}</SectionLabel>

      <MilestoneRow
        emoji={milestone.first10.emoji}
        title={milestone.first10.title}
        sub={milestone.first10.sub(phrases.length)}
        done={phrases.length >= 10}
      />
      <MilestoneRow
        emoji={milestone.firstTag.emoji}
        title={milestone.firstTag.title}
        sub={milestone.firstTag.sub}
        done={phrases.some((p) => p.tags.length > 0)}
      />
      <MilestoneRow
        emoji={milestone.firstLockIn.emoji}
        title={milestone.firstLockIn.title}
        sub={milestone.firstLockIn.sub}
        // `lockInDays` counts DISTINCT lock-in days and never decreases, which is
        // what a milestone needs. `automaticity` is today's signal: it is rewritten
        // downward by tomorrow's first rep, so this milestone used to un-earn itself
        // overnight — a learner watching an achievement they had disappear.
        done={phrases.some((p) => p.lockInDays > 0)}
      />
      <MilestoneRow
        emoji={milestone.mastered25.emoji}
        title={milestone.mastered25.title}
        sub={milestone.mastered25.sub(mastered)}
        done={mastered >= 25}
      />
    </Stack>
  )
}

function MilestoneRow({
  emoji,
  title,
  sub,
  done,
}: {
  emoji: string
  title: string
  sub: string
  done: boolean
}) {
  return (
    <Row
      gap={space['3']}
      style={[milestoneStyles.row, { backgroundColor: done ? surface.card : surface.sunken }]}
    >
      {/*
        Not `EmojiTile`, though it is the same 38-px square: the tile dims to 0.55 when the
        milestone is unearned, which that primitive has no prop for, and it would also hide
        the emoji from the accessibility tree. Either is a change to what ships.
      */}
      <View
        style={[
          milestoneStyles.tile,
          done ? null : milestoneStyles.tileUnearned,
          { backgroundColor: done ? semantic.success.bg : line.default },
        ]}
      >
        <Text style={milestoneStyles.emoji}>{emoji}</Text>
      </View>
      <View style={milestoneStyles.text}>
        <Text variant="bodySm" color={done ? ink.ink : ink.ink3}>
          {title}
        </Text>
        <Text variant="captionSm" color={ink.muted}>
          {sub}
        </Text>
      </View>
      {done && (
        <Text variant="headline" color={semantic.successAlt.text}>
          {copy.common.marks.check}
        </Text>
      )}
    </Row>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Metrics
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The numbers this screen passes as a PROP — a gap, a dot's diameter — where a `StyleSheet`
 * entry cannot hold them. Each has exactly one call site, which is why none of them is a
 * token: a token used once is not a token (`src/ui/tokens/sizing.ts`).
 */
const metrics = {
  /** Between a legend dot, its label, and its count. */
  legendItem: 7,
  /** The legend swatch. `Dot` rounds it at 5, which is what this legend drew by hand. */
  legendDot: 9,
  /** Between a tricky row's dot, label, count and chevron. */
  trickyRow: 9,
  /** The tag's colour, beside its name. `Dot` rounds it at 4 — again, as drawn. */
  trickyDot: 7,
  /** The tricky row's bar: one pixel taller than `ProgressBar`'s default. */
  trickyBar: 7,
} as const

const screenStyles = StyleSheet.create({
  scroll: { padding: space['4'], gap: space['4'] },
})

const streakStyles = StyleSheet.create({
  value: { marginTop: space['1'] },
  week: { marginTop: space['4'] },
  /** A day: its bar, then its letter. 5 is the blueprint's, and not a `space` step. */
  day: { flex: 1, alignItems: 'center', gap: 5 },
  dayBar: {
    width: '100%',
    height: 30,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
})

const masteryStyles = StyleSheet.create({
  /**
   * The stacked bar.
   *
   * `alignItems: 'center'` is load-bearing and wrong: this was a `<Row gap={0}>`, whose
   * default it is, and the segments declare no height of their own — so they centre at
   * ZERO height and the bar renders as an empty groove, on web and on native alike.
   * Preserved on purpose. Letting the fills stretch changes what is drawn, which this
   * refactor promises not to do (plans/52); the fix is the lead's call, not this file's.
   */
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 12,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: surface.sunken,
  },
  legend: { marginTop: space['3.5'] },
})

const trickyStyles = StyleSheet.create({
  row: {
    backgroundColor: surface.card,
    borderWidth: border.hairline,
    borderColor: line.default,
    borderRadius: radius.lg,
    padding: 13,
  },
  head: { marginBottom: space['2'] },
  /** The label takes the slack, so the count and chevron stay on the right edge. */
  label: { flex: 1 },
})

const milestoneStyles = StyleSheet.create({
  row: {
    borderWidth: border.hairline,
    borderColor: line.default,
    borderRadius: radius.xl,
    padding: space['3'],
  },
  tile: {
    width: 38,
    height: 38,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Dimmed, not greyed out: an unearned milestone is still legible. */
  tileUnearned: { opacity: 0.55 },
  emoji: { fontSize: 18 },
  text: { flex: 1 },
})
