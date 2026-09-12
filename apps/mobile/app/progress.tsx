import { useLocale } from '../src/lib/i18n'
/**
 * Progress — Loro.dc.html:1787–1876, logic 2815–2871.
 *
 * The connective thread: "What's tricky in your stream" rolls up the learner's OWN tags.
 *
 * Nothing on this screen shames a missed day.
 *
 * One rollup hook and five blocks, in the blueprint's order: `StreakCard` → `StatRow` →
 * `MasteryBar` → `TrickyRollup` → `MilestoneList`. Every number they show comes from
 * `useProgressSummary`, so there is one place to read what this screen counts.
 *
 * ── The loop this screen does NOT close yet ──
 * `P4-06` and FS §15 say tapping a tricky row starts a drill of exactly those phrases. It does
 * not exist: `RefrainEngine.plan()` practises today's frozen `refrainSet`, which has no
 * relationship to the tag that was tapped, and no tag-filtered session exists anywhere. The row
 * used to navigate there anyway and toast "Drilling 4 “pronunciation” phrases", which named a
 * consequence that did not happen — the exact thing `copy-and-tone.md` rule 3 exists to prevent.
 * So the rows are a rollup and nothing more until plan 64 §4 lands a genuinely filtered set (with
 * plan 60's tag-scoped selection). Their numbers are real; their tap is not invented.
 */
import { useMemo } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  countMasteryBuckets,
  MASTERY_BUCKETS,
  streak as streakOf,
  TAGS,
  type PhraseState,
} from '@loro/core'
import {
  Card,
  ChartSummary,
  DarkCard,
  Dot,
  Grid,
  ProgressBar,
  Row,
  Screen,
  Stack,
  Text,
} from '../src/ui/primitives'
import { StatRow } from '../src/ui/components'
import { stationeryElevation } from '../src/ui/elevation'
import {
  accent,
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
  useLocale()
  const insets = useSafeAreaInsets()
  const phrases = useApp((s) => s.phrases)
  const practiceDays = useApp((s) => s.practiceDays)

  const summary = useProgressSummary(phrases, practiceDays)
  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[screenStyles.scroll, { paddingBottom: insets.bottom + space['5'] }]}
      >
        <StreakCard
          streak={summary.streak}
          week={summary.week}
          weekSummary={summary.weekSummary}
          totalReps={summary.totalReps}
        />

        <StatRow
          stats={[
            { value: String(phrases.length), label: copy.progress.stats.phrasesInStream },
            { value: String(summary.totalReps), label: copy.progress.stats.repsDone },
            { value: String(summary.mastered), label: copy.progress.stats.mastered },
          ]}
        />

        <MasteryBar mastery={summary.mastery} total={summary.total} collected={phrases.length} />

        <TrickyRollup rows={summary.tricky} />

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
  const nativeLanguage = useApp((state) => state.nativeLanguage)
  const streak = useMemo(() => streakOf(practiceDays, deviceClock.streakDay()), [practiceDays])
  const week = useMemo(() => {
    const practised = new Set(practiceDays)
    return recentLocalDays(7).map((d) => ({ ...d, practised: practised.has(d.day) }))
  }, [practiceDays, nativeLanguage])
  const weekSummary = useMemo(() => {
    const count = week.filter((d) => d.practised).length
    // Stated as what happened, with no comparison to what could have happened.
    return copy.a11y.progress.weekSummary(count)
  }, [week, nativeLanguage])
  /** The canonical counts enriched with the presentation each chart row needs. */
  const mastery = useMemo(() => {
    const counts = countMasteryBuckets(phrases)
    return MASTERY_BUCKETS.map((key) => ({
      key,
      color: masteryMeta[key].color,
      label: copy.mastery[key],
      count: counts[key],
    }))
  }, [phrases, nativeLanguage])
  const total = Math.max(1, phrases.length)
  const tricky = useMemo(() => {
    const rows = TAGS.map((t) => ({
      tag: t,
      ...tagMeta[t],
      label: copy.tags[t],
      count: phrases.filter((p) => p.tags.includes(t)).length,
    })).filter((r) => r.count > 0)
    const max = Math.max(1, ...rows.map((r) => r.count))
    return rows.map((r) => ({ ...r, pct: r.count / max }))
  }, [phrases, nativeLanguage])
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
  totalReps,
}: {
  streak: number
  week: Summary['week']
  weekSummary: string
  totalReps: number
}) {
  useLocale()
  return (
    <DarkCard style={streakStyles.card}>
      <Row justify="space-between" align="flex-start" wrap>
        <View style={{ flex: 1, minWidth: 140 }}>
          <Text variant="labelSm" color={onDark.muted}>
            {copy.progress.streak.label}
          </Text>
          <Row gap={space['2']} align="baseline" wrap style={streakStyles.value}>
            {streak > 0 ? (
              <Text variant="hero" color={onDark.primary}>
                {copy.common.flame}
              </Text>
            ) : null}
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
        <View style={streakStyles.reps}>
          <Text variant="labelSm" color={onDark.muted}>
            {copy.progress.stats.repsDone}
          </Text>
          <Text variant="title2" color={onDark.primary} style={streakStyles.value}>
            {totalReps}
          </Text>
        </View>
      </Row>
      {/* The last seven REAL days, filled from the practice history. This used to be
            `i < streak`: a bar chart pretending to be a calendar, which drew a
            seven-day streak for a learner who had practised once. */}
      {/* One accessible group: seven separate cells would be read as seven
            meaningless letters. */}
      <View accessible accessibilityLabel={weekSummary} style={streakStyles.week}>
        <Row gap={space['1.5']} style={streakStyles.weekLetters}>
          {week.map((d) => (
            <Text
              key={`label-${d.day}`}
              variant="labelSm"
              color={onDark.muted}
              style={streakStyles.dayLetter}
            >
              {d.initial}
            </Text>
          ))}
        </Row>
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
                <Text variant="captionSm" color={onDark.primary}>
                  {d.practised ? copy.common.marks.check : ''}
                </Text>
              </View>
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
  useLocale()
  return (
    <Card>
      <Row justify="space-between" align="baseline" wrap style={masteryStyles.heading}>
        <Text variant="title2" color={ink.ink}>
          {copy.progress.mastery.title}
        </Text>
        <Text variant="captionSm" color={ink.muted}>
          {copy.progress.mastery.total(collected)}
        </Text>
      </Row>

      <View style={masteryStyles.bar}>
        {mastery.map((m) =>
          m.count > 0 ? (
            <View key={m.key} style={{ flex: m.count / total, backgroundColor: m.color }} />
          ) : null,
        )}
      </View>

      <Grid gap={space['2.5']} style={masteryStyles.legend}>
        {mastery.map((m) => (
          <Row key={m.key} gap={metrics.legendItem} style={masteryStyles.legendCell}>
            <Dot size={metrics.legendDot} color={m.color} />
            <View style={masteryStyles.legendCopy}>
              <Text variant="labelSm" color={ink.ink}>
                {m.label}
              </Text>
              <Text variant="captionSm" color={ink.ink2}>
                {copy.progress.mastery.share(
                  m.count,
                  collected === 0 ? 0 : Math.round((m.count / collected) * 100),
                )}
              </Text>
            </View>
          </Row>
        ))}
      </Grid>

      {/* Every chart carries a visible summary — checked in CI. */}
      <ChartSummary>{copy.progress.mastery.chartSummary(mastery)}</ChartSummary>
    </Card>
  )
}

/**
 * The learner's own tags, rolled up.
 *
 * A row is NOT a control. It carries no chevron and no hint, because both are affordances for a
 * tag drill that does not exist — see the note at the top of this file. The row is still one
 * accessible node named "<tag>, N phrases", so the number and what it counts are read together;
 * that is what a rollup owes a screen reader whether or not it is tappable.
 */
function TrickyRollup({ rows }: { rows: Summary['tricky'] }) {
  useLocale()
  return (
    <Card>
      <Stack gap={space['3']}>
        <Text variant="headline" color={ink.ink}>
          {copy.progress.tricky.title}
        </Text>
        {rows.length === 0 ? (
          <Text variant="bodyMd" color={ink.muted}>
            {copy.progress.tricky.empty}
          </Text>
        ) : (
          <Stack gap={space['2.5']}>
            {rows.map((r) => (
              <View
                key={r.tag}
                accessible
                accessibilityLabel={copy.a11y.progress.trickyRow(r.label, r.count)}
                aria-label={copy.a11y.progress.trickyRow(r.label, r.count)}
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
              </View>
            ))}
          </Stack>
        )}
      </Stack>
    </Card>
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
  useLocale()
  const milestone = copy.progress.milestones
  return (
    <Stack gap={space['2.5']}>
      <Text variant="headline" color={ink.ink}>
        {milestone.title}
      </Text>

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
  useLocale()
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
  scroll: { padding: space['5'], gap: space['6'] },
})
const streakStyles = StyleSheet.create({
  card: { padding: space['5'], borderRadius: radius.xl },
  value: { marginTop: space['1'] },
  reps: { alignItems: 'flex-end' },
  week: { marginTop: space['4'] },
  weekLetters: { marginBottom: space['2'] },
  dayLetter: { flex: 1, textAlign: 'center' },
  /** A day: its bar. 5 is the blueprint's, and not a `space` step. */
  day: { flex: 1, alignItems: 'center' },
  dayBar: {
    width: '100%',
    height: 32,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
const masteryStyles = StyleSheet.create({
  /**
   * The stacked bar (`Loro.dc.html:1830–1831`).
   *
   * `alignItems: 'stretch'` is the whole chart. It inherited `'center'` from the
   * `<Row gap={0}>` this used to be, and the segments declare no height of their own — so
   * every one of them centred at ZERO height and the bar drew as an empty groove while the
   * legend beside it counted four buckets. A chart that renders nothing is not a smaller
   * chart, it is a fabricated state: the screen claimed to show a distribution and showed
   * none. The authored segments carry no height either, precisely because they stretch to
   * fill the 12-px track.
   *
   * `render.spec.ts` measures the segments, because no semantic locator can see a zero
   * height — that is how this survived two rounds of E2E.
   */
  bar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    height: 12,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: surface.sunken,
  },
  heading: { marginBottom: space['3'] },
  legend: { marginTop: space['3.5'] },
  legendCell: {
    width: '46%',
    backgroundColor: surface.sunken,
    borderRadius: radius.lg,
    paddingVertical: space['2.5'],
    paddingHorizontal: space['2.5'],
  },
  legendCopy: { flex: 1, minWidth: 0 },
})
const trickyStyles = StyleSheet.create({
  row: {
    backgroundColor: surface.sunken,
    borderRadius: radius.lg,
    padding: space['3'],
  },
  head: { marginBottom: space['2'] },
  /** The label takes the slack, so the count and chevron stay on the right edge. */
  label: { flex: 1 },
})
const milestoneStyles = StyleSheet.create({
  row: {
    backgroundColor: surface.card,
    borderRadius: radius.xl,
    padding: space['4'],
    ...stationeryElevation('card'),
  },
  tile: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Dimmed, not greyed out: an unearned milestone is still legible. */
  tileUnearned: { opacity: 0.55 },
  emoji: { fontSize: 18 },
  text: { flex: 1 },
})
